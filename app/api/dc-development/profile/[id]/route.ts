import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) return NextResponse.json({ status: 'error', message: 'ID tidak valid' }, { status: 400 });

    const body = await request.json();

    const updated = await prisma.dc_project.update({
      where: { id },
      data: {
        ...body,
        id: undefined, // ensure id is not updated
        created_at: undefined,
        updated_at: undefined
      }
    });

    return NextResponse.json({ status: 'success', data: updated });
  } catch (error: any) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal mengupdate data' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) return NextResponse.json({ status: 'error', message: 'ID tidak valid' }, { status: 400 });

    await prisma.dc_project.delete({
      where: { id }
    });

    return NextResponse.json({ status: 'success', message: 'Profile berhasil dihapus' });
  } catch (error: any) {
    console.error("Error deleting profile:", error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal menghapus data' },
      { status: 500 }
    );
  }
}
