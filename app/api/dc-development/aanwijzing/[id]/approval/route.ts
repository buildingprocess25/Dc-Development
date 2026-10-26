import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canUserApproveAanwijzing } from '@/lib/permissions';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { status: 'error', message: 'Sesi login tidak valid' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const aanwijzingId = parseInt(id, 10);
    if (isNaN(aanwijzingId)) {
      return NextResponse.json(
        { status: 'error', message: 'ID Undangan tidak valid' },
        { status: 400 }
      );
    }

    const dbUser = await prisma.dc_users.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        role: true,
        cabang: true,
        nama: true,
        coverage_cabang: true,
      },
    });
    const currentUser = dbUser || session;

    const aanwijzing = await prisma.dc_aanwijzing.findUnique({
      where: { id: aanwijzingId },
      include: {
        project: true,
        peserta: {
          include: { vendor: true },
        },
      },
    });

    if (!aanwijzing) {
      return NextResponse.json(
        { status: 'error', message: 'Data Undangan Aanwijzing tidak ditemukan' },
        { status: 404 }
      );
    }

    // Validasi izin approval DC Building & Development Manager
    if (!canUserApproveAanwijzing(currentUser, aanwijzing)) {
      return NextResponse.json(
        {
          status: 'error',
          message:
            'Akses ditolak: Hanya DC Building & Development Manager (atau Admin) yang berhak memberikan persetujuan ini.',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, notes } = body; // action: "LANJUT" | "ON_HOLD"

    if (!action || !['LANJUT', 'ON_HOLD'].includes(action)) {
      return NextResponse.json(
        { status: 'error', message: 'Aksi persetujuan harus LANJUT atau ON_HOLD' },
        { status: 400 }
      );
    }

    if (action === 'ON_HOLD' && (!notes || !notes.trim())) {
      return NextResponse.json(
        { status: 'error', message: 'Wajib memberikan catatan alasan jika memilih ON HOLD / Tidak Lanjut' },
        { status: 400 }
      );
    }

    const newStatus = action === 'LANJUT' ? 'AANWIJZING_LANJUT' : 'ON_HOLD';
    const auditAction =
      action === 'LANJUT' ? 'APPROVAL_DC_MANAGER_LANJUT' : 'APPROVAL_DC_MANAGER_ON_HOLD';
    const defaultNotes =
      action === 'LANJUT'
        ? 'Aanwijzing disetujui tetap dilaksanakan dengan rekanan kontraktor yang hadir.'
        : 'Aanwijzing ditangguhkan (ON HOLD) karena jumlah rekanan yang hadir tidak mencukupi.';

    const updatedAanwijzing = await prisma.$transaction(async (tx) => {
      const updated = await tx.dc_aanwijzing.update({
        where: { id: aanwijzingId },
        data: {
          status: newStatus,
        },
        include: {
          project: true,
          peserta: {
            include: { vendor: true },
          },
        },
      });

      await tx.dc_aanwijzing_audit_log.create({
        data: {
          aanwijzing_id: aanwijzingId,
          user_email: currentUser.email,
          user_name: (currentUser as any).nama || currentUser.email,
          user_role: currentUser.role,
          action: auditAction,
          from_status: aanwijzing.status,
          to_status: newStatus,
          notes: notes?.trim() || defaultNotes,
        },
      });

      return updated;
    });

    return NextResponse.json({
      status: 'success',
      message:
        action === 'LANJUT'
          ? 'Undangan Aanwijzing berhasil disetujui untuk tetap dilanjutkan'
          : 'Undangan Aanwijzing berhasil di-set menjadi ON HOLD',
      data: updatedAanwijzing,
    });
  } catch (error: any) {
    console.error('Error approving aanwijzing:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal memproses keputusan approval' },
      { status: 500 }
    );
  }
}
