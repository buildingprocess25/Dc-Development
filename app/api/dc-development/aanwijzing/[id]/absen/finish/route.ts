import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canOpenAanwijzingAbsenSession } from '@/lib/permissions';

/**
 * POST /api/dc-development/aanwijzing/[id]/absen/finish
 * Menyimpan dan menyelesaikan sesi absensi Hari-H Aanwijzing oleh BBK / Admin
 * 
 * Aturan SOP SPARTA:
 * 1. Seluruh peserta yang berhak (eligible) wajib sudah berstatus definite (HADIR_AKTUAL atau TIDAK_HADIR).
 * 2. Evaluasi Quorum Kehadiran:
 *    - Jika Hadir Aktual >= 3: Sesi selesai dan lanjut ke proses selanjutnya (status: AANWIJZING_SELESAI).
 *    - Jika Hadir Aktual < 3: Sesi ditutup dan berkas dialihkan ke DC Building & Development Manager
 *      untuk persetujuan apakah aanwijzing dapat dilanjutkan atau tidak (status: MENUNGGU_APPROVAL_DC_MANAGER).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const aanwijzingId = parseInt(id, 10);
    if (isNaN(aanwijzingId)) {
      return NextResponse.json({ status: 'error', message: 'ID Aanwijzing tidak valid' }, { status: 400 });
    }

    const aanwijzing = await prisma.dc_aanwijzing.findUnique({
      where: { id: aanwijzingId },
      include: {
        project: true,
        peserta: {
          include: {
            vendor: true,
          },
        },
      },
    });

    if (!aanwijzing) {
      return NextResponse.json(
        { status: 'error', message: 'Data Aanwijzing tidak ditemukan' },
        { status: 404 }
      );
    }

    // Validasi wewenang (BBK pembuat cabang atau Admin)
    const authCheck = canOpenAanwijzingAbsenSession(user, aanwijzing);
    if (!authCheck.allowed) {
      return NextResponse.json(
        { status: 'error', message: authCheck.reason || 'Anda tidak berwenang menyelesaikan sesi absensi ini' },
        { status: 403 }
      );
    }

    // Ambil daftar peserta eligible (yang tidak konfirmasi TIDAK_HADIR pada pra-rapat)
    const eligiblePeserta = aanwijzing.peserta.filter(
      (p) => p.status_konfirmasi !== 'TIDAK_HADIR'
    );

    if (eligiblePeserta.length === 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Tidak ada peserta eligible untuk diautentikasi pada sesi absensi ini.',
        },
        { status: 400 }
      );
    }

    // Cek apakah masih ada peserta yang BELUM_ABSEN
    const belumAbsenList = eligiblePeserta.filter(
      (p) => p.status_kehadiran_aktual === 'BELUM_ABSEN'
    );

    if (belumAbsenList.length > 0) {
      const belumNames = belumAbsenList.map((p) => p.vendor?.nama_perusahaan || p.email).join(', ');
      return NextResponse.json(
        {
          status: 'error',
          message: `Masih ada ${belumAbsenList.length} rekanan yang belum terkonfirmasi kehadiran/ketidakhadirannya: ${belumNames}. Harap verifikasi hadir atau tandai tidak hadir untuk semua rekanan sebelum menyelesaikan sesi.`,
        },
        { status: 400 }
      );
    }

    // Hitung jumlah rekanan yang hadir aktual
    const hadirAktualCount = eligiblePeserta.filter(
      (p) => p.status_kehadiran_aktual === 'HADIR_AKTUAL'
    ).length;
    const tidakHadirAktualCount = eligiblePeserta.filter(
      (p) => p.status_kehadiran_aktual === 'TIDAK_HADIR'
    ).length;

    let newStatus: string;
    let auditAction: string;
    let auditNotes: string;
    let responseMessage: string;
    let nextStep: 'LANJUT_PROSES' | 'ESKALASI_DC_MANAGER';

    if (hadirAktualCount >= 3) {
      // Quorum Terpenuhi: Lanjut ke proses selanjutnya
      newStatus = 'AANWIJZING_SELESAI';
      auditAction = 'SELESAI_ABSENSI_QUORUM_OK';
      auditNotes = `Sesi absensi hari-H diselesaikan oleh ${user.email}. Quorum terpenuhi: ${hadirAktualCount} hadir aktual, ${tidakHadirAktualCount} tidak hadir. Status aanwijzing dinyatakan SELESAI dan lanjut ke tahap selanjutnya.`;
      responseMessage = `Sesi absensi berhasil disimpan dan diselesaikan. Quorum terpenuhi (${hadirAktualCount} rekanan hadir fisik). Aanwijzing lanjut ke proses selanjutnya.`;
      nextStep = 'LANJUT_PROSES';
    } else {
      // Quorum Tidak Terpenuhi (< 3 Hadir): Eskalasi ke DC Building & Development Manager
      newStatus = 'MENUNGGU_APPROVAL_DC_MANAGER';
      auditAction = 'ESKALASI_DC_MANAGER_ABSENSI';
      auditNotes = `Sesi absensi hari-H diselesaikan oleh ${user.email}. Rekanan hadir aktual (${hadirAktualCount} rekanan) kurang dari syarat quorum minimal 3. Berkas dialihkan ke antrean approval DC Building & Development Manager.`;
      responseMessage = `Sesi absensi telah disimpan. Rekanan yang hadir fisik (${hadirAktualCount} rekanan) kurang dari 3. Sesuai SOP, berkas dialihkan ke DC Building & Development Manager untuk otorisasi kelanjutan.`;
      nextStep = 'ESKALASI_DC_MANAGER';
    }

    // Eksekusi atomic batch update status & buat audit log (cepat, tanpa overhead interactive transaction session)
    try {
      await prisma.$transaction([
        prisma.dc_aanwijzing.update({
          where: { id: aanwijzingId },
          data: {
            status: newStatus,
            session_absen_active: false,
          },
        }),
        prisma.dc_aanwijzing_audit_log.create({
          data: {
            aanwijzing_id: aanwijzingId,
            user_email: user.email,
            user_name: (user as any).nama || user.email,
            user_role: user.role,
            action: auditAction,
            from_status: aanwijzing.status,
            to_status: newStatus,
            notes: auditNotes,
          },
        }),
      ]);
    } catch (txErr: any) {
      console.warn('Fallback to sequential queries for finish session:', txErr?.message);
      await prisma.dc_aanwijzing.update({
        where: { id: aanwijzingId },
        data: {
          status: newStatus,
          session_absen_active: false,
        },
      });
      await prisma.dc_aanwijzing_audit_log.create({
        data: {
          aanwijzing_id: aanwijzingId,
          user_email: user.email,
          user_name: (user as any).nama || user.email,
          user_role: user.role,
          action: auditAction,
          from_status: aanwijzing.status,
          to_status: newStatus,
          notes: auditNotes,
        },
      });
    }

    return NextResponse.json({
      status: 'success',
      message: responseMessage,
      data: {
        aanwijzing_id: aanwijzingId,
        status: newStatus,
        hadir_aktual_count: hadirAktualCount,
        tidak_hadir_count: tidakHadirAktualCount,
        total_peserta: eligiblePeserta.length,
        next_step: nextStep,
      },
    });
  } catch (error: any) {
    console.error('Error finishing aanwijzing absen session:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Terjadi kesalahan sistem saat menyelesaikan sesi absensi',
      },
      { status: 500 }
    );
  }
}
