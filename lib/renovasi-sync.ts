import { prisma } from '@/lib/db';
import { getDriveClient, getDcRenovasiFolderHierarchyId, uploadBufferToFolder } from '@/lib/google-drive';
import { generateRenovasiPdfBuffer, generateFotoLingkunganPdfBuffer } from '@/lib/pdf/renovasi-pdf.service';

export interface SyncRenovasiResult {
  file_url: string;
  drive_file_id: string;
  foto_file_url?: string;
  foto_drive_id?: string;
}

export async function syncRenovasiPdfToDrive(renovasiId: number): Promise<SyncRenovasiResult> {
  const renovasi = await prisma.dc_renovasi.findUnique({
    where: { id: renovasiId },
    include: {
      project: true,
      dokumen: true
    }
  });

  if (!renovasi) {
    throw new Error(`Renovasi #${renovasiId} tidak ditemukan.`);
  }

  const safeNomor = renovasi.nomor_pengajuan.replace(/[\/\\]/g, '-');

  // 1. Siapkan Drive client & folder hierarki 'Dokumen PDF'
  const drive = await getDriveClient();
  const folderId = await getDcRenovasiFolderHierarchyId(
    drive,
    renovasi.cabang || renovasi.project?.cabang || 'UMUM',
    renovasi.project?.kode || 'PROYEK',
    renovasi.project?.nama_proyek || 'RENOVASI',
    renovasi.project?.inisial || null,
    renovasi.nomor_pengajuan,
    'Dokumen PDF'
  );

  // 2. Jika ada foto lingkungan, generate & upload PDF Foto Lingkungan Eksisting terlebih dahulu
  let fotoFileUrl: string | undefined;
  let fotoDriveId: string | undefined;

  const fotoDocs = renovasi.dokumen.filter((d) => d.kategori_file === 'FOTO_LINGKUNGAN');
  if (fotoDocs.length > 0) {
    try {
      console.log(`[SYNC-PDF] Menghasilkan PDF Foto Lingkungan untuk renovasi #${renovasiId} (${fotoDocs.length} foto)...`);
      const fotoPdfBuffer = await generateFotoLingkunganPdfBuffer(renovasiId);
      const fotoFileName = `FOTO_LINGKUNGAN_${safeNomor}.pdf`;

      const uploadedFoto = await uploadBufferToFolder(drive, folderId, fotoPdfBuffer, fotoFileName, 'application/pdf');
      fotoFileUrl = uploadedFoto.webViewLink || `https://drive.google.com/file/d/${uploadedFoto.id}/view`;
      fotoDriveId = uploadedFoto.id!;

      // Upsert record DOKUMEN_FOTO_LINGKUNGAN_PDF
      const existingFotoDoc = await prisma.dc_renovasi_dokumen.findFirst({
        where: {
          renovasi_id: renovasiId,
          kategori_file: 'DOKUMEN_FOTO_LINGKUNGAN_PDF'
        }
      });

      if (existingFotoDoc) {
        await prisma.dc_renovasi_dokumen.update({
          where: { id: existingFotoDoc.id },
          data: {
            nama_file: fotoFileName,
            file_url: fotoFileUrl,
            drive_file_id: fotoDriveId,
            mime_type: 'application/pdf'
          }
        });
      } else {
        await prisma.dc_renovasi_dokumen.create({
          data: {
            renovasi_id: renovasiId,
            kategori_file: 'DOKUMEN_FOTO_LINGKUNGAN_PDF',
            nama_file: fotoFileName,
            nama_label: 'Dokumen Foto Lingkungan Eksisting',
            file_url: fotoFileUrl,
            drive_file_id: fotoDriveId,
            mime_type: 'application/pdf'
          }
        });
      }
      console.log(`[SYNC-PDF] ✓ Berhasil upload PDF Foto Lingkungan: ${fotoFileUrl}`);
    } catch (fotoErr: unknown) {
      console.warn(`[SYNC-PDF] Peringatan: Gagal generate/upload PDF Foto Lingkungan:`, (fotoErr as Error)?.message);
    }
  }

  // 3. Generate buffer PDF RAB/OE (yang akan otomatis memuat tautan doc_foto_pdf_url jika tersedia)
  console.log(`[SYNC-PDF] Menghasilkan PDF RAB/OE untuk renovasi #${renovasiId}...`);
  const rabPdfBuffer = await generateRenovasiPdfBuffer(renovasiId);
  const rabFileName = `RAB_OE_${safeNomor}.pdf`;

  // 4. Upload buffer PDF RAB/OE ke Drive
  const uploadedRab = await uploadBufferToFolder(drive, folderId, rabPdfBuffer, rabFileName, 'application/pdf');
  const rabFileUrl = uploadedRab.webViewLink || `https://drive.google.com/file/d/${uploadedRab.id}/view`;
  const rabDriveId = uploadedRab.id!;

  // 5. Upsert ke dc_renovasi_dokumen untuk RAB/OE PDF
  const existingRabDoc = await prisma.dc_renovasi_dokumen.findFirst({
    where: {
      renovasi_id: renovasiId,
      kategori_file: 'DOKUMEN_RAB_OE_PDF'
    }
  });

  if (existingRabDoc) {
    await prisma.dc_renovasi_dokumen.update({
      where: { id: existingRabDoc.id },
      data: {
        nama_file: rabFileName,
        file_url: rabFileUrl,
        drive_file_id: rabDriveId,
        mime_type: 'application/pdf'
      }
    });
  } else {
    await prisma.dc_renovasi_dokumen.create({
      data: {
        renovasi_id: renovasiId,
        kategori_file: 'DOKUMEN_RAB_OE_PDF',
        nama_file: rabFileName,
        nama_label: 'Dokumen Resmi RAB/OE',
        file_url: rabFileUrl,
        drive_file_id: rabDriveId,
        mime_type: 'application/pdf'
      }
    });
  }
  console.log(`[SYNC-PDF] ✓ Berhasil upload PDF RAB/OE: ${rabFileUrl}`);

  return {
    file_url: rabFileUrl,
    drive_file_id: rabDriveId,
    foto_file_url: fotoFileUrl,
    foto_drive_id: fotoDriveId
  };
}
