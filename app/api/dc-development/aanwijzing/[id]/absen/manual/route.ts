import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canOpenAanwijzingAbsenSession } from '@/lib/permissions';

/**
 * POST /api/dc-development/aanwijzing/[id]/absen/manual
 * Verifikasi kehadiran manual darurat oleh Branch Building Koordinator / Admin
 * Digunakan jika kontraktor hadir fisik namun memiliki kendala teknis (kamera/browser rusak)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const aanwijzingId = parseInt(id, 10);
    if (isNaN(aanwijzingId)) {
      return NextResponse.json({ message: 'ID Aanwijzing tidak valid' }, { status: 400 });
    }

    const aanwijzing = await prisma.dc_aanwijzing.findUnique({
      where: { id: aanwijzingId },
      include: {
        peserta: {
          include: {
            vendor: true,
          },
        },
      },
    });

    if (!aanwijzing) {
      return NextResponse.json({ message: 'Data Aanwijzing tidak ditemukan' }, { status: 404 });
    }

    // Pastikan user berwenang (BBK pembuat atau Admin)
    const authCheck = canOpenAanwijzingAbsenSession(user, aanwijzing);
    if (!authCheck.allowed) {
      return NextResponse.json(
        { message: authCheck.reason || 'Anda tidak berwenang melakukan verifikasi manual' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { vendor_id, catatan, action = 'HADIR' } = body;

    if (!vendor_id) {
      return NextResponse.json({ message: 'ID Rekanan (vendor_id) wajib dipilih' }, { status: 400 });
    }

    if (!catatan || !catatan.trim()) {
      return NextResponse.json(
        {
          message:
            action === 'TIDAK_HADIR'
              ? 'Catatan alasan ketidakhadiran rekanan wajib diisi untuk rekam audit.'
              : 'Catatan alasan verifikasi manual wajib diisi untuk rekam audit.',
        },
        { status: 400 }
      );
    }

    // Cari peserta yang sesuai
    const peserta = aanwijzing.peserta.find((p) => p.vendor_id === Number(vendor_id));
    if (!peserta) {
      return NextResponse.json(
        { message: 'Rekanan tidak ditemukan dalam daftar peserta undangan ini' },
        { status: 404 }
      );
    }

    if (peserta.status_konfirmasi === 'TIDAK_HADIR') {
      return NextResponse.json(
        { message: 'Rekanan telah mengonfirmasi TIDAK HADIR pada pra-rapat dan tidak dapat diabsenkan.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const cleanCatatan = catatan.trim();
    let vendorName = peserta.vendor?.nama_perusahaan || 'Rekanan';
    const isTidakHadir = action === 'TIDAK_HADIR';
    const newStatusAktual = isTidakHadir ? 'TIDAK_HADIR' : 'HADIR_AKTUAL';
    const newMetode = isTidakHadir ? 'KONFIRMASI_TIDAK_HADIR_BBK' : 'VERIFIKASI_MANUAL_BBK';

    try {
      const updated = await prisma.dc_aanwijzing_vendor.update({
        where: { id: peserta.id },
        data: {
          status_kehadiran_aktual: newStatusAktual,
          absen_at: now,
          absen_metode: newMetode,
          catatan_absen: cleanCatatan,
        },
        include: {
          vendor: true,
        },
      });
      if (updated?.vendor?.nama_perusahaan) {
        vendorName = updated.vendor.nama_perusahaan;
      }
    } catch (prismaUpdateErr: any) {
      console.warn('Fallback executeRaw for manual attendance update:', prismaUpdateErr?.message);
      await prisma.$executeRaw`
        UPDATE "dc_aanwijzing_vendor"
        SET "status_kehadiran_aktual" = ${newStatusAktual},
            "absen_at" = ${now},
            "absen_metode" = ${newMetode},
            "catatan_absen" = ${cleanCatatan}
        WHERE "id" = ${peserta.id}
      `;
    }

    return NextResponse.json({
      success: true,
      message: isTidakHadir
        ? `Ketidakhadiran ${vendorName} pada sesi hari-H berhasil dikonfirmasi.`
        : `Kehadiran ${vendorName} berhasil diverifikasi manual oleh penyelenggara.`,
      data: {
        id: peserta.id,
        nama_perusahaan: vendorName,
        status_kehadiran_aktual: newStatusAktual,
        absen_at: now.toISOString(),
        absen_metode: newMetode,
        catatan_absen: cleanCatatan,
      },
    });
  } catch (error: any) {
    console.error('Error in manual attendance verification:', error);
    return NextResponse.json(
      { message: 'Terjadi kesalahan sistem saat melakukan verifikasi manual', error: error?.message },
      { status: 500 }
    );
  }
}
