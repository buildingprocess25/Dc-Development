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

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const cabang = searchParams.get('cabang');

    if (!cabang) {
      return NextResponse.json({ status: 'error', message: 'Parameter cabang dibutuhkan' }, { status: 400 });
    }

    // Get all components
    const komponenList = await prisma.mh_komponen_dasar.findMany({
      orderBy: { nama_komponen: 'asc' }
    });

    // Get existing prices for this branch
    const existingPrices = await prisma.mh_harga_material_item_cabang.findMany({
      where: { coverage_cabang: cabang }
    });

    const priceMap = new Map(existingPrices.map(ep => [ep.komponen_id, ep.harga_satuan]));

    const upah = komponenList.filter(k => k.kategori === 'UPAH').map(k => ({
      ...k,
      harga_satuan: priceMap.get(k.id) || 0
    }));

    const material = komponenList.filter(k => k.kategori === 'MATERIAL').map(k => ({
      ...k,
      harga_satuan: priceMap.get(k.id) || 0
    }));

    return NextResponse.json({ status: 'success', data: { upah, material } });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { cabangs, prices } = body; 
    // cabangs: string[]
    // prices: { komponen_id: number, harga_satuan: number }[]

    if (!cabangs || !cabangs.length || !prices) {
      return NextResponse.json({ status: 'error', message: 'Payload tidak lengkap' }, { status: 400 });
    }

    // Fetch existing prices first for audit
    const oldPrices = await prisma.mh_harga_material_item_cabang.findMany({
      where: { coverage_cabang: { in: cabangs } }
    });
    const oldPriceMap = new Map();
    oldPrices.forEach(p => oldPriceMap.set(`${p.coverage_cabang}_${p.komponen_id}`, p.harga_satuan));

    // Perform upsert for each cabang and price
    const upserts: any[] = [];
    for (const coverage_cabang of cabangs) {
      const parentCabang = getParentBranch(coverage_cabang);
      for (const p of prices) {
        const oldHarga = oldPriceMap.get(`${coverage_cabang}_${p.komponen_id}`);
        
        if (oldHarga !== p.harga_satuan) {
          upserts.push(
            prisma.app_audit_log.create({
              data: {
                user_email: session.email,
                modul: 'MASTER_HARGA',
                entitas: 'HARGA_MATERIAL',
                entitas_id: `komponen_id:${p.komponen_id},coverage_cabang:${coverage_cabang}`,
                aksi: oldHarga === undefined ? 'CREATE' : 'UPDATE',
                data_lama: oldHarga === undefined ? undefined : { harga_satuan: oldHarga },
                data_baru: { harga_satuan: p.harga_satuan }
              }
            })
          );
        }

        upserts.push(
          prisma.mh_harga_material_item_cabang.upsert({
            where: {
              komponen_id_cabang_coverage_cabang: {
                komponen_id: p.komponen_id,
                cabang: parentCabang,
                coverage_cabang: coverage_cabang
              }
            },
            update: {
              harga_satuan: p.harga_satuan
            },
            create: {
              komponen_id: p.komponen_id,
              cabang: parentCabang,
              coverage_cabang: coverage_cabang,
              harga_satuan: p.harga_satuan
            }
          })
        );
      }
    }

    await prisma.$transaction(upserts);

    // RECALCULATION LOGIC:
    // Now that prices are saved, recalculate the items that use these components in these branches
    const affectedItemCabangs = await prisma.mh_item_cabang.findMany({
      where: { coverage_cabang: { in: cabangs } },
      include: {
        master_item: {
          include: { koefisien: true }
        }
      }
    });

    if (affectedItemCabangs.length > 0) {
      // Fetch current material prices for this branch
      const allMaterialPricesNow = await prisma.mh_harga_material_item_cabang.findMany({
        where: { coverage_cabang: { in: cabangs } }
      });
      const materialPriceMap = new Map();
      allMaterialPricesNow.forEach(p => {
        materialPriceMap.set(`${p.coverage_cabang}_${p.komponen_id}`, p.harga_satuan);
      });

      // Fetch current upah prices for these items in these branches
      const allUpahPricesNow = await prisma.mh_harga_upah_item_cabang.findMany({
        where: { 
          coverage_cabang: { in: cabangs },
          master_item_id: { in: affectedItemCabangs.map(ic => ic.master_item_id) }
        }
      });
      const upahPriceMap = new Map();
      allUpahPricesNow.forEach(p => {
        upahPriceMap.set(`${p.master_item_id}_${p.komponen_id}_${p.coverage_cabang}`, p.harga_satuan);
      });

      const recalculateOps = [];
      for (const itemCabang of affectedItemCabangs) {
        let total_upah = 0;
        let total_material = 0;
        
        for (const k of itemCabang.master_item.koefisien) {
            if (k.tipe === 'UPAH') {
              const harga = upahPriceMap.get(`${itemCabang.master_item_id}_${k.komponen_id}_${itemCabang.coverage_cabang}`) || 0;
              total_upah += harga * k.volume_koefisien;
            } else {
              const harga = materialPriceMap.get(`${itemCabang.coverage_cabang}_${k.komponen_id}`) || 0;
              total_material += harga * k.volume_koefisien;
            }
        }
        const harga_kalkulasi = total_upah + total_material;
        const harga_release = Math.ceil(harga_kalkulasi / 1000) * 1000;
        
        recalculateOps.push(
            prisma.mh_item_cabang.update({
              where: { id: itemCabang.id },
              data: {
                  total_upah,
                  total_material,
                  harga_kalkulasi: harga_kalkulasi,
                  harga_release: harga_release
              }
            })
        );
      }

      await prisma.$transaction(recalculateOps);
    }

    return NextResponse.json({ status: 'success', message: 'Harga berhasil disimpan' });
  } catch (error: any) {
    console.error('API Error (POST):', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
