import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canUserEvaluatePenawaranSpecialist, isApprovalAdmin } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (!canUserEvaluatePenawaranSpecialist(session) && !isApprovalAdmin(session.role))) {
      return NextResponse.json(
        { status: 'error', message: 'Wewenang tidak cukup untuk evaluasi DC Development Specialist' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const penawaranId = parseInt(id);
    const body = await request.json();
    const { action = 'NEGOSIASI', instruksi_negosiasi, flagged_items, flagged_gantt_items } = body;

    const existing = await prisma.dc_penawaran_rekanan.findUnique({
      where: { id: penawaranId },
    });

    if (!existing) {
      return NextResponse.json({ status: 'error', message: 'Penawaran tidak ditemukan' }, { status: 404 });
    }

    // Validasi threshold 1 Miliar: Penawaran < 1M ditangani oleh BBM Manager
    if (existing.grand_total < 1_000_000_000 && !isApprovalAdmin(session.role)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Penawaran ini bernilai < Rp 1 Miliar, evaluasi dan persetujuan berada di bawah wewenang Branch Building & Maintenance (BBM) Manager.',
        },
        { status: 403 }
      );
    }

    // Jika status DIAJUKAN_ULANG, satu-satunya aksi yang diizinkan adalah SETUJU
    if (existing.status === 'DIAJUKAN_ULANG' && action === 'NEGOSIASI') {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Penawaran pasca-negosiasi (DIAJUKAN_ULANG) tidak dapat dikembalikan lagi. Satu-satunya opsi adalah menyetujui untuk masuk ke wadah pemilihan pemenang.',
        },
        { status: 400 }
      );
    }

    if (action === 'NEGOSIASI' && (!instruksi_negosiasi || !instruksi_negosiasi.trim())) {
      return NextResponse.json({ status: 'error', message: 'Instruksi negosiasi / perbaikan wajib diisi saat mengembalikan penawaran' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      let targetStatus = 'SIAP_KOMPARASI';
      let auditAction = 'APPROVE_SPECIALIST';
      let auditNotes = instruksi_negosiasi || 'Penawaran disetujui DC Development Specialist dan masuk ke wadah pemilihan pemenang tender.';

      if (action === 'NEGOSIASI') {
        targetStatus = 'NEGOSIASI_REKANAN';
        auditAction = 'NEGOSIASI_SPECIALIST';
        auditNotes = instruksi_negosiasi.trim();

        // 1. Update status ke NEGOSIASI_REKANAN
        await tx.dc_penawaran_rekanan.update({
          where: { id: penawaranId },
          data: {
            status: targetStatus,
            catatan_negosiasi_specialist: instruksi_negosiasi.trim(),
          },
        });

        // 2. Tandai item BoQ yang wajib dinegosiasikan
        await tx.dc_penawaran_rekanan_item.updateMany({
          where: { penawaran_id: penawaranId },
          data: { is_flagged_specialist: false, catatan_specialist: null },
        });

        if (flagged_items && Array.isArray(flagged_items)) {
          for (const f of flagged_items) {
            await tx.dc_penawaran_rekanan_item.update({
              where: { id: parseInt(f.id) },
              data: {
                is_flagged_specialist: true,
                catatan_specialist: f.catatan || 'Wajib dinegosiasikan kembali',
              },
            });
          }
        }

        // 3. Tandai jadwal durasi Gantt yang wajib dinegosiasikan
        await tx.dc_penawaran_rekanan_gantt.updateMany({
          where: { penawaran_id: penawaranId },
          data: { is_flagged_durasi: false, catatan_durasi_specialist: null },
        });

        if (flagged_gantt_items && Array.isArray(flagged_gantt_items)) {
          for (const g of flagged_gantt_items) {
            await tx.dc_penawaran_rekanan_gantt.update({
              where: { item_id: parseInt(g.item_id) },
              data: {
                is_flagged_durasi: true,
                catatan_durasi_specialist: g.catatan || 'Durasi pekerjaan perlu disesuaikan',
              },
            });
          }
        }
      } else {
        // Aksi SETUJU: Langsung masuk ke SIAP_KOMPARASI (Wadah Pemilihan Pemenang)
        await tx.dc_penawaran_rekanan.update({
          where: { id: penawaranId },
          data: {
            status: targetStatus,
            catatan_negosiasi_specialist: instruksi_negosiasi || existing.catatan_negosiasi_specialist || '',
          },
        });

        // Reset flags
        await tx.dc_penawaran_rekanan_item.updateMany({
          where: { penawaran_id: penawaranId },
          data: {
            is_flagged_specialist: false,
            is_flagged_bbm: false,
          },
        });

        await tx.dc_penawaran_rekanan_gantt.updateMany({
          where: { penawaran_id: penawaranId },
          data: { is_flagged_durasi: false },
        });
      }

      // 4. Catat audit log
      await tx.dc_penawaran_rekanan_audit_log.create({
        data: {
          penawaran_id: penawaranId,
          user_email: session.email,
          user_name: session.email,
          user_role: session.role,
          action: auditAction,
          from_status: existing.status,
          to_status: targetStatus,
          notes: auditNotes,
        },
      });

      return await tx.dc_penawaran_rekanan.findUnique({
        where: { id: penawaranId },
        include: { items: true, gantt_items: true },
      });
    });

    return NextResponse.json({ status: 'success', data: result });
  } catch (error: any) {
    console.error('Error in negosiasi specialist route:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
