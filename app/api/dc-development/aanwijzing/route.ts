import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches } from '@/lib/branches';
import { canUserViewAanwijzing } from '@/lib/permissions';
import { generateUndanganAanwijzingPdf } from '@/lib/pdf/generate-undangan-aanwijzing-pdf';
import { sendUndanganAanwijzingEmail, findPicUserForVendor } from '@/lib/email/aanwijzing-mailer';
import { syncAanwijzingPdfToDrive } from '@/lib/aanwijzing-sync';

/**
 * Engine evaluasi otomatis timeout 48 jam (2x24 JAM)
 */
async function runAanwijzingTimeoutEngine() {
  const now = new Date();

  // Ambil semua aanwijzing yang masih MENUNGGU_KONFIRMASI dan deadline telah terlewat
  const expiredAanwijzings = await prisma.dc_aanwijzing.findMany({
    where: {
      status: 'MENUNGGU_KONFIRMASI',
      deadline_konfirmasi: {
        lte: now,
      },
    },
    include: {
      peserta: true,
    },
  });

  for (const aanwijzing of expiredAanwijzings) {
    // 1. Auto-set kontraktor yang belum merespon menjadi TIDAK_HADIR
    const pendingPeserta = aanwijzing.peserta.filter(
      (p) => p.status_konfirmasi === 'MENUNGGU_RESPON'
    );

    if (pendingPeserta.length > 0) {
      await prisma.dc_aanwijzing_vendor.updateMany({
        where: {
          aanwijzing_id: aanwijzing.id,
          status_konfirmasi: 'MENUNGGU_RESPON',
        },
        data: {
          status_konfirmasi: 'TIDAK_HADIR',
          respon_at: now,
          alasan_tidak_hadir: 'Auto-decline: Melewati batas waktu respon konfirmasi 2x24 JAM',
        },
      });
    }

    // 2. Evaluasi Quorum Kehadiran
    const updatedPeserta = await prisma.dc_aanwijzing_vendor.findMany({
      where: { aanwijzing_id: aanwijzing.id },
    });

    const hadirCount = updatedPeserta.filter((p) => p.status_konfirmasi === 'HADIR').length;

    if (hadirCount >= 3) {
      // Quorum terpenuhi: Aanwijzing lanjut
      await prisma.dc_aanwijzing.update({
        where: { id: aanwijzing.id },
        data: { status: 'AANWIJZING_LANJUT' },
      });

      await prisma.dc_aanwijzing_audit_log.create({
        data: {
          aanwijzing_id: aanwijzing.id,
          user_email: 'system.engine@sparta.local',
          user_name: 'SPARTA Automation Engine',
          user_role: 'SYSTEM',
          action: 'AUTO_DECLINE_TIMEOUT',
          from_status: 'MENUNGGU_KONFIRMASI',
          to_status: 'AANWIJZING_LANJUT',
          notes: `Batas waktu 48 jam berakhir. ${hadirCount} kontraktor konfirmasi hadir (Quorum >= 3 terpenuhi). Status aanwijzing disetujui lanjut.`,
        },
      });
    } else {
      // Quorum < 3 orang: Seluruh proyek (< 1M maupun > 1M) masuk ke antrean approval DC BUILDING & DEVELOPMENT MANAGER
      await prisma.dc_aanwijzing.update({
        where: { id: aanwijzing.id },
        data: { status: 'MENUNGGU_APPROVAL_DC_MANAGER' },
      });

      await prisma.dc_aanwijzing_audit_log.create({
        data: {
          aanwijzing_id: aanwijzing.id,
          user_email: 'system.engine@sparta.local',
          user_name: 'SPARTA Automation Engine',
          user_role: 'SYSTEM',
          action: 'AUTO_DECLINE_TIMEOUT',
          from_status: 'MENUNGGU_KONFIRMASI',
          to_status: 'MENUNGGU_APPROVAL_DC_MANAGER',
          notes: `Batas waktu 48 jam berakhir. Hanya ${hadirCount} kontraktor konfirmasi hadir (kurang dari 3). Berkas dialihkan ke antrean approval DC Building & Development Manager untuk otorisasi lanjut atau ulang.`,
        },
      });
    }
  }
}

/**
 * GET: Ambil daftar seluruh undangan aanwijzing
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
        nama: true,
        nama_pt: true,
        coverage_cabang: true,
      },
    });
    const currentUser = dbUser || session;

    // Jalankan engine pengecekan 48 jam timeout
    await runAanwijzingTimeoutEngine();

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const cabang = searchParams.get('cabang') || '';
    const status = searchParams.get('status') || '';
    const kategoriNilai = searchParams.get('kategori_nilai') || '';

    const list = await prisma.dc_aanwijzing.findMany({
      include: {
        project: true,
        renovasi: true,
        tender: true,
        fungsi_ruang: true,
        peserta: {
          include: {
            vendor: true,
          },
        },
        audit_logs: {
          orderBy: { created_at: 'desc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Filter berdasarkan permission dan query
    const filtered = list.filter((item) => {
      // 1. Izin melihat
      if (!canUserViewAanwijzing(currentUser, item)) {
        return false;
      }

      // 2. Filter Cabang
      if (cabang && cabang !== 'all') {
        const itemBranch = (item.cabang || item.project?.cabang || '').toUpperCase();
        if (itemBranch !== cabang.toUpperCase()) return false;
      }

      // 3. Filter Status
      if (status && status !== 'all') {
        if (item.status !== status) return false;
      }

      // 4. Filter Kategori Nilai
      if (kategoriNilai && kategoriNilai !== 'all') {
        if (item.kategori_nilai !== kategoriNilai) return false;
      }

      // 5. Filter Search
      if (search) {
        const q = search.toLowerCase();
        const matchNo = item.nomor_undangan.toLowerCase().includes(q);
        const matchProject = item.project.nama_proyek.toLowerCase().includes(q);
        const matchKode = item.project.kode.toLowerCase().includes(q);
        const matchVendor = item.peserta.some((p) =>
          p.vendor.nama_perusahaan.toLowerCase().includes(q)
        );
        if (!matchNo && !matchProject && !matchKode && !matchVendor) return false;
      }

      return true;
    });

    return NextResponse.json({
      status: 'success',
      data: filtered,
    });
  } catch (error: any) {
    console.error('Error fetching list aanwijzing:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal memuat daftar undangan aanwijzing' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Generate nomor undangan aanwijzing berikutnya
 */
async function generateNextNomorUndangan(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `UND/DC/${yy}${mm}/`;

  const lastRecord = await prisma.dc_aanwijzing.findFirst({
    where: {
      nomor_undangan: {
        startsWith: prefix,
      },
    },
    orderBy: {
      nomor_undangan: 'desc',
    },
    select: {
      nomor_undangan: true,
    },
  });

  let seq = 1;
  if (lastRecord?.nomor_undangan) {
    const parts = lastRecord.nomor_undangan.split('/');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/**
 * POST: Terbitkan Undangan Aanwijzing Baru
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

    const body = await request.json();
    const {
      project_id,
      renovasi_id,
      tender_id,
      fungsi_ruang_id,
      kategori_nilai,
      tanggal_pelaksanaan,
      waktu_pelaksanaan,
      catatan,
      vendor_ids,
    } = body;

    if (!project_id || !renovasi_id || !kategori_nilai || !tanggal_pelaksanaan || !waktu_pelaksanaan) {
      return NextResponse.json(
        { status: 'error', message: 'Field wajib tidak lengkap' },
        { status: 400 }
      );
    }

    // Ambil data proyek untuk mendapatkan alamat statis yang sah
    const project = await prisma.dc_project.findUnique({
      where: { id: Number(project_id) },
    });
    if (!project) {
      return NextResponse.json(
        { status: 'error', message: 'Data proyek tidak ditemukan' },
        { status: 404 }
      );
    }

    const lokasiStatis = project.alamat || `Fasilitas DC ${project.nama_proyek} (${project.cabang})`;

    // Tentukan daftar vendor peserta
    let selectedVendors: { vendor_id: number; email: string }[] = [];

    if (kategori_nilai === 'DI_ATAS_1M') {
      if (!tender_id) {
        return NextResponse.json(
          { status: 'error', message: 'Proyek > 1M wajib mengaitkan ID proposal tender yang disetujui' },
          { status: 400 }
        );
      }

      const tender = await prisma.dc_tender.findUnique({
        where: { id: Number(tender_id) },
        include: {
          peserta: {
            where: {
              status_tahap: 'LOLOS_KUALIFIKASI',
              peran: 'MAIN_KONTRAKTOR',
            },
            include: { vendor: true },
          },
        },
      });

      if (!tender || tender.peserta.length === 0) {
        return NextResponse.json(
          { status: 'error', message: 'Tidak ditemukan rekanan kontraktor yang lolos kualifikasi pada proposal tender ini' },
          { status: 400 }
        );
      }

      selectedVendors = tender.peserta.map((p) => ({
        vendor_id: p.vendor_id,
        email: p.vendor.email,
      }));
    } else {
      // DI_BAWAH_1M: Kontraktor dipilih manual minimal 3
      if (!vendor_ids || !Array.isArray(vendor_ids) || vendor_ids.length < 3) {
        return NextResponse.json(
          { status: 'error', message: 'Proyek bernilai di bawah 1M wajib memilih minimal 3 rekanan kontraktor' },
          { status: 400 }
        );
      }

      const vendors = await prisma.dc_master_vendor.findMany({
        where: { id: { in: vendor_ids.map(Number) } },
      });

      if (vendors.length < 3) {
        return NextResponse.json(
          { status: 'error', message: 'Data rekanan vendor yang dipilih tidak valid atau kurang dari 3' },
          { status: 400 }
        );
      }

      selectedVendors = vendors.map((v) => ({
        vendor_id: v.id,
        email: v.email,
      }));
    }

    const nomorUndangan = await generateNextNomorUndangan();
    const now = new Date();
    // Batas konfirmasi: Hari ke-2 pada pukul 23:59:59 WIB (Jam 24:00)
    const deadlineKonfirmasi = new Date(now);
    deadlineKonfirmasi.setDate(deadlineKonfirmasi.getDate() + 2);
    deadlineKonfirmasi.setHours(23, 59, 59, 999);

    // Simpan ke database via Prisma Transaction
    const newAanwijzing = await prisma.$transaction(async (tx) => {
      const created = await tx.dc_aanwijzing.create({
        data: {
          nomor_undangan: nomorUndangan,
          project_id: Number(project_id),
          renovasi_id: Number(renovasi_id),
          tender_id: tender_id ? Number(tender_id) : null,
          fungsi_ruang_id: fungsi_ruang_id ? Number(fungsi_ruang_id) : null,
          kategori_nilai,
          tanggal_pelaksanaan: new Date(tanggal_pelaksanaan),
          waktu_pelaksanaan,
          lokasi: lokasiStatis,
          catatan: catatan || null,
          status: 'MENUNGGU_KONFIRMASI',
          deadline_konfirmasi: deadlineKonfirmasi,
          created_by: currentUser.email,
          cabang: project.cabang,
          peserta: {
            create: selectedVendors.map((v) => ({
              vendor_id: v.vendor_id,
              email: v.email,
              status_konfirmasi: 'MENUNGGU_RESPON',
            })),
          },
        },
        include: {
          project: true,
          renovasi: true,
          peserta: {
            include: { vendor: true },
          },
        },
      });

      await tx.dc_aanwijzing_audit_log.create({
        data: {
          aanwijzing_id: created.id,
          user_email: currentUser.email,
          user_name: (currentUser as any).nama || currentUser.email,
          user_role: currentUser.role,
          action: 'SUBMIT_UNDANGAN',
          from_status: 'DRAFT',
          to_status: 'MENUNGGU_KONFIRMASI',
          notes: `Undangan diterbitkan untuk ${selectedVendors.length} rekanan kontraktor. Batas waktu respon hari ke-2 pukul 24:00 WIB.`,
        },
      });

      // Tetapkan default file_url agar tidak pernah null
      const initialFileUrl = `/api/dc-development/aanwijzing/${created.id}/pdf`;
      await tx.dc_aanwijzing.update({
        where: { id: created.id },
        data: { file_url: initialFileUrl },
      });
      created.file_url = initialFileUrl;

      return created;
    });

    // Asynchronous Execution: Generate fisik PDF & Drive Sync, lalu Kirim Email ke Semua Kontraktor
    (async () => {
      try {
        await syncAanwijzingPdfToDrive(newAanwijzing.id);
        for (const p of newAanwijzing.peserta) {
          try {
            const vendorNamaPerusahaan = p.vendor?.nama_perusahaan || '';
            const picUser = await findPicUserForVendor(vendorNamaPerusahaan);

            const vendorEmail = (p.email || p.vendor?.email || '').trim();
            const picEmail = picUser?.email?.trim();
            const toEmail = picEmail || vendorEmail;
            const ccEmail = picEmail && vendorEmail && picEmail.toLowerCase() !== vendorEmail.toLowerCase()
              ? vendorEmail
              : undefined;

            // Generate PDF khusus untuk kontraktor ini (tanpa mencantumkan nama kontraktor lain)
            const vendorPdfBuffer = await generateUndanganAanwijzingPdf(newAanwijzing.id, {
              tipe: 'KONTRAKTOR',
              pesertaId: p.id,
              vendorId: p.vendor_id,
            });

            const emailResult = await sendUndanganAanwijzingEmail({
              aanwijzingId: newAanwijzing.id,
              nomorUndangan: newAanwijzing.nomor_undangan,
              namaProyek: newAanwijzing.project.nama_proyek,
              cabang: newAanwijzing.cabang,
              tanggalPelaksanaan: new Date(newAanwijzing.tanggal_pelaksanaan).toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }),
              waktuPelaksanaan: newAanwijzing.waktu_pelaksanaan,
              lokasi: newAanwijzing.lokasi,
              catatan: newAanwijzing.catatan,
              deadlineKonfirmasi: new Date(newAanwijzing.deadline_konfirmasi).toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }) + ' pukul 23:59 WIB (Jam 24:00)',
              vendorNama: vendorNamaPerusahaan,
              vendorEmail: vendorEmail,
              toEmail: toEmail,
              toNama: picUser?.nama,
              ccEmail: ccEmail,
              portalUrl: process.env.WEB_SPARTA,
              pdfBuffer: vendorPdfBuffer,
            });

            await prisma.dc_aanwijzing_vendor.update({
              where: { id: p.id },
              data: {
                email_sent: emailResult.success,
                email_sent_at: emailResult.success ? new Date() : null,
                email_error: emailResult.error || null,
              },
            });
          } catch (mailErr: any) {
            console.error(`Error sending email to vendor ${p.vendor_id}:`, mailErr);
          }
        }
      } catch (bgErr) {
        console.error('Background PDF/Email generation error for aanwijzing:', bgErr);
      }
    })();

    return NextResponse.json({
      status: 'success',
      message: 'Undangan Aanwijzing berhasil diterbitkan dan email sedang dikirimkan ke seluruh kontraktor',
      data: newAanwijzing,
    });
  } catch (error: any) {
    console.error('Error creating aanwijzing:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal menerbitkan undangan aanwijzing' },
      { status: 500 }
    );
  }
}
