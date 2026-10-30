import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { isApprovalAdmin } from '@/lib/permissions';

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
        nama_pt: true,
      },
    });
    const currentUser = dbUser || session;

    const body = await request.json();
    const { status, alasan, vendor_id } = body;

    if (!status || !['HADIR', 'TIDAK_HADIR'].includes(status)) {
      return NextResponse.json(
        { status: 'error', message: 'Status konfirmasi harus HADIR atau TIDAK_HADIR' },
        { status: 400 }
      );
    }

    if (status === 'TIDAK_HADIR' && (!alasan || !alasan.trim())) {
      return NextResponse.json(
        { status: 'error', message: 'Wajib menyertakan alasan jika memilih TIDAK HADIR' },
        { status: 400 }
      );
    }

    const aanwijzing = await prisma.dc_aanwijzing.findUnique({
      where: { id: aanwijzingId },
      include: {
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

    if (aanwijzing.status !== 'MENUNGGU_KONFIRMASI') {
      return NextResponse.json(
        {
          status: 'error',
          message: `Undangan ini sudah tidak dalam tahap konfirmasi (Status: ${aanwijzing.status.replace(/_/g, ' ')})`,
        },
        { status: 400 }
      );
    }

    const now = new Date();
    if (now > new Date(aanwijzing.deadline_konfirmasi)) {
      return NextResponse.json(
        { status: 'error', message: 'Batas waktu konfirmasi 2x24 JAM telah berakhir' },
        { status: 400 }
      );
    }

    // Temukan baris peserta yang sesuai dengan vendor login
    const userRole = (currentUser.role || '').toUpperCase();
    const isAdmin = isApprovalAdmin(userRole);
    const userEmail = (currentUser.email || '').toLowerCase();
    const userPt = ((currentUser.nama_pt || '') as string).toLowerCase();

    let targetPeserta = aanwijzing.peserta.find((p) => {
      if (vendor_id && (isAdmin || p.vendor_id === Number(vendor_id))) {
        return p.vendor_id === Number(vendor_id);
      }
      const pEmail = (p.email || p.vendor?.email || '').toLowerCase();
      const pName = (p.vendor?.nama_perusahaan || '').toLowerCase();
      return (userEmail && pEmail === userEmail) || (userPt && pName.includes(userPt));
    });

    if (!targetPeserta) {
      return NextResponse.json(
        { status: 'error', message: 'Perusahaan Anda tidak terdaftar sebagai peserta pada undangan ini' },
        { status: 403 }
      );
    }

    // Update status respon kontraktor
    await prisma.dc_aanwijzing_vendor.update({
      where: { id: targetPeserta.id },
      data: {
        status_konfirmasi: status,
        respon_at: now,
        alasan_tidak_hadir: status === 'TIDAK_HADIR' ? alasan : null,
      },
    });

    // Ambil data peserta terbaru untuk evaluasi quorum
    const allPeserta = await prisma.dc_aanwijzing_vendor.findMany({
      where: { aanwijzing_id: aanwijzingId },
    });

    const hadirCount = allPeserta.filter((p) => p.status_konfirmasi === 'HADIR').length;
    const pendingCount = allPeserta.filter((p) => p.status_konfirmasi === 'MENUNGGU_RESPON').length;

    let newStatus = aanwijzing.status;
    let auditAction = status === 'HADIR' ? 'KONFIRMASI_HADIR' : 'KONFIRMASI_TIDAK_HADIR';
    let auditNotes = `${targetPeserta.vendor.nama_perusahaan} mengonfirmasi: ${status}${alasan ? ` (Alasan: ${alasan})` : ''}.`;

    // Evaluasi Quorum:
    // Aturan SOP SPARTA:
    // Aanwijzing Lanjut (AANWIJZING_LANJUT) HANYA berlaku jika SELURUH rekanan telah memberikan respon (pendingCount === 0)
    // DAN jumlah rekanan yang konfirmasi hadir minimal 3 (hadirCount >= 3).
    // Jika masih ada rekanan yang belum merespon (pendingCount > 0), status WAJIB TETAP MENUNGGU_KONFIRMASI
    // meskipun jumlah yang hadir saat ini sudah >= 3.
    if (pendingCount === 0) {
      if (hadirCount >= 3) {
        // Semua sudah merespon dan yang hadir >= 3 orang: Otomatis Disetujui Lanjut
        newStatus = 'AANWIJZING_LANJUT';
        auditNotes += ` Seluruh kontraktor telah merespon dan quorum terpenuhi (${hadirCount} kontraktor hadir). Aanwijzing disetujui lanjut.`;
      } else {
        // Semua sudah merespon tapi yang hadir < 3 orang:
        // Sesuai aturan khusus, seluruh proyek (< 1M maupun > 1M) masuk ke antrean approval DC Development Manager
        newStatus = 'MENUNGGU_APPROVAL_DC_MANAGER';
        auditAction = 'ESKALASI_DC_MANAGER';
        auditNotes += ` Semua kontraktor telah merespon, kontraktor hadir (${hadirCount}) kurang dari 3. Berkas dialihkan ke approval DC Building & Development Manager untuk otorisasi lanjut atau ulang.`;
      }
    } else {
      // Masih ada kontraktor yang belum merespon (pendingCount > 0)
      // Status wajib tetap MENUNGGU_KONFIRMASI meskipun saat ini yang hadir sudah >= 3
      newStatus = 'MENUNGGU_KONFIRMASI';
      auditNotes += ` Menunggu respon dari ${pendingCount} rekanan lainnya (rekanan hadir saat ini: ${hadirCount}).`;
    }

    if (newStatus !== aanwijzing.status) {
      await prisma.dc_aanwijzing.update({
        where: { id: aanwijzingId },
        data: { status: newStatus },
      });
    }

    await prisma.dc_aanwijzing_audit_log.create({
      data: {
        aanwijzing_id: aanwijzingId,
        user_email: currentUser.email,
        user_name: (currentUser as any).nama || targetPeserta.vendor.nama_perusahaan,
        user_role: currentUser.role,
        action: auditAction,
        from_status: aanwijzing.status,
        to_status: newStatus,
        notes: auditNotes,
      },
    });

    return NextResponse.json({
      status: 'success',
      message: `Konfirmasi kehadiran (${status}) berhasil disimpan`,
      data: {
        status_konfirmasi: status,
        aanwijzing_status: newStatus,
        hadir_count: hadirCount,
        pending_count: pendingCount,
      },
    });
  } catch (error: any) {
    console.error('Error responding to aanwijzing:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal menyimpan konfirmasi kehadiran' },
      { status: 500 }
    );
  }
}
