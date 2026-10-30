import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';
import { isApprovalAdmin, canUserApproveKlarifikasiAanwijzing } from '@/lib/permissions';

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
    const roleUpper = (currentUser.role || '').trim().toUpperCase();
    const isAdmin = isApprovalAdmin(roleUpper);
    const userCoverage = getUserCoverageBranches(currentUser);

    const allItems = await prisma.dc_aanwijzing_klarifikasi.findMany({
      include: {
        project: true,
      },
    });

    const accessibleItems = allItems.filter((it) => {
      const itemBranch = (it.cabang || it.project?.cabang || '').trim().toUpperCase();
      return isBranchAccessible(itemBranch, userCoverage);
    });

    let myPendingCount = 0;
    if (isAdmin) {
      myPendingCount = accessibleItems.filter(
        (it) =>
          it.status === 'MENUNGGU_APPROVAL_BBM_MANAGER' ||
          it.status === 'MENUNGGU_APPROVAL_DC_SPECIALIST'
      ).length;
    } else {
      myPendingCount = accessibleItems.filter((it) =>
        canUserApproveKlarifikasiAanwijzing(currentUser, it)
      ).length;
    }

    return NextResponse.json({
      status: 'success',
      data: {
        my_pending_count: myPendingCount,
        total_all: accessibleItems.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching klarifikasi summary:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}
