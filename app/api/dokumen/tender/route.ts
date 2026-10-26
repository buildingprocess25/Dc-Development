import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches, getBranchesUnderInduk } from '@/lib/branches';
import { getTenderPrismaFilter, canUserViewTenderSubmission } from '@/lib/permissions';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { status: 'error', message: 'Sesi login tidak valid' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const cabang = searchParams.get('cabang') || '';
    const status = searchParams.get('status') || '';
    const kategoriNilai = searchParams.get('kategori_nilai') || '';

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
    const andConditions: Prisma.dc_tenderWhereInput[] = [];

    // 1. Filter coverage cabang akun pengguna
    if (allowedBranches !== null) {
      if (cabang && cabang !== 'all') {
        const childBranches = getBranchesUnderInduk(cabang);
        const intersect = childBranches.filter((b) =>
          allowedBranches.includes(b.toUpperCase())
        );
        andConditions.push({
          OR: [
            { cabang: { in: intersect, mode: 'insensitive' } },
            { project: { cabang: { in: intersect, mode: 'insensitive' } } },
          ],
        });
      } else {
        andConditions.push({
          OR: [
            { cabang: { in: allowedBranches, mode: 'insensitive' } },
            { project: { cabang: { in: allowedBranches, mode: 'insensitive' } } },
          ],
        });
      }
    } else if (cabang && cabang !== 'all') {
      const childBranches = getBranchesUnderInduk(cabang);
      andConditions.push({
        OR: [
          { cabang: { in: childBranches, mode: 'insensitive' } },
          { project: { cabang: { in: childBranches, mode: 'insensitive' } } },
        ],
      });
    }

    // 2. Filter visibilitas bertingkat (Tiered Visibility) per role
    const tierFilter = getTenderPrismaFilter(currentUser);
    if (tierFilter) {
      andConditions.push(tierFilter);
    }

    // 3. Filter status dokumen
    if (status && status !== 'all') {
      andConditions.push({ status: { equals: status, mode: 'insensitive' } });
    }

    // 4. Filter kategori nilai (threshold pagu)
    if (kategoriNilai && kategoriNilai !== 'all') {
      andConditions.push({ kategori_nilai: { equals: kategoriNilai } });
    }

    // 5. Filter pencarian
    if (search.trim()) {
      const q = search.trim();
      andConditions.push({
        OR: [
          { nomor_tender: { contains: q, mode: 'insensitive' } },
          { cabang: { contains: q, mode: 'insensitive' } },
          { created_by: { contains: q, mode: 'insensitive' } },
          { project: { nama_proyek: { contains: q, mode: 'insensitive' } } },
          { project: { kode: { contains: q, mode: 'insensitive' } } },
          { project: { cabang: { contains: q, mode: 'insensitive' } } },
          {
            peserta: {
              some: {
                vendor: {
                  nama_perusahaan: { contains: q, mode: 'insensitive' },
                },
              },
            },
          },
        ],
      });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : undefined;

    const data = await prisma.dc_tender.findMany({
      where,
      include: {
        project: true,
        renovasi: true,
        fungsi_ruang: true,
        peserta: {
          include: {
            vendor: true,
          },
        },
        schedule: {
          orderBy: { urutan: 'asc' },
        },
        audit_logs: {
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // 6. In-memory safety verification dengan canUserViewTenderSubmission
    const filteredData = data.filter((item) =>
      canUserViewTenderSubmission(currentUser, item)
    );

    return NextResponse.json({
      status: 'success',
      data: filteredData,
    });
  } catch (error: any) {
    console.error('Error in dokumen/tender route:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Gagal mengambil arsip dokumen tender.',
      },
      { status: 500 }
    );
  }
}
