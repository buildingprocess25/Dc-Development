import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const penawaranId = parseInt(id);
    const body = await request.json();
    const { items, gantt_items, catatan_perbaikan } = body;

    const existing = await prisma.dc_penawaran_rekanan.findUnique({
      where: { id: penawaranId },
      include: {
        items: true,
        gantt_items: true,
      },
    });

    if (!existing || existing.status !== 'NEGOSIASI_REKANAN') {
      return NextResponse.json(
        { status: 'error', message: 'Status dokumen bukan dalam tahap negosiasi (NEGOSIASI_REKANAN)' },
        { status: 400 }
      );
    }

    const roleUpper = (session.role || '').toUpperCase();
    const isRekananUser =
      roleUpper.includes('KONTRAKTOR') ||
      roleUpper.includes('VENDOR') ||
      roleUpper.includes('KONSULTAN') ||
      Boolean(session.nama_pt);

    if (isRekananUser) {
      const emailMatch = existing.vendor_email.toLowerCase() === session.email.toLowerCase();
      const ptMatch =
        session.nama_pt &&
        (existing.vendor_nama.trim().toUpperCase() === session.nama_pt.trim().toUpperCase() ||
          existing.vendor_nama.toUpperCase().includes(session.nama_pt.toUpperCase()) ||
          session.nama_pt.toUpperCase().includes(existing.vendor_nama.toUpperCase()));
      if (!emailMatch && !ptMatch) {
        return NextResponse.json({ status: 'error', message: 'Akses ditolak: penawaran ini bukan milik Anda atau PT Anda' }, { status: 403 });
      }
    }

    // Validasi: Wajib mengubah minimal 1 field harga atau durasi pada item yang ditandai negosiasi
    let hasModifiedFlaggedItem = false;

    if (items && Array.isArray(items)) {
      for (const updatedItem of items) {
        const oldItem = existing.items.find((it) => it.id === parseInt(updatedItem.id));
        if (oldItem && oldItem.is_flagged_specialist) {
          const oldMat = parseFloat(String(oldItem.harga_material)) || 0;
          const newMat = parseFloat(String(updatedItem.harga_material)) || 0;
          const oldUpah = parseFloat(String(oldItem.harga_upah)) || 0;
          const newUpah = parseFloat(String(updatedItem.harga_upah)) || 0;

          if (oldMat !== newMat || oldUpah !== newUpah) {
            hasModifiedFlaggedItem = true;
            break;
          }
        }
      }
    }

    if (!hasModifiedFlaggedItem && gantt_items && Array.isArray(gantt_items)) {
      for (const updatedGantt of gantt_items) {
        const oldGantt = existing.gantt_items.find((g) => g.item_id === parseInt(updatedGantt.item_id));
        if (oldGantt && oldGantt.is_flagged_durasi) {
          const oldDur = parseInt(String(oldGantt.duration_days)) || 0;
          const newDur = parseInt(String(updatedGantt.duration_days)) || 0;

          if (oldDur !== newDur) {
            hasModifiedFlaggedItem = true;
            break;
          }
        }
      }
    }

    if (!hasModifiedFlaggedItem) {
      return NextResponse.json(
        {
          status: 'error',
          message:
            'Anda wajib mengubah minimal satu nilai harga atau durasi pada item yang ditandai sebelum mengajukan ulang!',
        },
        { status: 422 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Simpan perubahan item BoQ
      let totalSipil = 0;
      let totalMe = 0;

      if (items && Array.isArray(items)) {
        for (const it of items) {
          const vol = parseFloat(it.volume) || 0;
          const mat = parseFloat(it.harga_material) || 0;
          const upah = parseFloat(it.harga_upah) || 0;
          const itemTotal = vol * (mat + upah);

          if ((it.lingkup || '').toUpperCase() === 'SIPIL') {
            totalSipil += itemTotal;
          } else {
            totalMe += itemTotal;
          }

          await tx.dc_penawaran_rekanan_item.update({
            where: { id: parseInt(it.id) },
            data: {
              harga_material: mat,
              harga_upah: upah,
              total_harga: itemTotal,
              is_flagged_specialist: false,
            },
          });
        }
      }

      // 2. Simpan perubahan durasi Gantt
      if (gantt_items && Array.isArray(gantt_items)) {
        for (const g of gantt_items) {
          const start = parseInt(g.start_day) || 1;
          const dur = parseInt(g.duration_days) || 1;
          const end = start + dur - 1;

          await tx.dc_penawaran_rekanan_gantt.update({
            where: { item_id: parseInt(g.item_id) },
            data: {
              start_day: start,
              duration_days: dur,
              end_day: end,
              is_flagged_durasi: false,
            },
          });
        }
      }

      // 3. Update master penawaran ke DIAJUKAN_ULANG
      const p = await tx.dc_penawaran_rekanan.update({
        where: { id: penawaranId },
        data: {
          status: 'DIAJUKAN_ULANG',
          total_biaya_sipil: totalSipil,
          total_biaya_me: totalMe,
          grand_total: totalSipil + totalMe,
        },
      });

      // 4. Catat audit log perbaikan negosiasi
      await tx.dc_penawaran_rekanan_audit_log.create({
        data: {
          penawaran_id: penawaranId,
          user_email: session.email,
          user_name: session.nama_pt || session.email,
          user_role: session.role,
          action: 'RESUBMIT',
          from_status: 'NEGOSIASI_REKANAN',
          to_status: 'DIAJUKAN_ULANG',
          notes: catatan_perbaikan || 'Kontraktor melakukan perbaikan harga/durasi negosiasi',
        },
      });

      return p;
    });

    return NextResponse.json({ status: 'success', data: updated });
  } catch (error: any) {
    console.error('Error in resubmit penawaran route:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
