import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { syncRenovasiPdfToDrive } from '@/lib/renovasi-sync';
import { getSession } from '@/lib/auth';

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
    const renovasiId = parseInt(id, 10);
    if (isNaN(renovasiId)) {
      return NextResponse.json({ status: 'error', message: 'ID pengajuan tidak valid' }, { status: 400 });
    }

    // Cek apakah dokumen PDF sudah tersinkronisasi di Google Drive
    const existingDoc = await prisma.dc_renovasi_dokumen.findFirst({
      where: {
        renovasi_id: renovasiId,
        kategori_file: 'DOKUMEN_RAB_OE_PDF'
      }
    });

    if (existingDoc?.file_url) {
      return NextResponse.json({
        status: 'success',
        data: {
          file_url: existingDoc.file_url,
          drive_file_id: existingDoc.drive_file_id,
          synced: true
        }
      });
    }

    // Jika belum ada di Drive, generate dan sync sekarang juga
    const syncResult = await syncRenovasiPdfToDrive(renovasiId);

    return NextResponse.json({
      status: 'success',
      data: {
        file_url: syncResult.file_url,
        drive_file_id: syncResult.drive_file_id,
        synced: false
      }
    });
  } catch (error: unknown) {
    console.error('Error on download-pdf route:', error);
    return NextResponse.json(
      { status: 'error', message: (error as Error)?.message || 'Gagal menyiapkan file PDF' },
      { status: 500 }
    );
  }
}
