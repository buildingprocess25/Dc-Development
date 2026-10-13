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

    // 2. Ambil preset jenis renovasi (seed jika belum ada)
    let presets = await prisma.dc_jenis_renovasi_preset.findMany({
      orderBy: { id: 'asc' }
    });

    if (presets.length === 0) {
      await prisma.dc_jenis_renovasi_preset.createMany({
        data: [
          { nama: 'Renovasi Perluasan', is_default: true },
          { nama: 'Renovasi Peremajaan', is_default: true }
        ],
        skipDuplicates: true
      });
      presets = await prisma.dc_jenis_renovasi_preset.findMany({
        orderBy: { id: 'asc' }
      });
    }

    // 3. Ambil kategori pekerjaan
    const categories = await prisma.mh_kategori_pekerjaan.findMany({
      orderBy: { id: 'asc' }
    });

    // 4. Ambil master items beserta harga cabangnya
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
        presets: presets.map((p) => ({ ...p, nama: toTitleCase(p.nama) })),
        categories,
        masterItems
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
