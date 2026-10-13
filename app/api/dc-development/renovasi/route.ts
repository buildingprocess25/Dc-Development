import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getBranchesUnderInduk, getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';
import {
  canManageRenovasi,
  canEditRenovasiSubmission,
  canUserViewRenovasiSubmission,
  getRenovasiUserFilter
} from '@/lib/permissions';
import { toTitleCase } from '@/lib/utils';
import { syncRenovasiPdfToDrive } from '@/lib/renovasi-sync';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    const allowedBranches = getUserCoverageBranches(session);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const renovasi = await prisma.dc_renovasi.findUnique({
        where: { id: parseInt(id, 10) },
        include: {
          project: true,
          dokumen: true,
          item_rab: true
        }
      });

      if (!renovasi) {
        return NextResponse.json({ status: 'error', message: 'Data renovasi tidak ditemukan' }, { status: 404 });
      }

      if (allowedBranches !== null && !isBranchAccessible(renovasi.cabang || renovasi.project?.cabang, allowedBranches)) {
        return NextResponse.json({ status: 'error', message: 'Akses ditolak: Dokumen renovasi berada di luar coverage cabang Anda.' }, { status: 403 });
      }

      if (!canUserViewRenovasiSubmission(session, renovasi)) {
        return NextResponse.json(
          { status: 'error', message: 'Akses ditolak: Anda hanya dapat mengakses pengajuan yang diajukan oleh akun Anda sendiri.' },
          { status: 403 }
        );
      }

      // Ambil detail_revisi dari log revisi terbaru jika status REVISI
      let detailRevisi = null;
      if (renovasi.status === 'REVISI') {
        try {
          const latestRevisionLog = await prisma.app_audit_log.findFirst({
            where: {
              modul: 'RENOVASI_DC',
              entitas: 'dc_renovasi',
              entitas_id: String(renovasi.id),
              aksi: 'APPROVAL_REVISI'
            },
            orderBy: { created_at: 'desc' }
          });
          const dataBaru = latestRevisionLog?.data_baru as any;
          detailRevisi = dataBaru?.detail_revisi || null;
        } catch (err) {
          console.warn('Gagal memuat log audit revisi:', err);
        }
      }

      return NextResponse.json({
        status: 'success',
        data: {
          ...renovasi,
          detail_revisi: detailRevisi
        }
      });
    }

    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const cabang = searchParams.get('cabang') || '';

    const andConditions: any[] = [];

    // Filter berdasarkan coverage cabang akun user
    if (allowedBranches !== null) {
      if (cabang && cabang !== 'all') {
        const childBranches = getBranchesUnderInduk(cabang);
        const intersect = childBranches.filter((b) => allowedBranches.includes(b.toUpperCase()));
        andConditions.push({
          OR: [
            { cabang: { in: intersect, mode: 'insensitive' } },
            { project: { cabang: { in: intersect, mode: 'insensitive' } } }
          ]
        });
      } else {
        andConditions.push({
          OR: [
            { cabang: { in: allowedBranches, mode: 'insensitive' } },
            { project: { cabang: { in: allowedBranches, mode: 'insensitive' } } }
          ]
        });
      }
    } else {
      if (cabang && cabang !== 'all') {
        const childBranches = getBranchesUnderInduk(cabang);
        andConditions.push({
          OR: [
            { cabang: { in: childBranches, mode: 'insensitive' } },
            { project: { cabang: { in: childBranches, mode: 'insensitive' } } }
          ]
        });
      }
    }

    // Filter pembatasan creator (Branch Building Koordinator hanya melihat pengajuan yang diajukan sendiri)
    const creatorFilter = getRenovasiUserFilter(session);
    if (creatorFilter) {
      andConditions.push(creatorFilter);
    }

    if (status && status !== 'all') {
      andConditions.push({
        status: { equals: status, mode: 'insensitive' }
      });
    }

    if (search) {
      andConditions.push({
        OR: [
          { nomor_pengajuan: { contains: search, mode: 'insensitive' } },
          { jenis_renovasi: { contains: search, mode: 'insensitive' } },
          { project: { nama_proyek: { contains: search, mode: 'insensitive' } } },
          { project: { kode: { contains: search, mode: 'insensitive' } } },
        ]
      });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const renovasiList = await prisma.dc_renovasi.findMany({
      where,
      include: {
        project: true,
        dokumen: true,
        item_rab: true,
        _count: {
          select: {
            dokumen: true,
            item_rab: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // Batch query detail_revisi untuk pengajuan berstatus REVISI
    const revisiIds = renovasiList
      .filter((r) => r.status === 'REVISI')
      .map((r) => String(r.id));

    const revisiMap: Record<string, any> = {};
    if (revisiIds.length > 0) {
      try {
        const logs = await prisma.app_audit_log.findMany({
          where: {
            modul: 'RENOVASI_DC',
            entitas: 'dc_renovasi',
            entitas_id: { in: revisiIds },
            aksi: 'APPROVAL_REVISI'
          },
          orderBy: { created_at: 'desc' }
        });
        logs.forEach((log) => {
          if (!revisiMap[log.entitas_id]) {
            const db = log.data_baru as any;
            revisiMap[log.entitas_id] = db?.detail_revisi || null;
          }
        });
      } catch (err) {
        console.warn('Gagal memuat log audit revisi:', err);
      }
    }

    const dataWithDetailRevisi = renovasiList.map((r) => ({
      ...r,
      detail_revisi: revisiMap[String(r.id)] || null
    }));

    return NextResponse.json({ status: 'success', data: dataWithDetailRevisi });
  } catch (error: any) {
    console.error('Error fetching list renovasi:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !canManageRenovasi(session.role)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Akses ditolak: Hanya Branch Building Koordinator dan Admin yang memiliki izin mengajukan atau mengubah pengajuan renovasi.'
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      project_id,
      jenis_renovasi,
      lingkup_pekerjaan = 'Sipil + ME',
      durasi_hari = 0,
      satuan_durasi = 'Hari',
      catatan_pengajuan,
      status = 'DRAFT',
      dokumen = [],
      items = []
    } = body;

    if (!project_id) {
      return NextResponse.json({ status: 'error', message: 'Proyek harus dipilih' }, { status: 400 });
    }

    if (status === 'MENUNGGU APPROVAL B&M MANAGER') {
      if (!jenis_renovasi || !jenis_renovasi.trim()) {
        return NextResponse.json({ status: 'error', message: 'Jenis Renovasi wajib diisi' }, { status: 400 });
      }

      if (!durasi_hari || Number(durasi_hari) <= 0) {
        return NextResponse.json({ status: 'error', message: 'Durasi Pekerjaan wajib diisi (minimal 1 hari)' }, { status: 400 });
      }

      // Validasi 4 Berkas Gambar Teknis: Sipil (PDF & DWG) dan ME (PDF & DWG)
      const hasSipilPdf = dokumen.some((d: any) =>
        d.kategori_file === 'GAMBAR_SIPIL_PDF' || (d.kategori_file === 'GAMBAR_SIPIL' && d.nama_file?.toLowerCase().endsWith('.pdf'))
      );
      if (!hasSipilPdf) {
        return NextResponse.json({ status: 'error', message: 'Gambar Kerja Sipil berformat PDF (.pdf) wajib diunggah' }, { status: 400 });
      }

      const hasSipilDwg = dokumen.some((d: any) =>
        d.kategori_file === 'GAMBAR_SIPIL_DWG' || (d.kategori_file === 'GAMBAR_SIPIL' && (d.nama_file?.toLowerCase().endsWith('.dwg') || d.nama_file?.toLowerCase().endsWith('.dxf')))
      );
      if (!hasSipilDwg) {
        return NextResponse.json({ status: 'error', message: 'Gambar Kerja Sipil berformat AutoCAD (.dwg) wajib diunggah' }, { status: 400 });
      }

      const hasMePdf = dokumen.some((d: any) =>
        d.kategori_file === 'GAMBAR_ME_PDF' || (d.kategori_file === 'GAMBAR_ME' && d.nama_file?.toLowerCase().endsWith('.pdf'))
      );
      if (!hasMePdf) {
        return NextResponse.json({ status: 'error', message: 'Gambar Kerja ME berformat PDF (.pdf) wajib diunggah' }, { status: 400 });
      }

      const hasMeDwg = dokumen.some((d: any) =>
        d.kategori_file === 'GAMBAR_ME_DWG' || (d.kategori_file === 'GAMBAR_ME' && (d.nama_file?.toLowerCase().endsWith('.dwg') || d.nama_file?.toLowerCase().endsWith('.dxf')))
      );
      if (!hasMeDwg) {
        return NextResponse.json({ status: 'error', message: 'Gambar Kerja ME berformat AutoCAD (.dwg) wajib diunggah' }, { status: 400 });
      }

      const hasFotoLingkungan = dokumen.some((d: any) => d.kategori_file === 'FOTO_LINGKUNGAN');
      if (!hasFotoLingkungan) {
        return NextResponse.json({ status: 'error', message: 'Foto Lingkungan Eksisting wajib diisi (minimal 1 foto)' }, { status: 400 });
      }

      const hasItemSipil = items.some(
        (it: any) => (it.lingkup || '').toUpperCase() === 'SIPIL' && (it.deskripsi || it.master_item_id) && parseFloat(it.volume) > 0
      );
      if (!hasItemSipil) {
        return NextResponse.json({ status: 'error', message: 'Item pekerjaan Sipil wajib diisi (minimal 1 item dengan volume > 0)' }, { status: 400 });
      }

      const hasItemMe = items.some(
        (it: any) => (it.lingkup || '').toUpperCase() === 'ME' && (it.deskripsi || it.master_item_id) && parseFloat(it.volume) > 0
      );
      if (!hasItemMe) {
        return NextResponse.json({ status: 'error', message: 'Item pekerjaan ME wajib diisi (minimal 1 item dengan volume > 0)' }, { status: 400 });
      }
    }

    // Ambil data proyek untuk cabang dan kode
    const project = await prisma.dc_project.findUnique({
      where: { id: Number(project_id) }
    });

    if (!project) {
      return NextResponse.json({ status: 'error', message: 'Proyek tidak ditemukan' }, { status: 404 });
    }

    // Validasi Penguncian & Hak Edit:
    // Jika body.id ada, validasi apakah user memiliki wewenang untuk merevisi/mengubah pengajuan ini
    let existingTarget: any = null;
    if (body.id) {
      const existingId = Number(body.id);
      existingTarget = await prisma.dc_renovasi.findUnique({
        where: { id: existingId },
        select: { id: true, created_by: true, status: true, nomor_pengajuan: true, catatan_pengajuan: true }
      });

      if (!existingTarget) {
        return NextResponse.json({ status: 'error', message: 'Data pengajuan renovasi tidak ditemukan' }, { status: 404 });
      }

      if (!canEditRenovasiSubmission(session, existingTarget)) {
        return NextResponse.json(
          {
            status: 'error',
            message: `Akses ditolak: Pengajuan ini dibuat oleh ${existingTarget.created_by}. Hanya akun pembuat yang sama atau Admin yang berhak melakukan revisi/perubahan.`
          },
          { status: 403 }
        );
      }
    }

    // Cek apakah proyek DC ini sudah memiliki pengajuan renovasi aktif (belum SELESAI)
    // Jika body.id ada, kecualikan pengajuan yang sedang diupdate.
    const activeRenovasiWhere: any = {
      project_id: Number(project_id),
      status: { not: 'SELESAI' }
    };

    if (body.id) {
      activeRenovasiWhere.id = { not: Number(body.id) };
    }

    const existingActiveSubmission = await prisma.dc_renovasi.findFirst({
      where: activeRenovasiWhere,
      select: {
        id: true,
        nomor_pengajuan: true,
        status: true
      }
    });

    if (existingActiveSubmission) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Proyek DC ini sudah memiliki pengajuan renovasi aktif (${existingActiveSubmission.nomor_pengajuan} - Status: ${existingActiveSubmission.status}). Pengajuan baru tidak dapat dibuat hingga renovasi sebelumnya berstatus SELESAI.`
        },
        { status: 400 }
      );
    }

    // Generate Nomor Pengajuan: REN/YYYYMM/XXXX
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `REN/${yearMonth}/`;

    const lastSubmission = await prisma.dc_renovasi.findFirst({
      where: {
        nomor_pengajuan: {
          startsWith: prefix
        }
      },
      orderBy: {
        nomor_pengajuan: 'desc'
      }
    });

    let nextNumber = 1;
    if (lastSubmission && lastSubmission.nomor_pengajuan) {
      const parts = lastSubmission.nomor_pengajuan.split('/');
      if (parts.length === 3) {
        const lastSequence = parseInt(parts[2], 10);
        if (!isNaN(lastSequence)) {
          nextNumber = lastSequence + 1;
        }
      }
    }

    const nomorPengajuan = `${prefix}${String(nextNumber).padStart(4, '0')}`;

    // Hitung subtotal
    let totalBiayaSipil = 0;
    let totalBiayaMe = 0;

    const formattedItems = items.map((it: any) => {
      const vol = parseFloat(it.volume) || 0;
      const mat = parseFloat(it.harga_material) || 0;
      const wge = parseFloat(it.harga_upah) || 0;
      const totMat = mat * vol;
      const totUpah = wge * vol;
      const totBiaya = totMat + totUpah;

      if ((it.lingkup || '').toUpperCase() === 'ME') {
        totalBiayaMe += totBiaya;
      } else {
        totalBiayaSipil += totBiaya;
      }

      return {
        lingkup: (it.lingkup || 'SIPIL').toUpperCase(),
        kategori_pekerjaan: it.kategori_pekerjaan || 'Umum',
        master_item_id: it.master_item_id ? Number(it.master_item_id) : null,
        deskripsi: it.deskripsi || '',
        harga_material: mat,
        harga_upah: wge,
        volume: vol,
        total_material: totMat,
        total_upah: totUpah,
        total_biaya: totBiaya,
        catatan: it.catatan ? toTitleCase(it.catatan) : null,
        is_custom: Boolean(it.is_custom)
      };
    });

    const totalSebelumPpn = totalBiayaSipil + totalBiayaMe;
    const nilaiPpn = Math.round(totalSebelumPpn * 0.11);
    const totalPlusPpn = totalSebelumPpn + nilaiPpn;
    const grandTotal = Math.ceil(totalPlusPpn / 1000) * 1000;
    const nilaiPembulatan = grandTotal - totalPlusPpn;

    const creatorEmail = session?.email || body.created_by || 'system@alfamart.co.id';
    const submissionCabang = project.cabang || session?.cabang || 'HEAD OFFICE';

    // Simpan ke database via Prisma transaction
    const newRenovasi = await prisma.$transaction(async (tx) => {
      // 1. Simpan jenis renovasi ke preset jika baru
      if (jenis_renovasi && jenis_renovasi.trim()) {
        const titleJenis = toTitleCase(jenis_renovasi.trim());
        const existingPreset = await tx.dc_jenis_renovasi_preset.findUnique({
          where: { nama: titleJenis }
        });
        if (!existingPreset) {
          await tx.dc_jenis_renovasi_preset.create({
            data: {
              nama: titleJenis,
              is_default: false
            }
          });
        }
      }

      // 2. Jika body.id ada, lakukan update pada pengajuan/draft yang sudah ada
      if (body.id) {
        const existingId = Number(body.id);
        await tx.dc_renovasi_dokumen.deleteMany({ where: { renovasi_id: existingId } });
        await tx.dc_renovasi_item.deleteMany({ where: { renovasi_id: existingId } });

        // Jika status pengajuan adalah REVISI dan user menyimpan sebagai draft, status tetap REVISI (tidak berubah jadi DRAFT)
        let updateStatus = status;
        if (existingTarget?.status === 'REVISI' && status === 'DRAFT') {
          updateStatus = 'REVISI';
        }

        const updated = await tx.dc_renovasi.update({
          where: { id: existingId },
          data: {
            project_id: Number(project_id),
            jenis_renovasi: jenis_renovasi ? toTitleCase(jenis_renovasi) : 'Renovasi Peremajaan',
            lingkup_pekerjaan,
            durasi_hari: Number(durasi_hari) || 0,
            satuan_durasi,
            status: updateStatus,
            total_biaya_sipil: totalBiayaSipil,
            total_biaya_me: totalBiayaMe,
            total_sebelum_ppn: totalSebelumPpn,
            nilai_ppn: nilaiPpn,
            nilai_pembulatan: nilaiPembulatan,
            grand_total: grandTotal,
            catatan_pengajuan:
              catatan_pengajuan !== undefined && catatan_pengajuan !== null
                ? (catatan_pengajuan.trim() ? toTitleCase(catatan_pengajuan.trim()) : null)
                : (existingTarget?.catatan_pengajuan ?? null),
            cabang: submissionCabang,
            dokumen: {
              create: dokumen.map((doc: any) => ({
                kategori_file: doc.kategori_file,
                nama_file: doc.nama_file,
                nama_label: doc.nama_label
                  ? toTitleCase(doc.nama_label)
                  : (doc.kategori_file === 'FOTO_LINGKUNGAN' && doc.nama_file
                      ? toTitleCase(doc.nama_file.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '))
                      : null),
                file_url: doc.file_url || null,
                drive_file_id: doc.drive_file_id || null,
                mime_type: doc.mime_type || null,
                latitude: doc.latitude ? parseFloat(doc.latitude) : null,
                longitude: doc.longitude ? parseFloat(doc.longitude) : null,
                timestamp_watermark: doc.timestamp_watermark ? new Date(doc.timestamp_watermark) : null
              }))
            },
            item_rab: {
              create: formattedItems
            }
          },
          include: {
            project: true,
            dokumen: true,
            item_rab: true
          }
        });
        return updated;
      }

      // 3. Buat header dc_renovasi baru
      const created = await tx.dc_renovasi.create({
        data: {
          nomor_pengajuan: nomorPengajuan,
          project_id: Number(project_id),
          jenis_renovasi: jenis_renovasi ? toTitleCase(jenis_renovasi) : 'Renovasi Peremajaan',
          lingkup_pekerjaan,
          durasi_hari: Number(durasi_hari) || 0,
          satuan_durasi,
          status,
          total_biaya_sipil: totalBiayaSipil,
          total_biaya_me: totalBiayaMe,
          total_sebelum_ppn: totalSebelumPpn,
          nilai_ppn: nilaiPpn,
          nilai_pembulatan: nilaiPembulatan,
          grand_total: grandTotal,
          catatan_pengajuan: catatan_pengajuan ? toTitleCase(catatan_pengajuan) : null,
          created_by: creatorEmail,
          cabang: submissionCabang,
          dokumen: {
            create: dokumen.map((doc: any) => ({
              kategori_file: doc.kategori_file, // "GAMBAR_SIPIL", "GAMBAR_ME", "FOTO_LINGKUNGAN"
              nama_file: doc.nama_file,
              nama_label: doc.nama_label
                ? toTitleCase(doc.nama_label)
                : (doc.kategori_file === 'FOTO_LINGKUNGAN' && doc.nama_file
                    ? toTitleCase(doc.nama_file.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '))
                    : null),
              file_url: doc.file_url || null,
              drive_file_id: doc.drive_file_id || null,
              mime_type: doc.mime_type || null,
              latitude: doc.latitude ? parseFloat(doc.latitude) : null,
              longitude: doc.longitude ? parseFloat(doc.longitude) : null,
              timestamp_watermark: doc.timestamp_watermark ? new Date(doc.timestamp_watermark) : null
            }))
          },
          item_rab: {
            create: formattedItems
          }
        },
        include: {
          project: true,
          dokumen: true,
          item_rab: true
        }
      });

      return created;
    });

    // Picu sinkronisasi PDF ke Google Drive di latar belakang (tidak memblokir respons HTTP)
    if (newRenovasi && newRenovasi.id) {
      syncRenovasiPdfToDrive(newRenovasi.id).catch((err) => {
        console.error(`[Background Sync PDF] Gagal sinkronisasi renovasi #${newRenovasi.id}:`, err);
      });
    }

    return NextResponse.json({
      status: 'success',
      message: 'Pengajuan renovasi berhasil disimpan',
      data: newRenovasi
    });
  } catch (error: any) {
    console.error('Error creating pengajuan renovasi:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// Handler DELETE untuk menghapus pengajuan / draft beserta seluruh dokumen & item RAB
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || !canManageRenovasi(session.role)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Akses ditolak: Hanya Branch Building Koordinator dan Admin yang memiliki izin menghapus pengajuan renovasi.'
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { status: 'error', message: 'ID pengajuan wajib disertakan' },
        { status: 400 }
      );
    }

    const renovasiId = parseInt(id, 10);
    const existing = await prisma.dc_renovasi.findUnique({
      where: { id: renovasiId },
      include: { project: true }
    });

    if (!existing) {
      return NextResponse.json(
        { status: 'error', message: 'Data renovasi tidak ditemukan' },
        { status: 404 }
      );
    }

    if (!canEditRenovasiSubmission(session, existing)) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Akses ditolak: Pengajuan ini dibuat oleh ${existing.created_by}. Hanya akun pembuat yang sama atau Admin yang berhak menghapus.`
        },
        { status: 403 }
      );
    }

    // Hapus dari database (Prisma cascade akan otomatis menghapus dc_renovasi_dokumen dan dc_renovasi_item)
    await prisma.dc_renovasi.delete({
      where: { id: renovasiId }
    });

    return NextResponse.json({
      status: 'success',
      message: `Pengajuan ${existing.nomor_pengajuan} berhasil dihapus beserta seluruh dokumen dan item RAB.`
    });
  } catch (error: any) {
    console.error('Error deleting renovasi:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
