import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { toTitleCase } from '@/lib/utils';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches } from '@/lib/branches';

export async function GET() {
  try {
    const session = await getSession();
    const allowedBranches = getUserCoverageBranches(session);

    const projectWhere: any = {};
    if (allowedBranches !== null) {
      projectWhere.cabang = {
        in: allowedBranches,
        mode: 'insensitive',
      };
    }

    // 1. Ambil list semua proyek (DC, Warehouse, Depo, Store-Hub, Bulky, dll) beserta pengajuan aktifnya
    const projectsRaw = await prisma.dc_project.findMany({
      where: projectWhere,
      include: {
        renovasi: {
          where: {
            status: { not: 'SELESAI' }
          },
          select: {
            id: true,
            nomor_pengajuan: true,
            status: true,
            created_by: true,
            created_at: true
          },
          orderBy: { id: 'desc' },
          take: 1
        }
      },
      orderBy: { nama_proyek: 'asc' }
    });

    const projects = projectsRaw.map((p) => {
      const active = p.renovasi && p.renovasi.length > 0 ? p.renovasi[0] : null;
      const { renovasi, ...rest } = p;
      return {
        ...rest,
        active_renovasi: active
      };
    });

    // 2. Ambil jenis renovasi dinamis dari dc_renovasi (status bukan DRAFT)
    const distinctJenisRaw = await prisma.dc_renovasi.findMany({
      where: {
        status: { not: 'DRAFT' }
      },
      select: {
        jenis_renovasi: true
      },
      distinct: ['jenis_renovasi']
    });

    const defaultJenis = ['Renovasi Perluasan', 'Renovasi Peremajaan'];
    const jenisSet = new Set<string>();

    defaultJenis.forEach((j) => jenisSet.add(toTitleCase(j.trim())));
    distinctJenisRaw.forEach((row) => {
      if (row.jenis_renovasi && row.jenis_renovasi.trim()) {
        jenisSet.add(toTitleCase(row.jenis_renovasi.trim()));
      }
    });

    const jenisRenovasiOptions = Array.from(jenisSet);

    // 3. Ambil riwayat item bebas (is_custom = true atau master_item_id null) dari pengajuan non-DRAFT
    const historicalItemsRaw = await prisma.dc_renovasi_item.findMany({
      where: {
        OR: [
          { is_custom: true },
          { master_item_id: null }
        ],
        deskripsi: { not: '' },
        renovasi: {
          status: { not: 'DRAFT' }
        }
      },
      select: {
        id: true,
        deskripsi: true,
        lingkup: true,
        kategori_pekerjaan: true,
        harga_material: true,
        harga_upah: true,
        created_at: true,
        renovasi: {
          select: {
            cabang: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // Kelompokkan item riwayat berdasarkan lingkup, kategori_pekerjaan, dan deskripsi
    const historyMap = new Map<string, {
      deskripsi: string;
      lingkup: string;
      kategori_pekerjaan: string;
      latest_national_material: number;
      latest_national_upah: number;
      branch_prices: Record<string, { material: number; upah: number }>;
    }>();

    for (const item of historicalItemsRaw) {
      const cleanDeskripsi = (item.deskripsi || '').trim();
      if (!cleanDeskripsi) continue;

      const normLingkup = (item.lingkup || 'SIPIL').toUpperCase();
      const normCat = (item.kategori_pekerjaan || '').trim();
      const key = `${normLingkup}:::${normCat.toLowerCase()}:::${cleanDeskripsi.toLowerCase()}`;

      const cabangUpper = (item.renovasi?.cabang || '').trim().toUpperCase();
      const mat = Number(item.harga_material) || 0;
      const upah = Number(item.harga_upah) || 0;

      if (!historyMap.has(key)) {
        historyMap.set(key, {
          deskripsi: cleanDeskripsi,
          lingkup: normLingkup,
          kategori_pekerjaan: normCat,
          latest_national_material: mat,
          latest_national_upah: upah,
          branch_prices: {}
        });
      }

      const entry = historyMap.get(key)!;
      // Karena di-order by created_at desc, entri pertama untuk setiap cabang adalah harga terbaru cabang tersebut
      if (cabangUpper && !entry.branch_prices[cabangUpper]) {
        entry.branch_prices[cabangUpper] = {
          material: mat,
          upah: upah
        };
      }
    }

    const customItemHistory = Array.from(historyMap.values());

    // 4. Ambil kategori pekerjaan
    const categories = await prisma.mh_kategori_pekerjaan.findMany({
      orderBy: { id: 'asc' }
    });

    // 5. Ambil master items beserta harga cabangnya
    const masterItems = await prisma.mh_master_item.findMany({
      include: {
        item_cabang: true
      },
      orderBy: { id: 'asc' }
    });

    return NextResponse.json({
      status: 'success',
      data: {
        projects,
        jenisRenovasiOptions,
        presets: jenisRenovasiOptions.map((nama) => ({ nama, is_default: false })),
        categories,
        masterItems,
        customItemHistory
      }
    });
  } catch (error: any) {
    console.error('Error fetching renovasi master data:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
