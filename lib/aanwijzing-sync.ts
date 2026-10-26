import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/db';
import { getDriveClient, getDcAanwijzingFolderHierarchyId, uploadBufferToFolder } from '@/lib/google-drive';
import { generateUndanganAanwijzingPdf } from '@/lib/pdf/generate-undangan-aanwijzing-pdf';

export interface SyncAanwijzingResult {
  file_url: string;
  drive_file_id?: string;
  local_path?: string;
}

export interface SyncAanwijzingVendorResult {
  file_url: string;
  drive_file_id?: string;
  local_path?: string;
}

/**
 * Menghasilkan PDF Surat Undangan Aanwijzing Internal (memuat semua rekanan),
 * menyimpan file fisik di storage server, mengunggah ke Google Drive, serta memperbarui file_url di dc_aanwijzing.
 * Jika file_url Google Drive sudah ada, langsung kembalikan link yang ada tanpa generate ulang.
 */
export async function syncAanwijzingPdfToDrive(
  aanwijzingId: number,
  forceRegenerate: boolean = false
): Promise<SyncAanwijzingResult> {
  const aanwijzing = await prisma.dc_aanwijzing.findUnique({
    where: { id: aanwijzingId },
    include: {
      project: true,
      renovasi: true,
    },
  });

  if (!aanwijzing) {
    throw new Error(`Data Undangan Aanwijzing #${aanwijzingId} tidak ditemukan.`);
  }

  // Jika sudah tersimpan link Google Drive (http/https) dan tidak forceRegenerate, langsung gunakan yang ada
  if (!forceRegenerate && aanwijzing.file_url && (aanwijzing.file_url.startsWith('http://') || aanwijzing.file_url.startsWith('https://'))) {
    return {
      file_url: aanwijzing.file_url,
      drive_file_id: aanwijzing.drive_file_id || undefined,
    };
  }

  // 1. Generate buffer PDF resmi (Versi Internal: memuat daftar lengkap seluruh rekanan)
  const pdfBuffer = await generateUndanganAanwijzingPdf(aanwijzingId, { tipe: 'INTERNAL' });
  const safeNomor = aanwijzing.nomor_undangan.replace(/[\/\\]/g, '-');
  const cleanFileName = `SURAT_UNDANGAN_AANWIJZING_${safeNomor}.pdf`;

  // 2. Simpan file PDF fisik di folder server public/pdf/aanwijzing/
  let localPath: string | undefined = undefined;
  try {
    const dirPath = path.resolve(process.cwd(), 'public/pdf/aanwijzing');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const fullPath = path.join(dirPath, cleanFileName);
    fs.writeFileSync(fullPath, pdfBuffer);
    localPath = `/pdf/aanwijzing/${cleanFileName}`;
  } catch (fsErr: any) {
    console.warn(`[SYNC-AANWIJZING] Peringatan: Gagal menyimpan berkas lokal PDF #${aanwijzingId}:`, fsErr?.message);
  }

  let fileUrl = localPath || `/api/dc-development/aanwijzing/${aanwijzingId}/pdf`;
  let driveFileId: string | undefined = undefined;

  // 3. Upload / Sinkronisasi ke Google Drive
  try {
    const drive = await getDriveClient();
    const folderId = await getDcAanwijzingFolderHierarchyId(
      drive,
      aanwijzing.cabang || aanwijzing.project?.cabang || 'UMUM',
      aanwijzing.project?.kode || 'PROYEK',
      aanwijzing.project?.nama_proyek || 'AANWIJZING',
      aanwijzing.project?.inisial || null,
      aanwijzing.nomor_undangan
    );

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
    console.warn(`[SYNC-AANWIJZING] Peringatan: Sinkronisasi Google Drive tidak aktif/gagal untuk #${aanwijzingId}:`, (driveErr as Error)?.message);
  }

  // 4. Update data di database sehingga file_url tersimpan permanen di dc_aanwijzing
  await prisma.dc_aanwijzing.update({
    where: { id: aanwijzingId },
    data: {
      file_url: fileUrl,
      drive_file_id: driveFileId || null,
    },
  });

  return {
    file_url: fileUrl,
    drive_file_id: driveFileId,
    local_path: localPath,
  };
}

/**
 * Menghasilkan PDF Surat Undangan Khusus Rekanan (hanya memuat nama rekanan bersangkutan),
 * mengunggah ke Google Drive, dan menyimpan link drive di tabel dc_aanwijzing_vendor.
 * Jika link Google Drive sudah ada, langsung mengembalikan link tersebut tanpa generate ulang.
 */
export async function syncAanwijzingVendorPdfToDrive(
  aanwijzingId: number,
  target: { vendorId?: number; pesertaId?: number },
  forceRegenerate: boolean = false
): Promise<SyncAanwijzingVendorResult> {
  const peserta = await prisma.dc_aanwijzing_vendor.findFirst({
    where: {
      aanwijzing_id: aanwijzingId,
      ...(target.pesertaId ? { id: target.pesertaId } : {}),
      ...(target.vendorId ? { vendor_id: target.vendorId } : {}),
    },
    include: {
      vendor: true,
      aanwijzing: {
        include: {
          project: true,
        },
      },
    },
  });

  if (!peserta) {
    throw new Error(`Data rekanan vendor pada Aanwijzing #${aanwijzingId} tidak ditemukan.`);
  }

  // Jika sudah tersimpan link Google Drive (http/https) dan tidak forceRegenerate, langsung gunakan link yang ada!
  if (!forceRegenerate && peserta.file_url && (peserta.file_url.startsWith('http://') || peserta.file_url.startsWith('https://'))) {
    return {
      file_url: peserta.file_url,
      drive_file_id: peserta.drive_file_id || undefined,
    };
  }

  const aanwijzing = peserta.aanwijzing;
  const safeNomor = aanwijzing.nomor_undangan.replace(/[\/\\]/g, '-');
  const safeVendorName = (peserta.vendor?.nama_perusahaan || 'REKANAN').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanFileName = `SURAT_UNDANGAN_AANWIJZING_${safeNomor}_${safeVendorName}.pdf`;

  // 1. Generate buffer PDF khusus kontraktor ini
  const pdfBuffer = await generateUndanganAanwijzingPdf(aanwijzingId, {
    tipe: 'KONTRAKTOR',
    pesertaId: peserta.id,
    vendorId: peserta.vendor_id,
  });

  // 2. Simpan fisik lokal jika memungkinkan
  let localPath: string | undefined = undefined;
  try {
    const dirPath = path.resolve(process.cwd(), 'public/pdf/aanwijzing');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const fullPath = path.join(dirPath, cleanFileName);
    fs.writeFileSync(fullPath, pdfBuffer);
    localPath = `/pdf/aanwijzing/${cleanFileName}`;
  } catch (fsErr: any) {
    console.warn(`[SYNC-AANWIJZING-VENDOR] Peringatan: Gagal simpan file lokal:`, fsErr?.message);
  }

  let fileUrl = localPath || `/api/dc-development/aanwijzing/${aanwijzingId}/pdf?tipe=kontraktor&vendor_id=${peserta.vendor_id}`;
  let driveFileId: string | undefined = undefined;

  // 3. Upload ke folder Google Drive resmi Aanwijzing
  try {
    const drive = await getDriveClient();
    const folderId = await getDcAanwijzingFolderHierarchyId(
      drive,
      aanwijzing.cabang || aanwijzing.project?.cabang || 'UMUM',
      aanwijzing.project?.kode || 'PROYEK',
      aanwijzing.project?.nama_proyek || 'AANWIJZING',
      aanwijzing.project?.inisial || null,
      aanwijzing.nomor_undangan
    );

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
    console.warn(`[SYNC-AANWIJZING-VENDOR] Peringatan: Sinkronisasi Google Drive gagal:`, (driveErr as Error)?.message);
  }

  // 4. Update data di tabel dc_aanwijzing_vendor sehingga link drive tersimpan permanen
  await prisma.dc_aanwijzing_vendor.update({
    where: { id: peserta.id },
    data: {
      file_url: fileUrl,
      drive_file_id: driveFileId || null,
    },
  });

  return {
    file_url: fileUrl,
    drive_file_id: driveFileId,
    local_path: localPath,
  };
}
