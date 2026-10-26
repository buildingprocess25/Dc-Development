import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
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

    if (!canUserViewTenderSubmission(currentUser, tender)) {
      return NextResponse.json(
        {
          status: 'error',
          message:
            'Akses ditolak: Dokumen pengajuan ini berada di luar wewenang atau cakupan cabang Anda.',
        },
        { status: 403 }
      );
    }

    // Jika sudah memiliki URL Google Drive publik yang valid, kembalikan URL tersebut
    if (tender.file_url && tender.file_url.startsWith('http')) {
      return NextResponse.json({
        status: 'success',
        data: {
          file_url: tender.file_url,
          drive_file_id: tender.drive_file_id,
        },
      });
    }

    // Fallback: gunakan URL endpoint streaming lokal dengan query download=1
    return NextResponse.json({
      status: 'success',
      data: {
        file_url: `/api/dc-development/tender/${tenderId}/pdf?download=1`,
        drive_file_id: null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching download PDF URL for tender:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Gagal memproses permintaan unduh PDF tender.',
      },
      { status: 500 }
    );
  }
}
