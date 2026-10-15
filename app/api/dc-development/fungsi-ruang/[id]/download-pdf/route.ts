import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';
import { syncFungsiRuangPdfToDrive } from '@/lib/fungsi-ruang-sync';
import { canUserViewFungsiRuangSubmission } from '@/lib/permissions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const submissionId = parseInt(id, 10);
    if (isNaN(submissionId)) {
      return NextResponse.json({ status: 'error', message: 'ID pengajuan tidak valid' }, { status: 400 });
    }

    // 1. Ambil data pengajuan fungsi ruang beserta relasi project dan renovasi
    const submission = await prisma.dc_fungsi_ruang.findUnique({
      where: { id: submissionId },
      include: {
        project: true,
        renovasi: true,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { status: 'error', message: 'Data pengajuan fungsi ruang tidak ditemukan' },
        { status: 404 }
      );
    }

    // 2. Validasi izin akses bertingkat dan coverage cabang
    if (!canUserViewFungsiRuangSubmission(session, submission)) {
      return NextResponse.json(
        { status: 'error', message: 'Akses ditolak: Dokumen pengajuan ini belum mencapai tahapan persetujuan Anda atau berada di luar coverage cabang Anda.' },
        { status: 403 }
      );
    }

    // 3. Jika file_url Google Drive sudah tersimpan di database, kembalikan SECARA INSTAN (0 detik)
    if (submission.file_url) {
      return NextResponse.json({
        status: 'success',
        data: {
          file_url: submission.file_url,
          drive_file_id: submission.drive_file_id,
          nomor_pengajuan: submission.nomor_pengajuan,
        },
      });
    }

    // 4. Fallback (untuk data lama yang belum tersinkron): Generate & upload ke Drive sekarang
    try {
      const syncResult = await syncFungsiRuangPdfToDrive(submissionId);
      return NextResponse.json({
        status: 'success',
        data: {
          file_url: syncResult.file_url,
          drive_file_id: syncResult.drive_file_id,
          nomor_pengajuan: submission.nomor_pengajuan,
        },
      });
    } catch (syncError: unknown) {
      console.warn('[PFR-FALLBACK-SYNC] Gagal sinkronisasi fallback ke Drive:', (syncError as Error)?.message);
      return NextResponse.json({
        status: 'success',
        data: {
          file_url: `/api/dc-development/fungsi-ruang/${submissionId}/pdf`,
          nomor_pengajuan: submission.nomor_pengajuan,
        },
      });
    }
  } catch (error: unknown) {
    console.error('Error on download-pdf route:', error);
    return NextResponse.json(
      { status: 'error', message: (error as Error)?.message || 'Gagal menyiapkan file PDF' },
      { status: 500 }
    );
  }
}
