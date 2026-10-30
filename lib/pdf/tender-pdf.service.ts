import fs from 'fs';
import path from 'path';
import nunjucks from 'nunjucks';
import puppeteer, { LaunchOptions } from 'puppeteer';
import { prisma } from '@/lib/db';
import { toTitleCase } from '@/lib/utils';
import { getVendorUsers, enrichPesertaWithPic } from '@/lib/tender-helper';

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

function formatApprovalDateTime(date: Date | string | null | undefined): string {
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
  return `${tgl} pukul ${jam}`;
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
  return `${tgl} ${jam} WIB`;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface SignatureItem {
  name: string;
  date: string;
  approved: boolean;
  role?: string;
}

export async function generateTenderPdfBuffer(tenderId: number): Promise<Buffer> {
  // 1. Ambil data tender lengkap
  const tender = await prisma.dc_tender.findUnique({
    where: { id: tenderId },
    include: {
      project: true,
      renovasi: true,
      fungsi_ruang: true,
      peserta: {
        include: {
          vendor: true,
        },
      },
      schedule: {
        orderBy: { urutan: 'asc' },
      },
      audit_logs: {
        orderBy: { created_at: 'asc' },
      },
    },
  });

  if (!tender) {
    throw new Error(`Data Pengajuan Proposal Tender dengan ID ${tenderId} tidak ditemukan.`);
  }

  // 2. Ambil user list untuk fallback nama approver
  const allUsers = await prisma.dc_users.findMany({
    select: { email: true, nama: true, role: true },
  });

  const getUserName = (email: string) => {
    if (!email) return '';
    const cleanEmail = email.toLowerCase().replace('@gmai.com', '@gmail.com');
    const u = allUsers.find(
      (user) =>
        user.email.toLowerCase() === email.toLowerCase() ||
        user.email.toLowerCase() === cleanEmail
    );
    return u?.nama || email.split('@')[0];
  };

  const isAbove1M =
    tender.kategori_nilai === 'DI_ATAS_1M' || tender.nilai_proyek > 1_000_000_000;
  const isApproved = tender.status === 'APPROVED';
  const isRevision = tender.status === 'REVISI';

  // Catatan revisi terbaru
  let catatanRevisi = '';
  if (isRevision) {
    const revLog = [...tender.audit_logs].reverse().find((l) => l.action === 'REVISI');
    catatanRevisi = revLog?.notes || '';
  }

  // 3. Matriks Tanda Tangan
  const signatures: {
    maker: SignatureItem;
    approver_1: SignatureItem;
    approver_2: SignatureItem;
    approver_3: SignatureItem;
  } = {
    maker: {
      name: getUserName(tender.created_by),
      date: formatApprovalDateTime(tender.created_at),
      approved: true,
      role: isAbove1M ? 'DC Specialist / Branch B&M Mgr' : 'Branch Building & Maintenance Manager',
    },
    approver_1: {
      name: 'DC Building & Dev Specialist',
      date: '-',
      approved: false,
      role: 'DC Building & Dev Specialist',
    },
    approver_2: {
      name: 'Building & Maintenance GM',
      date: '-',
      approved: false,
      role: 'Building & Maintenance General Manager',
    },
    approver_3: {
      name: 'Property & Dev Director',
      date: '-',
      approved: false,
      role: 'Property & Development Director',
    },
  };

  for (const log of tender.audit_logs) {
    if (log.action === 'APPROVE') {
      const logDate = formatApprovalDateTime(log.created_at);
      const approverName = log.user_name || getUserName(log.user_email);

      if (log.from_status === 'MENUNGGU APPROVAL DC SPECIALIST') {
        signatures.approver_1 = {
          name: approverName,
          date: logDate,
          approved: true,
          role: 'DC Building & Dev Specialist',
        };
      } else if (log.from_status === 'MENUNGGU APPROVAL B&M GM') {
        signatures.approver_2 = {
          name: approverName,
          date: logDate,
          approved: true,
          role: 'Building & Maintenance General Manager',
        };
      } else if (log.from_status === 'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR') {
        signatures.approver_3 = {
          name: approverName,
          date: logDate,
          approved: true,
          role: 'Property & Development Director',
        };
      }
    }
  }

  // Jika status sudah final APPROVED, pastikan seluruh tahapan bertanda approved
  if (isApproved) {
    const lastApproveLog = [...tender.audit_logs]
      .reverse()
      .find((l) => l.action === 'APPROVE');
    const finalDate = formatApprovalDateTime(lastApproveLog?.created_at || tender.updated_at);

    if (!signatures.approver_1.approved) {
      signatures.approver_1 = {
        name: 'DC Building & Dev Specialist',
        date: finalDate,
        approved: true,
        role: 'DC Building & Dev Specialist',
      };
    }
    if (isAbove1M) {
      if (!signatures.approver_2.approved) {
        signatures.approver_2 = {
          name: 'Building & Maintenance General Manager',
          date: finalDate,
          approved: true,
          role: 'Building & Maintenance General Manager',
        };
      }
      if (!signatures.approver_3.approved) {
        signatures.approver_3 = {
          name: 'Property & Development Director',
          date: finalDate,
          approved: true,
          role: 'Property & Development Director',
        };
      }
    }
  }

  // 4. Siapkan Logo Alfamart & SPARTA format Base64
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

  // 5. Normalisasi data peserta & resume portofolio JSON
  const safeJsonArray = (val: unknown): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(String).filter(Boolean);
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [val];
      } catch {
        return [val];
      }
    }
    return [];
  };

  const vendorUsers = await getVendorUsers();
  const enrichedPeserta = enrichPesertaWithPic(tender.peserta, vendorUsers);

  const processedPeserta = enrichedPeserta.map((p) => {
    const v = p.vendor || {};
    const picName = v.pic_user?.nama || '-';
    const picPhone = v.nomor_telepon || v.pic_user?.nomor_telepon || '-';
    const picEmail = v.email || v.pic_user?.email || '-';
    const peranStr = (p.peran || '').toUpperCase();

    let peranLabel = 'Kontraktor';
    if (peranStr.includes('PENGAWAS')) {
      peranLabel = 'Konsultan Pengawas';
    } else if (peranStr.includes('PERENCANA')) {
      peranLabel = 'Konsultan Perencana';
    }

    return {
      ...p,
      nama_perusahaan: v.nama_perusahaan || '-',
      alamat: v.alamat || '-',
      pic: picName,
      telepon: picPhone,
      email: picEmail,
      golongan: v.golongan || '-',
      peran_label: peranLabel,
      alasan_tidak_lolos: p.alasan_tidak_lolos ? toTitleCase(p.alasan_tidak_lolos) : '',
      vendor_pengalaman: safeJsonArray(v.pengalaman),
      vendor_sertifikat: safeJsonArray(v.sertifikat),
      vendor_iso: safeJsonArray(v.sertifikasi_iso),
    };
  });

  const prakualifikasiKontraktor = processedPeserta.filter(
    (p) => p.peran === 'MAIN_KONTRAKTOR' || p.peran === 'KONTRAKTOR'
  );
  const prakualifikasiPengawas = processedPeserta.filter(
    (p) => (p.peran || '').toUpperCase().includes('PENGAWAS')
  );
  const prakualifikasiPerencana = processedPeserta.filter(
    (p) => (p.peran || '').toUpperCase().includes('PERENCANA')
  );

  const hasPengawas =
    prakualifikasiPengawas.length > 0 ||
    (tender.butuh_konsultan &&
      (tender.tipe_konsultan === 'PENGAWAS' ||
        tender.tipe_konsultan === 'PENGAWAS_DAN_PERENCANA'));

  const hasPerencana =
    prakualifikasiPerencana.length > 0 ||
    (tender.butuh_konsultan &&
      (tender.tipe_konsultan === 'PERENCANA' ||
        tender.tipe_konsultan === 'PENGAWAS_DAN_PERENCANA'));

  const kualifikasiKontraktor = prakualifikasiKontraktor.filter(
    (p) => p.status_tahap === 'LOLOS_KUALIFIKASI'
  );
  const kualifikasiPengawas = prakualifikasiPengawas.filter(
    (p) => p.status_tahap === 'LOLOS_KUALIFIKASI'
  );
  const kualifikasiPerencana = prakualifikasiPerencana.filter(
    (p) => p.status_tahap === 'LOLOS_KUALIFIKASI'
  );

  const pesertaTidakLolos = processedPeserta.filter(
    (p) =>
      p.status_tahap === 'TIDAK_LOLOS' ||
      (p.status_tahap !== 'LOLOS_KUALIFIKASI' && p.status_tahap !== 'PRAKUALIFIKASI')
  );

  // Helper konjungsi kata 'dan' / 'DAN' sesuai aturan bahasa Indonesia
  function joinWithDan(items: string[], isUpper: boolean = false): string {
    if (items.length === 0) return '';
    const conj = isUpper ? 'DAN' : 'dan';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} ${conj} ${items[1]}`;
    return `${items.slice(0, -1).join(', ')} ${conj} ${items[items.length - 1]}`;
  }

  const projectCabang = (
    tender.cabang ||
    tender.project?.cabang ||
    tender.renovasi?.cabang ||
    'PUSAT'
  ).toUpperCase();
  const projectNama = tender.project?.nama_proyek || 'Proyek Renovasi DC';
  const projectKode = tender.project?.kode || '-';
  const signLocation = projectCabang !== 'PUSAT' ? `Branch ${projectCabang}` : 'Tangerang';
  const signDate = formatDateIndo(tender.updated_at || tender.created_at);

  // 1. Judul: "PROPOSAL PESERTA TENDER (nama_proyek) JASA KONTRAKTOR, JASA KONSULTAN PENGAWAS(kalau ada) dan JASA KONSULTAN PERENCANA (kalau ada)"
  const servicesTitle: string[] = ['JASA KONTRAKTOR'];
  if (hasPengawas) servicesTitle.push('JASA KONSULTAN PENGAWAS');
  if (hasPerencana) servicesTitle.push('JASA KONSULTAN PERENCANA');

  const dynamicTitle = `PROPOSAL PESERTA TENDER ${projectNama.toUpperCase()} ${joinWithDan(servicesTitle, true)}`;

  // 2. Paragraf Pembuka:
  // "Berkaitan dengan rencana pembangunan Project (nama_proyek) yang membutuhkan kontraktor, konsultan perencana (kalau ada) dan konsultan pengawas (kalau ada), kami telah menyeleksi yang ikut serta Tender dan menyerahkan dokumen Company Profile dengan rincian sebagai berikut :"
  const servicesOpening: string[] = ['kontraktor'];
  if (hasPerencana) servicesOpening.push('konsultan perencana');
  if (hasPengawas) servicesOpening.push('konsultan pengawas');

  const openingServicesText = joinWithDan(servicesOpening, false);
  const dynamicOpeningParagraph = `Berkaitan dengan rencana pembangunan Project ${projectNama} yang membutuhkan ${openingServicesText}, kami telah menyeleksi yang ikut serta Tender dan menyerahkan dokumen Company Profile dengan rincian sebagai berikut :`;

  // 3. Paragraf Penutup:
  const dynamicClosingParagraph = `Demikian yang dapat kami informasikan berkaitan dengan data peserta ${openingServicesText} yang diikutsertakan dalam Tender ini pembangunan ${projectNama}.`;

  // 4. Kriteria Pekerjaan
  let kriteriaPekerjaanText = 'Pengawasan';
  if (!hasPengawas && !hasPerencana) {
    kriteriaPekerjaanText = 'Konstruksi';
  } else if (hasPengawas && !hasPerencana) {
    kriteriaPekerjaanText = 'Pengawasan';
  } else if (!hasPengawas && hasPerencana) {
    kriteriaPekerjaanText = 'Perencanaan';
  } else {
    kriteriaPekerjaanText = 'Perencanaan dan Pengawasan';
  }

  // 5. Huruf Section Dinamis (A-E fix, F dan G dinamis)
  let nextLetterCode = 70; // 'F'
  let letterPengawas = '';
  let letterPerencana = '';
  if (hasPengawas) {
    letterPengawas = String.fromCharCode(nextLetterCode++);
  }
  if (hasPerencana) {
    letterPerencana = String.fromCharCode(nextLetterCode++);
  }

  // 6. Normalisasi Gantt Timeline Schedule (Lampiran Schedule Pekerjaan)
  const rawSchedule = tender.schedule || [];

  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const s of rawSchedule) {
    const tStart = new Date(s.tanggal_mulai).getTime();
    const tEnd = new Date(s.tanggal_selesai).getTime();
    if (!isNaN(tStart) && tStart < minTime) minTime = tStart;
    if (!isNaN(tEnd) && tEnd > maxTime) maxTime = tEnd;
  }

  function formatDateShort(date: Date | string | null | undefined): string {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    const m = monthNames[d.getMonth()];
    const y = String(d.getFullYear()).slice(-2);
    return `${day}-${m}-${y}`;
  }

  const ganttYears: Array<{ year: number; weeksCount: number }> = [];
  const ganttMonths: Array<{
    year: number;
    monthIndex: number;
    monthName: string;
    weeksCount: number;
  }> = [];
  const ganttAllWeeks: Array<{
    index: number;
    weekRoman: string;
    startDate: Date;
    endDate: Date;
  }> = [];
  let scheduleGroups: any[] = [];

  if (rawSchedule.length > 0 && minTime !== Infinity && maxTime !== -Infinity) {
    const minD = new Date(minTime);
    const maxD = new Date(maxTime);

    const startYear = minD.getFullYear();
    const startMonth = minD.getMonth();
    const endYear = maxD.getFullYear();
    const endMonth = maxD.getMonth();

    const MONTH_NAMES_HEADER = [
      'JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUNI',
      'JULI', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'
    ];

    let gWeekIdx = 0;
    let curY = startYear;
    let curM = startMonth;

    while (curY < endYear || (curY === endYear && curM <= endMonth)) {
      const daysInMonth = new Date(curY, curM + 1, 0).getDate();
      const mName = MONTH_NAMES_HEADER[curM];

      let yObj = ganttYears.find((y) => y.year === curY);
      if (!yObj) {
        yObj = { year: curY, weeksCount: 0 };
        ganttYears.push(yObj);
      }

      ganttMonths.push({
        year: curY,
        monthIndex: curM,
        monthName: mName,
        weeksCount: 4,
      });
      yObj.weeksCount += 4;

      const weekRanges = [
        { start: 1, end: 7, roman: 'I' },
        { start: 8, end: 14, roman: 'II' },
        { start: 15, end: 21, roman: 'III' },
        { start: 22, end: daysInMonth, roman: 'IV' },
      ];

      for (const wr of weekRanges) {
        const sDate = new Date(curY, curM, wr.start, 0, 0, 0);
        const eDate = new Date(curY, curM, wr.end, 23, 59, 59);

        ganttAllWeeks.push({
          index: gWeekIdx++,
          weekRoman: wr.roman,
          startDate: sDate,
          endDate: eDate,
        });
      }

      curM++;
      if (curM > 11) {
        curM = 0;
        curY++;
      }
    }

    const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

    const CATEGORY_MAP: Record<string, { title: string; order: number }> = {
      TENDER_KONSULTAN_PENGAWAS: { title: 'TENDER KONSULTAN PENGAWAS (MK)', order: 1 },
      TENDER_MAIN_KONTRAKTOR: { title: 'TENDER Kontraktor', order: 2 },
      TENDER_KONSULTAN_PERENCANA: { title: 'TENDER KONSULTAN PERENCANA', order: 3 },
      KONSTRUKSI_MAIN_KONTRAKTOR: { title: 'TAHAP KONSTRUKSI', order: 4 },
      KONSTRUKSI_KONSULTAN_PENGAWAS: { title: 'SUPERVISI PENGAWAS (MK)', order: 5 },
      KONSTRUKSI_KONSULTAN_PERENCANA: { title: 'SUPERVISI PERENCANA', order: 6 },
    };

    const groupsMap = new Map<string, typeof rawSchedule>();

    for (const s of rawSchedule) {
      const cat = s.kategori_jadwal || 'TENDER_MAIN_KONTRAKTOR';
      if (!groupsMap.has(cat)) {
        groupsMap.set(cat, []);
      }
      groupsMap.get(cat)!.push(s);
    }

    const sortedCategories = Array.from(groupsMap.keys()).sort((a, b) => {
      const orderA = CATEGORY_MAP[a]?.order ?? 99;
      const orderB = CATEGORY_MAP[b]?.order ?? 99;
      return orderA - orderB;
    });

    scheduleGroups = sortedCategories.map((catKey, groupIndex) => {
      const items = groupsMap.get(catKey) || [];
      items.sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0));

      let catMin = Infinity;
      let catMax = -Infinity;

      for (const item of items) {
        const sT = new Date(item.tanggal_mulai).getTime();
        const eT = new Date(item.tanggal_selesai).getTime();
        if (!isNaN(sT) && sT < catMin) catMin = sT;
        if (!isNaN(eT) && eT > catMax) catMax = eT;
      }

      const catWeekCells = ganttAllWeeks.map((w) => {
        return catMin <= w.endDate.getTime() && catMax >= w.startDate.getTime();
      });

      const roman = ROMAN_NUMERALS[groupIndex] || String(groupIndex + 1);
      const title = CATEGORY_MAP[catKey]?.title || toTitleCase(catKey.replace(/_/g, ' '));

      const processedItems = items.map((it, itIdx) => {
        const sT = new Date(it.tanggal_mulai).getTime();
        const eT = new Date(it.tanggal_selesai).getTime();

        const itWeekCells = ganttAllWeeks.map((w) => {
          return sT <= w.endDate.getTime() && eT >= w.startDate.getTime();
        });

        const descUpper = (it.nama_kegiatan || '').toUpperCase();
        let barClass = 'bar-yellow';
        if (descUpper.includes('SERAH TERIMA') || descUpper.includes('BAST')) {
          barClass = 'bar-red';
        } else if (descUpper.includes('RACK') || descUpper.includes('IT')) {
          barClass = 'bar-orange';
        }

        return {
          subNo: `${itIdx + 1}`,
          description: toTitleCase(it.nama_kegiatan),
          startFormatted: formatDateShort(it.tanggal_mulai),
          finishFormatted: formatDateShort(it.tanggal_selesai),
          barClass,
          weekCells: itWeekCells,
        };
      });

      return {
        roman,
        title,
        startFormatted: formatDateShort(catMin !== Infinity ? new Date(catMin) : null),
        finishFormatted: formatDateShort(catMax !== -Infinity ? new Date(catMax) : null),
        weekCells: catWeekCells,
        items: processedItems,
      };
    });
  }

  // 7. Render Nunjucks Template
  const templatePath = path.resolve(process.cwd(), 'templates/pdf/tender.njk');
  const templateContent = fs.readFileSync(templatePath, 'utf-8');

  const renderedHtml = nunjucks.renderString(templateContent, {
    tender,
    project: tender.project,
    renovasi: tender.renovasi,
    fungsi_ruang: tender.fungsi_ruang,
    peserta: processedPeserta,
    project_cabang: projectCabang,
    project_nama: projectNama,
    project_kode: projectKode,
    tgl_pengajuan_indo: formatDateIndo(tender.created_at),
    nilai_proyek_formatted: formatRupiah(tender.nilai_proyek),
    is_above_1m: isAbove1M,
    is_approved: isApproved,
    is_revision: isRevision,
    catatan_revisi: catatanRevisi,
    catatan_maker_formatted: tender.catatan_maker ? toTitleCase(tender.catatan_maker) : '',
    catatan_kualifikasi_formatted: (tender as any).catatan_kualifikasi ? toTitleCase((tender as any).catatan_kualifikasi) : '',
    signatures,
    sign_location: signLocation,
    sign_date: signDate,
    alfamart_logo_path: alfamart_logo_base64,
    sparta_logo_path: sparta_logo_base64,
    generated_at: formatDateTimeIndo(new Date()),

    // Variabel Penyesuaian Proposal Tender
    dynamic_title: dynamicTitle,
    dynamic_opening_paragraph: dynamicOpeningParagraph,
    dynamic_closing_paragraph: dynamicClosingParagraph,
    kriteria_pekerjaan_text: kriteriaPekerjaanText,
    has_pengawas: hasPengawas,
    has_perencana: hasPerencana,
    letter_pengawas: letterPengawas,
    letter_perencana: letterPerencana,
    prakualifikasi_kontraktor: prakualifikasiKontraktor,
    prakualifikasi_pengawas: prakualifikasiPengawas,
    prakualifikasi_perencana: prakualifikasiPerencana,
    kualifikasi_kontraktor: kualifikasiKontraktor,
    kualifikasi_pengawas: kualifikasiPengawas,
    kualifikasi_perencana: kualifikasiPerencana,
    peserta_tidak_lolos: pesertaTidakLolos,

    // Variabel Gantt Schedule Lampiran
    gantt_years: ganttYears,
    gantt_months: ganttMonths,
    gantt_all_weeks: ganttAllWeeks,
    schedule_groups: scheduleGroups,
  });

  // 8. Render PDF via Puppeteer
  const execPath = getBrowserExecutablePath();
  const launchOptions: LaunchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
}
