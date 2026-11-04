import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { isExternalPartnerRole } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(
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

    const penawaran = await prisma.dc_penawaran_rekanan.findUnique({
      where: { id: penawaranId },
      include: {
        project: true,
        vendor: true,
        klarifikasi: {
          include: {
            dokumen: true,
            items: { orderBy: { id: 'asc' } },
          },
        },
        items: {
          include: {
            gantt_item: true,
          },
          orderBy: { id: 'asc' },
        },
        gantt_items: {
          orderBy: { start_day: 'asc' },
        },
        dependencies: true,
        audit_logs: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!penawaran) {
      return NextResponse.json({ status: 'error', message: 'Data penawaran tidak ditemukan' }, { status: 404 });
    }

    const roleUpper = (session.role || '').toUpperCase();
    const isRekananUser =
      roleUpper.includes('KONTRAKTOR') ||
      roleUpper.includes('VENDOR') ||
      roleUpper.includes('KONSULTAN') ||
      Boolean(session.nama_pt);

    // SENSORING ATURAN KERAHASIAAN SPARTA TENDER
    const sanitized: any = { ...penawaran };

    if (isRekananUser) {
      // 1. Catatan internal BBM rahasia mutlak dari rekanan
      delete sanitized.catatan_internal_bbm;

      // 2. Sensor harga OE pada klarifikasi items (kontraktor hanya melihat volume)
      if (sanitized.klarifikasi && sanitized.klarifikasi.items) {
        sanitized.klarifikasi.items = sanitized.klarifikasi.items.map((it: any) => ({
          ...it,
          harga_material: 0,
          harga_upah: 0,
          total_biaya_awal: 0,
          total_biaya_akhir: 0,
        }));
      }

      // 3. Sensor checklist dan catatan internal BBM pada items
      sanitized.items = sanitized.items.map((it: any) => ({
        ...it,
        is_flagged_bbm: false,
        catatan_bbm: null,
      }));

      // 4. Sensor audit log BBM internal
      sanitized.audit_logs = sanitized.audit_logs.map((log: any) => {
        if (log.action === 'REVIEW_BBM') {
          return {
            ...log,
            notes: 'Pemeriksaan awal evaluasi internal telah selesai.',
          };
        }
        return log;
      });
    }

    return NextResponse.json({
      status: 'success',
      data: sanitized,
    });
  } catch (error: any) {
    console.error('Error fetching detail penawaran rekanan:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function PUT(
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

    const {
      status,
      items,
      durasi_pekerjaan_hari,
      catatan_kontraktor,
      gantt_items,
      dependencies,
      // Field dokumen & asuransi penawaran
      kontraktor_logo_url,
      kontraktor_logo_drive_id,
      analisa_harga_url,
      analisa_harga_drive_id,
      analisa_harga_nama,
      asuransi_no_polis,
      asuransi_masa_berlaku,
      asuransi_file_url,
      asuransi_file_drive_id,
      asuransi_file_nama,
    } = body;

    const currentPenawaran = await prisma.dc_penawaran_rekanan.findUnique({
      where: { id: penawaranId },
      include: { items: true, klarifikasi: true },
    });

    if (!currentPenawaran) {
      return NextResponse.json({ status: 'error', message: 'Data penawaran tidak ditemukan' }, { status: 404 });
    }

    // Validasi batas waktu tanggal tender untuk rekanan (jika draft dan tanggal lewat -> tereliminasi)
    const isRekananUser = isExternalPartnerRole(session.role);
    if (isRekananUser && currentPenawaran.klarifikasi) {
      const todayStr = new Date().toLocaleDateString("en-CA");
      const tenderDateObj = currentPenawaran.klarifikasi.tanggal_tender
        ? new Date(currentPenawaran.klarifikasi.tanggal_tender)
        : new Date("2026-11-03T00:00:00.000Z");
      const tenderDateStr = tenderDateObj.toLocaleDateString("en-CA");

      if (todayStr > tenderDateStr && currentPenawaran.status === "DRAFT") {
        return NextResponse.json(
          {
            status: "error",
            message: `Batas waktu pengisian penawaran tender telah berakhir (${tenderDateStr}). Anda dinyatakan tereliminasi dari tender lelang proyek ini.`,
          },
          { status: 403 }
        );
      }
    }

    // Validasi masa berlaku asuransi tidak boleh backdate jika diajukan resmi
    if (status === "DIAJUKAN") {
      const targetMasaBerlaku = asuransi_masa_berlaku || currentPenawaran.asuransi_masa_berlaku;
      if (targetMasaBerlaku) {
        const masaBerlakuStr = new Date(targetMasaBerlaku).toLocaleDateString("en-CA");
        const todayStr = new Date().toLocaleDateString("en-CA");
        if (masaBerlakuStr < todayStr) {
          return NextResponse.json(
            {
              status: "error",
              message: `Masa berlaku asuransi tidak boleh tanggal lampau (backdate). Tanggal minimum adalah hari ini (${todayStr}).`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Hitung subtotal sipil dan ME
    let totalSipil = 0;
    let totalMe = 0;

    if (items && Array.isArray(items)) {
      items.forEach((it: any) => {
        const itemVol = parseFloat(it.volume) || 0;
        const itemMat = parseFloat(it.harga_material) || 0;
        const itemUpah = parseFloat(it.harga_upah) || 0;
        const total = itemVol * (itemMat + itemUpah);

        if ((it.lingkup || '').toUpperCase() === 'SIPIL') {
          totalSipil += total;
        } else {
          totalMe += total;
        }
      });
    } else {
      totalSipil = currentPenawaran.total_biaya_sipil;
      totalMe = currentPenawaran.total_biaya_me;
    }

    const grandTotal = totalSipil + totalMe;

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update header penawaran
      const p = await tx.dc_penawaran_rekanan.update({
        where: { id: penawaranId },
        data: {
          ...(status ? { status } : {}),
          total_biaya_sipil: totalSipil,
          total_biaya_me: totalMe,
          grand_total: grandTotal,
          ...(durasi_pekerjaan_hari ? { durasi_pekerjaan_hari: parseInt(durasi_pekerjaan_hari) } : {}),
          ...(catatan_kontraktor !== undefined ? { catatan_kontraktor } : {}),
          ...(kontraktor_logo_url !== undefined ? { kontraktor_logo_url } : {}),
          ...(kontraktor_logo_drive_id !== undefined ? { kontraktor_logo_drive_id } : {}),
          ...(analisa_harga_url !== undefined ? { analisa_harga_url } : {}),
          ...(analisa_harga_drive_id !== undefined ? { analisa_harga_drive_id } : {}),
          ...(analisa_harga_nama !== undefined ? { analisa_harga_nama } : {}),
          ...(asuransi_no_polis !== undefined ? { asuransi_no_polis } : {}),
          ...(asuransi_masa_berlaku !== undefined
            ? { asuransi_masa_berlaku: asuransi_masa_berlaku ? new Date(asuransi_masa_berlaku) : null }
            : {}),
          ...(asuransi_file_url !== undefined ? { asuransi_file_url } : {}),
          ...(asuransi_file_drive_id !== undefined ? { asuransi_file_drive_id } : {}),
          ...(asuransi_file_nama !== undefined ? { asuransi_file_nama } : {}),
        },
      });

      // 2. Update item-item BoQ
      if (items && Array.isArray(items)) {
        for (const it of items) {
          const itemVol = parseFloat(it.volume) || 0;
          const itemMat = parseFloat(it.harga_material) || 0;
          const itemUpah = parseFloat(it.harga_upah) || 0;
          const itemTotal = itemVol * (itemMat + itemUpah);

          await tx.dc_penawaran_rekanan_item.update({
            where: { id: it.id },
            data: {
              harga_material: itemMat,
              harga_upah: itemUpah,
              total_harga: itemTotal,
              ...(it.file_bukti_url !== undefined ? { file_bukti_url: it.file_bukti_url } : {}),
              ...(it.file_bukti_drive_id !== undefined ? { file_bukti_drive_id: it.file_bukti_drive_id } : {}),
              ...(it.file_bukti_nama !== undefined ? { file_bukti_nama: it.file_bukti_nama } : {}),
            },
          });
        }
      }

      // 3. Update Gantt Items jika ada
      if (gantt_items && Array.isArray(gantt_items)) {
        const scheduledItemIds = gantt_items.map((g: any) => parseInt(g.item_id)).filter((id: number) => !isNaN(id) && id > 0);

        // Hapus jadwal gantt yang di-reset atau belum dijadwalkan
        await tx.dc_penawaran_rekanan_gantt.deleteMany({
          where: {
            penawaran_id: penawaranId,
            item_id: { notIn: scheduledItemIds },
          },
        });

        for (const g of gantt_items) {
          const startDay = parseInt(g.start_day) || 1;
          const durationDays = parseInt(g.duration_days) || 1;
          const endDay = startDay + durationDays - 1;

          await tx.dc_penawaran_rekanan_gantt.upsert({
            where: { item_id: g.item_id },
            create: {
              penawaran_id: penawaranId,
              item_id: g.item_id,
              start_day: startDay,
              duration_days: durationDays,
              end_day: endDay,
            },
            update: {
              start_day: startDay,
              duration_days: durationDays,
              end_day: endDay,
            },
          });
        }
      }

      // 4. Update Dependencies jika ada
      if (dependencies && Array.isArray(dependencies)) {
        await tx.dc_penawaran_rekanan_dependency.deleteMany({
          where: { penawaran_id: penawaranId },
        });

        // Map item_id ke lingkup untuk mencegah keterikatan lintas lingkup (Sipil vs ME)
        const itemLingkupMap = new Map<number, string>();
        currentPenawaran.items.forEach((it) => {
          itemLingkupMap.set(it.id, (it.lingkup || 'SIPIL').toUpperCase());
        });

        for (const dep of dependencies) {
          if (dep.predecessor_id && dep.successor_id) {
            const predScope = itemLingkupMap.get(dep.predecessor_id);
            const succScope = itemLingkupMap.get(dep.successor_id);

            // Validasi: Keterikatan hanya diizinkan antar sesama item dalam lingkup yang sama
            if (predScope && succScope && predScope === succScope) {
              await tx.dc_penawaran_rekanan_dependency.create({
                data: {
                  penawaran_id: penawaranId,
                  predecessor_id: dep.predecessor_id,
                  successor_id: dep.successor_id,
                },
              });
            }
          }
        }
      }

      // 5. Catat audit log jika status berubah atau submit
      if (status && status !== currentPenawaran.status) {
        let action = 'UPDATE_STATUS';
        if (status === 'DIAJUKAN') action = 'SUBMIT';
        else if (status === 'DRAFT') action = 'SIMPAN_DRAFT';

        await tx.dc_penawaran_rekanan_audit_log.create({
          data: {
            penawaran_id: penawaranId,
            user_email: session.email,
            user_name: session.nama_pt || session.email,
            user_role: session.role,
            action,
            from_status: currentPenawaran.status,
            to_status: status,
            notes: catatan_kontraktor || `Penawaran diubah ke status ${status}`,
          },
        });
      }

      return p;
    });

    return NextResponse.json({
      status: 'success',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating penawaran rekanan:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function DELETE(
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

    const penawaran = await prisma.dc_penawaran_rekanan.findUnique({
      where: { id: penawaranId },
    });

    if (!penawaran) {
      return NextResponse.json({ status: 'error', message: 'Data penawaran tidak ditemukan' }, { status: 404 });
    }

    // Hanya status DRAFT yang boleh dibatalkan
    if (penawaran.status !== 'DRAFT') {
      return NextResponse.json(
        { status: 'error', message: 'Hanya draf penawaran yang dapat dibatalkan atau dihapus' },
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
      const emailMatch =
        penawaran.vendor_email.toLowerCase() === session.email.toLowerCase() ||
        penawaran.created_by.toLowerCase() === session.email.toLowerCase();
      const ptMatch =
        session.nama_pt &&
        (penawaran.vendor_nama.trim().toUpperCase() === session.nama_pt.trim().toUpperCase() ||
          penawaran.vendor_nama.toUpperCase().includes(session.nama_pt.toUpperCase()) ||
          session.nama_pt.toUpperCase().includes(penawaran.vendor_nama.toUpperCase()));

      if (!emailMatch && !ptMatch) {
        return NextResponse.json(
          { status: 'error', message: 'Anda hanya dapat membatalkan draf penawaran milik Anda sendiri' },
          { status: 403 }
        );
      }
    }

    // Hapus penawaran (relasi items, gantt, dependencies, audit_log akan CASCADE terhapus)
    await prisma.dc_penawaran_rekanan.delete({
      where: { id: penawaranId },
    });

    return NextResponse.json({
      status: 'success',
      message: `Draf penawaran ${penawaran.nomor_penawaran} berhasil dibatalkan dan dihapus`,
    });
  } catch (error: any) {
    console.error('Error deleting penawaran draft:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
