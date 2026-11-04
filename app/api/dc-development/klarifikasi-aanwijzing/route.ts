import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';
import { isApprovalAdmin, isSameCreator, canManageKlarifikasiAanwijzing } from '@/lib/permissions';
import { generateBeritaAcaraAanwijzingPdf, syncBeritaAcaraToGoogleDrive } from '@/lib/pdf/berita-acara-aanwijzing-pdf.service';

/**
 * Helper untuk men-generate Nomor Berita Acara Klarifikasi Resmi
 * Format: BA/DC/YYMM/XXXX (misal: BA/DC/2610/0001)
 */
async function generateNomorKlarifikasi(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `BA/DC/${yy}${mm}/`;

  const countThisMonth = await prisma.dc_aanwijzing_klarifikasi.count({
    where: {
      nomor_klarifikasi: {
        startsWith: prefix,
      },
    },
  });

  const nextSeq = String(countThisMonth + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

/**
 * GET /api/dc-development/klarifikasi-aanwijzing
 * Mengambil daftar berita acara klarifikasi dengan filter, pagination, dan aturan tiered visibility
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { status: 'error', message: 'Sesi login tidak valid' },
        { status: 401 }
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

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const branchFilter = searchParams.get('cabang') || '';
    const statusFilter = searchParams.get('status') || '';

    const list = await prisma.dc_aanwijzing_klarifikasi.findMany({
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
            dokumen: true,
          },
        },
        items: true,
        dokumen: true,
        audit_logs: {
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Terapkan Tiered Visibility & Hak Akses Cabang
    const filtered = list.filter((item) => {
      // 1. Filter Cakupan Cabang
      const itemBranch = (item.cabang || item.project?.cabang || '').trim().toUpperCase();
      if (!isBranchAccessible(itemBranch, userCoverage)) return false;
      if (branchFilter && branchFilter.toLowerCase() !== 'all') {
        if (itemBranch !== branchFilter.trim().toUpperCase()) return false;
      }

      // 2. Filter Status UI
      if (statusFilter && statusFilter.toLowerCase() !== 'all') {
        if (item.status !== statusFilter) return false;
      }

      // 3. Aturan Visibilitas Khusus Berstatus REVISI (Private to Creator & Admin)
      if (item.status === 'REVISI') {
        const isCreator = isSameCreator(currentUser, item.created_by);
        if (!isAdmin && !isCreator) return false;
      }

      // 4. Aturan Visibilitas Tiered Approver vs Maker
      if (!isAdmin) {
        const isCreator = isSameCreator(currentUser, item.created_by);
        const isBmMgr =
          (roleUpper.includes('BRANCH BUILDING') && roleUpper.includes('MANAGER')) ||
          roleUpper.includes('B&M MANAGER') ||
          roleUpper.includes('BM MANAGER');
        const isDcSpecialist =
          roleUpper.includes('DC SPECIALIST') || roleUpper.includes('DEVELOPMENT SPECIALIST');

        if (isCreator) {
          // Maker melihat semua status pengajuannya sendiri
        } else if (isBmMgr) {
          // B&M Mgr hanya melihat jika sudah submit (MENUNGGU_APPROVAL_BBM_MANAGER ke atas), tidak melihat DRAFT atau REVISI
          if (item.status === 'DRAFT' || item.status === 'REVISI') return false;
        } else if (isDcSpecialist) {
          // DC Specialist hanya melihat jika sudah lolos B&M Manager
          if (
            item.status === 'DRAFT' ||
            item.status === 'REVISI' ||
            item.status === 'MENUNGGU_APPROVAL_BBM_MANAGER'
          ) {
            return false;
          }
        } else {
          // User umum lain hanya melihat APPROVED
          if (item.status !== 'APPROVED') return false;
        }
      }

      // 5. Filter Pencarian Text
      if (search) {
        const matchNo = item.nomor_klarifikasi.toLowerCase().includes(search);
        const matchProyek = (item.project?.nama_proyek || '').toLowerCase().includes(search);
        const matchKode = (item.project?.kode || '').toLowerCase().includes(search);
        const matchAanwijzing = (item.aanwijzing?.nomor_undangan || '').toLowerCase().includes(search);
        if (!matchNo && !matchProyek && !matchKode && !matchAanwijzing) return false;
      }

      return true;
    });

    // Query detail_revisi untuk pengajuan berstatus REVISI
    const revisiIds = filtered.filter((i) => i.status === 'REVISI').map((i) => String(i.id));
    const revisiMap: Record<string, any> = {};
    if (revisiIds.length > 0) {
      const logs = await prisma.app_audit_log.findMany({
        where: {
          entitas: 'dc_aanwijzing_klarifikasi',
          entitas_id: { in: revisiIds },
          aksi: 'APPROVAL_REVISI',
        },
        orderBy: { created_at: 'desc' },
      });
      for (const log of logs) {
        if (!revisiMap[log.entitas_id]) {
          const db = log.data_baru as any;
          revisiMap[log.entitas_id] = db?.detail_revisi || null;
        }
      }
    }

    const finalData = filtered.map((item) => ({
      ...item,
      detail_revisi: revisiMap[String(item.id)] || null,
    }));

    return NextResponse.json({
      status: 'success',
      data: finalData,
    });
  } catch (error: any) {
    console.error('Error fetching klarifikasi aanwijzing list:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dc-development/klarifikasi-aanwijzing
 * Membuat dan mengajukan Berita Acara Klarifikasi Baru
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { status: 'error', message: 'Sesi login tidak valid' },
        { status: 401 }
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

    // Validasi izin Maker
    if (!canManageKlarifikasiAanwijzing(currentUser.role)) {
      return NextResponse.json(
        {
          status: 'error',
          message:
            'Akses ditolak: Hanya Branch Building Koordinator atau Administrator yang berwenang membuat Berita Acara Klarifikasi.',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      aanwijzing_id,
      catatan_maker,
      durasi_hari_awal,
      durasi_hari_akhir,
      status_durasi,
      catatan_durasi,
      items = [],
      dokumen = [],
      is_draft = false,
    } = body;

    const aanwijzingId = parseInt(aanwijzing_id, 10);
    if (isNaN(aanwijzingId)) {
      return NextResponse.json(
        { status: 'error', message: 'ID Aanwijzing tidak valid' },
        { status: 400 }
      );
    }

    // Ambil data Aanwijzing
    const aanwijzing = await prisma.dc_aanwijzing.findUnique({
      where: { id: aanwijzingId },
      include: {
        project: true,
        renovasi: {
          include: {
            item_rab: true,
            dokumen: true,
          },
        },
        klarifikasi: true,
      },
    });

    if (!aanwijzing) {
      return NextResponse.json(
        { status: 'error', message: 'Data Aanwijzing tidak ditemukan' },
        { status: 404 }
      );
    }

    // Pastikan aanwijzing sudah selesai sesi absensi
    if (aanwijzing.status !== 'AANWIJZING_SELESAI') {
      return NextResponse.json(
        {
          status: 'error',
          message: `Aanwijzing belum berstatus SELESAI (Status saat ini: ${aanwijzing.status}). Klarifikasi hanya dapat dibuat setelah sesi absensi selesai.`,
        },
        { status: 400 }
      );
    }

    // Pastikan belum ada klarifikasi aktif
    if (aanwijzing.klarifikasi) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Aanwijzing ini sudah memiliki Berita Acara Klarifikasi (${aanwijzing.klarifikasi.nomor_klarifikasi}). Silakan perbaiki atau buka berkas tersebut.`,
        },
        { status: 400 }
      );
    }

    // Validasi wewenang cabang pembuat
    const userCoverage = getUserCoverageBranches(currentUser);
    const targetBranch = (aanwijzing.cabang || aanwijzing.project?.cabang || '').trim().toUpperCase();
    if (!isBranchAccessible(targetBranch, userCoverage)) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Anda tidak berwenang membuat klarifikasi untuk cabang ${targetBranch}`,
        },
        { status: 403 }
      );
    }

    // Validasi kelengkapan item baru jika bukan draft
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

    const nomorKlarifikasi = await generateNomorKlarifikasi();
    const initialStatus = is_draft ? 'DRAFT' : 'MENUNGGU_APPROVAL_BBM_MANAGER';

    // Hitung rekap perubahan item
    const totalItemBaru = items.filter((it: any) => it.tipe_perubahan === 'ITEM_BARU').length;
    const totalItemUbahVol = items.filter((it: any) => it.tipe_perubahan === 'UBAH_VOLUME').length;

    // Simpan ke database
    const newKlarifikasi = await prisma.$transaction(async (tx) => {
      const created = await tx.dc_aanwijzing_klarifikasi.create({
        data: {
          nomor_klarifikasi: nomorKlarifikasi,
          aanwijzing_id: aanwijzing.id,
          project_id: aanwijzing.project_id,
          renovasi_id: aanwijzing.renovasi_id,
          status: initialStatus,
          total_item_baru: totalItemBaru,
          total_item_ubah_vol: totalItemUbahVol,
          catatan_maker: catatan_maker || null,
          durasi_hari_awal: Number(durasi_hari_awal) || 0,
          durasi_hari_akhir: Number(durasi_hari_akhir) || Number(durasi_hari_awal) || 0,
          status_durasi: status_durasi || 'TETAP',
          catatan_durasi: catatan_durasi || null,
          tanggal_tender: body.tanggal_tender ? new Date(body.tanggal_tender) : new Date('2026-11-03T00:00:00.000Z'),
          created_by: currentUser.email,
          cabang: aanwijzing.cabang,
        },
      });

      // Jika items yang dikirim kosong, otomatis masukkan seluruh item dari renovasi sebagai baseline "Sama dengan RAB/OE"
      let finalItems = items;
      if (!finalItems || finalItems.length === 0) {
        finalItems = (aanwijzing.renovasi?.item_rab || []).map((orig: any) => {
          const vol = Number(orig.volume) || 0;
          const mat = Number(orig.harga_material) || 0;
          const upah = Number(orig.harga_upah) || 0;
          return {
            tipe_perubahan: 'SAMA_DENGAN_RAB',
            original_renovasi_item_id: orig.id,
            lingkup: orig.lingkup || 'SIPIL',
            kategori_pekerjaan: orig.kategori_pekerjaan || 'Pekerjaan Persiapan',
            deskripsi: orig.deskripsi,
            satuan: orig.satuan || 'm2',
            volume_awal: vol,
            volume_akhir: vol,
            harga_material: mat,
            harga_upah: upah,
            total_biaya_awal: vol * (mat + upah),
            total_biaya_akhir: vol * (mat + upah),
            status_perubahan: 'Sama dengan RAB/OE',
            catatan: null,
            keterangan: 'Sama dengan RAB/OE',
          };
        });
      }

      // Insert Items
      if (finalItems.length > 0) {
        await tx.dc_aanwijzing_klarifikasi_item.createMany({
          data: finalItems.map((it: any) => ({
            klarifikasi_id: created.id,
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
            status_perubahan: it.status_perubahan || (it.tipe_perubahan === 'ITEM_BARU' ? 'Item Baru Ditambahkan' : (it.tipe_perubahan === 'SAMA_DENGAN_RAB' ? 'Sama dengan RAB/OE' : 'Item Disesuaikan')),
            catatan: it.catatan || null,
            keterangan: it.keterangan || (it.tipe_perubahan === 'ITEM_BARU' ? 'Item Baru Ditambahkan' : (it.tipe_perubahan === 'SAMA_DENGAN_RAB' ? 'Sama dengan RAB/OE' : `Volume berubah dari ${it.volume_awal} ${it.satuan} menjadi ${it.volume_akhir} ${it.satuan}`)),
          })),
        });
      }

      // Jika dokumen yang dikirim kosong, otomatis masukkan seluruh dokumen dari renovasi sebagai baseline "DARI_RAB"
      let finalDokumen = dokumen;
      if (!finalDokumen || finalDokumen.length === 0) {
        finalDokumen = (aanwijzing.renovasi?.dokumen || []).map((d: any) => ({
          kategori_file: d.kategori_file,
          nama_file: d.nama_file,
          nama_label: d.nama_label || d.nama_file,
          file_url: d.file_url || null,
          drive_file_id: d.drive_file_id || null,
          mime_type: d.mime_type || null,
          latitude: d.latitude ? Number(d.latitude) : null,
          longitude: d.longitude ? Number(d.longitude) : null,
          lokasi_wilayah: d.lokasi_wilayah || null,
          timestamp_watermark: d.timestamp_watermark ? new Date(d.timestamp_watermark) : null,
          sumber: 'DARI_RAB',
          catatan: null,
        }));
      }

      // Insert Dokumen Teknis & Foto Lingkungan
      if (finalDokumen && Array.isArray(finalDokumen) && finalDokumen.length > 0) {
        await tx.dc_aanwijzing_klarifikasi_dokumen.createMany({
          data: finalDokumen.map((d: any) => ({
            klarifikasi_id: created.id,
            kategori_file: d.kategori_file,
            nama_file: d.nama_file,
            nama_label: d.nama_label || null,
            file_url: d.file_url || null,
            drive_file_id: d.drive_file_id || null,
            mime_type: d.mime_type || null,
            latitude: d.latitude ? Number(d.latitude) : null,
            longitude: d.longitude ? Number(d.longitude) : null,
            lokasi_wilayah: d.lokasi_wilayah || null,
            timestamp_watermark: d.timestamp_watermark ? new Date(d.timestamp_watermark) : null,
            sumber: d.sumber || 'DARI_RAB',
            catatan: d.catatan || null,
          })),
        });
      }

      // Audit Log
      await tx.dc_aanwijzing_klarifikasi_audit_log.create({
        data: {
          klarifikasi_id: created.id,
          user_email: currentUser.email,
          user_name: (currentUser as any).nama || currentUser.email,
          user_role: currentUser.role,
          action: is_draft ? 'DRAFT_CREATED' : 'SUBMIT',
          from_status: 'DRAFT',
          to_status: initialStatus,
          notes: is_draft
            ? 'Draft Berita Acara Klarifikasi dibuat.'
            : 'Berita Acara Klarifikasi diajukan ke Branch Building & Maintenance Manager.',
        },
      });

      return created;
    });

    // Jalankan background sync Google Drive secara asinkron
    syncBeritaAcaraToGoogleDrive(newKlarifikasi.id).catch((err) =>
      console.error('[GDrive Sync Error]', err)
    );

    return NextResponse.json({
      status: 'success',
      message: is_draft
        ? 'Draft Berita Acara Klarifikasi berhasil disimpan.'
        : 'Berita Acara Klarifikasi berhasil dibuat dan diajukan ke Branch B&M Manager.',
      data: newKlarifikasi,
    });
  } catch (error: any) {
    console.error('Error creating klarifikasi aanwijzing:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}
