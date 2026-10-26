import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';
import { isApprovalAdmin, isSameCreator, canManageFungsiRuang, canUserViewFungsiRuangSubmission } from '@/lib/permissions';
import { sanitizeFungsiRuangInput } from '@/lib/fungsi-ruang/utils';
import { syncFungsiRuangPdfToDrive } from '@/lib/fungsi-ruang-sync';
import { getDriveClient } from '@/lib/google-drive';
import { findDepartmentApprovers } from '@/lib/department-roles';

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
        pemohon: true,
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

    let enrichedPemohon: any = submission.pemohon;
    if (submission.pemohon) {
      const allUsers = await prisma.dc_users.findMany({
        select: { email: true, nama: true, role: true },
      });
      const { gm, director } = findDepartmentApprovers(
        allUsers,
        submission.pemohon.departemen,
        submission.pemohon.divisi
      );
      enrichedPemohon = {
        ...submission.pemohon,
        gm_nama: gm?.nama || null,
        gm_email: gm?.email || null,
        gm_role: gm?.role || null,
        direktur_nama: director?.nama || null,
        direktur_email: director?.email || null,
        direktur_role: director?.role || null,
      };
    }

    return NextResponse.json({
      status: 'success',
      data: {
        ...submission,
        pemohon: enrichedPemohon,
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
          pemohon_id: existing.pemohon_id,
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
      include: { project: true, pemohon: true },
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
      pemohon_id,
      jenis_pengajuan,
      alasan_pengajuan,
    } = body;

    const newPemohonId = pemohon_id ? parseInt(String(pemohon_id), 10) : existing.pemohon_id;
    const cleanJenis = (jenis_pengajuan || existing.jenis_pengajuan).trim();
    const cleanAlasan = (alasan_pengajuan || existing.alasan_pengajuan).trim();

    // Validasi bahwa pengajuan revisi wajib mengubah minimal satu data/rincian pengajuan
    const isUnchanged =
      existing.pemohon_id === newPemohonId &&
      existing.jenis_pengajuan.trim() === cleanJenis &&
      existing.alasan_pengajuan.trim() === cleanAlasan;

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
        pemohon_id: newPemohonId,
        jenis_pengajuan: cleanJenis,
        alasan_pengajuan: cleanAlasan,
        status: 'MENUNGGU APPROVAL BM/DBM',
      },
      include: {
        pemohon: true,
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

