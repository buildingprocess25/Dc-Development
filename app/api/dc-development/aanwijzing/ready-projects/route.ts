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

    // 1. Ambil seluruh undangan aanwijzing aktif untuk pengecekan duplikasi
    const activeAanwijzings = await prisma.dc_aanwijzing.findMany({
      where: {
        status: {
          notIn: ['ON_HOLD', 'AANWIJZING_ULANG', 'TENDER_ULANG', 'AANWIJZING_SELESAI'],
        },
      },
      select: {
        id: true,
        project_id: true,
        tender_id: true,
        fungsi_ruang_id: true,
        status: true,
      },
    });

    const activeTenderIds = new Set(
      activeAanwijzings.map((a) => a.tender_id).filter(Boolean) as number[]
    );
    const activeFungsiRuangIds = new Set(
      activeAanwijzings.map((a) => a.fungsi_ruang_id).filter(Boolean) as number[]
    );

    const readyProjects: any[] = [];

    // 2. TIER > 1M: Sumber dari Proposal Tender yang berstatus APPROVED
    const tenders = await prisma.dc_tender.findMany({
      where: {
        status: 'APPROVED',
        kategori_nilai: 'DI_ATAS_1M',
      },
      include: {
        project: true,
        renovasi: true,
        peserta: {
          where: {
            status_tahap: 'LOLOS_KUALIFIKASI',
            peran: 'MAIN_KONTRAKTOR',
          },
          include: {
            vendor: true,
          },
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    for (const t of tenders) {
      const branch = (t.cabang || t.project.cabang).toUpperCase();
      if (!isBranchAccessible(branch, userCoverage)) continue;
      if (filterCabang && filterCabang !== 'all' && branch !== filterCabang.toUpperCase()) continue;

      const hasActive = activeTenderIds.has(t.id);

      readyProjects.push({
        source_type: 'TENDER_ABOVE_1M',
        kategori_nilai: 'DI_ATAS_1M',
        tender_id: t.id,
        fungsi_ruang_id: t.fungsi_ruang_id || null,
        project_id: t.project_id,
        renovasi_id: t.renovasi_id,
        nomor_referensi: t.nomor_tender,
        nama_proyek: t.project.nama_proyek,
        kode_proyek: t.project.kode,
        cabang: branch,
        alamat_lokasi: t.project.alamat || 'Alamat proyek belum diisi di profil DC',
        nilai_proyek: t.renovasi?.grand_total || 0,
        has_active_aanwijzing: hasActive,
        kontraktor_lolos: t.peserta.map((p) => ({
          vendor_id: p.vendor_id,
          nama_perusahaan: p.vendor.nama_perusahaan,
          email: p.vendor.email,
          nomor_telepon: p.vendor.nomor_telepon,
          alamat: p.vendor.alamat,
        })),
      });
    }

    // 3. TIER < 1M: Sumber dari Fungsi Ruang yang berstatus APPROVED & bernilai < 1M
    const fungsiRuangs = await prisma.dc_fungsi_ruang.findMany({
      where: {
        status: 'APPROVED',
        renovasi: {
          kategori_nilai: 'DI_BAWAH_1M',
        },
      },
      include: {
        project: true,
        renovasi: true,
      },
      orderBy: { updated_at: 'desc' },
    });

    for (const f of fungsiRuangs) {
      const branch = f.project.cabang.toUpperCase();
      if (!isBranchAccessible(branch, userCoverage)) continue;
      if (filterCabang && filterCabang !== 'all' && branch !== filterCabang.toUpperCase()) continue;

      const hasActive = activeFungsiRuangIds.has(f.id);

      readyProjects.push({
        source_type: 'FUNGSI_RUANG_BELOW_1M',
        kategori_nilai: 'DI_BAWAH_1M',
        tender_id: null,
        fungsi_ruang_id: f.id,
        project_id: f.project_id,
        renovasi_id: f.renovasi_id,
        nomor_referensi: f.nomor_pengajuan,
        nama_proyek: f.project.nama_proyek,
        kode_proyek: f.project.kode,
        cabang: branch,
        alamat_lokasi: f.project.alamat || 'Alamat proyek belum diisi di profil DC',
        nilai_proyek: f.renovasi?.grand_total || 0,
        has_active_aanwijzing: hasActive,
        kontraktor_lolos: [], // Kontraktor dipilih manual di form (min 3)
      });
    }

    return NextResponse.json({
      status: 'success',
      data: readyProjects,
    });
  } catch (error: any) {
    console.error('Error fetching ready projects for aanwijzing:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal memuat daftar proyek siap aanwijzing' },
      { status: 500 }
    );
  }
}
