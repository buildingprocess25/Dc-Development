import { prisma } from '@/lib/db';
import { getDriveClient, getDcFungsiRuangFolderHierarchyId, uploadBufferToFolder } from '@/lib/google-drive';
import { generateFungsiRuangPdfBuffer } from '@/lib/pdf/fungsi-ruang-pdf.service';

export interface SyncFungsiRuangResult {
  file_url: string;
  drive_file_id?: string;
}

/**
 * Menghasilkan PDF terbaru untuk Pengajuan Fungsi Ruang dan mengunggah/meng-update
 * file di Google Drive hierarki folder proyek, lalu menyimpan file_url di database.
 */
export async function syncFungsiRuangPdfToDrive(submissionId: number): Promise<SyncFungsiRuangResult> {
  const submission = await prisma.dc_fungsi_ruang.findUnique({
    where: { id: submissionId },
    include: {
      project: true,
      renovasi: true,
    },
  });

  if (!submission) {
    throw new Error(`Data pengajuan fungsi ruang #${submissionId} tidak ditemukan.`);
  }

  // 1. Generate buffer PDF terbaru via Puppeteer & Nunjucks
  const pdfBuffer = await generateFungsiRuangPdfBuffer(submissionId);
  const safeNomor = submission.nomor_pengajuan.replace(/[\/\\]/g, '-');
  const cabang = (submission.project?.cabang || submission.renovasi?.cabang || 'UMUM').toUpperCase();

  let fileUrl = `/api/dc-development/fungsi-ruang/${submissionId}/pdf`;
  let driveFileId: string | undefined = undefined;

  // 2. Upload / Update file di Google Drive
  try {
    const drive = await getDriveClient();
    const folderId = await getDcFungsiRuangFolderHierarchyId(
      drive,
      cabang,
      submission.project?.kode || 'PROYEK',
      submission.project?.nama_proyek || 'PFR',
      submission.project?.inisial || null,
      submission.nomor_pengajuan
    );

    const cleanFileName = `FORM_PERUBAHAN_FUNGSI_RUANG_${safeNomor}.pdf`;
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
    console.warn(`[SYNC-PFR] Peringatan: Gagal sinkronisasi Google Drive untuk #${submissionId}:`, (driveErr as Error)?.message);
  }

  // 3. Simpan URL di database jika berhasil sinkronisasi Drive (atau jika belum ada URL sama sekali)
  if (driveFileId || !submission.file_url) {
    await prisma.dc_fungsi_ruang.update({
      where: { id: submissionId },
      data: {
        file_url: fileUrl,
        drive_file_id: driveFileId,
      },
    });
  }

  return { file_url: fileUrl, drive_file_id: driveFileId };
}
