import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches, getBranchesUnderInduk } from '@/lib/branches';
import { filterRenovasiByCreator } from '@/lib/permissions';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const cabang = searchParams.get('cabang') || '';
    const status = searchParams.get('status') || '';

    const allowedBranches = getUserCoverageBranches(session);
    const andConditions: Prisma.dc_renovasiWhereInput[] = [];

    // Filter coverage
    if (allowedBranches !== null) {
      if (cabang && cabang !== 'all') {
        const childBranches = getBranchesUnderInduk(cabang);
        const intersect = childBranches.filter((b) => allowedBranches.includes(b.toUpperCase()));
        andConditions.push({
          OR: [
            { cabang: { in: intersect, mode: 'insensitive' } },
            { project: { cabang: { in: intersect, mode: 'insensitive' } } }
          ]
        });
      } else {
        andConditions.push({
          OR: [
            { cabang: { in: allowedBranches, mode: 'insensitive' } },
            { project: { cabang: { in: allowedBranches, mode: 'insensitive' } } }
          ]
        });
      }
    } else if (cabang && cabang !== 'all') {
      const childBranches = getBranchesUnderInduk(cabang);
      andConditions.push({
        OR: [
          { cabang: { in: childBranches, mode: 'insensitive' } },
          { project: { cabang: { in: childBranches, mode: 'insensitive' } } }
        ]
      });
    }

    // Filter status
    if (status && status !== 'all') {
      andConditions.push({ status });
    }

    // Filter pencarian
    if (search) {
      andConditions.push({
        OR: [
          { nomor_pengajuan: { contains: search, mode: 'insensitive' } },
          { project: { nama_proyek: { contains: search, mode: 'insensitive' } } },
          { project: { kode: { contains: search, mode: 'insensitive' } } }
        ]
      });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : undefined;

    const data = await prisma.dc_renovasi.findMany({
      where,
      include: {
        project: true,
        dokumen: true,
        item_rab: true
      },
      orderBy: { updated_at: 'desc' }
    });

    const filteredData = filterRenovasiByCreator(data, session);

    return NextResponse.json({
      status: 'success',
      data: filteredData
    });
  } catch (error: unknown) {
    console.error('Error in dokumen/rab-oe route:', error);
    return NextResponse.json({ status: 'error', message: (error as Error)?.message || 'Internal error' }, { status: 500 });
  }
}
