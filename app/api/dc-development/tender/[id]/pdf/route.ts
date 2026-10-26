import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { generateTenderPdfBuffer } from '@/lib/pdf/tender-pdf.service';
import { canUserViewTenderSubmission } from '@/lib/permissions';

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
    const tenderId = parseInt(id, 10);
    if (isNaN(tenderId)) {
      return NextResponse.json(
        { status: 'error', message: 'ID tender tidak valid' },
        { status: 400 }
      );
    }

    // Ambil data user terkini
    const dbUser = await prisma.dc_users.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        role: true,
        cabang: true,
        coverage_cabang: true,
      },
    });

    const currentUser = dbUser || session;

    const tender = await prisma.dc_tender.findUnique({
      where: { id: tenderId },
      include: {
        project: true,
        renovasi: true,
      },
    });

    if (!tender) {
      return NextResponse.json(
        { status: 'error', message: 'Data Pengajuan Proposal Tender tidak ditemukan' },
        { status: 404 }
      );
    }

    // Validasi status pengajuan: PDF resmi baru tersedia setelah kualifikasi & jadwal diselesaikan
    if (tender.status === 'PRAKUALIFIKASI' || tender.status === 'DRAFT' || tender.status === 'REVISI') {
      return NextResponse.json(
        {
          status: 'error',
          message:
            'Dokumen PDF resmi belum tersedia. Harap selesaikan proses kualifikasi rekanan dan penjadwalan terlebih dahulu.',
        },
        { status: 400 }
      );
    }

    // Validasi izin akses bertingkat dan coverage cabang
    if (!canUserViewTenderSubmission(currentUser, tender)) {
      return NextResponse.json(
        {
          status: 'error',
          message:
            'Akses ditolak: Dokumen pengajuan ini belum mencapai tahapan persetujuan Anda atau berada di luar cakupan cabang Anda.',
        },
        { status: 403 }
      );
    }

    // Generate PDF Buffer via Puppeteer & Nunjucks
    const pdfBuffer = await generateTenderPdfBuffer(tenderId);

    const { searchParams } = new URL(request.url);
    const isDownload = searchParams.get('download') === '1';

    const safeNomor = (tender.nomor_tender || `TENDER_${tenderId}`).replace(
      /[\/\\]/g,
      '_'
    );
    const filename = `Proposal_Peserta_Tender_${safeNomor}.pdf`;
    const dispositionType = isDownload ? 'attachment' : 'inline';

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${dispositionType}; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error generating tender PDF:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Gagal menghasilkan dokumen PDF tender.',
      },
      { status: 500 }
    );
  }
}
