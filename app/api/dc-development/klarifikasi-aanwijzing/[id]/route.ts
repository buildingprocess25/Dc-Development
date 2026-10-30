import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';
import { isApprovalAdmin, isSameCreator, canManageKlarifikasiAanwijzing } from '@/lib/permissions';
import { syncBeritaAcaraToGoogleDrive } from '@/lib/pdf/berita-acara-aanwijzing-pdf.service';

/**
 * GET /api/dc-development/klarifikasi-aanwijzing/[id]
 * Mengambil detail lengkap satu Berita Acara Klarifikasi
 */
export async function GET(
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
        coverage_cabang: true,
      },
    });
    const currentUser = dbUser || session;
    const roleUpper = (currentUser.role || '').trim().toUpperCase();
    const isAdmin = isApprovalAdmin(roleUpper);
    const userCoverage = getUserCoverageBranches(currentUser);

    const klarifikasi = await prisma.dc_aanwijzing_klarifikasi.findUnique({
      where: { id: klarifikasiId },
      include: {
        project: true,
        aanwijzing: {
          include: {
            peserta: {
              include: { vendor: true },
            },
          },
        },
        renovasi: {
          include: {
            item_rab: true,
          },
        },
        items: true,
        audit_logs: {
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!klarifikasi) {
      return NextResponse.json(
        { status: 'error', message: 'Data Berita Acara Klarifikasi tidak ditemukan' },
        { status: 404 }
      );
    }

    // Validasi cabang
    const itemBranch = (klarifikasi.cabang || klarifikasi.project?.cabang || '').trim().toUpperCase();
    if (!isBranchAccessible(itemBranch, userCoverage)) {
      return NextResponse.json(
        { status: 'error', message: 'Anda tidak memiliki hak akses untuk cabang ini' },
        { status: 403 }
      );
    }

    // Aturan Visibilitas Revisi (Private ke Creator & Admin)
    if (klarifikasi.status === 'REVISI') {
      const isCreator = isSameCreator(currentUser, klarifikasi.created_by);
      if (!isAdmin && !isCreator) {
        return NextResponse.json(
          {
            status: 'error',
            message: 'Berkas ini sedang berstatus REVISI dan dikembalikan kepada pembuat pengajuan.',
          },
          { status: 403 }
        );
      }
    }

    // Ambil detail_revisi jika status REVISI
    let detailRevisi: any = null;
    if (klarifikasi.status === 'REVISI') {
      const latestRevisiLog = await prisma.app_audit_log.findFirst({
        where: {
          entitas: 'dc_aanwijzing_klarifikasi',
          entitas_id: String(klarifikasi.id),
          aksi: 'APPROVAL_REVISI',
        },
        orderBy: { created_at: 'desc' },
      });
      if (latestRevisiLog && latestRevisiLog.data_baru) {
        const dataBaru = latestRevisiLog.data_baru as any;
        detailRevisi = dataBaru?.detail_revisi || null;
      }
    }

    return NextResponse.json({
      status: 'success',
      data: {
        ...klarifikasi,
        detail_revisi: detailRevisi,
      },
    });
  } catch (error: any) {
    console.error('Error fetching detail klarifikasi aanwijzing:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/dc-development/klarifikasi-aanwijzing/[id]
 * Memperbarui data klarifikasi (saat status DRAFT atau REVISI)
 */
export async function PUT(
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
    const roleUpper = (currentUser.role || '').trim().toUpperCase();
    const isAdmin = isApprovalAdmin(roleUpper);

    const existing = await prisma.dc_aanwijzing_klarifikasi.findUnique({
      where: { id: klarifikasiId },
      include: {
        items: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { status: 'error', message: 'Data Klarifikasi tidak ditemukan' },
        { status: 404 }
      );
    }

    // Hanya Maker atau Admin yang boleh mengedit
    const isCreator = isSameCreator(currentUser, existing.created_by);
    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { status: 'error', message: 'Hanya pembuat pengajuan atau Administrator yang berwenang memperbarui berkas ini.' },
        { status: 403 }
      );
    }

    // Hanya boleh diedit jika DRAFT atau REVISI
    if (existing.status !== 'DRAFT' && existing.status !== 'REVISI') {
      return NextResponse.json(
        {
          status: 'error',
          message: `Berkas tidak dapat diedit karena sedang dalam alur persetujuan aktif (Status: ${existing.status}).`,
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { catatan_maker, items = [], is_draft = false } = body;

    // VALIDASI SOP REVISI:
    if (existing.status === 'REVISI' && !is_draft) {
      // Ambil detail_revisi dari log revisi terbaru jika ada
      const latestRevisiLog = await prisma.app_audit_log.findFirst({
        where: {
          entitas: 'dc_aanwijzing_klarifikasi',
          entitas_id: String(existing.id),
          aksi: 'APPROVAL_REVISI',
        },
        orderBy: { created_at: 'desc' },
      });
      const detailRevisi = latestRevisiLog?.data_baru && (latestRevisiLog.data_baru as any).detail_revisi;

      if (Array.isArray(detailRevisi) && detailRevisi.length > 0) {
        // MAKER WAJIB UBAH SEMUA ITEM YANG DICEKLIS
        for (const revItem of detailRevisi) {
          if (revItem.category === 'ITEM_KLARIFIKASI') {
            const currentItem = items.find(
              (it: any) =>
                String(it.id) === String(revItem.fieldOrId) ||
                String(it.item_id) === String(revItem.fieldOrId)
            );
            const oldItem = existing.items.find((it) => String(it.id) === String(revItem.fieldOrId));
            if (!currentItem) {
              // Jika item dihapus, itu dianggap sudah diubah
              continue;
            }
            if (oldItem) {
              const isVolumeChanged = Number(currentItem.volume_akhir) !== Number(oldItem.volume_akhir);
              const isHargaMatChanged = Number(currentItem.harga_material) !== Number(oldItem.harga_material);
              const isHargaUpahChanged = Number(currentItem.harga_upah) !== Number(oldItem.harga_upah);
              const isDeskripsiChanged = (currentItem.deskripsi || '').trim() !== (oldItem.deskripsi || '').trim();
              const isSatuanChanged = (currentItem.satuan || '').trim() !== (oldItem.satuan || '').trim();

              if (!isVolumeChanged && !isHargaMatChanged && !isHargaUpahChanged && !isDeskripsiChanged && !isSatuanChanged) {
                return NextResponse.json(
                  {
                    status: 'error',
                    message: `Item "${revItem.label || oldItem.deskripsi}" wajib diperbaiki sesuai instruksi peninjau: "${revItem.catatan}".`,
                  },
                  { status: 400 }
                );
              }
            }
          } else if (revItem.category === 'CATATAN_MAKER') {
            if ((catatan_maker || '').trim() === (existing.catatan_maker || '').trim()) {
              return NextResponse.json(
                {
                  status: 'error',
                  message: `Catatan Berita Acara wajib diperbaiki sesuai instruksi peninjau: "${revItem.catatan}".`,
                },
                { status: 400 }
              );
            }
          }
        }
      } else {
        // JIKA TIDAK ADA YANG DICEKLIS (CATATAN GENERAL), MAKER WAJIB MENGUBAH MINIMAL SATU PERUBAHAN
        const oldItemsStr = JSON.stringify(
          existing.items.map((it) => ({
            deskripsi: it.deskripsi,
            volume_akhir: it.volume_akhir,
            harga_material: it.harga_material,
            harga_upah: it.harga_upah,
            satuan: it.satuan,
          }))
        );
        const newItemsStr = JSON.stringify(
          items.map((it: any) => ({
            deskripsi: it.deskripsi,
            volume_akhir: Number(it.volume_akhir) || 0,
            harga_material: Number(it.harga_material) || 0,
            harga_upah: Number(it.harga_upah) || 0,
            satuan: it.satuan,
          }))
        );

        const isCatatanChanged = (catatan_maker || '') !== (existing.catatan_maker || '');
        const isItemsChanged = oldItemsStr !== newItemsStr;

        if (!isCatatanChanged && !isItemsChanged) {
          return NextResponse.json(
            {
              status: 'error',
              message:
                'Validasi Gagal: Sesuai aturan SOP SPARTA, Anda wajib mengubah / memperbaiki minimal satu data pekerjaan sebelum dapat mengajukan ulang berkas revisi.',
            },
            { status: 400 }
          );
        }
      }
    }

    // Validasi kelengkapan item baru (Kategori & Nama Pekerjaan) jika bukan draft
    if (!is_draft && items.length > 0) {
      for (const it of items) {
        if (it.tipe_perubahan === 'ITEM_BARU') {
          if (!it.kategori_pekerjaan || !String(it.kategori_pekerjaan).trim()) {
            return NextResponse.json(
              {
                status: 'error',
                message: `Kategori pekerjaan wajib dipilih untuk penambahan item baru "${it.deskripsi || 'Item'}".`,
              },
              { status: 400 }
            );
          }
          if (!it.deskripsi || !String(it.deskripsi).trim()) {
            return NextResponse.json(
              {
                status: 'error',
                message: `Nama item pekerjaan baru wajib diisi atau dipilih dari Master Harga.`,
              },
              { status: 400 }
            );
          }
        }
      }
    }

    const nextStatus = is_draft
      ? (existing.status === 'REVISI' ? 'REVISI' : 'DRAFT')
      : 'MENUNGGU_APPROVAL_BBM_MANAGER';

    const totalItemBaru = items.filter((it: any) => it.tipe_perubahan === 'ITEM_BARU').length;
    const totalItemUbahVol = items.filter((it: any) => it.tipe_perubahan === 'UBAH_VOLUME').length;

    // Transaksi Update
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Hapus items lama
      await tx.dc_aanwijzing_klarifikasi_item.deleteMany({
        where: { klarifikasi_id: klarifikasiId },
      });

      // 2. Insert items baru
      if (items.length > 0) {
        await tx.dc_aanwijzing_klarifikasi_item.createMany({
          data: items.map((it: any) => ({
            klarifikasi_id: klarifikasiId,
            tipe_perubahan: it.tipe_perubahan,
            original_renovasi_item_id: it.original_renovasi_item_id ? parseInt(it.original_renovasi_item_id, 10) : null,
            lingkup: it.lingkup || 'SIPIL',
            kategori_pekerjaan: it.kategori_pekerjaan || 'Pekerjaan Persiapan',
            deskripsi: it.deskripsi,
            satuan: it.satuan || 'm2',
            volume_awal: Number(it.volume_awal) || 0,
            volume_akhir: Number(it.volume_akhir) || 0,
            harga_material: Number(it.harga_material) || 0,
            harga_upah: Number(it.harga_upah) || 0,
            total_biaya_awal: Number(it.total_biaya_awal) || 0,
            total_biaya_akhir: Number(it.total_biaya_akhir) || 0,
            status_perubahan: it.status_perubahan || (it.tipe_perubahan === 'ITEM_BARU' ? 'Item Baru Ditambahkan' : 'Item Disesuaikan'),
            catatan: it.catatan || null,
            keterangan: it.keterangan || (it.tipe_perubahan === 'ITEM_BARU' ? 'Item Baru Ditambahkan' : `Volume berubah dari ${it.volume_awal} ${it.satuan} menjadi ${it.volume_akhir} ${it.satuan}`),
          })),
        });
      }

      // 3. Update induk
      const upd = await tx.dc_aanwijzing_klarifikasi.update({
        where: { id: klarifikasiId },
        data: {
          catatan_maker: catatan_maker || null,
          total_item_baru: totalItemBaru,
          total_item_ubah_vol: totalItemUbahVol,
          status: nextStatus,
        },
      });

      // 4. Audit Log
      await tx.dc_aanwijzing_klarifikasi_audit_log.create({
        data: {
          klarifikasi_id: klarifikasiId,
          user_email: currentUser.email,
          user_name: (currentUser as any).nama || currentUser.email,
          user_role: currentUser.role,
          action: is_draft
            ? (existing.status === 'REVISI' ? 'REVISI_DRAFT_UPDATED' : 'DRAFT_UPDATED')
            : 'RESUBMIT',
          from_status: existing.status,
          to_status: nextStatus,
          notes: is_draft
            ? (existing.status === 'REVISI' ? 'Draft perbaikan revisi disimpan sementara.' : 'Draft Berita Acara Klarifikasi diperbarui.')
            : 'Perbaikan berkas revisi diajukan ulang ke Branch Building & Maintenance Manager.',
        },
      });

      return upd;
    });

    // Background sync Google Drive
    syncBeritaAcaraToGoogleDrive(klarifikasiId).catch((err) =>
      console.error('[GDrive Sync Error on update]', err)
    );

    return NextResponse.json({
      status: 'success',
      message: is_draft
        ? (existing.status === 'REVISI'
            ? 'Draft perbaikan revisi berhasil disimpan. Berkas tetap berstatus REVISI sampai Anda mengajukan ulang.'
            : 'Draft Berita Acara Klarifikasi berhasil diperbarui.')
        : 'Perbaikan Berita Acara Klarifikasi berhasil diajukan ulang ke alur persetujuan.',
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating klarifikasi aanwijzing:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dc-development/klarifikasi-aanwijzing/[id]
 * Menghapus pengajuan klarifikasi (hanya jika DRAFT atau REVISI)
 */
export async function DELETE(
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
      },
    });
    const currentUser = dbUser || session;
    const roleUpper = (currentUser.role || '').trim().toUpperCase();
    const isAdmin = isApprovalAdmin(roleUpper);

    const existing = await prisma.dc_aanwijzing_klarifikasi.findUnique({
      where: { id: klarifikasiId },
    });

    if (!existing) {
      return NextResponse.json(
        { status: 'error', message: 'Data Berita Acara tidak ditemukan' },
        { status: 404 }
      );
    }

    const isCreator = isSameCreator(currentUser, existing.created_by);
    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { status: 'error', message: 'Hanya pembuat pengajuan atau Administrator yang berwenang menghapus berkas ini.' },
        { status: 403 }
      );
    }

    // Dokumen yang aktif di alur approval dilarang dihapus
    if (existing.status !== 'DRAFT' && existing.status !== 'REVISI') {
      return NextResponse.json(
        {
          status: 'error',
          message: `Berkas dengan status ${existing.status} tidak dapat dihapus karena sedang aktif di alur persetujuan.`,
        },
        { status: 400 }
      );
    }

    // Hapus cascading
    await prisma.dc_aanwijzing_klarifikasi.delete({
      where: { id: klarifikasiId },
    });

    return NextResponse.json({
      status: 'success',
      message: 'Berita Acara Klarifikasi berhasil dihapus.',
    });
  } catch (error: any) {
    console.error('Error deleting klarifikasi aanwijzing:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}
