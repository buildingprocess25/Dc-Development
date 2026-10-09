import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ambil semua komponen beserta harga default-nya (misal cabang JAKARTA sebagai preview)
    const komponen = await prisma.mh_komponen_dasar.findMany({
      include: {
        harga_cabang: {
          where: { cabang: 'JAKARTA' },
          take: 1
        }
      },
      orderBy: {
        nama_komponen: 'asc'
      }
    });

    const upah = komponen.filter(k => k.kategori === 'UPAH').map(k => ({
      id: k.id,
      nama_komponen: k.nama_komponen,
      satuan: k.satuan,
      harga_preview: k.harga_cabang[0]?.harga_satuan || 0
    }));

    const material = komponen.filter(k => k.kategori === 'MATERIAL').map(k => ({
      id: k.id,
      nama_komponen: k.nama_komponen,
      satuan: k.satuan,
      harga_preview: k.harga_cabang[0]?.harga_satuan || 0
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
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { kategori, nama_komponen, satuan } = body;

    if (!kategori || !nama_komponen || !satuan) {
      return NextResponse.json({ status: 'error', message: 'Semua field wajib diisi' }, { status: 400 });
    }

    const newKomponen = await prisma.mh_komponen_dasar.create({
      data: {
        kategori,
        nama_komponen,
        satuan,
        email: session.email
      }
    });

    return NextResponse.json({ status: 'success', data: newKomponen });
  } catch (error: any) {
    console.error('API Error (POST):', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
