import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { generateBeritaAcaraAanwijzingPdf } from '@/lib/pdf/berita-acara-aanwijzing-pdf.service';

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

    const pdfBuffer = await generateBeritaAcaraAanwijzingPdf(klarifikasiId);

    const sanitizedNo = (klarifikasi.nomor_klarifikasi || `BA_${klarifikasi.id}`).replace(/[\/\\:]/g, '_');
    const filename = `Berita_Acara_Aanwijzing_${sanitizedNo}.pdf`;

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error generating/downloading Berita Acara PDF:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal menghasilkan PDF Berita Acara' },
      { status: 500 }
    );
  }
}
