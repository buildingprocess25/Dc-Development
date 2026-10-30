import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canOpenAanwijzingAbsenSession } from '@/lib/permissions';
import { checkTanggalPelaksanaanHariH } from '@/lib/geolocation';

/**
 * GET /api/dc-development/aanwijzing/[id]/absen/session
 * Mengambil status sesi absensi dan rekap kehadiran aktual saat ini
 */
export async function GET(
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
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!aanwijzing) {
      return NextResponse.json({ message: 'Data Aanwijzing tidak ditemukan' }, { status: 404 });
    }

    const authCheck = canOpenAanwijzingAbsenSession(user, aanwijzing);

    let sessionActive = aanwijzing.session_absen_active;
    let sessionStartedAt = aanwijzing.session_absen_started_at;
    let sessionLat = aanwijzing.session_absen_lat;
    let sessionLong = aanwijzing.session_absen_long;
    let sessionAddress = aanwijzing.session_absen_address;

    if (sessionActive === undefined) {
      try {
        const rawRows: any[] = await prisma.$queryRaw`
          SELECT "session_absen_active", "session_absen_started_at", "session_absen_lat", "session_absen_long", "session_absen_address"
          FROM "dc_aanwijzing"
          WHERE "id" = ${aanwijzingId}
          LIMIT 1
        `;
        if (rawRows && rawRows.length > 0) {
          sessionActive = rawRows[0].session_absen_active;
          sessionStartedAt = rawRows[0].session_absen_started_at;
          sessionLat = rawRows[0].session_absen_lat;
          sessionLong = rawRows[0].session_absen_long;
          sessionAddress = rawRows[0].session_absen_address;
        }
      } catch (err) {
        console.warn('Fallback queryRaw for session GET:', err);
      }
    }

    return NextResponse.json({
      session_active: Boolean(sessionActive),
      session_started_at: sessionStartedAt,
      session_lat: sessionLat,
      session_long: sessionLong,
      session_address: sessionAddress,
      can_manage: authCheck.allowed,
      tanggal_pelaksanaan: aanwijzing.tanggal_pelaksanaan,
      peserta: aanwijzing.peserta
        .filter((p) => p.status_konfirmasi !== 'TIDAK_HADIR')
        .map((p) => ({
          id: p.id,
          vendor_id: p.vendor_id,
          nama_perusahaan: p.vendor.nama_perusahaan,
          email: p.email,
          status_konfirmasi: p.status_konfirmasi,
          status_kehadiran_aktual: p.status_kehadiran_aktual,
          absen_at: p.absen_at,
          absen_lat: p.absen_lat,
          absen_long: p.absen_long,
          absen_distance_meter: p.absen_distance_meter,
          absen_metode: p.absen_metode,
          catatan_absen: p.catatan_absen,
        })),
    });
  } catch (error: any) {
    console.error('Error fetching aanwijzing absen session:', error);
    return NextResponse.json(
      { message: 'Terjadi kesalahan sistem saat mengambil data sesi absensi', error: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dc-development/aanwijzing/[id]/absen/session
 * Membuka atau Menutup Sesi Absensi Hari-H oleh BBK / Admin
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
        peserta: true,
      },
    });

    if (!aanwijzing) {
      return NextResponse.json({ message: 'Data Aanwijzing tidak ditemukan' }, { status: 404 });
    }

    const authCheck = canOpenAanwijzingAbsenSession(user, aanwijzing);
    if (!authCheck.allowed) {
      return NextResponse.json(
        { message: authCheck.reason || 'Anda tidak berwenang mengelola sesi absensi ini' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, lat, long, address } = body;

    if (action === 'START') {
      const dateCheck = checkTanggalPelaksanaanHariH(aanwijzing.tanggal_pelaksanaan);
      if (!dateCheck.isHariH) {
        return NextResponse.json(
          {
            success: false,
            message: dateCheck.message,
            status: dateCheck.status,
            formattedTargetDate: dateCheck.formattedTargetDate,
          },
          { status: 400 }
        );
      }
    }

    if (action === 'START' || action === 'UPDATE_LOCATION') {
      const now = new Date();
      const latVal = typeof lat === 'number' ? lat : aanwijzing.session_absen_lat;
      const longVal = typeof long === 'number' ? long : aanwijzing.session_absen_long;
      const addrVal =
        typeof address === 'string' && address.trim() && address !== 'Lokasi Fisik Koordinator'
          ? address
          : aanwijzing.session_absen_address || (typeof address === 'string' ? address : null);

      try {
        await prisma.dc_aanwijzing.update({
          where: { id: aanwijzingId },
          data: {
            ...(action === 'START' ? { session_absen_active: true, session_absen_started_at: now } : {}),
            session_absen_lat: latVal,
            session_absen_long: longVal,
            session_absen_address: addrVal,
          },
        });
      } catch (prismaUpdateErr: any) {
        console.warn(`Fallback to executeRaw for session ${action}:`, prismaUpdateErr?.message);
        if (action === 'START') {
          await prisma.$executeRaw`
            UPDATE "dc_aanwijzing"
            SET "session_absen_active" = true,
                "session_absen_started_at" = ${now},
                "session_absen_lat" = ${latVal},
                "session_absen_long" = ${longVal},
                "session_absen_address" = ${addrVal}
            WHERE "id" = ${aanwijzingId}
          `;
        } else {
          await prisma.$executeRaw`
            UPDATE "dc_aanwijzing"
            SET "session_absen_lat" = ${latVal},
                "session_absen_long" = ${longVal},
                "session_absen_address" = ${addrVal}
            WHERE "id" = ${aanwijzingId}
          `;
        }
      }

      return NextResponse.json({
        success: true,
        message: action === 'START' ? 'Sesi absensi kehadiran Hari-H berhasil dibuka.' : 'Lokasi koordinat koordinator berhasil diperbarui.',
        session_active: true,
        session_lat: latVal,
        session_long: longVal,
        session_address: addrVal,
        session_started_at: now.toISOString(),
      });
    } else if (action === 'STOP') {
      try {
        await prisma.dc_aanwijzing.update({
          where: { id: aanwijzingId },
          data: {
            session_absen_active: false,
          },
        });
      } catch (prismaUpdateErr: any) {
        console.warn('Fallback to executeRaw for session STOP:', prismaUpdateErr?.message);
        await prisma.$executeRaw`
          UPDATE "dc_aanwijzing"
          SET "session_absen_active" = false
          WHERE "id" = ${aanwijzingId}
        `;
      }

      return NextResponse.json({
        success: true,
        message: 'Sesi absensi kehadiran telah ditutup.',
        session_active: false,
      });
    } else {
      return NextResponse.json({ message: 'Action tidak valid. Gunakan START atau STOP.' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error updating aanwijzing absen session:', error);
    return NextResponse.json(
      {
        message: error?.message ? `Gagal: ${error.message}` : 'Terjadi kesalahan sistem saat memperbarui status sesi absensi',
        error: error?.message,
      },
      { status: 500 }
    );
  }
}
