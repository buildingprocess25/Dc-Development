import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { lingkup, kode_anak, kode, abjad_lokasi, spesifikasi, koefisien } = body;

    let finalKategori = spesifikasi.kategori_pekerjaan;
    if (finalKategori) {
      try {
        await prisma.mh_kategori_pekerjaan.upsert({
          where: { lingkup_nama: { lingkup, nama: finalKategori } },
          update: {},
          create: { lingkup, nama: finalKategori }
        });
      } catch (e) {
        // Ignore duplicate errors
      }
    }

    let finalLokasi = spesifikasi.lokasi_penerapan || null;
    let finalImplementasi = spesifikasi.implementasi || null;

    // Generate Deskripsi
    let parts = [];
    if (spesifikasi.item_material) parts.push(spesifikasi.item_material);
    if (spesifikasi.ukuran_dimensi) parts.push(spesifikasi.ukuran_dimensi);
    if (spesifikasi.merk_brand) parts.push(spesifikasi.merk_brand);
    if (spesifikasi.warna_corak) parts.push(spesifikasi.warna_corak);
    if (spesifikasi.tipe_produk) parts.push(`Tipe ${spesifikasi.tipe_produk}`);
    if (spesifikasi.ketebalan) parts.push(`Tebal ${spesifikasi.ketebalan}`);
    if (spesifikasi.finishing_permukaan) parts.push(spesifikasi.finishing_permukaan);
    
    if (spesifikasi.toleransi) {
       const tebalVal = parseFloat(spesifikasi.ketebalan) || 0;
       const tolVal = parseFloat(spesifikasi.toleransi) || 0;
       const minimalTebal = (tebalVal - tolVal).toFixed(2);
       const kUnit = spesifikasi.ketebalan ? spesifikasi.ketebalan.replace(/[0-9.]/g, '').trim() : 'mm';
       parts.push(`Toleransi ${spesifikasi.toleransi} (Toleransi Terukur Minimal: ${minimalTebal} ${kUnit || 'mm'})`);
    }

    if (finalLokasi) parts.push(`Lokasi ${finalLokasi}`);
    if (finalImplementasi) parts.push(`Implementasi ${finalImplementasi}`);
    if (spesifikasi.informasi_tambahan) parts.push(`(${spesifikasi.informasi_tambahan})`);

    const deskripsiOtomatis = parts.join(' ').replace(/\s+/g, ' ');

    // 3. Simpan Master Item beserta Koefisiennya
    const newItem = await prisma.mh_master_item.create({
      data: {
        kode_anak: kode_anak,
        kode: kode || null,
        abjad_lokasi: abjad_lokasi || null,
        lingkup: lingkup,
        kategori_pekerjaan: finalKategori,
        item_material: spesifikasi.item_material || '-',
        ukuran_dimensi: spesifikasi.ukuran_dimensi || null,
        merk_brand: spesifikasi.merk_brand || null,
        warna_corak: spesifikasi.warna_corak || null,
        tipe_produk: spesifikasi.tipe_produk || null,
        ketebalan: spesifikasi.ketebalan || null,
        finishing_permukaan: spesifikasi.finishing_permukaan || null,
        toleransi: spesifikasi.toleransi || null,
        implementasi: finalImplementasi || null,
        lokasi_penerapan: finalLokasi || null,
        informasi_tambahan: spesifikasi.informasi_tambahan || null,
        deskripsi_otomatis: deskripsiOtomatis,
        email_pembuat: session.email,
        
        koefisien: {
          create: koefisien.map((k: any) => ({
            komponen_id: parseInt(k.komponen_id),
            tipe: k.tipe,
            volume_koefisien: parseFloat(k.volume || k.volume_koefisien)
          }))
        }
      }
    });

    await prisma.app_audit_log.create({
      data: {
        user_email: session.email,
        modul: 'MASTER_HARGA',
        entitas: 'MASTER_ITEM',
        entitas_id: newItem.id.toString(),
        aksi: 'CREATE',
        data_baru: {
          kategori_pekerjaan: finalKategori,
          item_material: spesifikasi.item_material
        }
      }
    });

    return NextResponse.json({ status: 'success', data: newItem });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
