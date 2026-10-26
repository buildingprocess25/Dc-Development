import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { findDepartmentApprovers } from '@/lib/department-roles';
import { getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Sesi login tidak valid' }, { status: 401 });
    }

    const dbUser = await prisma.dc_users.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, role: true, cabang: true, coverage_cabang: true },
    });
    const currentUser = dbUser || session;
    const userCoverage = getUserCoverageBranches(currentUser);

    const { searchParams } = new URL(request.url);
    const specificBranch = searchParams.get('cabang')?.trim();

    const [pemohonList, allUsers] = await Promise.all([
      prisma.dc_master_pemohon.findMany({
        orderBy: {
          nama_pemohon: 'asc',
        },
      }),
      prisma.dc_users.findMany({
        select: { email: true, nama: true, role: true },
      }),
    ]);

    // 1. Filter berdasarkan wewenang coverage_cabang pengguna login
    let filteredList = pemohonList;
    if (userCoverage !== null) {
      filteredList = filteredList.filter((p) =>
        isBranchAccessible((p as any).cabang || '', userCoverage)
      );
    }

    // 2. Filter spesifik cabang jika parameter diberikan
    if (specificBranch && specificBranch !== 'all') {
      filteredList = filteredList.filter(
        (p) => ((p as any).cabang || '').toUpperCase() === specificBranch.toUpperCase()
      );
    }

    // Dinamis membaca approver GM dan Direktur dari dc_users berdasarkan role departemen
    const data = filteredList.map((p) => {
      const { gm, director } = findDepartmentApprovers(allUsers, p.departemen, p.divisi);
      return {
        ...p,
        gm_nama: gm?.nama || null,
        gm_email: gm?.email || null,
        gm_role: gm?.role || null,
        direktur_nama: director?.nama || null,
        direktur_email: director?.email || null,
        direktur_role: director?.role || null,
      };
    });

    return NextResponse.json({
      status: 'success',
      data,
    });
  } catch (error: any) {
    console.error('Error fetching master pemohon:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal memuat master pemohon' },
      { status: 500 }
    );
  }
}

