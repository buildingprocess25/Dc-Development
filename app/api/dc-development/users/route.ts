import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const users = await prisma.dc_users.findMany({
      orderBy: { id: 'desc' }
    });
    return NextResponse.json({ status: 'success', data: users });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Check if email exists
    const existing = await prisma.dc_users.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ status: 'error', message: 'Email sudah terdaftar' }, { status: 400 });
    }

    const user = await prisma.dc_users.create({
      data: {
        email: data.email,
        nama: data.nama,
        cabang: data.cabang,
        role: data.role,
        nama_pt: data.nama_pt || null,
        akses_menu: data.akses_menu || null,
        coverage_cabang: data.coverage_cabang || null,
      }
    });

    return NextResponse.json({ status: 'success', data: user });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    
    if (!data.id) {
      return NextResponse.json({ status: 'error', message: 'ID User diperlukan' }, { status: 400 });
    }

    const user = await prisma.dc_users.update({
      where: { id: data.id },
      data: {
        nama: data.nama,
        cabang: data.cabang,
        role: data.role,
        nama_pt: data.nama_pt || null,
        akses_menu: data.akses_menu || null,
        coverage_cabang: data.coverage_cabang || null,
      }
    });

    return NextResponse.json({ status: 'success', data: user });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

