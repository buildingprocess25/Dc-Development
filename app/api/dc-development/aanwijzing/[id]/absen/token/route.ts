import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canOpenAanwijzingAbsenSession, isApprovalAdmin, isSameCreator } from '@/lib/permissions';

const ROLLING_TOKEN_SECRET =
  process.env.NEXTAUTH_SECRET ||
  process.env.JWT_SECRET ||
  'sparta-dc-aanwijzing-rolling-secret-key-2026';

/**
 * Menghasilkan hash HMAC untuk rolling time slot
 */
export function generateRollingTokenHash(aanwijzingId: number, timeSlot: number): string {
  return crypto
    .createHmac('sha256', ROLLING_TOKEN_SECRET)
    .update(`${aanwijzingId}:${timeSlot}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * GET /api/dc-development/aanwijzing/[id]/absen/token
 * Menghasilkan One-Time Rolling Token 60 Detik untuk ditampilkan di layar BBK/Proyektor
 * HANYA dapat diakses oleh BBK Pembuat atau Admin.
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
    });

    if (!aanwijzing) {
      return NextResponse.json({ message: 'Data Aanwijzing tidak ditemukan' }, { status: 404 });
    }

    // Pastikan user berwenang (Admin, Creator, atau Branch Building Koordinator cabang terkait)
    const authCheck = canOpenAanwijzingAbsenSession(user, aanwijzing);
    if (!authCheck.allowed) {
      return NextResponse.json(
        { message: authCheck.reason || 'Anda tidak berwenang mengambil token absensi ini.' },
        { status: 403 }
      );
    }

    // Pastikan sesi aktif (dengan fallback raw query jika DMMF cache belum sinkron)
    let isSessionActive = Boolean(aanwijzing.session_absen_active);
    let bbkLat = aanwijzing.session_absen_lat;
    let bbkLong = aanwijzing.session_absen_long;
    let bbkAddress = aanwijzing.session_absen_address;

    if (!isSessionActive) {
      try {
        const rawRows: any[] = await prisma.$queryRaw`
          SELECT "session_absen_active", "session_absen_lat", "session_absen_long", "session_absen_address"
          FROM "dc_aanwijzing"
          WHERE "id" = ${aanwijzingId}
          LIMIT 1
        `;
        if (rawRows && rawRows.length > 0 && rawRows[0].session_absen_active) {
          isSessionActive = true;
          bbkLat = rawRows[0].session_absen_lat;
          bbkLong = rawRows[0].session_absen_long;
          bbkAddress = rawRows[0].session_absen_address;
        }
      } catch (err) {
        console.warn('Fallback queryRaw for token check:', err);
      }
    }

    if (!isSessionActive) {
      return NextResponse.json(
        {
          message: 'Sesi absensi belum dibuka atau sudah ditutup oleh penyelenggara.',
          sessionActive: false,
        },
        { status: 400 }
      );
    }

    // Hitung slot waktu 60 detik (1 menit per slot)
    const now = Date.now();
    const timeSlot = Math.floor(now / 60000);
    const secondsRemaining = 60 - Math.floor((now % 60000) / 1000);

    const hash = generateRollingTokenHash(aanwijzingId, timeSlot);
    const token = `${aanwijzingId}.${timeSlot}.${hash}`;

    return NextResponse.json({
      token,
      expiresInSeconds: secondsRemaining,
      timeSlot,
      sessionActive: true,
      bbkCoordinates: {
        lat: bbkLat,
        long: bbkLong,
        address: bbkAddress,
      },
    });
  } catch (error: any) {
    console.error('Error generating aanwijzing absen token:', error);
    return NextResponse.json(
      { message: 'Terjadi kesalahan sistem saat menghasilkan token absensi', error: error?.message },
      { status: 500 }
    );
  }
}
