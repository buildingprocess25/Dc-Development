import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';
import { generateFungsiRuangPdfBuffer } from '@/lib/pdf/fungsi-ruang-pdf.service';
import { canUserViewFungsiRuangSubmission } from '@/lib/permissions';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Sesi login tidak valid' }, { status: 401 });
    }

    const { id } = await params;
    const submissionId = parseInt(id, 10);
    if (isNaN(submissionId)) {
      return NextResponse.json({ status: 'error', message: 'ID pengajuan tidak valid' }, { status: 400 });
    }

    const submission = await prisma.dc_fungsi_ruang.findUnique({
      where: { id: submissionId },
      include: {
        project: true,
        renovasi: true,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { status: 'error', message: 'Data pengajuan fungsi ruang tidak ditemukan' },
        { status: 404 }
      );
    }

    // Validasi izin akses bertingkat dan coverage cabang
    if (!canUserViewFungsiRuangSubmission(session, submission)) {
      return NextResponse.json(
        { status: 'error', message: 'Akses ditolak: Dokumen pengajuan ini belum mencapai tahapan persetujuan Anda atau berada di luar coverage cabang Anda.' },
        { status: 403 }
      );
    }

    // Generate PDF Buffer via Puppeteer & Nunjucks
    const pdfBuffer = await generateFungsiRuangPdfBuffer(submissionId);

    const { searchParams } = new URL(request.url);
    const isDownload = searchParams.get('download') === '1';

    const safeNomor = (submission.nomor_pengajuan || `PFR_${submissionId}`)
      .replace(/[\/\\]/g, '_');
    const filename = `Formulir_PFR_${safeNomor}.pdf`;
    const dispositionType = isDownload ? 'attachment' : 'inline';

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${dispositionType}; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('Error generating streaming PDF fungsi ruang:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal menghasilkan dokumen PDF' },
      { status: 500 }
    );
  }
}
