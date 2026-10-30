import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { syncBeritaAcaraToGoogleDrive } from '@/lib/pdf/berita-acara-aanwijzing-pdf.service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const klarifikasiId = parseInt(id, 10);
    if (isNaN(klarifikasiId)) {
      return NextResponse.json({ status: 'error', message: 'ID Berita Acara tidak valid' }, { status: 400 });
    }

    const klarifikasi = await prisma.dc_aanwijzing_klarifikasi.findUnique({
      where: { id: klarifikasiId },
      select: {
        id: true,
        nomor_klarifikasi: true,
        file_url: true,
        drive_file_id: true,
        status: true,
      },
    });

    if (!klarifikasi) {
      return NextResponse.json(
        { status: 'error', message: 'Data Berita Acara Klarifikasi tidak ditemukan' },
        { status: 404 }
      );
    }

    // Jika file_url Google Drive sudah tersimpan di database, kembalikan SECARA INSTAN
    if (klarifikasi.file_url && (klarifikasi.file_url.startsWith('http://') || klarifikasi.file_url.startsWith('https://'))) {
      return NextResponse.json({
        status: 'success',
        data: {
          file_url: klarifikasi.file_url,
          drive_file_id: klarifikasi.drive_file_id,
          nomor_klarifikasi: klarifikasi.nomor_klarifikasi,
        },
      });
    }

    // Fallback: Generate & upload ke Google Drive sekarang
    try {
      const syncResult = await syncBeritaAcaraToGoogleDrive(klarifikasiId);
      if (syncResult?.file_url) {
        return NextResponse.json({
          status: 'success',
          data: {
            file_url: syncResult.file_url,
            drive_file_id: syncResult.drive_file_id,
            nomor_klarifikasi: klarifikasi.nomor_klarifikasi,
          },
        });
      }
    } catch (syncError: unknown) {
      console.warn('[KLARIFIKASI-DRIVE-SYNC] Gagal sinkronisasi fallback ke Drive:', (syncError as Error)?.message);
    }

    // Fallback jika Google Drive offline: endpoint PDF lokal
    return NextResponse.json({
      status: 'success',
      data: {
        file_url: `/api/dc-development/klarifikasi-aanwijzing/${klarifikasiId}/pdf`,
        nomor_klarifikasi: klarifikasi.nomor_klarifikasi,
      },
    });
  } catch (error: unknown) {
    console.error('Error on download-pdf route:', error);
    return NextResponse.json(
      { status: 'error', message: (error as Error)?.message || 'Gagal menyiapkan file PDF' },
      { status: 500 }
    );
  }
}
