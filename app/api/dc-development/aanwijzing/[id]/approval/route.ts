import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canUserApproveAanwijzing } from '@/lib/permissions';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { status: 'error', message: 'Sesi login tidak valid' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const aanwijzingId = parseInt(id, 10);
    if (isNaN(aanwijzingId)) {
      return NextResponse.json(
        { status: 'error', message: 'ID Undangan tidak valid' },
        { status: 400 }
      );
    }

    const dbUser = await prisma.dc_users.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        role: true,
        cabang: true,
        nama: true,
        coverage_cabang: true,
      },
    });
    const currentUser = dbUser || session;

    const aanwijzing = await prisma.dc_aanwijzing.findUnique({
      where: { id: aanwijzingId },
      include: {
        project: true,
        peserta: {
          include: { vendor: true },
        },
      },
    });

    if (!aanwijzing) {
      return NextResponse.json(
        { status: 'error', message: 'Data Undangan Aanwijzing tidak ditemukan' },
        { status: 404 }
      );
    }

    // Validasi izin approval DC Building & Development Manager
    if (!canUserApproveAanwijzing(currentUser, aanwijzing)) {
      return NextResponse.json(
        {
          status: 'error',
          message:
            'Akses ditolak: Hanya DC Building & Development Manager (atau Admin) yang berhak memberikan persetujuan ini.',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, notes } = body; // action: "LANJUT" | "ON_HOLD" | "TIDAK_LANJUT"

    const isLanjut = action === 'LANJUT';
    const isTolak = action === 'ON_HOLD' || action === 'TIDAK_LANJUT' || action === 'TOLAK';

    if (!isLanjut && !isTolak) {
      return NextResponse.json(
        { status: 'error', message: 'Aksi persetujuan harus LANJUT atau TOLAK / ON_HOLD' },
        { status: 400 }
      );
    }

    if (isTolak && (!notes || !notes.trim())) {
      return NextResponse.json(
        { status: 'error', message: 'Wajib memberikan catatan alasan jika memutuskan Tidak Lanjut / Tolak' },
        { status: 400 }
      );
    }

    // Tentukan status baru sesuai aturan SOP:
    // Jika LANJUT:
    // - Jika sesi hari-H sudah dilaksanakan -> AANWIJZING_SELESAI (lanjut ke proses selanjutnya)
    // - Jika masih pra-rapat -> AANWIJZING_LANJUT
    // Jika TOLAK / TIDAK LANJUT:
    // - Jika kategori_nilai === "DI_BAWAH_1M" -> AANWIJZING_ULANG (Undangan Aanwijzing Ulang)
    // - Jika kategori_nilai === "DI_ATAS_1M" -> TENDER_ULANG (Pengajuan Proposal Tender Ulang)
    const isAbove1M = aanwijzing.kategori_nilai === 'DI_ATAS_1M';
    const hasStartedAbsen = Boolean(aanwijzing.session_absen_started_at);

    let newStatus: string;
    let auditAction: string;
    let auditNotes: string;
    let responseMessage: string;

    if (isLanjut) {
      newStatus = hasStartedAbsen ? 'AANWIJZING_SELESAI' : 'AANWIJZING_LANJUT';
      auditAction = 'APPROVAL_DC_MANAGER_LANJUT';
      auditNotes = notes?.trim()
        ? `Aanwijzing disetujui tetap dilanjutkan oleh DC Manager. Catatan: ${notes.trim()}`
        : 'Aanwijzing disetujui tetap dilanjutkan oleh DC Manager dengan rekanan yang hadir.';
      responseMessage = 'Undangan Aanwijzing berhasil disetujui untuk tetap dilanjutkan ke proses selanjutnya.';
    } else {
      if (isAbove1M) {
        newStatus = 'TENDER_ULANG';
        auditAction = 'APPROVAL_DC_MANAGER_TENDER_ULANG';
        auditNotes = notes?.trim()
          ? `Keputusan DC Manager: Tidak lanjut (rekanan hadir < 3). Proyek > 1M dialihkan ke Pengajuan Proposal Tender Ulang. Alasan: ${notes.trim()}`
          : 'Keputusan DC Manager: Tidak lanjut. Proyek > 1M dialihkan ke Pengajuan Proposal Tender Ulang.';
        responseMessage = 'Aanwijzing diputuskan tidak lanjut. Sesuai SOP proyek > 1M, berkas dialihkan ke Pengajuan Proposal Tender Ulang.';
      } else {
        newStatus = 'AANWIJZING_ULANG';
        auditAction = 'APPROVAL_DC_MANAGER_AANWIJZING_ULANG';
        auditNotes = notes?.trim()
          ? `Keputusan DC Manager: Tidak lanjut (rekanan hadir < 3). Proyek < 1M dialihkan ke Undangan Aanwijzing Ulang. Alasan: ${notes.trim()}`
          : 'Keputusan DC Manager: Tidak lanjut. Proyek < 1M dialihkan ke Undangan Aanwijzing Ulang.';
        responseMessage = 'Aanwijzing diputuskan tidak lanjut. Sesuai SOP proyek < 1M, berkas dialihkan ke Undangan Aanwijzing Ulang.';
      }
    }

    const updatedAanwijzing = await prisma.$transaction(async (tx) => {
      // 1. Update status Aanwijzing & matikan sesi aktif jika ada
      const updated = await tx.dc_aanwijzing.update({
        where: { id: aanwijzingId },
        data: {
          status: newStatus,
          session_absen_active: false,
        },
        include: {
          project: true,
          peserta: {
            include: { vendor: true },
          },
        },
      });

      // 2. Buat audit log di Aanwijzing
      await tx.dc_aanwijzing_audit_log.create({
        data: {
          aanwijzing_id: aanwijzingId,
          user_email: currentUser.email,
          user_name: (currentUser as any).nama || currentUser.email,
          user_role: currentUser.role,
          action: auditAction,
          from_status: aanwijzing.status,
          to_status: newStatus,
          notes: auditNotes,
        },
      });

      // 3. Jika proyek > 1M dan ditolak, kembalikan status Tender ke DITOLAK agar bisa diajukan proposal tender ulang
      if (!isLanjut && isAbove1M && aanwijzing.tender_id) {
        await tx.dc_tender.update({
          where: { id: aanwijzing.tender_id },
          data: {
            status: 'DITOLAK',
          },
        });

        await tx.dc_tender_audit_log.create({
          data: {
            tender_id: aanwijzing.tender_id,
            user_email: currentUser.email,
            user_name: (currentUser as any).nama || currentUser.email,
            user_role: currentUser.role,
            action: 'AANWIJZING_TENDER_ULANG',
            from_status: 'APPROVED',
            to_status: 'DITOLAK',
            notes: `Aanwijzing (${aanwijzing.nomor_undangan}) tidak memenuhi quorum (< 3 rekanan) dan DC Building & Development Manager memutuskan pengajuan proposal tender ulang. Catatan: ${notes?.trim() || '-'}`,
          },
        });
      }

      return updated;
    }, { maxWait: 10000, timeout: 30000 });

    return NextResponse.json({
      status: 'success',
      message: responseMessage,
      data: updatedAanwijzing,
    });
  } catch (error: any) {
    console.error('Error approving aanwijzing:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal memproses keputusan approval' },
      { status: 500 }
    );
  }
}
