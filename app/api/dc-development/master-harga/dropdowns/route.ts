import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const DEFAULT_SIPIL = [
  "PEKERJAAN PERSIAPAN", "PEKERJAAN BOBOKAN / BONGKARAN", "PEKERJAAN TANAH",
  "PEKERJAAN PONDASI & BETON", "PEKERJAAN PASANGAN", "PEKERJAAN BESI",
  "PEKERJAAN KERAMIK", "PEKERJAAN PLUMBING", "PEKERJAAN SANITARY & ACECORIES",
  "PEKERJAAN JANITOR", "PEKERJAAN ATAP", "PEKERJAAN KUSEN, PINTU & KACA",
  "PEKERJAAN FINISHING", "PEKERJAAN BEANSPOT", "PEKERJAAN AREA TERBUKA", "PEKERJAAN TAMBAHAN"
];

const DEFAULT_ME = ["INSTALASI", "FIXTURE", "PEKERJAAN TAMBAHAN"];


export async function GET() {
  try {
    // 1. Cek Kategori Pekerjaan Sipil
    const countSipil = await prisma.mh_kategori_pekerjaan.count({ where: { lingkup: 'SIPIL' } });
    if (countSipil === 0) {
      await prisma.mh_kategori_pekerjaan.createMany({
        data: DEFAULT_SIPIL.map(n => ({ lingkup: 'SIPIL', nama: n }))
      });
    }

    // 2. Cek Kategori Pekerjaan ME
    const countME = await prisma.mh_kategori_pekerjaan.count({ where: { lingkup: 'ME' } });
    if (countME === 0) {
      await prisma.mh_kategori_pekerjaan.createMany({
        data: DEFAULT_ME.map(n => ({ lingkup: 'ME', nama: n }))
      });
    }


    // Fetch data
    const kategori = await prisma.mh_kategori_pekerjaan.findMany({ orderBy: { id: 'asc' } });
    
    // Fetch unique specs from master item for recommendations
    const masterItems = await prisma.mh_master_item.findMany({
      select: {
        ukuran_dimensi: true,
        merk_brand: true,
        warna_corak: true,
        tipe_produk: true,
        lokasi_penerapan: true,
        implementasi: true,
        finishing_permukaan: true,
        ketebalan: true,
        toleransi: true,
      }
    });

    // Extract unique non-null values
    const uniqueVals = (field: keyof typeof masterItems[0]) => 
      Array.from(new Set(masterItems.map(item => item[field]).filter(Boolean))) as string[];

    // Extract unique units (remove numbers and dots)
    const extractUnits = (field: keyof typeof masterItems[0]) => {
      const units = new Set<string>();
      masterItems.forEach(item => {
        const val = item[field] as string;
        if (val) {
           const unit = val.replace(/[0-9.]/g, '').trim();
           if (unit) units.add(unit);
        }
      });
      return Array.from(units);
    };

    let permukaan = uniqueVals('finishing_permukaan');
    if (permukaan.length === 0) {
      permukaan = ["Matte", "Glossy", "Polished", "Unpolished"];
    }

    let ketebalanUnits = extractUnits('ketebalan');
    if (ketebalanUnits.length === 0) ketebalanUnits = ["mm", "cm"];

    let toleransiUnits = extractUnits('toleransi');
    if (toleransiUnits.length === 0) toleransiUnits = ["mm", "cm"];

    const recommendations = {
      ukuran_dimensi: uniqueVals('ukuran_dimensi'),
      merk_brand: uniqueVals('merk_brand'),
      warna_corak: uniqueVals('warna_corak'),
      tipe_produk: uniqueVals('tipe_produk'),
      lokasi_penerapan: uniqueVals('lokasi_penerapan'),
      implementasi: uniqueVals('implementasi'),
      finishing_permukaan: permukaan,
      ketebalan_units: ketebalanUnits,
      toleransi_units: toleransiUnits,
    };

    return NextResponse.json({
      status: 'success',
      data: {
        kategori_sipil: kategori.filter(k => k.lingkup === 'SIPIL'),
        kategori_me: kategori.filter(k => k.lingkup === 'ME'),
        recommendations
      }
    });
  } catch (error: any) {
    console.error('Dropdown API Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
