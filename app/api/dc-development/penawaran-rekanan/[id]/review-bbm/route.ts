import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canUserEvaluatePenawaranBbm, isApprovalAdmin } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (!canUserEvaluatePenawaranBbm(session) && !isApprovalAdmin(session.role))) {
      return NextResponse.json(
        { status: 'error', message: 'Wewenang tidak cukup untuk evaluasi BBM Manager' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const penawaranId = parseInt(id);
    const body = await request.json();
    const { action = 'SETUJU', catatan_internal, catatan_negosiasi, flagged_items, flagged_item_ids } = body;

    const existing = await prisma.dc_penawaran_rekanan.findUnique({
      where: { id: penawaranId },
    });

    if (!existing) {
      return NextResponse.json({ status: 'error', message: 'Penawaran tidak ditemukan' }, { status: 404 });
    }

    // Validasi threshold 1 Miliar: Penawaran >= 1M ditangani oleh DC Specialist
    if (existing.grand_total >= 1_000_000_000 && !isApprovalAdmin(session.role)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Penawaran ini bernilai >= Rp 1 Miliar, evaluasi dan persetujuan berada di bawah wewenang DC Development Specialist.',
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

    const result = await prisma.$transaction(async (tx) => {
      let targetStatus = 'SIAP_KOMPARASI';
      let auditAction = 'APPROVE_BBM';
      let auditNotes = catatan_internal || 'Penawaran disetujui BBM Manager dan masuk ke wadah pemilihan pemenang tender.';

      if (action === 'NEGOSIASI') {
        targetStatus = 'NEGOSIASI_REKANAN';
        auditAction = 'NEGOSIASI_BBM';
        auditNotes = catatan_negosiasi || catatan_internal || 'Penawaran dikembalikan ke kontraktor untuk negosiasi / revisi.';

        // 1. Simpan catatan internal BBM dan catatan negosiasi
        await tx.dc_penawaran_rekanan.update({
          where: { id: penawaranId },
          data: {
            status: targetStatus,
            catatan_internal_bbm: catatan_internal || '',
            catatan_negosiasi_specialist: catatan_negosiasi || catatan_internal || 'Perlu penyesuaian harga penawaran.',
          },
        });

        // 2. Reset & tandai items yang wajib dinegosiasikan
        await tx.dc_penawaran_rekanan_item.updateMany({
          where: { penawaran_id: penawaranId },
          data: {
            is_flagged_bbm: false,
            catatan_bbm: null,
            is_flagged_specialist: false,
            catatan_specialist: null,
          },
        });

        if (flagged_items && Array.isArray(flagged_items) && flagged_items.length > 0) {
          for (const it of flagged_items) {
            await tx.dc_penawaran_rekanan_item.update({
              where: { id: parseInt(it.id) },
              data: {
                is_flagged_bbm: true,
                catatan_bbm: it.catatan || null,
                is_flagged_specialist: true,
                catatan_specialist: it.catatan || null,
              },
            });
          }
        } else if (flagged_item_ids && Array.isArray(flagged_item_ids) && flagged_item_ids.length > 0) {
          await tx.dc_penawaran_rekanan_item.updateMany({
            where: {
              penawaran_id: penawaranId,
              id: { in: flagged_item_ids.map((itId: any) => parseInt(itId)) },
            },
            data: {
              is_flagged_bbm: true,
              is_flagged_specialist: true,
            },
          });
        }
      } else {
        // Aksi SETUJU: Langsung masuk ke SIAP_KOMPARASI (Wadah Pemilihan Pemenang)
        await tx.dc_penawaran_rekanan.update({
          where: { id: penawaranId },
          data: {
            status: targetStatus,
            catatan_internal_bbm: catatan_internal || existing.catatan_internal_bbm || '',
          },
        });

        // Reset flags
        await tx.dc_penawaran_rekanan_item.updateMany({
          where: { penawaran_id: penawaranId },
          data: {
            is_flagged_bbm: false,
            is_flagged_specialist: false,
          },
        });
      }

      // 3. Catat audit log evaluasi BBM
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
        include: { items: true },
      });
    });

    return NextResponse.json({ status: 'success', data: result });
  } catch (error: any) {
    console.error('Error in review BBM route:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
