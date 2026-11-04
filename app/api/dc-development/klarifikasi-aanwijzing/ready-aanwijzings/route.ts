import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { status: 'error', message: 'Sesi login tidak valid' },
        { status: 401 }
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
    const userCoverage = getUserCoverageBranches(currentUser);

    const { searchParams } = new URL(request.url);
    const filterCabang = searchParams.get('cabang') || '';

    // Ambil seluruh Aanwijzing yang sudah selesai sesi absensinya (AANWIJZING_SELESAI)
    // dan belum memiliki Berita Acara Klarifikasi (klarifikasi is null)
    const readyAanwijzings = await prisma.dc_aanwijzing.findMany({
      where: {
        status: 'AANWIJZING_SELESAI',
        klarifikasi: null, // belum ada klarifikasi
      },
      include: {
        project: true,
        renovasi: {
          include: {
            item_rab: true,
            dokumen: true,
          },
        },
        peserta: {
          include: {
            vendor: true,
          },
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    // Filter berdasarkan wewenang cakupan cabang user
    const filtered = readyAanwijzings.filter((item) => {
      const itemBranch = (item.cabang || item.project?.cabang || '').trim().toUpperCase();
      if (!isBranchAccessible(itemBranch, userCoverage)) return false;
      if (filterCabang && filterCabang.toLowerCase() !== 'all') {
        if (itemBranch !== filterCabang.trim().toUpperCase()) return false;
      }
      return true;
    });

    return NextResponse.json({
      status: 'success',
      data: filtered,
    });
  } catch (error: any) {
    console.error('Error fetching ready aanwijzings for klarifikasi:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}
