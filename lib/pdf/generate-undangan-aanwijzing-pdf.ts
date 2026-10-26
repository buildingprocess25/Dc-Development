import fs from 'fs';
import path from 'path';
import nunjucks from 'nunjucks';
import puppeteer, { LaunchOptions } from 'puppeteer';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { prisma } from '../db';

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
    month: 'long',
    year: 'numeric',
  });
  const jam = d
    .toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(':', '.');
  return `${tgl} pukul ${jam} WIB`;
}

export interface GenerateAanwijzingPdfOptions {
  tipe?: 'INTERNAL' | 'KONTRAKTOR';
  vendorId?: number;
  pesertaId?: number;
}

/**
 * Fallback generator menggunakan jsPDF murni jika Puppeteer tidak dapat di-launch
 */
function generateJsPdfFallback(data: any): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Box
  doc.setFillColor(230, 95, 43); // SPARTA Orange
  doc.rect(14, 12, 182, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(
    data.is_kontraktor ? 'SURAT UNDANGAN AANWIJZING' : 'SURAT UNDANGAN AANWIJZING (INTERNAL)',
    20,
    21
  );
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('BUILDING & MAINTENANCE DC DEVELOPMENT — PT SUMBER ALFARIA TRIJAYA, TBK.', 20, 25);

  // Meta info
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Nomor: ${data.aanwijzing.nomor_undangan}`, 14, 36);
  doc.setFont('helvetica', 'normal');
  doc.text(`Lampiran: 1 Berkas RKS`, 14, 41);
  doc.text(`Perihal: Undangan Rapat Penjelasan Pekerjaan (Aanwijzing)`, 14, 46);
  doc.text(`${data.aanwijzing.cabang}, ${data.tgl_surat_indo}`, 140, 36);

  // Body
  if (data.is_kontraktor) {
    const vName = data.target_vendor?.nama_perusahaan || 'Rekanan Kontraktor Terpilih';
    doc.text(`Kepada Yth. Pimpinan ${vName} Di Tempat`, 14, 55);
    doc.text(
      `Sehubungan dengan rencana pelaksanaan pekerjaan pada proyek ${data.project.nama_proyek} (${data.project.kode}), bersama ini kami mengundang ${vName} untuk hadir pada rapat Aanwijzing:`,
      14,
      62,
      { maxWidth: 182 }
    );
  } else {
    doc.text(`Kepada Yth. Tim Evaluasi & Panitia Pengadaan DC Di Tempat`, 14, 55);
    doc.text(
      `Sehubungan dengan rencana pelaksanaan pekerjaan pada proyek ${data.project.nama_proyek} (${data.project.kode}), berikut adalah daftar rekanan kontraktor yang diundang pada rapat Aanwijzing:`,
      14,
      62,
      { maxWidth: 182 }
    );
  }

  // Event info box
  doc.setFillColor(249, 250, 251);
  doc.setDrawColor(229, 231, 235);
  doc.rect(14, 72, 182, 28, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.text(`Hari / Tanggal :`, 18, 79);
  doc.text(`Waktu          :`, 18, 85);
  doc.text(`Tempat         :`, 18, 91);
  doc.setFont('helvetica', 'normal');
  doc.text(data.tgl_pelaksanaan_indo, 50, 79);
  doc.text(data.aanwijzing.waktu_pelaksanaan, 50, 85);
  doc.text(data.aanwijzing.lokasi, 50, 91, { maxWidth: 140 });

  // Tabel Rekanan
  if (data.is_kontraktor) {
    autoTable(doc, {
      startY: 106,
      head: [['Data Rekanan', 'Keterangan']],
      body: [
        ['Nama Perusahaan', data.target_vendor?.nama_perusahaan || '-'],
        ['Alamat Kantor', data.target_vendor?.alamat || '-'],
        ['Email / Kontak', `${data.target_peserta?.email || data.target_vendor?.email || '-'} (${data.target_vendor?.nomor_telepon || '-'})`],
        ['Batas Waktu Respon', data.deadline_konfirmasi_indo],
      ],
      theme: 'grid',
      headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
    });
  } else {
    const tableRows = (data.peserta || []).map((p: any, idx: number) => [
      idx + 1,
      p.vendor?.nama_perusahaan || '-',
      p.vendor?.alamat || '-',
      p.email || p.vendor?.email || '-',
      p.status_konfirmasi || 'MENUNGGU',
    ]);

    autoTable(doc, {
      startY: 106,
      head: [['No', 'Nama Perusahaan', 'Alamat', 'Kontak / Email', 'Status']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2 },
    });
  }

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

/**
 * Service Utama: Generate Buffer PDF Surat Undangan Aanwijzing
 */
export async function generateUndanganAanwijzingPdf(
  aanwijzingInput: number | any,
  options?: GenerateAanwijzingPdfOptions
): Promise<Buffer> {
  let aanwijzing: any = aanwijzingInput;

  // Jika input berupa ID angka, fetch relasi lengkap dari Prisma
  if (typeof aanwijzingInput === 'number') {
    aanwijzing = await prisma.dc_aanwijzing.findUnique({
      where: { id: aanwijzingInput },
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
      },
    });

    if (!aanwijzing) {
      throw new Error(`Data Undangan Aanwijzing dengan ID ${aanwijzingInput} tidak ditemukan.`);
    }
  }

  // Ambil nama pembuat jika created_by berupa email
  let pembuatNama = aanwijzing.created_by;
  try {
    const user = await prisma.dc_users.findFirst({
      where: { email: aanwijzing.created_by },
      select: { nama: true },
    });
    if (user?.nama) pembuatNama = user.nama;
  } catch (err) {
    // ignore
  }

  // Load logo Alfamart
  let alfamart_logo_base64 = '';
  const alfamartPath = path.resolve(process.cwd(), 'public/Alfamart-logo.png');
  if (fs.existsSync(alfamartPath)) {
    alfamart_logo_base64 = `data:image/png;base64,${fs.readFileSync(alfamartPath).toString('base64')}`;
  }

  // Cek apakah mode kontraktor (khusus 1 kontraktor penerima) atau arsip internal
  const isKontraktor = options?.tipe === 'KONTRAKTOR' || Boolean(options?.vendorId || options?.pesertaId);

  let targetPeserta: any = null;
  if (isKontraktor) {
    targetPeserta =
      (aanwijzing.peserta || []).find((p: any) =>
        options?.pesertaId
          ? p.id === options.pesertaId
          : options?.vendorId
          ? p.vendor_id === options.vendorId
          : false
      ) || aanwijzing.peserta?.[0] || null;
  }

  const templateData = {
    aanwijzing,
    project: aanwijzing.project,
    renovasi: aanwijzing.renovasi,
    peserta: aanwijzing.peserta || [],
    pembuat_nama: pembuatNama,
    is_kontraktor: isKontraktor,
    target_peserta: targetPeserta,
    target_vendor: targetPeserta?.vendor || null,
    tgl_surat_indo: formatDateIndo(aanwijzing.created_at),
    tgl_pelaksanaan_indo: formatDateIndo(aanwijzing.tanggal_pelaksanaan),
    deadline_konfirmasi_indo: formatDateTimeIndo(aanwijzing.deadline_konfirmasi),
    dicetak_pada_indo: formatDateTimeIndo(new Date()),
    alfamart_logo_path: alfamart_logo_base64,
  };

  // Render Template Nunjucks
  const templatePath = path.resolve(process.cwd(), 'templates/pdf/aanwijzing.njk');
  if (!fs.existsSync(templatePath)) {
    console.warn('[PDF] Template aanwijzing.njk not found, using jsPDF fallback');
    return generateJsPdfFallback(templateData);
  }

  const templateContent = fs.readFileSync(templatePath, 'utf-8');
  const renderedHtml = nunjucks.renderString(templateContent, templateData);

  // Render PDF via Puppeteer
  try {
    const execPath = getBrowserExecutablePath();
    const launchOptions: LaunchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    };
    if (execPath) {
      launchOptions.executablePath = execPath;
    }

    const browser = await puppeteer.launch(launchOptions);
    try {
      const page = await browser.newPage();
      await page.setContent(renderedHtml, { waitUntil: 'load' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (error: any) {
    console.warn('[PDF] Puppeteer launch failed, falling back to jsPDF:', error.message);
    return generateJsPdfFallback(templateData);
  }
}
