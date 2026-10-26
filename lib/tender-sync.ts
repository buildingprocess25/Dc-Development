import { prisma } from '@/lib/db';
import { getDriveClient, getDcTenderFolderHierarchyId, uploadBufferToFolder } from '@/lib/google-drive';
import { generateTenderPdfBuffer } from '@/lib/pdf/tender-pdf.service';

export interface SyncTenderResult {
  file_url: string;
  drive_file_id?: string;
}

/**
 * Menghasilkan PDF terbaru untuk Pengajuan Proposal Tender dan mengunggah/meng-update
 * file di Google Drive hierarki folder proyek, lalu menyimpan file_url di database.
 */
export async function syncTenderPdfToDrive(tenderId: number): Promise<SyncTenderResult> {
  const tender = await prisma.dc_tender.findUnique({
    where: { id: tenderId },
    include: {
      project: true,
      renovasi: true,
      fungsi_ruang: true,
    },
  });

  if (!tender) {
    throw new Error(`Data Pengajuan Proposal Tender #${tenderId} tidak ditemukan.`);
  }

  // 1. Generate buffer PDF terbaru via Puppeteer & Nunjucks
  const pdfBuffer = await generateTenderPdfBuffer(tenderId);
  const safeNomor = tender.nomor_tender.replace(/[\/\\]/g, '-');
  const cabang = (tender.cabang || tender.project?.cabang || 'UMUM').toUpperCase();

  let fileUrl = `/api/dc-development/tender/${tenderId}/pdf`;
  let driveFileId: string | undefined = undefined;

  // 2. Upload / Update file di Google Drive
  try {
    const drive = await getDriveClient();
    const folderId = await getDcTenderFolderHierarchyId(
      drive,
      cabang,
      tender.project?.kode || 'PROYEK',
      tender.project?.nama_proyek || 'TENDER',
      tender.project?.inisial || null,
      tender.nomor_tender
    );

    const cleanFileName = `PROPOSAL_PESERTA_TENDER_${safeNomor}.pdf`;
    const uploaded = await uploadBufferToFolder(
      drive,
      folderId,
      pdfBuffer,
      cleanFileName,
      'application/pdf'
    );

    if (uploaded?.webViewLink || uploaded?.id) {
      fileUrl = uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
      driveFileId = uploaded.id || undefined;
    }
  } catch (driveErr: unknown) {
    console.warn(`[SYNC-TENDER] Peringatan: Gagal sinkronisasi Google Drive untuk #${tenderId}:`, (driveErr as Error)?.message);
  }

  // 3. Simpan URL di database jika berhasil sinkronisasi Drive (atau jika belum ada URL sama sekali)
  if (driveFileId || !tender.file_url) {
    await prisma.dc_tender.update({
      where: { id: tenderId },
      data: {
        file_url: fileUrl,
        drive_file_id: driveFileId,
      },
    });
  }

  return { file_url: fileUrl, drive_file_id: driveFileId };
}
