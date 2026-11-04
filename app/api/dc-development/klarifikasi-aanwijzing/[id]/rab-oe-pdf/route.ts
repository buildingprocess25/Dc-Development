import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import {
  generateRabOePascaAanwijzingPdfBuffer,
  syncRabOePascaAanwijzingToGoogleDrive,
} from '@/lib/pdf/renovasi-pdf.service';

export async function GET(
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
    const klarifikasiId = parseInt(id, 10);
    if (isNaN(klarifikasiId)) {
      return NextResponse.json(
        { status: 'error', message: 'ID Klarifikasi tidak valid' },
        { status: 400 }
      );
    }

    const klarifikasi = await prisma.dc_aanwijzing_klarifikasi.findUnique({
      where: { id: klarifikasiId },
      include: {
        project: true,
        dokumen: true,
      },
    });

    if (!klarifikasi) {
      return NextResponse.json(
        { status: 'error', message: 'Data Berita Acara Klarifikasi tidak ditemukan' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const isDownload = searchParams.get('download') === '1';

    // Background sync jika belum ada di GDrive
    const existingDriveDoc = klarifikasi.dokumen.find(
      (d) => d.kategori_file === 'DOKUMEN_RAB_OE_PASCA_AANWIJZING_PDF' && d.file_url
    );
    if (!existingDriveDoc) {
      syncRabOePascaAanwijzingToGoogleDrive(klarifikasiId).catch((err) =>
        console.warn('[GDrive] Async sync RAB/OE pasca aanwijzing warning:', err)
      );
    }

    const pdfBuffer = await generateRabOePascaAanwijzingPdfBuffer(klarifikasiId);

    const sanitizedNo = (klarifikasi.nomor_klarifikasi || `BA_${klarifikasi.id}`).replace(/[\/\\:]/g, '_');
    const filename = `RAB_OE_Pasca_Aanwijzing_${sanitizedNo}.pdf`;

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error generating RAB/OE Pasca Aanwijzing PDF:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal menghasilkan PDF RAB/OE Pasca Aanwijzing' },
      { status: 500 }
    );
  }
}
