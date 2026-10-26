import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canUserViewAanwijzing, isApprovalAdmin, isSameCreator } from '@/lib/permissions';

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
    const aanwijzingId = parseInt(id, 10);
    if (isNaN(aanwijzingId)) {
      return NextResponse.json(
        { status: 'error', message: 'ID Undangan tidak valid' },
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
        nama: true,
        nama_pt: true,
        coverage_cabang: true,
      },
    });
    const currentUser = dbUser || session;

    const aanwijzing = await prisma.dc_aanwijzing.findUnique({
      where: { id: aanwijzingId },
      include: {
        project: true,
        renovasi: true,
        tender: true,
        fungsi_ruang: true,
        peserta: {
          include: {
            vendor: true,
          },
        },
        audit_logs: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!aanwijzing) {
      return NextResponse.json(
        { status: 'error', message: 'Data Undangan Aanwijzing tidak ditemukan' },
        { status: 404 }
      );
    }

    if (!canUserViewAanwijzing(currentUser, aanwijzing)) {
      return NextResponse.json(
        { status: 'error', message: 'Akses ditolak: Anda tidak memiliki wewenang pada dokumen ini' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      status: 'success',
      data: aanwijzing,
    });
  } catch (error: any) {
    console.error('Error fetching aanwijzing detail:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal memuat rincian undangan' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
    const aanwijzingId = parseInt(id, 10);
    if (isNaN(aanwijzingId)) {
      return NextResponse.json(
        { status: 'error', message: 'ID Undangan tidak valid' },
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
      },
    });
    const currentUser = dbUser || session;

    const aanwijzing = await prisma.dc_aanwijzing.findUnique({
      where: { id: aanwijzingId },
    });

    if (!aanwijzing) {
      return NextResponse.json(
        { status: 'error', message: 'Data Undangan tidak ditemukan' },
        { status: 404 }
      );
    }

    const isAdmin = isApprovalAdmin(currentUser.role);
    const isCreator = isSameCreator(currentUser, aanwijzing.created_by);

    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { status: 'error', message: 'Akses ditolak: Hanya pembuat atau Admin yang dapat membatalkan undangan' },
        { status: 403 }
      );
    }

    await prisma.dc_aanwijzing.delete({
      where: { id: aanwijzingId },
    });

    return NextResponse.json({
      status: 'success',
      message: 'Undangan Aanwijzing berhasil dibatalkan dan dihapus',
    });
  } catch (error: any) {
    console.error('Error deleting aanwijzing:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal menghapus undangan aanwijzing' },
      { status: 500 }
    );
  }
}
