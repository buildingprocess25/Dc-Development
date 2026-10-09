import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { CABANG_GRUP } from '@/lib/branches';

function getParentBranch(coverage: string): string {
   for (const [parent, children] of Object.entries(CABANG_GRUP)) {
      if (children.includes(coverage)) {
         return parent;
      }
   }
   return coverage;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { master_item_id, activeBranches } = await request.json();

    if (!master_item_id || !Array.isArray(activeBranches)) {
       return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
    }

    // 1. Get all current branches for this item
    const existing = await prisma.mh_item_cabang.findMany({
       where: { master_item_id: master_item_id }
    });

    const existingCoverageNames = new Set(existing.map(e => e.coverage_cabang));
    const newCoverageNames = new Set(activeBranches as string[]);

    // We will do this in a transaction
    const ops = [];

    // For all existing ones, update status_aktif
    for (const ex of existing) {
       const shouldBeActive = newCoverageNames.has(ex.coverage_cabang);
       if (ex.status_aktif !== shouldBeActive) {
          ops.push(
             prisma.mh_item_cabang.update({
                where: { id: ex.id },
                data: { status_aktif: shouldBeActive }
             })
          );
          
          ops.push(
             prisma.app_audit_log.create({
                data: {
                   user_email: session.email,
                   modul: 'MASTER_HARGA',
                   entitas: 'STATUS_CABANG',
                   entitas_id: ex.id.toString(),
                   aksi: shouldBeActive ? 'ACTIVATE' : 'DEACTIVATE',
                   data_lama: { status_aktif: ex.status_aktif, cabang: ex.coverage_cabang },
                   data_baru: { status_aktif: shouldBeActive, cabang: ex.coverage_cabang }
                }
             })
          );
       }
    }

    // For new ones that don't exist yet in mh_item_cabang, create them
    if (newCoverageNames.size > 0) {
       // Get koefisiens to calculate initial 0s or actual prices
       const koefisiens = await prisma.mh_analisa_koefisien.findMany({
          where: { master_item_id: master_item_id }
       });

       for (const b of newCoverageNames) {
          if (!existingCoverageNames.has(b)) {
             const parentBranch = getParentBranch(b);
             let total_upah = 0;
             let total_material = 0;

             if (koefisiens.length > 0) {
                const hargaMaterial = await prisma.mh_harga_material_item_cabang.findMany({
                   where: {
                      coverage_cabang: b,
                      komponen_id: { in: koefisiens.filter(k => k.tipe === 'MATERIAL').map(k => k.komponen_id) }
                   }
                });

                const hargaUpah = await prisma.mh_harga_upah_item_cabang.findMany({
                   where: {
                      coverage_cabang: b,
                      master_item_id: master_item_id,
                      komponen_id: { in: koefisiens.filter(k => k.tipe === 'UPAH').map(k => k.komponen_id) }
                   }
                });
                
                const hargaMaterialMap = new Map();
                hargaMaterial.forEach(hk => hargaMaterialMap.set(hk.komponen_id, hk.harga_satuan));

                const hargaUpahMap = new Map();
                hargaUpah.forEach(hk => hargaUpahMap.set(hk.komponen_id, hk.harga_satuan));

                for (const k of koefisiens) {
                   if (k.tipe === 'UPAH') {
                      const harga = hargaUpahMap.get(k.komponen_id) || 0;
                      total_upah += harga * k.volume_koefisien;
                   } else {
                      const harga = hargaMaterialMap.get(k.komponen_id) || 0;
                      total_material += harga * k.volume_koefisien;
                   }
                }
             }

             const harga_kalkulasi = total_upah + total_material;
             const harga_release = Math.ceil(harga_kalkulasi / 1000) * 1000;

             const createCabangData = {
                master_item_id: master_item_id,
                cabang: parentBranch,
                coverage_cabang: b,
                total_upah: total_upah,
                total_material: total_material,
                harga_kalkulasi: harga_kalkulasi,
                harga_release: harga_release,
                status_aktif: true
             };

             ops.push(
                prisma.mh_item_cabang.create({
                   data: createCabangData
                })
             );
             
             ops.push(
                prisma.app_audit_log.create({
                   data: {
                      user_email: session.email,
                      modul: 'MASTER_HARGA',
                      entitas: 'STATUS_CABANG',
                      entitas_id: `master_item_id:${master_item_id},coverage_cabang:${b}`,
                      aksi: 'CREATE',
                      data_baru: createCabangData
                   }
                })
             );
          }
       }
    }

    await prisma.$transaction(ops);

    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
