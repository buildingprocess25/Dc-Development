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

    // Get all Master Items that have UPAH in their koefisien
    const items = await prisma.mh_master_item.findMany({
      where: {
        koefisien: {
          some: {
            tipe: 'UPAH'
          }
        }
      },
      include: {
        koefisien: {
          where: { tipe: 'UPAH' },
          include: {
            komponen: true
          }
        },
        harga_upah_cabang: {
          where: { coverage_cabang: cabang }
        }
      },
      orderBy: [
        { kategori_pekerjaan: 'asc' },
        { id: 'asc' }
      ]
    });

    return NextResponse.json({ status: 'success', data: items });
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
    const { cabang, prices } = body; 
    // cabang: string
    // prices: { master_item_id: number, komponen_id: number, harga_satuan: number }[]

    if (!cabang || !prices) {
      return NextResponse.json({ status: 'error', message: 'Payload tidak lengkap' }, { status: 400 });
    }

    const oldPrices = await prisma.mh_harga_upah_item_cabang.findMany({
      where: { coverage_cabang: cabang }
    });
    const oldPriceMap = new Map();
    oldPrices.forEach(p => oldPriceMap.set(`${p.master_item_id}_${p.komponen_id}`, p.harga_satuan));

    // Upsert prices for Upah
    const parentCabang = getParentBranch(cabang);
    const upserts: any[] = [];
    
    for (const p of prices) {
      const oldHarga = oldPriceMap.get(`${p.master_item_id}_${p.komponen_id}`);
      
      if (oldHarga !== p.harga_satuan) {
        upserts.push(
          prisma.app_audit_log.create({
            data: {
              user_email: session.email,
              modul: 'MASTER_HARGA',
              entitas: 'HARGA_UPAH',
              entitas_id: `master_item_id:${p.master_item_id},komponen_id:${p.komponen_id},coverage_cabang:${cabang}`,
              aksi: oldHarga === undefined ? 'CREATE' : 'UPDATE',
              data_lama: oldHarga === undefined ? undefined : { harga_satuan: oldHarga },
              data_baru: { harga_satuan: p.harga_satuan }
            }
          })
        );
      }

      upserts.push(
        prisma.mh_harga_upah_item_cabang.upsert({
          where: {
            master_item_id_komponen_id_cabang_coverage_cabang: {
              master_item_id: p.master_item_id,
              komponen_id: p.komponen_id,
              cabang: parentCabang,
              coverage_cabang: cabang
            }
          },
          update: { harga_satuan: p.harga_satuan },
          create: {
            master_item_id: p.master_item_id,
            komponen_id: p.komponen_id,
            cabang: parentCabang,
            coverage_cabang: cabang,
            harga_satuan: p.harga_satuan
          }
        })
      );
    }

    await prisma.$transaction(upserts);

    // RECALCULATE `mh_item_cabang`
    const affectedItemIds = Array.from(new Set(prices.map((p: any) => p.master_item_id))) as number[];
    
    const affectedItemCabangs = await prisma.mh_item_cabang.findMany({
      where: { 
        master_item_id: { in: affectedItemIds },
        coverage_cabang: cabang
      },
      include: {
        master_item: {
          include: { koefisien: true }
        }
      }
    });

    if (affectedItemCabangs.length > 0) {
      // Fetch current material prices for this branch
      const materialPrices = await prisma.mh_harga_material_item_cabang.findMany({
        where: { coverage_cabang: cabang }
      });
      const materialPriceMap = new Map();
      materialPrices.forEach(p => materialPriceMap.set(p.komponen_id, p.harga_satuan));

      // Fetch current upah prices for this branch
      const upahPrices = await prisma.mh_harga_upah_item_cabang.findMany({
        where: { coverage_cabang: cabang, master_item_id: { in: affectedItemIds } }
      });
      const upahPriceMap = new Map();
      upahPrices.forEach(p => upahPriceMap.set(`${p.master_item_id}_${p.komponen_id}`, p.harga_satuan));

      const recalculateOps = [];
      for (const itemCabang of affectedItemCabangs) {
        let total_upah = 0;
        let total_material = 0;
        
        for (const k of itemCabang.master_item.koefisien) {
            if (k.tipe === 'UPAH') {
              const harga = upahPriceMap.get(`${itemCabang.master_item_id}_${k.komponen_id}`) || 0;
              total_upah += harga * k.volume_koefisien;
            } else {
              const harga = materialPriceMap.get(k.komponen_id) || 0;
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

    return NextResponse.json({ status: 'success', message: 'Harga upah berhasil disimpan' });
  } catch (error: any) {
    console.error('API Error (POST):', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
