import fs from 'fs';
import path from 'path';
import nunjucks from 'nunjucks';
import puppeteer, { LaunchOptions } from 'puppeteer';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { prisma } from '../db';
import { getDriveClient, getDcAanwijzingFolderHierarchyId, uploadBufferToFolder } from '@/lib/google-drive';
import { formatRupiah } from '@/lib/utils';

function getBrowserExecutablePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidatePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function formatDateIndo(date: Date | string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTimeIndo(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  const tgl = d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const jam = d
    .toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(':', '.');
  return `${tgl}, ${jam} WIB`;
}

/**
 * Fallback generator menggunakan jsPDF murni jika browser Puppeteer gagal di-launch
 * Dilengkapi dengan 3 kotak tanda tangan berjenjang lengkap (Dibuat, Mengetahui, Disetujui)
 */
function generateJsPdfFallback(data: any): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Box Oranye SPARTA
  doc.setFillColor(230, 95, 43); // SPARTA Orange #E65F2B
  doc.rect(14, 12, 182, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('BERITA ACARA AANWIJZING', 20, 21);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('BUILDING & MAINTENANCE DC DEVELOPMENT — PT SUMBER ALFARIA TRIJAYA, TBK.', 20, 25);

  // Meta Info Table
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Nomor: ${data.klarifikasi.nomor_klarifikasi}`, 14, 34);
  doc.text(`Cabang / DC: Branch ${data.klarifikasi.cabang || data.project.cabang}`, 115, 34);
  doc.setFont('helvetica', 'normal');
  doc.text(`Proyek: ${data.project.nama_proyek} (${data.project.kode})`, 14, 39);
  doc.text(`No. Undangan: ${data.aanwijzing.nomor_undangan || '-'}`, 115, 39);
  doc.text(`Lokasi: ${data.project.alamat || data.project.cabang}`, 14, 44);
  doc.text(`Tanggal Rapat: ${data.tgl_aanwijzing_indo}`, 115, 44);
  doc.text(`Durasi Pekerjaan: ${data.durasi_hari_akhir || data.durasi_hari_awal || 0} Hari (${data.status_durasi || 'TETAP'})`, 14, 49);
  if (data.is_durasi_berubah) {
    doc.text(`Awal: ${data.durasi_hari_awal || 0} Hari | Selisih: ${data.selisih_durasi > 0 ? `+${data.selisih_durasi}` : data.selisih_durasi} Hari`, 115, 49);
  }

  // Paragraf Pembuka
  doc.setFontSize(8);
  const leadText =
    'Berdasarkan pengamatan kondisi bangunan eksisting yang akan di renovasi terhadap rencana renovasi pada saat aanwijzing, terdapat beberapa hal yang menjadi perhatian sebagai berikut:';
  doc.text(leadText, 14, 55, { maxWidth: 182 });

  const sipilItems =
    data.items_sipil ||
    (data.items || []).filter((it: any) => (it.lingkup || 'SIPIL').toUpperCase() === 'SIPIL');
  const meItems =
    data.items_me ||
    (data.items || []).filter((it: any) => (it.lingkup || '').toUpperCase() === 'ME');

  const mapRows = (itemsList: any[]) =>
    itemsList.map((it: any, idx: number) => {
      const mat = Number(it.harga_material) || 0;
      const upah = Number(it.harga_upah) || 0;
      const hrgSatuan = mat + upah;
      const total = Number(it.total_biaya_akhir) || 0;
      return [
        idx + 1,
        `${it.deskripsi}\n(${it.kategori_pekerjaan})`,
        `${it.volume_akhir} ${it.satuan}`,
        formatRupiah(mat),
        formatRupiah(upah),
        formatRupiah(hrgSatuan),
        formatRupiah(total),
        it.status_perubahan || (it.tipe_perubahan === 'ITEM_BARU' ? 'Item Baru Ditambahkan' : (it.tipe_perubahan === 'SAMA_DENGAN_RAB' ? 'Sama dengan RAB/OE' : 'Item Disesuaikan')),
        it.catatan || it.keterangan || '-',
      ];
    });

  const sipilRows = mapRows(sipilItems);
  const meRows = mapRows(meItems);

  // A. Item Pekerjaan Sipil
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(230, 95, 43);
  doc.text('A. Item Pekerjaan Sipil (Penyesuaian / Baru)', 14, 62);

  autoTable(doc, {
    startY: 65,
    head: [['No', 'Item Pekerjaan', 'Volume', 'Material', 'Upah', 'Satuan', 'Total Biaya', 'Status', 'Catatan']],
    body: sipilRows.length ? sipilRows : [['-', 'Tidak ada penyesuaian volume atau penambahan item pekerjaan Sipil (mengacu RAB/OE)', '-', '-', '-', '-', '-', '-', '-']],
    foot: [['', 'Jumlah Pekerjaan Sipil Disepakati :', '', '', '', '', data.subtotal_changed_sipil_rp || data.subtotal_sipil_rp || '-', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [255, 247, 237], textColor: [194, 65, 12], fontStyle: 'bold', fontSize: 7 },
    footStyles: { fillColor: [255, 247, 237], textColor: [194, 65, 12], fontStyle: 'bold', fontSize: 7.5 },
    styles: { fontSize: 6.5, cellPadding: 2 },
  });

  let nextY = ((doc as any).lastAutoTable?.finalY || 80) + 6;

  // B. Item Pekerjaan ME
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(230, 95, 43);
  doc.text('B. Item Pekerjaan ME (Penyesuaian / Baru)', 14, nextY);

  autoTable(doc, {
    startY: nextY + 3,
    head: [['No', 'Item Pekerjaan', 'Volume', 'Material', 'Upah', 'Satuan', 'Total Biaya', 'Status', 'Catatan']],
    body: meRows.length ? meRows : [['-', 'Tidak ada penyesuaian volume atau penambahan item pekerjaan ME (mengacu RAB/OE)', '-', '-', '-', '-', '-', '-', '-']],
    foot: [['', 'Jumlah Pekerjaan ME Disepakati :', '', '', '', '', data.subtotal_changed_me_rp || data.subtotal_me_rp || '-', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [255, 247, 237], textColor: [194, 65, 12], fontStyle: 'bold', fontSize: 7 },
    footStyles: { fillColor: [255, 247, 237], textColor: [194, 65, 12], fontStyle: 'bold', fontSize: 7.5 },
    styles: { fontSize: 6.5, cellPadding: 2 },
  });

  let finalY = (doc as any).lastAutoTable?.finalY || 120;

  // Ringkasan Akumulasi Total Biaya (Jumlah Keduanya)
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(254, 215, 170);
  doc.rect(14, finalY + 4, 182, 7, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(154, 52, 18);
  doc.text('Jumlah Total (Sipil + ME) :', 18, finalY + 8.5);
  doc.setTextColor(230, 95, 43);
  doc.text(data.grand_total_biaya_rp || '-', 192, finalY + 8.5, { align: 'right' });
  finalY += 12;

  // Paragraf Penutup (Tepat sebelum Tanda Tangan)
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(31, 41, 55);
  doc.text(
    'Demikian Berita Acara Klarifikasi Hasil Aanwijzing ini dibuat dengan sebenar-benarnya sebagai dasar acuan resmi penawaran tender dan penyusunan kontrak rekanan.',
    14,
    finalY + 6,
    { maxWidth: 182 }
  );

  // Matriks Tanda Tangan 3 Kolom
  const sigY = finalY + 14;
  const colW = 56;
  const gap = 7;
  const boxH = 34;
  const startX = 14;

  // Tanggal & Lokasi
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Branch ${data.klarifikasi.cabang || data.project.cabang}, ${data.sign_date}`, 196, sigY - 2, { align: 'right' });

  // 1. DIBUAT (Branch Building Koordinator)
  const x1 = startX;
  doc.setFillColor(230, 95, 43);
  doc.rect(x1, sigY, colW, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('DIBUAT', x1 + colW / 2, sigY + 4.2, { align: 'center' });

  doc.setDrawColor(203, 213, 225);
  doc.rect(x1, sigY + 6, colW, boxH, 'S');

  // Tanggal di tengah-tengah
  doc.setTextColor(55, 65, 81);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(data.signatures.maker.date || '-', x1 + colW / 2, sigY + 19, { align: 'center' });

  // Nama & Role
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text((data.signatures.maker.name || '-').toUpperCase(), x1 + colW / 2, sigY + 31, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Branch Building Koordinator', x1 + colW / 2, sigY + 36, { align: 'center' });

  // 2. MENGETAHUI (Branch Building & Maintenance Manager)
  const x2 = startX + colW + gap;
  doc.setFillColor(230, 95, 43);
  doc.rect(x2, sigY, colW, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('MENGETAHUI', x2 + colW / 2, sigY + 4.2, { align: 'center' });

  doc.setDrawColor(203, 213, 225);
  doc.rect(x2, sigY + 6, colW, boxH, 'S');

  if (data.signatures.approver_1.approved && !data.is_revisi) {
    doc.setTextColor(55, 65, 81);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(data.signatures.approver_1.date || '-', x2 + colW / 2, sigY + 19, { align: 'center' });

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text((data.signatures.approver_1.name || '-').toUpperCase(), x2 + colW / 2, sigY + 31, { align: 'center' });
  } else {
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text('( Menunggu Persetujuan )', x2 + colW / 2, sigY + 19, { align: 'center' });

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.text('( ........................................ )', x2 + colW / 2, sigY + 31, { align: 'center' });
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Branch Building & Maint. Manager', x2 + colW / 2, sigY + 36, { align: 'center' });

  // 3. DISETUJUI (DC Development Specialist)
  const x3 = startX + (colW + gap) * 2;
  doc.setFillColor(230, 95, 43);
  doc.rect(x3, sigY, colW, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('DISETUJUI', x3 + colW / 2, sigY + 4.2, { align: 'center' });

  doc.setDrawColor(203, 213, 225);
  doc.rect(x3, sigY + 6, colW, boxH, 'S');

  if (data.signatures.approver_2.approved && !data.is_revisi) {
    doc.setTextColor(55, 65, 81);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(data.signatures.approver_2.date || '-', x3 + colW / 2, sigY + 19, { align: 'center' });

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text((data.signatures.approver_2.name || '-').toUpperCase(), x3 + colW / 2, sigY + 31, { align: 'center' });
  } else {
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text('( Menunggu Persetujuan )', x3 + colW / 2, sigY + 19, { align: 'center' });

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.text('( ........................................ )', x3 + colW / 2, sigY + 31, { align: 'center' });
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('DC Development Specialist', x3 + colW / 2, sigY + 36, { align: 'center' });

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

/**
 * Service Utama: Generate Buffer PDF Berita Acara Klarifikasi Aanwijzing
 */
export async function generateBeritaAcaraAanwijzingPdf(klarifikasiInput: number | any): Promise<Buffer> {
  let klarifikasi: any = klarifikasiInput;

  if (typeof klarifikasiInput === 'number') {
    klarifikasi = await prisma.dc_aanwijzing_klarifikasi.findUnique({
      where: { id: klarifikasiInput },
      include: {
        project: true,
        renovasi: {
          include: {
            dokumen: true,
          },
        },
        aanwijzing: {
          include: {
            peserta: {
              include: {
                vendor: true,
              },
            },
          },
        },
        items: true,
        dokumen: true,
        audit_logs: {
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!klarifikasi) {
      throw new Error(`Data Klarifikasi Aanwijzing dengan ID ${klarifikasiInput} tidak ditemukan.`);
    }
  }

  // Load Logo Alfamart & SPARTA dari folder public/
  let alfamart_logo_base64 = '';
  const alfamartPath = path.resolve(process.cwd(), 'public/Alfamart-logo.png');
  if (fs.existsSync(alfamartPath)) {
    alfamart_logo_base64 = `data:image/png;base64,${fs.readFileSync(alfamartPath).toString('base64')}`;
  }

  let sparta_logo_base64 = '';
  const spartaPath = path.resolve(process.cwd(), 'public/Sparta-Logo.png');
  if (fs.existsSync(spartaPath)) {
    sparta_logo_base64 = `data:image/png;base64,${fs.readFileSync(spartaPath).toString('base64')}`;
  }

  // Cari seluruh user untuk pencocokan nama lengkap approver
  const allUsers = await prisma.dc_users.findMany({
    select: { email: true, nama: true },
  });

  const getUserName = (email: string) => {
    if (!email) return '';
    const cleanEmail = email.toLowerCase().replace('@gmai.com', '@gmail.com');
    const u = allUsers.find(
      (user) => user.email.toLowerCase() === email.toLowerCase() || user.email.toLowerCase() === cleanEmail
    );
    return u?.nama || email.split('@')[0];
  };

  // Susun Tanda Tangan dari Audit Log
  const logs = klarifikasi.audit_logs || [];
  const isApproved = klarifikasi.status === 'APPROVED';
  const isRevisi = klarifikasi.status === 'REVISI';

  // Cari log revisi terakhir (jika ada) untuk menampilkan banner instruksi
  const revLog = [...logs].reverse().find((l: any) => l.to_status === 'REVISI' || l.action === 'REVISI');
  const latestRevisionNote = revLog?.notes || null;

  // Maker signature (Branch Building Koordinator)
  const submitLog = logs.find((l: any) => l.action === 'SUBMIT' || l.action === 'RESUBMIT') || logs[0];
  const makerDate = submitLog?.created_at
    ? formatDateTimeIndo(submitLog.created_at)
    : formatDateTimeIndo(klarifikasi.created_at);
  const makerName = submitLog?.user_name || getUserName(klarifikasi.created_by);

  // Approver 1: Branch Building & Maintenance Manager
  const app1Log = logs.find(
    (l: any) =>
      l.action === 'APPROVE_BBM_MANAGER' ||
      l.to_status === 'MENUNGGU_APPROVAL_DC_SPECIALIST' ||
      (l.action?.includes('BBM') && l.action?.includes('APPROVE'))
  ) || (isApproved ? logs.find((l: any) => l.action?.includes('BBM') || l.from_status === 'MENUNGGU_APPROVAL_BBM_MANAGER') : null);

  const app1Approved = (Boolean(app1Log) || isApproved || klarifikasi.status === 'MENUNGGU_APPROVAL_DC_SPECIALIST') && !isRevisi;
  const app1Date = app1Log?.created_at ? formatDateTimeIndo(app1Log.created_at) : (app1Approved ? formatDateTimeIndo(klarifikasi.updated_at) : null);
  const app1Name = app1Log?.user_name || (app1Log?.user_email ? getUserName(app1Log.user_email) : 'Branch B&M Manager');

  // Approver 2: DC Development Specialist
  const app2Log = logs.find(
    (l: any) =>
      l.action === 'APPROVE_DC_SPECIALIST' ||
      l.to_status === 'APPROVED' ||
      (l.action?.includes('SPECIALIST') && l.action?.includes('APPROVE'))
  );
  const app2Approved = (Boolean(app2Log) || isApproved) && !isRevisi;
  const app2Date = app2Log?.created_at ? formatDateTimeIndo(app2Log.created_at) : (app2Approved ? formatDateTimeIndo(klarifikasi.updated_at) : null);
  const app2Name = app2Log?.user_name || (app2Log?.user_email ? getUserName(app2Log.user_email) : 'DC Development Specialist');

  // Peserta list dengan formatted date
  const rawPeserta = klarifikasi.aanwijzing?.peserta || [];
  const pesertaList = rawPeserta.map((p: any) => ({
    ...p,
    absen_timestamp_indo: p.absen_at ? formatDateTimeIndo(p.absen_at) : '-',
  }));

  // Format Items dengan breakdown Rupiah untuk template PDF
  const rawItems = klarifikasi.items || [];
  let grandTotalBiaya = 0;
  let subtotalSipil = 0;
  let subtotalMe = 0;

  const formattedItems = rawItems.map((it: any) => {
    const mat = Number(it.harga_material) || 0;
    const upah = Number(it.harga_upah) || 0;
    const hrgSatuan = mat + upah;
    const total = Number(it.total_biaya_akhir) || 0;
    grandTotalBiaya += total;
    const scopeUpper = (it.lingkup || 'SIPIL').trim().toUpperCase();
    if (scopeUpper === 'SIPIL') {
      subtotalSipil += total;
    } else {
      subtotalMe += total;
    }

    return {
      ...it,
      lingkup: scopeUpper,
      status_perubahan: it.status_perubahan || (it.tipe_perubahan === 'ITEM_BARU' ? 'Item Baru Ditambahkan' : (it.tipe_perubahan === 'SAMA_DENGAN_RAB' ? 'Sama dengan RAB/OE' : 'Item Disesuaikan')),
      catatan: it.catatan || it.keterangan || '-',
      harga_material_rp: formatRupiah(mat),
      harga_upah_rp: formatRupiah(upah),
      harga_satuan_rp: formatRupiah(hrgSatuan),
      total_biaya_awal_rp: formatRupiah(Number(it.total_biaya_awal) || 0),
      total_biaya_akhir_rp: formatRupiah(total),
      is_volume_changed: it.tipe_perubahan !== 'ITEM_BARU' && it.volume_awal > 0 && it.volume_awal !== it.volume_akhir,
      is_total_changed: it.tipe_perubahan !== 'ITEM_BARU' && it.total_biaya_awal > 0 && it.total_biaya_awal !== it.total_biaya_akhir,
    };
  });

  const itemsSipil = formattedItems.filter((it: any) => (it.lingkup || 'SIPIL').trim().toUpperCase() === 'SIPIL');
  const itemsMe = formattedItems.filter((it: any) => (it.lingkup || '').trim().toUpperCase() === 'ME');

  // Filter HANYA item yang mengalami penyesuaian (Item Baru atau Volume Berubah atau Harga Berubah)
  const isChangedItem = (it: any) => {
    if (it.tipe_perubahan === 'ITEM_BARU') return true;
    if (it.tipe_perubahan === 'UBAH_VOLUME') return true;
    if (it.tipe_perubahan === 'SAMA_DENGAN_RAB') return false;
    const volAwal = Number(it.volume_awal) || 0;
    const volAkhir = Number(it.volume_akhir) || 0;
    const totalAwal = Number(it.total_biaya_awal) || 0;
    const totalAkhir = Number(it.total_biaya_akhir) || 0;
    return volAwal !== volAkhir || totalAwal !== totalAkhir;
  };

  const changedItems = formattedItems.filter(isChangedItem);
  const changedItemsSipil = changedItems.filter((it: any) => (it.lingkup || 'SIPIL').trim().toUpperCase() === 'SIPIL');
  const changedItemsMe = changedItems.filter((it: any) => (it.lingkup || '').trim().toUpperCase() === 'ME');

  let subtotalChangedSipil = 0;
  for (const it of changedItemsSipil) {
    subtotalChangedSipil += Number(it.total_biaya_akhir) || 0;
  }
  let subtotalChangedMe = 0;
  for (const it of changedItemsMe) {
    subtotalChangedMe += Number(it.total_biaya_akhir) || 0;
  }
  const grandTotalChangedBiaya = subtotalChangedSipil + subtotalChangedMe;

  // Durasi Pekerjaan Proyek (Baseline RAB vs Klarifikasi)
  const durasiAwal = klarifikasi.durasi_hari_awal ?? klarifikasi.renovasi?.durasi_hari ?? 0;
  const durasiAkhir = klarifikasi.durasi_hari_akhir ?? durasiAwal;
  const isDurasiBerubah = durasiAkhir !== durasiAwal;
  const statusDurasi = klarifikasi.status_durasi || (isDurasiBerubah ? 'BERUBAH' : 'TETAP');
  const selisihDurasi = durasiAkhir - durasiAwal;

  // Dokumen Teknis & Foto Lingkungan (Kolom 1: Acuan RAB vs Kolom 2: Klarifikasi)
  const rabDocs = klarifikasi.renovasi?.dokumen || [];
  const klarifikasiDocs = klarifikasi.dokumen || [];

  const findDocInList = (list: any[], slotKey: string) => {
    return list.find((d: any) => {
      const k = d.kategori_file;
      const fn = (d.nama_file || '').toLowerCase();
      if (slotKey === 'GAMBAR_SIPIL_PDF') return k === 'GAMBAR_SIPIL_PDF' || (k === 'GAMBAR_SIPIL' && fn.endsWith('.pdf'));
      if (slotKey === 'GAMBAR_SIPIL_DWG') return k === 'GAMBAR_SIPIL_DWG' || (k === 'GAMBAR_SIPIL' && (fn.endsWith('.dwg') || fn.endsWith('.cad')));
      if (slotKey === 'GAMBAR_ME_PDF') return k === 'GAMBAR_ME_PDF' || (k === 'GAMBAR_ME' && fn.endsWith('.pdf'));
      if (slotKey === 'GAMBAR_ME_DWG') return k === 'GAMBAR_ME_DWG' || (k === 'GAMBAR_ME' && (fn.endsWith('.dwg') || fn.endsWith('.cad')));
      return false;
    });
  };

  const gambarTeknisList = [
    { key: 'GAMBAR_SIPIL_PDF', label: 'Sipil (PDF)' },
    { key: 'GAMBAR_SIPIL_DWG', label: 'Sipil (CAD / DWG)' },
    { key: 'GAMBAR_ME_PDF', label: 'ME (PDF)' },
    { key: 'GAMBAR_ME_DWG', label: 'ME (CAD / DWG)' },
  ].map((slot) => {
    const rabDoc = findDocInList(rabDocs, slot.key);
    const klarifikasiDoc = klarifikasiDocs.find((d: any) => {
      const fn = (d.nama_file || '').toLowerCase();
      const matchSlot =
        d.kategori_file === slot.key ||
        (slot.key === 'GAMBAR_SIPIL_PDF' && d.kategori_file === 'GAMBAR_SIPIL' && fn.endsWith('.pdf')) ||
        (slot.key === 'GAMBAR_SIPIL_DWG' && d.kategori_file === 'GAMBAR_SIPIL' && (fn.endsWith('.dwg') || fn.endsWith('.cad'))) ||
        (slot.key === 'GAMBAR_ME_PDF' && d.kategori_file === 'GAMBAR_ME' && fn.endsWith('.pdf')) ||
        (slot.key === 'GAMBAR_ME_DWG' && d.kategori_file === 'GAMBAR_ME' && (fn.endsWith('.dwg') || fn.endsWith('.cad')));
      return matchSlot && (d.sumber === 'REVISI' || d.sumber === 'BARU');
    });
    const hasRevision = Boolean(klarifikasiDoc);
    const activeDoc = hasRevision ? klarifikasiDoc : rabDoc;
    const sumberStatus = hasRevision
      ? (klarifikasiDoc?.sumber === 'BARU' ? 'BARU' : 'REVISI')
      : (rabDoc ? 'RAB_AWAL' : '-');
    const sumberLabel = hasRevision
      ? (klarifikasiDoc?.sumber === 'BARU' ? 'BARU' : 'REVISI')
      : (rabDoc ? 'RAB AWAL' : '-');

    return {
      label: slot.label,
      nama_file: activeDoc?.nama_file || 'Belum diunggah',
      file_url: activeDoc?.file_url || null,
      sumber: sumberStatus,
      sumber_label: sumberLabel,
      catatan: hasRevision ? (klarifikasiDoc?.catatan || null) : null,
      has_revision: hasRevision,
      rab_nama_file: rabDoc?.nama_file || 'Tidak ada pada RAB',
      rab_file_url: rabDoc?.file_url || null,
      baru_nama_file: hasRevision ? (klarifikasiDoc?.nama_file || '-') : 'Sama dengan RAB',
      baru_file_url: hasRevision ? (klarifikasiDoc?.file_url || null) : (rabDoc?.file_url || null),
      status_label: sumberLabel,
      is_attached: Boolean(activeDoc?.file_url),
    };
  });

  const revisedGambarTeknisList = gambarTeknisList.filter((g) => g.has_revision);

  // Cek apakah foto RAB digantikan oleh foto REVISI pada Klarifikasi Aanwijzing
  const isRabPhotoReplaced = (rabPhoto: any) => {
    const rabName = (rabPhoto.nama_label || rabPhoto.nama_file || '').trim().toLowerCase();
    const rabFileName = (rabPhoto.nama_file || '').trim().toLowerCase();
    const rabUrl = (rabPhoto.file_url || '').trim();

    return klarifikasiDocs.some((kDoc: any) => {
      if (kDoc.kategori_file !== 'FOTO_LINGKUNGAN' || kDoc.sumber !== 'REVISI') return false;
      const cat = (kDoc.catatan || '').toLowerCase();
      // 1. Cek apakah catatan menyebutkan nama foto RAB (misal: 'Foto revisi pengganti untuk eksisting RAB: "Ninja 1"')
      if (rabName && (cat.includes(`"${rabName}"`) || cat.includes(rabName))) return true;
      if (rabFileName && (cat.includes(`"${rabFileName}"`) || cat.includes(rabFileName))) return true;
      // 2. Cek apakah ada metadata revisi_dari
      if (kDoc.revisi_dari_url && rabUrl && kDoc.revisi_dari_url === rabUrl) return true;
      if (kDoc.revisi_dari_id && rabPhoto.id && String(kDoc.revisi_dari_id) === String(rabPhoto.id)) return true;
      if (kDoc.revisi_dari_nama && (kDoc.revisi_dari_nama.toLowerCase() === rabName || kDoc.revisi_dari_nama.toLowerCase() === rabFileName)) return true;
      return false;
    });
  };

  const rabFotoList = rabDocs
    .filter((d: any) => d.kategori_file === 'FOTO_LINGKUNGAN' && !isRabPhotoReplaced(d))
    .map((f: any) => ({
      nama_file: f.nama_label || f.nama_file,
      file_url: f.file_url,
      sumber: 'RAB_AWAL',
      sumber_label: 'RAB AWAL',
      catatan: null,
      gps_coordinate: f.latitude && f.longitude ? `${f.latitude.toFixed(6)}, ${f.longitude.toFixed(6)}` : '-',
      lokasi_wilayah: f.lokasi_wilayah || '-',
      timestamp_watermark: f.timestamp_watermark ? formatDateTimeIndo(f.timestamp_watermark) : '-',
    }));

  const baruFotoList = klarifikasiDocs
    .filter((d: any) => d.kategori_file === 'FOTO_LINGKUNGAN' && (d.sumber === 'BARU' || d.sumber === 'REVISI'))
    .map((f: any) => ({
      nama_file: f.nama_label || f.nama_file,
      file_url: f.file_url,
      sumber: f.sumber || 'BARU',
      catatan: f.catatan || (f.sumber === 'REVISI' ? (f.revisi_dari_nama ? `Pengganti foto: ${f.revisi_dari_nama}` : 'Foto Revisi Pengganti') : null),
      sumber_label: f.sumber === 'REVISI' ? 'REVISI' : 'BARU',
      gps_coordinate: f.latitude && f.longitude ? `${f.latitude.toFixed(6)}, ${f.longitude.toFixed(6)}` : '-',
      lokasi_wilayah: f.lokasi_wilayah || '-',
      timestamp_watermark: f.timestamp_watermark ? formatDateTimeIndo(f.timestamp_watermark) : '-',
    }));

  const fotoLingkunganList = [...rabFotoList, ...baruFotoList];

  const templateData = {
    klarifikasi,
    project: klarifikasi.project || {},
    renovasi: klarifikasi.renovasi || {},
    aanwijzing: klarifikasi.aanwijzing || {},
    items: formattedItems,
    items_sipil: itemsSipil,
    items_me: itemsMe,
    changed_items: changedItems,
    changed_items_sipil: changedItemsSipil,
    changed_items_me: changedItemsMe,
    has_changed_items: changedItems.length > 0,
    subtotal_changed_sipil_rp: formatRupiah(subtotalChangedSipil),
    subtotal_changed_me_rp: formatRupiah(subtotalChangedMe),
    grand_total_changed_rp: formatRupiah(grandTotalChangedBiaya),
    durasi_hari_awal: durasiAwal,
    durasi_hari_akhir: durasiAkhir,
    status_durasi: statusDurasi,
    catatan_durasi: klarifikasi.catatan_durasi || '',
    is_durasi_berubah: isDurasiBerubah,
    selisih_durasi: selisihDurasi,
    gambar_teknis_list: gambarTeknisList,
    revised_gambar_teknis_list: revisedGambarTeknisList,
    has_revised_drawings: revisedGambarTeknisList.length > 0,
    foto_lingkungan_list: fotoLingkunganList,
    rab_foto_list: rabFotoList,
    baru_foto_list: baruFotoList,
    has_new_photos: baruFotoList.length > 0,
    subtotal_sipil_rp: formatRupiah(subtotalSipil),
    subtotal_me_rp: formatRupiah(subtotalMe),
    grand_total_biaya_rp: formatRupiah(grandTotalBiaya),
    peserta_list: pesertaList,
    alfamart_logo_path: alfamart_logo_base64,
    sparta_logo_path: sparta_logo_base64,
    watermark_logo_path: sparta_logo_base64,
    is_approved: isApproved,
    is_revisi: isRevisi,
    latest_revision_note: latestRevisionNote,
    tgl_aanwijzing_indo: formatDateIndo(klarifikasi.aanwijzing?.tanggal_pelaksanaan || klarifikasi.created_at),
    sign_location: klarifikasi.cabang || klarifikasi.project?.cabang || 'Tangerang',
    sign_date: formatDateIndo(new Date()),
    print_date_time: formatDateTimeIndo(new Date()),
    signatures: {
      maker: {
        name: makerName,
        date: makerDate,
        role: 'Branch Building Koordinator',
      },
      approver_1: {
        approved: app1Approved,
        name: app1Name,
        date: app1Date,
        role: 'Branch Building & Maintenance Manager',
      },
      approver_2: {
        approved: app2Approved,
        name: app2Name,
        date: app2Date,
        role: 'DC Development Specialist',
      },
    },
  };

  const templatePath = path.resolve(process.cwd(), 'templates/pdf/berita-acara-aanwijzing.njk');
  if (!fs.existsSync(templatePath)) {
    console.warn('[PDF] Template berita-acara-aanwijzing.njk not found, using jsPDF fallback');
    return generateJsPdfFallback(templateData);
  }

  const templateContent = fs.readFileSync(templatePath, 'utf8');
  const renderedHtml = nunjucks.renderString(templateContent, templateData);

  // Render HTML ke PDF melalui Puppeteer
  let browser: any = null;
  try {
    const execPath = getBrowserExecutablePath();
    const launchArgs: LaunchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    };
    if (execPath) {
      launchArgs.executablePath = execPath;
    }

    browser = await puppeteer.launch(launchArgs);
    const page = await browser.newPage();
    // Gunakan 'load' agar instan dan tidak hang/timeout pada networkidle0
    await page.setContent(renderedHtml, { waitUntil: 'load' });

    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '12mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm',
      },
    });

    await browser.close();
    return Buffer.from(pdfUint8);
  } catch (browserError) {
    console.error('[PDF] Puppeteer launch/render failed, fallback to jsPDF:', browserError);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // ignore
      }
    }
    return generateJsPdfFallback(templateData);
  }
}

/**
 * Background Asynchronous Sync ke Google Drive
 */
export async function syncBeritaAcaraToGoogleDrive(klarifikasiId: number): Promise<{ file_url: string; drive_file_id?: string } | null> {
  try {
    const klarifikasi = await prisma.dc_aanwijzing_klarifikasi.findUnique({
      where: { id: klarifikasiId },
      include: {
        project: true,
        aanwijzing: true,
      },
    });

    if (!klarifikasi) return null;

    const pdfBuffer = await generateBeritaAcaraAanwijzingPdf(klarifikasiId);
    const sanitizedNo = (klarifikasi.nomor_klarifikasi || `BA_${klarifikasi.id}`).replace(/[\/\\:]/g, '_');
    const fileName = `Berita_Acara_Aanwijzing_${sanitizedNo}_${klarifikasi.project?.kode || 'DC'}.pdf`;

    const drive = await getDriveClient();
    const folderId = await getDcAanwijzingFolderHierarchyId(
      drive,
      klarifikasi.cabang || klarifikasi.project?.cabang || 'UMUM',
      klarifikasi.project?.kode || 'PROYEK',
      klarifikasi.project?.nama_proyek || 'AANWIJZING',
      klarifikasi.project?.inisial || null,
      klarifikasi.aanwijzing?.nomor_undangan || klarifikasi.nomor_klarifikasi
    );

    const uploaded = await uploadBufferToFolder(
      drive,
      folderId,
      pdfBuffer,
      fileName,
      'application/pdf'
    );

    if (uploaded?.id) {
      const finalUrl = uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
      await prisma.dc_aanwijzing_klarifikasi.update({
        where: { id: klarifikasiId },
        data: {
          file_url: finalUrl,
          drive_file_id: uploaded.id,
        },
      });
      console.log(`[GDrive] Successfully synced Berita Acara ${klarifikasi.nomor_klarifikasi} to Drive (${uploaded.id})`);
      return { file_url: finalUrl, drive_file_id: uploaded.id };
    }
    return null;
  } catch (error) {
    console.warn(`[GDrive] Background sync Berita Acara ${klarifikasiId} skipped or failed:`, (error as Error)?.message);
    return null;
  }
}
