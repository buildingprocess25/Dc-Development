import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canUserSelectWinner, isApprovalAdmin } from '@/lib/permissions';
import { getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const winnerId = parseInt(id);
    const body = await request.json();
    const { catatan_keputusan, alasan } = body;

    const winner = await prisma.dc_penawaran_rekanan.findUnique({
      where: { id: winnerId },
      include: { vendor: true },
    });

    if (!winner) {
      return NextResponse.json({ status: 'error', message: 'Data penawaran tidak ditemukan' }, { status: 404 });
    }

    // Validasi: Keputusan pemenang bersifat final & tidak dapat diubah lagi sekali sudah ditetapkan
    const existingWinner = await prisma.dc_penawaran_rekanan.findFirst({
      where: {
        project_id: winner.project_id,
        status: 'MENANG',
      },
    });

    if (existingWinner) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Pemenang lelang untuk proyek ini telah resmi ditetapkan (${existingWinner.vendor_nama}) dan bersifat final (tidak dapat diubah lagi).`,
        },
        { status: 400 }
      );
    }

    // Validasi penawaran yang dipilih harus berstatus SIAP_KOMPARASI
    if (winner.status !== 'SIAP_KOMPARASI') {
      return NextResponse.json(
        {
          status: 'error',
          message: `Rekanan ${winner.vendor_nama} belum disetujui masuk ke Wadah Komparasi (Status saat ini: ${winner.status}).`,
        },
        { status: 400 }
      );
    }

    // Validasi wewenang pemilihan pemenang berdasarkan threshold 1 Miliar
    if (!canUserSelectWinner(session, winner.grand_total)) {
      const msg = winner.grand_total < 1_000_000_000
        ? 'Penetapan pemenang paket < Rp 1 Miliar adalah wewenang Branch Building & Maintenance (BBM) Manager.'
        : 'Penetapan pemenang paket >= Rp 1 Miliar adalah wewenang DC Development Specialist.';
      return NextResponse.json({ status: 'error', message: msg }, { status: 403 });
    }

    // Validasi wewenang coverage cabang pengguna
    const roleUpper = (session.role || '').toUpperCase();
    if (!isApprovalAdmin(roleUpper) && !roleUpper.includes('HEAD_OFFICE') && !roleUpper.includes('DIRECTOR')) {
      const userCoverage = getUserCoverageBranches(session);
      if (!isBranchAccessible(winner.cabang, userCoverage)) {
        return NextResponse.json(
          { status: 'error', message: 'Akses ditolak: Proyek di luar cakupan cabang wewenang Anda' },
          { status: 403 }
        );
      }
    }

    // Validasi: Pastikan tidak ada berkas rekanan pada proyek ini yang masih menunggu review approval
    const pendingPenawaran = await prisma.dc_penawaran_rekanan.findMany({
      where: {
        project_id: winner.project_id,
        status: { in: ['DIAJUKAN', 'NEGOSIASI_REKANAN', 'DIAJUKAN_ULANG', 'DRAFT'] },
      },
    });

    if (pendingPenawaran.length > 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Tidak dapat menetapkan pemenang: Terdapat ${pendingPenawaran.length} berkas penawaran yang belum disetujui masuk ke wadah komparasi.`,
        },
        { status: 400 }
      );
    }

    // Validasi: Cek batas waktu tender & peserta yang belum submit
    const klarifikasi = await prisma.dc_aanwijzing_klarifikasi.findFirst({
      where: { project_id: winner.project_id, status: 'APPROVED' },
      include: {
        aanwijzing: {
          include: {
            peserta: true,
          },
        },
      },
    });

    if (klarifikasi) {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const tenderDateObj = klarifikasi.tanggal_tender
        ? new Date(klarifikasi.tanggal_tender)
        : new Date('2026-11-03T00:00:00.000Z');
      const tenderDateStr = tenderDateObj.toLocaleDateString('en-CA');
      const isTenderPassed = todayStr > tenderDateStr;

      const eligiblePeserta = (klarifikasi.aanwijzing?.peserta || []).filter(
        (p: any) => p.status_kehadiran_aktual === 'HADIR_AKTUAL'
      );

      // Jika tender belum lewat, pastikan seluruh rekanan yang ikutan sudah submit
      if (!isTenderPassed && eligiblePeserta.length > 0) {
        const existingPenawarans = await prisma.dc_penawaran_rekanan.findMany({
          where: { project_id: winner.project_id, status: { not: 'DRAFT' } },
          select: { vendor_id: true },
        });
        const submittedVendorIds = new Set(existingPenawarans.map((p) => p.vendor_id));
        const unsubmitted = eligiblePeserta.filter((p: any) => !submittedVendorIds.has(p.vendor_id));

        if (unsubmitted.length > 0) {
          return NextResponse.json(
            {
              status: 'error',
              message: `Batas waktu tender belum berakhir (${tenderDateStr}) dan masih ada ${unsubmitted.length} rekanan yang belum mengajukan penawaran.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const combinedNotes = [
      alasan ? `Alasan: ${alasan.trim()}` : null,
      catatan_keputusan ? `Catatan: ${catatan_keputusan.trim()}` : null,
    ].filter(Boolean).join(' | ') || 'Ditetapkan sebagai pemenang tender lelang DC';

    await prisma.$transaction(async (tx) => {
      // 1. Update penawaran pemenang
      await tx.dc_penawaran_rekanan.update({
        where: { id: winnerId },
        data: {
          status: 'MENANG',
          catatan_pemenang: combinedNotes,
        },
      });

      // 2. Update penawaran rekanan lainnya pada proyek ini menjadi TIDAK_MENANG
      await tx.dc_penawaran_rekanan.updateMany({
        where: {
          project_id: winner.project_id,
          id: { not: winnerId },
        },
        data: {
          status: 'TIDAK_MENANG',
        },
      });

      // 3. Catat audit log untuk pemenang
      await tx.dc_penawaran_rekanan_audit_log.create({
        data: {
          penawaran_id: winnerId,
          user_email: session.email,
          user_name: session.email,
          user_role: session.role,
          action: 'PILIH_PEMENANG',
          from_status: winner.status,
          to_status: 'MENANG',
          notes: combinedNotes,
        },
      });
    });

    return NextResponse.json({
      status: 'success',
      message: `Kontraktor ${winner.vendor_nama} berhasil ditetapkan sebagai pemenang tender lelang!`,
    });
  } catch (error: any) {
    console.error('Error in pilih-pemenang route:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
