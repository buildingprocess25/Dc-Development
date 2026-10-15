import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches, getBranchesUnderInduk } from '@/lib/branches';
import { getFungsiRuangPrismaFilter, canUserViewFungsiRuangSubmission } from '@/lib/permissions';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Sesi login tidak valid' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const cabang = searchParams.get('cabang') || '';
    const status = searchParams.get('status') || '';

    // Ambil data user terkini dari dc_users untuk coverage cabang & role yang up-to-date
    const dbUser = await prisma.dc_users.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        nama: true,
        cabang: true,
        role: true,
        coverage_cabang: true,
      },
    });

    const currentUser = dbUser || session;
    const allowedBranches = getUserCoverageBranches(currentUser);
    const andConditions: Prisma.dc_fungsi_ruangWhereInput[] = [];

    // 1. Filter coverage cabang akun pengguna
    if (allowedBranches !== null) {
      if (cabang && cabang !== 'all') {
        const childBranches = getBranchesUnderInduk(cabang);
        const intersect = childBranches.filter((b) => allowedBranches.includes(b.toUpperCase()));
        andConditions.push({
          OR: [
            { project: { cabang: { in: intersect, mode: 'insensitive' } } },
            { renovasi: { cabang: { in: intersect, mode: 'insensitive' } } },
          ],
        });
      } else {
        andConditions.push({
          OR: [
            { project: { cabang: { in: allowedBranches, mode: 'insensitive' } } },
            { renovasi: { cabang: { in: allowedBranches, mode: 'insensitive' } } },
          ],
        });
      }
    } else if (cabang && cabang !== 'all') {
      const childBranches = getBranchesUnderInduk(cabang);
      andConditions.push({
        OR: [
          { project: { cabang: { in: childBranches, mode: 'insensitive' } } },
          { renovasi: { cabang: { in: childBranches, mode: 'insensitive' } } },
        ],
      });
    }

    // 2. Filter visibilitas bertingkat (Tiered Visibility) per role
    const tierFilter = getFungsiRuangPrismaFilter(currentUser);
    if (tierFilter) {
      andConditions.push(tierFilter);
    }

    // 3. Filter status dokumen
    if (status && status !== 'all') {
      andConditions.push({ status: { equals: status, mode: 'insensitive' } });
    }

    // 4. Filter pencarian
    if (search.trim()) {
      const q = search.trim();
      andConditions.push({
        OR: [
          { nomor_pengajuan: { contains: q, mode: 'insensitive' } },
          { nama_pemohon: { contains: q, mode: 'insensitive' } },
          { email_pemohon: { contains: q, mode: 'insensitive' } },
          { jabatan: { contains: q, mode: 'insensitive' } },
          { project: { nama_proyek: { contains: q, mode: 'insensitive' } } },
          { project: { kode: { contains: q, mode: 'insensitive' } } },
          { project: { cabang: { contains: q, mode: 'insensitive' } } },
          { renovasi: { nomor_pengajuan: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : undefined;

    const data = await prisma.dc_fungsi_ruang.findMany({
      where,
      include: {
        project: true,
        renovasi: true,
      },
      orderBy: { created_at: 'desc' },
    });

    // 5. In-memory safety verification dengan canUserViewFungsiRuangSubmission
    const filteredData = data.filter((item) => canUserViewFungsiRuangSubmission(currentUser, item));

    return NextResponse.json({
      status: 'success',
      data: filteredData,
    });
  } catch (error: any) {
    console.error('Error in dokumen/fungsi-ruang route:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal mengambil arsip dokumen fungsi ruang' },
      { status: 500 }
    );
  }
}
