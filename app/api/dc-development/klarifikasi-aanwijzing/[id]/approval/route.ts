import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canUserApproveKlarifikasiAanwijzing } from '@/lib/permissions';
import { syncBeritaAcaraToGoogleDrive } from '@/lib/pdf/berita-acara-aanwijzing-pdf.service';

/**
 * POST /api/dc-development/klarifikasi-aanwijzing/[id]/approval
 * Menangani aksi persetujuan bertingkat (APPROVE atau REVISI)
 */
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
    const klarifikasiId = parseInt(id, 10);
    if (isNaN(klarifikasiId)) {
      return NextResponse.json(
        { status: 'error', message: 'ID Klarifikasi tidak valid' },
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

    const klarifikasi = await prisma.dc_aanwijzing_klarifikasi.findUnique({
      where: { id: klarifikasiId },
      include: {
        project: true,
      },
    });

    if (!klarifikasi) {
      return NextResponse.json(
        { status: 'error', message: 'Data Berita Acara Klarifikasi tidak ditemukan' },
        { status: 404 }
      );
    }

    // Validasi wewenang approval sesuai tahap saat ini
    if (!canUserApproveKlarifikasiAanwijzing(currentUser, klarifikasi)) {
      return NextResponse.json(
        {
          status: 'error',
          message:
            'Akses ditolak: Anda tidak memiliki wewenang untuk menyetujui dokumen ini pada tahapan status saat ini.',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, notes, detail_revisi } = body; // action: "APPROVE" | "REVISI"

    if (action !== 'APPROVE' && action !== 'REVISI') {
      return NextResponse.json(
        { status: 'error', message: 'Aksi persetujuan harus bernilai APPROVE atau REVISI' },
        { status: 400 }
      );
    }

    const hasGranularItems = Array.isArray(detail_revisi) && detail_revisi.length > 0;

    // SOP ATURAN REVISI:
    // 1. Jika tidak ada item yang diceklis, catatan general wajib diisi.
    if (action === 'REVISI' && !hasGranularItems && (!notes || !notes.trim())) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Sesuai SOP SPARTA, catatan alasan revisi wajib diisi agar pembuat dapat mengetahui perbaikan yang diminta.',
        },
        { status: 400 }
      );
    }

    // 2. Jika ada item yang diceklis, setiap item wajib memiliki catatan instruksi perbaikan
    if (action === 'REVISI' && hasGranularItems) {
      for (const revItem of detail_revisi) {
        if (!revItem.catatan || !String(revItem.catatan).trim()) {
          return NextResponse.json(
            {
              status: 'error',
              message: `Item revisi "${revItem.label || revItem.id}" wajib memiliki catatan instruksi perbaikan.`,
            },
            { status: 400 }
          );
        }
      }
    }

    let nextStatus: string;
    let auditAction: string;
    let auditNotes: string;
    let responseMsg: string;

    const currentStatus = klarifikasi.status;

    if (action === 'REVISI') {
      nextStatus = 'REVISI';
      auditAction = 'REVISI';
      auditNotes = (notes && notes.trim()) || (hasGranularItems ? `Revisi ${detail_revisi.length} Item pekerjaan yang ditandai.` : 'Revisi berkas klarifikasi aanwijzing.');
      responseMsg = 'Dokumen Berita Acara berhasil dikembalikan kepada pembuat untuk diperbaiki (Status: REVISI).';
    } else {
      // APPROVE
      if (currentStatus === 'MENUNGGU_APPROVAL_BBM_MANAGER') {
        nextStatus = 'MENUNGGU_APPROVAL_DC_SPECIALIST';
        auditAction = 'APPROVE_BBM_MANAGER';
        auditNotes = (notes && notes.trim()) || 'Disetujui oleh Branch Building & Maintenance Manager.';
        responseMsg = 'Berita Acara berhasil disetujui dan dialihkan ke DC Building & Development Specialist.';
      } else if (currentStatus === 'MENUNGGU_APPROVAL_DC_SPECIALIST') {
        nextStatus = 'APPROVED';
        auditAction = 'APPROVE_DC_SPECIALIST';
        auditNotes = (notes && notes.trim()) || 'Disetujui final oleh DC Building & Development Specialist.';
        responseMsg = 'Berita Acara berhasil disetujui final (Status: APPROVED). Dokumen siap dijadikan dasar penawaran tender.';
      } else {
        return NextResponse.json(
          { status: 'error', message: `Dokumen dengan status ${currentStatus} tidak dapat diproses lebih lanjut.` },
          { status: 400 }
        );
      }
    }

    // Atomic update status & insert audit log
    await prisma.$transaction([
      prisma.dc_aanwijzing_klarifikasi.update({
        where: { id: klarifikasiId },
        data: {
          status: nextStatus,
        },
      }),
      prisma.dc_aanwijzing_klarifikasi_audit_log.create({
        data: {
          klarifikasi_id: klarifikasiId,
          user_email: currentUser.email,
          user_name: (currentUser as any).nama || currentUser.email,
          user_role: currentUser.role,
          action: auditAction,
          from_status: currentStatus,
          to_status: nextStatus,
          notes: auditNotes,
        },
      }),
      prisma.app_audit_log.create({
        data: {
          user_email: currentUser.email,
          modul: 'dc-development',
          entitas: 'dc_aanwijzing_klarifikasi',
          entitas_id: String(klarifikasiId),
          aksi: `APPROVAL_${action}`,
          data_lama: {
            status: currentStatus,
          },
          data_baru: {
            status: nextStatus,
            notes: auditNotes,
            action,
            detail_revisi: action === 'REVISI' && hasGranularItems ? detail_revisi : null,
          },
        },
      }),
    ]);

    // Background sync Google Drive
    syncBeritaAcaraToGoogleDrive(klarifikasiId).catch((err) =>
      console.error('[GDrive Sync Error on approval]', err)
    );

    return NextResponse.json({
      status: 'success',
      message: responseMsg,
      data: {
        id: klarifikasiId,
        from_status: currentStatus,
        to_status: nextStatus,
      },
    });
  } catch (error: any) {
    console.error('Error in klarifikasi aanwijzing approval:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}
