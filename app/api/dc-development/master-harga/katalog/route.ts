import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getBranchesUnderInduk, getUserCoverageBranches } from '@/lib/branches';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedBranches = getUserCoverageBranches(session);

    const { searchParams } = new URL(request.url);
    const lingkup = searchParams.get('lingkup') || 'SIPIL';
    const cabang = searchParams.get('cabang'); // parent cabang code
    const search = searchParams.get('search');

    // Build the query
    const whereClause: any = {
      status_aktif: true,
      master_item: {
        lingkup: lingkup,
      }
    };

    if (allowedBranches !== null) {
      if (cabang && cabang !== 'all') {
        const childBranches = getBranchesUnderInduk(cabang);
        const intersect = childBranches.filter(b => allowedBranches.includes(b.toUpperCase()));
        whereClause.OR = [
          { cabang: { in: intersect, mode: 'insensitive' } },
          { coverage_cabang: { in: intersect, mode: 'insensitive' } }
        ];
      } else {
        whereClause.OR = [
          { cabang: { in: allowedBranches, mode: 'insensitive' } },
          { coverage_cabang: { in: allowedBranches, mode: 'insensitive' } }
        ];
      }
    } else {
      if (cabang && cabang !== 'all') {
        const childBranches = getBranchesUnderInduk(cabang);
        whereClause.OR = [
          { cabang: { in: childBranches, mode: 'insensitive' } },
          { coverage_cabang: { in: childBranches, mode: 'insensitive' } }
        ];
      }
    }

    if (search) {
      const searchFilter = {
        contains: search,
        mode: 'insensitive',
      };
      whereClause.master_item.OR = [
        { kode: searchFilter },
        { kode_anak: searchFilter },
        { item_material: searchFilter },
        { deskripsi_otomatis: searchFilter },
        { kategori_pekerjaan: searchFilter }
      ];
    }

    const items = await prisma.mh_item_cabang.findMany({
      where: whereClause,
      include: {
        master_item: true,
      },
      orderBy: [
        { master_item: { kode: 'asc' } },
        { master_item: { kode_anak: 'asc' } },
        { coverage_cabang: 'asc' }
      ]
    });

    // Get all distinct active branches for this lingkup (ter-filter coverage)
    const distinctWhere: any = {
      status_aktif: true,
      master_item: {
        lingkup: lingkup,
      }
    };
    if (whereClause.OR) {
      distinctWhere.OR = whereClause.OR;
    }

    const distinctBranches = await prisma.mh_item_cabang.findMany({
      where: distinctWhere,
      select: {
        coverage_cabang: true
      },
      distinct: ['coverage_cabang']
    });

    return NextResponse.json({ 
      status: 'success', 
      data: items,
      branches: distinctBranches.map(b => b.coverage_cabang).sort()
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
