import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lingkup, spesifikasi, koefisiens } = body;
    const prefix = lingkup === 'SIPIL' ? 'SIP-' : 'ME-';

    const katStr = (spesifikasi.kategori_pekerjaan || 'Kategori')
      .replace(/\w\S*/g, (txt: string) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase())
      .replace(/\s+/g, '');

    // Cari SEMUA item dengan 6 pilar utama yang identik
    const matchingItems = await prisma.mh_master_item.findMany({
      where: {
        lingkup,
        item_material: spesifikasi.item_material || '-',
        ukuran_dimensi: spesifikasi.ukuran_dimensi || null,
        merk_brand: spesifikasi.merk_brand || null,
        warna_corak: spesifikasi.warna_corak || null,
        tipe_produk: spesifikasi.tipe_produk || null,
        ketebalan: spesifikasi.ketebalan || null,
      },
      orderBy: { id: 'desc' },
      include: {
        koefisien: true
      }
    });

    let finalNomorSeri = '';
    let finalAbjad = 'A';
    let suggested_ahs = null;
    let is_new_kode = false;
    let is_ahs_matched_another = false;
    let activeMatch = null;

    if (matchingItems.length > 0) {
      // Format payload koefisiens (jika ada) untuk perbandingan
      const payloadKoefs = koefisiens && Array.isArray(koefisiens)
        ? koefisiens
            .filter((k: any) => k.komponen_id && k.volume)
            .map((k: any) => ({
              komponen_id: Number(k.komponen_id),
              volume: Number(k.volume)
            }))
            .sort((a, b) => a.komponen_id - b.komponen_id)
        : null;

      if (!payloadKoefs || payloadKoefs.length === 0) {
        // User baru mengetik 6 pilar, belum mengirim AHS valid (atau kosong)
        // Ambil item terbaru sebagai referensi autofill
        activeMatch = matchingItems[0];
        suggested_ahs = activeMatch.koefisien;
      } else {
        // Cek apakah ada item yang AHS-nya sama persis dengan yang di-edit user
        for (const item of matchingItems) {
          const dbKoefs = item.koefisien.map(k => ({
            komponen_id: k.komponen_id,
            volume: k.volume_koefisien
          })).sort((a, b) => a.komponen_id - b.komponen_id);

          if (dbKoefs.length === payloadKoefs.length) {
            let isMatch = true;
            for (let i = 0; i < dbKoefs.length; i++) {
              if (dbKoefs[i].komponen_id !== payloadKoefs[i].komponen_id ||
                  dbKoefs[i].volume !== payloadKoefs[i].volume) {
                isMatch = false;
                break;
              }
            }
            if (isMatch) {
              activeMatch = item;
              break;
            }
          }
        }

        // Jika kita nemu match, tapi match-nya bukan item yang paling baru (yang di-autofill tadi)
        // Maka kita bisa tandai bahwa dia cocok dengan SIP lain.
        if (activeMatch && activeMatch.id !== matchingItems[0].id) {
           is_ahs_matched_another = true;
        }
      }
    }

    if (activeMatch && activeMatch.kode) {
      // Ketemu kombinasi 6 pilar + AHS yang sama persis
      finalNomorSeri = activeMatch.kode;
      
      const highestAbjadItem = await prisma.mh_master_item.findFirst({
        where: { kode: finalNomorSeri },
        orderBy: { abjad_lokasi: 'desc' }
      });

      if (highestAbjadItem && highestAbjadItem.abjad_lokasi) {
        // Cek apakah lokasi ini sudah ada
        const sameLocationItem = await prisma.mh_master_item.findFirst({
          where: { kode: finalNomorSeri, lokasi_penerapan: spesifikasi.lokasi_penerapan || null }
        });

        if (sameLocationItem && sameLocationItem.abjad_lokasi) {
          finalAbjad = sameLocationItem.abjad_lokasi;
        } else {
          finalAbjad = String.fromCharCode(highestAbjadItem.abjad_lokasi.charCodeAt(0) + 1);
        }
      }
    } else {
      // Spesifikasi BARU atau AHS diubah sehingga tidak match dengan yang ada!
      // -> Bikin kode induk baru
      is_new_kode = matchingItems.length > 0; // True JIKA 6 pilar sama tapi AHS beda (memicu pop-up)

      const lastItem = await prisma.mh_master_item.findFirst({
        where: { lingkup, kode: { not: null } },
        orderBy: { kode: 'desc' }
      });

      let nextNum = 1;
      if (lastItem && lastItem.kode && lastItem.kode.startsWith(prefix)) {
        const lastVal = parseInt(lastItem.kode.replace(prefix, ''), 10);
        if (!isNaN(lastVal)) nextNum = lastVal + 1;
      }
      finalNomorSeri = `${prefix}${nextNum.toString().padStart(3, '0')}`;
    }

    const finalCode = `${finalNomorSeri}-${finalAbjad}-${katStr}`;

    return NextResponse.json({
      status: 'success',
      data: {
        kode: finalNomorSeri,
        abjad_lokasi: finalAbjad,
        kode_anak: finalCode,
        suggested_ahs,
        is_new_kode,
        is_ahs_matched_another,
        matched_kode: activeMatch?.kode || null
      }
    });

  } catch (error: any) {
    console.error('Preview Code API Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
