import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Sesi login tidak valid' }, { status: 401 });
    }

    // Ambil data user langsung dari tabel dc_users untuk mendapatkan nilai kolom coverage_cabang terkini
    const dbUser = await prisma.dc_users.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        cabang: true,
        role: true,
        coverage_cabang: true,
      },
    });

    const userCoverage = getUserCoverageBranches(dbUser || session);

    const whereClause: any = {
      status: 'APPROVED',
    };

    // Filter langsung di query database jika bukan DC Admin
    if (userCoverage !== null) {
      whereClause.OR = [
        { cabang: { in: userCoverage, mode: 'insensitive' } },
        { project: { cabang: { in: userCoverage, mode: 'insensitive' } } },
      ];
    }

    // Ambil proyek renovasi yang berstatus APPROVED sesuai coverage_cabang
    const approvedRenovasi = await prisma.dc_renovasi.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            kode: true,
            nama_proyek: true,
            tipe: true,
            cabang: true,
            fungsi_ruang: {
              where: {
                status: {
                  not: 'APPROVED',
                },
              },
              select: {
                id: true,
                nomor_pengajuan: true,
                status: true,
                nama_pemohon: true,
                created_by: true,
                created_at: true,
              },
              orderBy: { id: 'desc' },
              take: 1,
            },
          },
        },
        fungsi_ruang: {
          where: {
            status: {
              not: 'APPROVED',
            },
          },
          select: {
            id: true,
            nomor_pengajuan: true,
            status: true,
            nama_pemohon: true,
            created_by: true,
            created_at: true,
          },
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    // Filter validasi tambahan menggunakan isBranchAccessible (memastikan grup & induk cabang terpenuhi)
    const filtered = approvedRenovasi.filter((item) => {
      const itemCabang = (item.cabang || item.project?.cabang || '').toUpperCase();
      return isBranchAccessible(itemCabang, userCoverage);
    });

    return NextResponse.json({
      status: 'success',
      data: filtered.map((r) => {
        const active =
          (r.fungsi_ruang && r.fungsi_ruang.length > 0 ? r.fungsi_ruang[0] : null) ||
          (r.project?.fungsi_ruang && r.project.fungsi_ruang.length > 0 ? r.project.fungsi_ruang[0] : null);

        const projectData = r.project ? {
          id: r.project.id,
          kode: r.project.kode,
          nama_proyek: r.project.nama_proyek,
          tipe: r.project.tipe,
          cabang: r.project.cabang,
        } : null;

        return {
          id: r.id,
          nomor_pengajuan: r.nomor_pengajuan,
          jenis_renovasi: r.jenis_renovasi,
          cabang: r.cabang,
          project_id: r.project_id,
          project: projectData,
          active_fungsi_ruang: active,
        };
      }),
    });
  } catch (error: any) {
    console.error('Error fetching approved projects for fungsi ruang:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal mengambil daftar proyek renovasi approved' },
      { status: 500 }
    );
  }
}
