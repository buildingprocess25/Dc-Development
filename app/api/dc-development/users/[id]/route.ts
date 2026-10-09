import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await request.json();
    
    // Check email uniqueness if email is being updated
    if (data.email) {
      const existing = await prisma.dc_users.findFirst({
        where: { 
          email: data.email,
          id: { not: Number(id) }
        }
      });
      if (existing) {
        return NextResponse.json({ status: 'error', message: 'Email sudah digunakan pengguna lain' }, { status: 400 });
      }
    }

    const updated = await prisma.dc_users.update({
      where: { id: Number(id) },
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

    return NextResponse.json({ status: 'success', data: updated });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.dc_users.delete({ where: { id: Number(id) } });
    return NextResponse.json({ status: 'success' });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
