import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canContractorAttendAanwijzing } from '@/lib/permissions';
import { calculateDistanceMeters, isValidCoordinate } from '@/lib/geolocation';

const ROLLING_TOKEN_SECRET =
  process.env.NEXTAUTH_SECRET ||
  process.env.JWT_SECRET ||
  'sparta-dc-aanwijzing-rolling-secret-key-2026';

function verifyRollingToken(aanwijzingId: number, tokenStr: string): boolean {
  if (!tokenStr || typeof tokenStr !== 'string') return false;

  const parts = tokenStr.split('.');
  if (parts.length !== 3) return false;

  const [idStr, slotStr, hash] = parts;
  const tokenAanwijzingId = parseInt(idStr, 10);
  const tokenSlot = parseInt(slotStr, 10);

  if (isNaN(tokenAanwijzingId) || isNaN(tokenSlot) || tokenAanwijzingId !== aanwijzingId) {
    return false;
  }

  const now = Date.now();
  const currentSlot = Math.floor(now / 60000);

  // Toleransi: Slot saat ini atau slot 1 menit sebelumnya (untuk toleransi delay transmisi)
  if (tokenSlot !== currentSlot && tokenSlot !== currentSlot - 1) {
    return false;
  }

  const expectedHash = crypto
    .createHmac('sha256', ROLLING_TOKEN_SECRET)
    .update(`${aanwijzingId}:${tokenSlot}`)
    .digest('hex')
    .slice(0, 16);

  return expectedHash === hash;
}

/**
 * POST /api/dc-development/aanwijzing/[id]/absen/verify
 * Memverifikasi pemindaian QR Code oleh Kontraktor dan mencatat koordinat GPS ke database.
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

    const body = await req.json();
    const { token, lat, long, address } = body;

    if (!token) {
      return NextResponse.json({ message: 'Token QR Code wajib disertakan' }, { status: 400 });
    }

    // Ambil data Aanwijzing
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

    // 1. Validasi Sesi Aktif
    if (!aanwijzing.session_absen_active) {
      return NextResponse.json(
        {
          message:
            'Sesi absensi rapat belum dibuka atau telah ditutup oleh Branch Building Koordinator.',
        },
        { status: 400 }
      );
    }

    // 2. Validasi Token QR Rolling 60 Detik
    const isTokenValid = verifyRollingToken(aanwijzingId, token);
    if (!isTokenValid) {
      return NextResponse.json(
        {
          message:
            'QR Code telah kedaluwarsa atau tidak valid. Silakan scan QR Code terbaru di layar proyektor / koordinator.',
        },
        { status: 400 }
      );
    }

    // 3. Validasi Kontraktor Login
    const contractorCheck = canContractorAttendAanwijzing(user, aanwijzing);
    if (!contractorCheck.allowed || !contractorCheck.myPeserta) {
      return NextResponse.json(
        { message: contractorCheck.reason || 'Anda tidak berhak melakukan absensi pada rapat ini' },
        { status: 403 }
      );
    }

    const myPeserta = contractorCheck.myPeserta;

    // 4. Hitung Jarak relatif (jika BBK dan Kontraktor memiliki koordinat GPS)
    let distanceMeter: number | null = null;
    const hasContractorCoords = isValidCoordinate(lat, long);
    const hasBbkCoords = isValidCoordinate(aanwijzing.session_absen_lat, aanwijzing.session_absen_long);

    if (hasContractorCoords && hasBbkCoords) {
      distanceMeter = calculateDistanceMeters(
        lat,
        long,
        aanwijzing.session_absen_lat!,
        aanwijzing.session_absen_long!
      );
    }

    // 5. Simpan koordinat GPS, alamat terdeteksi, dan konfirmasi kehadiran aktual ke database
    const now = new Date();
    const latVal = hasContractorCoords ? lat : null;
    const longVal = hasContractorCoords ? long : null;
    const contractorAddress = typeof address === 'string' && address.trim() ? address.trim() : null;

    let updatedPesertaVendorName = myPeserta.vendor?.nama_perusahaan || 'Rekanan';

    try {
      const updatedPeserta = await prisma.dc_aanwijzing_vendor.update({
        where: { id: myPeserta.id },
        data: {
          status_kehadiran_aktual: 'HADIR_AKTUAL',
          absen_at: now,
          absen_lat: latVal,
          absen_long: longVal,
          absen_distance_meter: distanceMeter,
          absen_metode: 'QR_SCAN_GPS',
          catatan_absen: contractorAddress,
        },
        include: {
          vendor: true,
        },
      });
      if (updatedPeserta?.vendor?.nama_perusahaan) {
        updatedPesertaVendorName = updatedPeserta.vendor.nama_perusahaan;
      }
    } catch (prismaUpdateErr: any) {
      console.warn('Fallback executeRaw for attendance verify:', prismaUpdateErr?.message);
      await prisma.$executeRaw`
        UPDATE "dc_aanwijzing_vendor"
        SET "status_kehadiran_aktual" = 'HADIR_AKTUAL',
            "absen_at" = ${now},
            "absen_lat" = ${latVal},
            "absen_long" = ${longVal},
            "absen_distance_meter" = ${distanceMeter},
            "absen_metode" = 'QR_SCAN_GPS',
            "catatan_absen" = ${contractorAddress}
        WHERE "id" = ${myPeserta.id}
      `;
    }

    return NextResponse.json({
      success: true,
      message: 'Kehadiran fisik Anda dalam rapat Aanwijzing berhasil diverifikasi!',
      data: {
        nama_perusahaan: updatedPesertaVendorName,
        status_kehadiran_aktual: 'HADIR_AKTUAL',
        absen_at: now.toISOString(),
        absen_distance_meter: distanceMeter,
        absen_lat: latVal,
        absen_long: longVal,
        absen_metode: 'QR_SCAN_GPS',
        absen_address: contractorAddress,
      },
    });
  } catch (error: any) {
    console.error('Error verifying aanwijzing attendance:', error);
    return NextResponse.json(
      { message: 'Terjadi kesalahan sistem saat memverifikasi absensi', error: error?.message },
      { status: 500 }
    );
  }
}
