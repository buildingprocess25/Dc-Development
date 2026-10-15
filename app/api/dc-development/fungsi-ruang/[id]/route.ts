import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';
import { isApprovalAdmin, isSameCreator, canManageFungsiRuang, canUserViewFungsiRuangSubmission } from '@/lib/permissions';
import { sanitizeFungsiRuangInput } from '@/lib/fungsi-ruang/utils';
import { syncFungsiRuangPdfToDrive } from '@/lib/fungsi-ruang-sync';
import { getDriveClient } from '@/lib/google-drive';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Sesi login tidak valid' }, { status: 401 });
    }

    const { id } = await params;
    const submissionId = parseInt(id, 10);
    if (isNaN(submissionId)) {
      return NextResponse.json({ status: 'error', message: 'ID pengajuan tidak valid' }, { status: 400 });
    }

    const submission = await prisma.dc_fungsi_ruang.findUnique({
      where: { id: submissionId },
      include: {
        project: true,
        renovasi: true,
      },
    });

    if (!submission) {
      return NextResponse.json({ status: 'error', message: 'Data pengajuan fungsi ruang tidak ditemukan' }, { status: 404 });
    }

    // Ambil data user terkini dari dc_users untuk coverage cabang & role yang up-to-date
    const dbUser = await prisma.dc_users.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        cabang: true,
        role: true,
        coverage_cabang: true,
      },
    });

    if (!canUserViewFungsiRuangSubmission(dbUser || session, submission)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Akses ditolak: Dokumen pengajuan ini belum mencapai tahapan persetujuan Anda atau sedang dalam perbaikan (REVISI).',
        },
        { status: 403 }
      );
    }

    // Ambil riwayat audit log untuk melihat jejak approval dan catatan revisi
    const auditLogs = await prisma.app_audit_log.findMany({
      where: {
        entitas: 'dc_fungsi_ruang',
        entitas_id: String(submissionId),
      },
      orderBy: { created_at: 'asc' },
    });

    return NextResponse.json({
      status: 'success',
      data: {
        ...submission,
        audit_logs: auditLogs,
      },
    });
  } catch (error: any) {
    console.error('Error fetching detail fungsi ruang:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal mengambil detail pengajuan fungsi ruang' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Sesi login tidak valid' }, { status: 401 });
    }

    const { id } = await params;
    const submissionId = parseInt(id, 10);
    if (isNaN(submissionId)) {
      return NextResponse.json({ status: 'error', message: 'ID pengajuan tidak valid' }, { status: 400 });
    }

    const existing = await prisma.dc_fungsi_ruang.findUnique({
      where: { id: submissionId },
      include: { project: true },
    });

    if (!existing) {
      return NextResponse.json({ status: 'error', message: 'Data pengajuan tidak ditemukan' }, { status: 404 });
    }

    // Pengajuan hanya boleh dihapus jika berstatus REVISI (saat proses approval berjalan atau approved tidak bisa dihapus)
    if (existing.status !== 'REVISI') {
      return NextResponse.json(
        {
          status: 'error',
          message: `Pengajuan ${existing.nomor_pengajuan} sedang dalam tahap "${existing.status}" dan tidak dapat dihapus. Dokumen hanya dapat dihapus saat berstatus REVISI.`,
        },
        { status: 400 }
      );
    }

    const isAdmin = isApprovalAdmin(session.role);
    const isMaker = (canManageFungsiRuang(session.role) && isSameCreator(session, existing.created_by)) || isSameCreator(session, existing.created_by);

    if (!isAdmin && !isMaker) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Akses ditolak: Hanya Branch Building & Maintenance Manager (pembuat pengajuan) atau Administrator yang berhak menghapus data ini.',
        },
        { status: 403 }
      );
    }

    // Hapus file di Google Drive jika ada
    if (existing.drive_file_id) {
      try {
        const drive = await getDriveClient();
        await drive.files.delete({
          fileId: existing.drive_file_id,
          supportsAllDrives: true,
        });
      } catch (driveErr) {
        console.warn(`[DELETE-PFR] Peringatan: Gagal menghapus file drive ${existing.drive_file_id}:`, driveErr);
      }
    }

    await prisma.dc_fungsi_ruang.delete({
      where: { id: submissionId },
    });

    await prisma.app_audit_log.create({
      data: {
        user_email: session.email || 'SYSTEM',
        modul: 'FUNGSI_RUANG_DC',
        entitas: 'dc_fungsi_ruang',
        entitas_id: String(submissionId),
        aksi: 'DELETE_SUBMISSION',
        data_lama: {
          nomor_pengajuan: existing.nomor_pengajuan,
          nama_pemohon: existing.nama_pemohon,
        },
      },
    });

    return NextResponse.json({
      status: 'success',
      message: `Pengajuan ${existing.nomor_pengajuan} berhasil dihapus.`,
    });
  } catch (error: any) {
    console.error('Error deleting fungsi ruang submission:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal menghapus pengajuan fungsi ruang' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Sesi login tidak valid' }, { status: 401 });
    }

    const { id } = await params;
    const submissionId = parseInt(id, 10);
    if (isNaN(submissionId)) {
      return NextResponse.json({ status: 'error', message: 'ID pengajuan tidak valid' }, { status: 400 });
    }

    const existing = await prisma.dc_fungsi_ruang.findUnique({
      where: { id: submissionId },
      include: { project: true },
    });

    if (!existing) {
      return NextResponse.json({ status: 'error', message: 'Data pengajuan tidak ditemukan' }, { status: 404 });
    }

    // Hanya pengajuan berstatus REVISI yang dapat diedit untuk diajukan ulang
    if (existing.status !== 'REVISI') {
      return NextResponse.json(
        { status: 'error', message: `Pengajuan ini berstatus "${existing.status}" dan tidak dalam status REVISI.` },
        { status: 400 }
      );
    }

    const isAdmin = isApprovalAdmin(session.role);
    const isMaker = (canManageFungsiRuang(session.role) && isSameCreator(session, existing.created_by)) || isSameCreator(session, existing.created_by);

    if (!isAdmin && !isMaker) {
      return NextResponse.json(
        { status: 'error', message: 'Akses ditolak: Hanya Branch B&M Manager pembuat atau Admin yang dapat mengedit pengajuan ini.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      nama_pemohon,
      email_pemohon,
      jabatan,
      divisi,
      departemen,
      jenis_pengajuan,
      alasan_pengajuan,
    } = body;

    const sanitized = sanitizeFungsiRuangInput({
      nama_pemohon,
      email_pemohon,
      jabatan,
      divisi,
      departemen,
      jenis_pengajuan,
      alasan_pengajuan,
    });

    // Validasi bahwa pengajuan revisi wajib mengubah minimal satu data/rincian pengajuan
    const isUnchanged =
      existing.nama_pemohon.trim() === sanitized.nama_pemohon.trim() &&
      existing.email_pemohon.trim().toLowerCase() === sanitized.email_pemohon.trim().toLowerCase() &&
      existing.jabatan.trim() === sanitized.jabatan.trim() &&
      existing.divisi.trim() === sanitized.divisi.trim() &&
      existing.departemen.trim() === sanitized.departemen.trim() &&
      existing.jenis_pengajuan.trim() === sanitized.jenis_pengajuan.trim() &&
      existing.alasan_pengajuan.trim() === sanitized.alasan_pengajuan.trim();

    if (isUnchanged) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Pengajuan revisi wajib mengubah minimal satu data atau rincian pengajuan sebelum dapat diajukan ulang.',
        },
        { status: 400 }
      );
    }

    // Update pengajuan dan kembalikan statusnya ke awal antrean approval: "MENUNGGU APPROVAL BM/DBM"
    const updated = await prisma.dc_fungsi_ruang.update({
      where: { id: submissionId },
      data: {
        nama_pemohon: sanitized.nama_pemohon,
        email_pemohon: sanitized.email_pemohon,
        jabatan: sanitized.jabatan,
        divisi: sanitized.divisi,
        departemen: sanitized.departemen,
        jenis_pengajuan: sanitized.jenis_pengajuan,
        alasan_pengajuan: sanitized.alasan_pengajuan,
        status: 'MENUNGGU APPROVAL BM/DBM',
      },
      include: {
        project: true,
        renovasi: true,
      },
    });

    // Catat riwayat resubmit ke app_audit_log
    await prisma.app_audit_log.create({
      data: {
        user_email: session.email || 'SYSTEM',
        modul: 'FUNGSI_RUANG_DC',
        entitas: 'dc_fungsi_ruang',
        entitas_id: String(submissionId),
        aksi: 'RESUBMIT_REVISI',
        data_lama: { status: 'REVISI' },
        data_baru: {
          status: 'MENUNGGU APPROVAL BM/DBM',
          action_by_name: (session as any).nama || (session as any).namaLengkap || (session as any).name || session.email,
          action_by_role: session.role,
        },
      },
    });

    // Otomatis perbarui PDF di Google Drive di latar belakang setelah revisi diajukan ulang
    syncFungsiRuangPdfToDrive(submissionId).catch((syncErr: unknown) => {
      console.warn('[PFR-RESUBMIT-SYNC] Sinkronisasi PDF ke Drive gagal:', (syncErr as Error)?.message);
    });

    return NextResponse.json({
      status: 'success',
      message: `Pengajuan ${existing.nomor_pengajuan} berhasil diperbaiki dan diajukan ulang ke antrean approval.`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating fungsi ruang submission:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal memperbarui pengajuan fungsi ruang' },
      { status: 500 }
    );
  }
}

