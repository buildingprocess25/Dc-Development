import fs from 'fs';
import path from 'path';
import nunjucks from 'nunjucks';
import puppeteer, { LaunchOptions } from 'puppeteer';
import { prisma } from '@/lib/db';
import { getDriveClient, downloadFileBuffer } from '@/lib/google-drive';

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

function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(Math.round(num || 0));
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateTime(date: Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  const tgl = d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const jam = d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(':', '.');
  return `${tgl} pukul ${jam}`;
}

interface AuditLogPayload {
  status?: string;
  approver_name?: string;
  [key: string]: unknown;
}

interface RabGroupItem {
  deskripsi: string;
  catatan?: string | null;
  satuan: string;
  volume_formatted: string;
  harga_material_formatted: string;
  harga_upah_formatted: string;
  total_material_formatted: string;
  total_biaya_formatted: string;
}

interface RekapKategoriItem {
  nama: string;
  total_material_formatted: string;
  total_upah_formatted: string;
  total_harga_formatted: string;
}

interface RincianGroupItem {
  kategori: string;
  subtotal_material_formatted: string;
  subtotal_biaya_formatted: string;
  items: RabGroupItem[];
}

export interface FotoItemView {
  index: number;
  label: string;
  nama_file: string;
  image_src: string;
  timestamp?: string | null;
  koordinat?: string | null;
}

interface FotoDocInput {
  id: number;
  nama_file?: string | null;
  nama_label?: string | null;
  drive_file_id?: string | null;
  mime_type?: string | null;
  timestamp_watermark?: Date | null;
  latitude?: number | null;
  longitude?: number | null;
}

async function prepareFotoItems(fotoDocs: FotoDocInput[]): Promise<FotoItemView[]> {
  const preparedPhotos: FotoItemView[] = [];
  try {
    const driveClient = await getDriveClient();
    if (driveClient && fotoDocs.length > 0) {
      const photoPromises = fotoDocs.map(async (doc, idx) => {
        let base64Src = '';
        if (doc.drive_file_id) {
          try {
            const buf = await downloadFileBuffer(driveClient, doc.drive_file_id);
            if (buf) {
              const mime = doc.mime_type || 'image/jpeg';
              base64Src = `data:${mime};base64,${buf.toString('base64')}`;
            }
          } catch (dlErr: unknown) {
            console.warn(`Gagal unduh foto ${doc.id}:`, (dlErr as Error)?.message);
          }
        }

        if (!base64Src && doc.drive_file_id) {
          base64Src = `https://lh3.googleusercontent.com/d/${doc.drive_file_id}=s800`;
        }

        const koordinat =
          doc.latitude && doc.longitude
            ? `${doc.latitude.toFixed(6)}, ${doc.longitude.toFixed(6)}`
            : null;

        return {
          index: idx + 1,
          label: doc.nama_label || `Foto #${idx + 1}`,
          nama_file: doc.nama_file || `foto_${idx + 1}.jpg`,
          image_src: base64Src,
          timestamp: doc.timestamp_watermark ? formatDate(doc.timestamp_watermark) : null,
          koordinat
        };
      });

      const photoResults = await Promise.all(photoPromises);
      for (const p of photoResults) {
        if (p.image_src) {
          preparedPhotos.push(p);
        }
      }
    }
  } catch (driveErr: unknown) {
    console.warn('Gagal menyiapkan foto lingkungan via Google Drive:', (driveErr as Error)?.message);
  }
  return preparedPhotos;
}

/**
 * Generate PDF buffer untuk Formulir & Rekapitulasi RAB/OE (Gabung: Formulir, Rekap, Rincian + Lampiran Foto)
 */
export async function generateRenovasiPdfBuffer(renovasiId: number): Promise<Buffer> {
  // 1. Ambil data renovasi lengkap
  const renovasi = await prisma.dc_renovasi.findUnique({
    where: { id: renovasiId },
    include: {
      project: true,
      dokumen: true,
      item_rab: {
        orderBy: [{ lingkup: 'asc' }, { kategori_pekerjaan: 'asc' }, { id: 'asc' }]
      }
    }
  });

  if (!renovasi) {
    throw new Error(`Data renovasi dengan ID ${renovasiId} tidak ditemukan.`);
  }

  // 2. Ambil seluruh user untuk pencocokan nama approver
  const allUsers = await prisma.dc_users.findMany({
    select: { email: true, nama: true }
  });

  const getUserName = (email: string) => {
    if (!email) return '';
    const cleanEmail = email.toLowerCase().replace('@gmai.com', '@gmail.com');
    const u = allUsers.find(
      (user) => user.email.toLowerCase() === email.toLowerCase() || user.email.toLowerCase() === cleanEmail
    );
    return u?.nama || email.split('@')[0];
  };

  const creatorName = getUserName(renovasi.created_by);

  // 3. Ambil log persetujuan untuk tanda tangan berjenjang
  const auditLogs = await prisma.app_audit_log.findMany({
    where: {
      modul: 'RENOVASI_DC',
      entitas: 'dc_renovasi',
      entitas_id: String(renovasi.id)
    },
    orderBy: { created_at: 'asc' }
  });

  const isRevision = renovasi.status === 'REVISI';

  const signatures = {
    creator: {
      name: creatorName,
      date: formatDateTime(renovasi.created_at),
      approved: true
    },
    bm_manager: {
      name: '',
      date: '',
      approved: false
    },
    dc_specialist: {
      name: '',
      date: '',
      approved: false
    },
    dc_manager: {
      name: '',
      date: '',
      approved: false
    }
  };

  if (!isRevision) {
    for (const log of auditLogs) {
      if (log.aksi === 'APPROVAL_APPROVE') {
        const dataLamaPayload = log.data_lama as AuditLogPayload | null;
        const dataBaruPayload = log.data_baru as AuditLogPayload | null;
        const dataLama = dataLamaPayload?.status || '';
        const dataBaru = dataBaruPayload?.status || '';

        // Approval B&M Manager
        if (dataLama === 'MENUNGGU APPROVAL B&M MANAGER') {
          signatures.bm_manager = {
            name: dataBaruPayload?.approver_name || getUserName(log.user_email),
            date: formatDateTime(log.created_at),
            approved: true
          };
        }
        // Approval DC Specialist
        if (dataLama === 'MENUNGGU APPROVAL DC SPECIALIST') {
          signatures.dc_specialist = {
            name: dataBaruPayload?.approver_name || getUserName(log.user_email),
            date: formatDateTime(log.created_at),
            approved: true
          };
        }
        // Approval DC Manager (Final)
        if (dataLama === 'MENUNGGU APPROVAL DC MANAGER' || dataBaru === 'APPROVED') {
          signatures.dc_manager = {
            name: dataBaruPayload?.approver_name || getUserName(log.user_email),
            date: formatDateTime(log.created_at),
            approved: true
          };
        }
      }
    }
  }

  // 4. URL Lampiran Dokumen Teknis (Sipil & ME: PDF + DWG)
  const docSipilPdfRaw = renovasi.dokumen.find(
    (d) =>
      d.kategori_file === 'GAMBAR_SIPIL_PDF' ||
      (d.kategori_file === 'GAMBAR_SIPIL' && d.nama_file?.toLowerCase().endsWith('.pdf'))
  );
  const docSipilDwgRaw = renovasi.dokumen.find(
    (d) =>
      d.kategori_file === 'GAMBAR_SIPIL_DWG' ||
      (d.kategori_file === 'GAMBAR_SIPIL' && (d.nama_file?.toLowerCase().endsWith('.dwg') || d.nama_file?.toLowerCase().endsWith('.dxf')))
  );

  const docMePdfRaw = renovasi.dokumen.find(
    (d) =>
      d.kategori_file === 'GAMBAR_ME_PDF' ||
      (d.kategori_file === 'GAMBAR_ME' && d.nama_file?.toLowerCase().endsWith('.pdf'))
  );
  const docMeDwgRaw = renovasi.dokumen.find(
    (d) =>
      d.kategori_file === 'GAMBAR_ME_DWG' ||
      (d.kategori_file === 'GAMBAR_ME' && (d.nama_file?.toLowerCase().endsWith('.dwg') || d.nama_file?.toLowerCase().endsWith('.dxf')))
  );

  const doc_sipil_pdf = docSipilPdfRaw ? { name: docSipilPdfRaw.nama_file, url: docSipilPdfRaw.file_url } : null;
  const doc_sipil_dwg = docSipilDwgRaw ? { name: docSipilDwgRaw.nama_file, url: docSipilDwgRaw.file_url } : null;
  const doc_me_pdf = docMePdfRaw ? { name: docMePdfRaw.nama_file, url: docMePdfRaw.file_url } : null;
  const doc_me_dwg = docMeDwgRaw ? { name: docMeDwgRaw.nama_file, url: docMeDwgRaw.file_url } : null;

  // Foto Lingkungan
  const fotoDocs = renovasi.dokumen.filter((d) => d.kategori_file === 'FOTO_LINGKUNGAN');
  const doc_foto_folder_url = fotoDocs.length > 0 ? (fotoDocs[0].file_url || null) : null;

  // Cek apakah sudah ada file PDF khusus Foto Lingkungan
  const docFotoPdfRaw = renovasi.dokumen.find((d) => d.kategori_file === 'DOKUMEN_FOTO_LINGKUNGAN_PDF');
  const doc_foto_pdf_url = docFotoPdfRaw ? docFotoPdfRaw.file_url : null;

  // Siapkan foto lingkungan untuk lampiran akhir PDF gabung
  const preparedPhotos = await prepareFotoItems(fotoDocs);
  const foto_pages: FotoItemView[][] = [];
  const CHUNK_SIZE = 4;
  for (let i = 0; i < preparedPhotos.length; i += CHUNK_SIZE) {
    foto_pages.push(preparedPhotos.slice(i, i + CHUNK_SIZE));
  }

  // Base64 Logo Alfamart & Sparta
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

  // 5. Kalkulasi Rekapitulasi per Kategori & Grouping Item
  const kategoriMap = new Map<string, { totalMaterial: number; totalUpah: number; totalHarga: number; items: RabGroupItem[] }>();

  for (const item of renovasi.item_rab) {
    const katName = `${item.lingkup} - ${item.kategori_pekerjaan}`;
    if (!kategoriMap.has(katName)) {
      kategoriMap.set(katName, { totalMaterial: 0, totalUpah: 0, totalHarga: 0, items: [] });
    }
    const cat = kategoriMap.get(katName)!;
    const itemTotalMaterial = Number(item.total_material || 0);
    const itemTotalUpah = Number(item.total_upah || 0);
    const itemTotalBiaya = Number(item.total_biaya || itemTotalMaterial + itemTotalUpah);

    cat.totalMaterial += itemTotalMaterial;
    cat.totalUpah += itemTotalUpah;
    cat.totalHarga += itemTotalBiaya;

    cat.items.push({
      deskripsi: item.deskripsi,
      catatan: item.catatan,
      satuan: 'Ls',
      volume_formatted: formatNumber(item.volume),
      harga_material_formatted: formatNumber(item.harga_material),
      harga_upah_formatted: formatNumber(item.harga_upah),
      total_material_formatted: formatNumber(itemTotalMaterial),
      total_biaya_formatted: formatNumber(itemTotalBiaya)
    });
  }

  const rekap_kategori: RekapKategoriItem[] = [];
  const rincian_grouped: RincianGroupItem[] = [];
  let subtotalKategori = 0;

  for (const [katName, val] of kategoriMap.entries()) {
    subtotalKategori += val.totalHarga;
    rekap_kategori.push({
      nama: katName,
      total_material_formatted: formatNumber(val.totalMaterial),
      total_upah_formatted: formatNumber(val.totalUpah),
      total_harga_formatted: formatNumber(val.totalHarga)
    });

    rincian_grouped.push({
      kategori: katName,
      subtotal_material_formatted: formatNumber(val.totalMaterial),
      subtotal_biaya_formatted: formatNumber(val.totalHarga),
      items: val.items
    });
  }

  const totalSebelumPpn = subtotalKategori;
  const nilaiPpn = Math.round(totalSebelumPpn * 0.11);
  const totalPlusPpn = totalSebelumPpn + nilaiPpn;
  // Pembulatan ribuan ke atas: misal 23300 jadi 24000
  const grandTotal = Math.ceil(totalPlusPpn / 1000) * 1000;
  const nilaiPembulatan = grandTotal - totalPlusPpn;

  // Sinkronkan ke database dc_renovasi
  if (
    renovasi.grand_total !== grandTotal ||
    renovasi.total_sebelum_ppn !== totalSebelumPpn ||
    renovasi.nilai_ppn !== nilaiPpn ||
    renovasi.nilai_pembulatan !== nilaiPembulatan
  ) {
    try {
      await prisma.dc_renovasi.update({
        where: { id: renovasi.id },
        data: {
          total_sebelum_ppn: totalSebelumPpn,
          nilai_ppn: nilaiPpn,
          nilai_pembulatan: nilaiPembulatan,
          grand_total: grandTotal
        }
      });
    } catch (updateErr: unknown) {
      console.warn('Gagal sinkronkan nilai pembulatan & grand_total ke DB:', (updateErr as Error)?.message);
    }
  }

  const total_pages = 3 + foto_pages.length;

  // 6. Compile template Nunjucks
  const templatePath = path.resolve(process.cwd(), 'templates/pdf/rab-oe.njk');
  const templateContent = fs.readFileSync(templatePath, 'utf-8');

  const renderedHtml = nunjucks.renderString(templateContent, {
    renovasi,
    project: renovasi.project,
    creator_name: creatorName,
    submitted_at_formatted: formatDate(renovasi.created_at),
    grand_total_formatted: formatNumber(grandTotal),
    alfamart_logo_base64,
    sparta_logo_base64,
    alfamart_logo_path: alfamart_logo_base64,
    sparta_logo_path: sparta_logo_base64,
    watermark_logo_path: sparta_logo_base64,
    doc_sipil_pdf,
    doc_sipil_dwg,
    doc_me_pdf,
    doc_me_dwg,
    total_foto_count: fotoDocs.length,
    doc_foto_folder_url,
    doc_foto_pdf_url,
    foto_items: preparedPhotos,
    foto_pages,
    signatures,
    rekap_kategori,
    total_kategori_formatted: formatNumber(totalSebelumPpn),
    pembulatan_formatted: formatNumber(nilaiPembulatan),
    ppn_formatted: formatNumber(nilaiPpn),
    rincian_grouped,
    total_pages: String(total_pages)
  });

  // 7. Render PDF via Puppeteer
  const execPath = getBrowserExecutablePath();
  const launchOptions: LaunchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
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
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Generate PDF buffer khusus Lampiran Foto Lingkungan Eksisting
 */
export async function generateFotoLingkunganPdfBuffer(renovasiId: number): Promise<Buffer> {
  const renovasi = await prisma.dc_renovasi.findUnique({
    where: { id: renovasiId },
    include: {
      project: true,
      dokumen: true
    }
  });

  if (!renovasi) {
    throw new Error(`Data renovasi dengan ID ${renovasiId} tidak ditemukan.`);
  }

  const fotoDocs = renovasi.dokumen.filter((d) => d.kategori_file === 'FOTO_LINGKUNGAN');

  // Base64 Logo Alfamart & Sparta
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

  // Unduh buffer gambar via Google Drive
  const preparedPhotos = await prepareFotoItems(fotoDocs);

  // Render template Nunjucks foto lingkungan
  const templatePath = path.resolve(process.cwd(), 'templates/pdf/foto-lingkungan.njk');
  const templateContent = fs.readFileSync(templatePath, 'utf-8');

  const renderedHtml = nunjucks.renderString(templateContent, {
    renovasi,
    project: renovasi.project,
    submitted_at_formatted: formatDate(renovasi.created_at),
    alfamart_logo_path: alfamart_logo_base64,
    sparta_logo_path: sparta_logo_base64,
    watermark_logo_path: sparta_logo_base64,
    foto_items: preparedPhotos
  });

  // Render PDF via Puppeteer
  const execPath = getBrowserExecutablePath();
  const launchOptions: LaunchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
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
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
