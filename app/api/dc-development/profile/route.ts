import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getBranchesUnderInduk, getUserCoverageBranches } from '@/lib/branches';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    const allowedBranches = getUserCoverageBranches(session);

    const { searchParams } = new URL(request.url);
    const cabangParam = searchParams.get('cabang') || '';

    const where: any = {};

    if (allowedBranches !== null) {
      if (cabangParam && cabangParam !== 'all') {
        const childBranches = getBranchesUnderInduk(cabangParam);
        const intersect = childBranches.filter(b => allowedBranches.includes(b.toUpperCase()));
        where.cabang = { in: intersect, mode: 'insensitive' };
      } else {
        where.cabang = { in: allowedBranches, mode: 'insensitive' };
      }
    } else {
      if (cabangParam && cabangParam !== 'all') {
        const childBranches = getBranchesUnderInduk(cabangParam);
        where.cabang = { in: childBranches, mode: 'insensitive' };
      }
    }

    const profiles = await prisma.dc_project.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { created_at: 'asc' }
    });

    return NextResponse.json({ status: 'success', data: profiles });
  } catch (error: any) {
    console.error("Error fetching profiles:", error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
