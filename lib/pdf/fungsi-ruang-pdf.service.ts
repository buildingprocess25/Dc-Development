import fs from 'fs';
import path from 'path';
import nunjucks from 'nunjucks';
import puppeteer, { LaunchOptions } from 'puppeteer';
import { prisma } from '@/lib/db';

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

function formatDateIndo(date: Date | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTimeIndo(date: Date | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  const tgl = d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const jam = d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(':', '.');
  return `${tgl} ${jam}`;
}

interface AuditLogPayload {
  status?: string;
  action_by_name?: string;
  action_by_role?: string;
  catatan?: string;
  [key: string]: unknown;
}

interface SignatureItem {
  name: string;
  date: string;
  approved: boolean;
  role?: string;
}

export async function generateFungsiRuangPdfBuffer(submissionId: number): Promise<Buffer> {
  // 1. Ambil data pengajuan fungsi ruang beserta relasi project dan renovasi
  const submission = await prisma.dc_fungsi_ruang.findUnique({
    where: { id: submissionId },
    include: {
      project: true,
      renovasi: true,
    },
  });

  if (!submission) {
    throw new Error(`Data pengajuan fungsi ruang dengan ID ${submissionId} tidak ditemukan.`);
  }

  // 2. Ambil user list untuk fallback pencocokan nama
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

  const creatorName = getUserName(submission.created_by);

  // 3. Ambil seluruh riwayat audit log untuk entitas dc_fungsi_ruang ini
  const auditLogs = await prisma.app_audit_log.findMany({
    where: {
      entitas: 'dc_fungsi_ruang',
      entitas_id: String(submission.id),
    },
    orderBy: { created_at: 'asc' },
  });

  // 4. Inisialisasi struktur tanda tangan 8 kolom
  const signatures: Record<string, SignatureItem> = {
    pemohon: {
      name: submission.nama_pemohon,
      date: formatDateTimeIndo(submission.created_at),
      approved: true,
      role: submission.jabatan,
    },
    bm_mgr: {
      name: creatorName,
      date: formatDateTimeIndo(submission.created_at),
      approved: true,
      role: 'Branch B&M Manager',
    },
    bm_dbm: {
      name: '',
      date: '',
      approved: false,
      role: 'Branch Manager / DBM',
    },
    reg_bm_mgr: {
      name: '',
      date: '',
      approved: false,
      role: 'Regional B&M Manager',
    },
    dc_specialist: {
      name: '',
      date: '',
      approved: false,
      role: 'DC Specialist',
    },
    bm_gm: {
      name: '',
      date: '',
      approved: false,
      role: 'B&M General Manager',
    },
    op_director: {
      name: '',
      date: '',
      approved: false,
      role: 'Operation Director',
    },
    prop_dev_mgr: {
      name: '',
      date: '',
      approved: false,
      role: 'Property Dev Manager',
    },
  };

  // 5. Ekstraksi approval log ke masing-masing posisi
  const isRevision = submission.status === 'REVISI';
  let catatanRevisi = '';
  if (isRevision) {
    for (let i = auditLogs.length - 1; i >= 0; i--) {
      if (auditLogs[i].aksi === 'APPROVAL_REVISI') {
        catatanRevisi = (auditLogs[i].data_baru as AuditLogPayload | null)?.catatan || '';
        break;
      }
    }
  }

  if (!isRevision) {
    // Jika pernah terjadi revisi sebelumnya, hanya approval setelah revisi terakhir yang berlaku
    let lastRevisionIdx = -1;
    for (let i = auditLogs.length - 1; i >= 0; i--) {
      if (auditLogs[i].aksi === 'APPROVAL_REVISI' || auditLogs[i].aksi === 'RESUBMIT_REVISI') {
        lastRevisionIdx = i;
        break;
      }
    }
    const validApprovalLogs = lastRevisionIdx >= 0 ? auditLogs.slice(lastRevisionIdx + 1) : auditLogs;

    for (const log of validApprovalLogs) {
      if (log.aksi === 'APPROVAL_APPROVE') {
        const dataLama = (log.data_lama as AuditLogPayload | null)?.status || '';
        const dataBaru = (log.data_baru as AuditLogPayload | null)?.status || '';
        const rawApproverName = (log.data_baru as AuditLogPayload | null)?.action_by_name || '';
        const realName = getUserName(log.user_email);
        const approverName =
          rawApproverName && !rawApproverName.includes('@')
            ? rawApproverName
            : realName || rawApproverName || log.user_email;
        const approveDate = formatDateTimeIndo(log.created_at);

        // Tier 2: BM/DBM
        if (
          dataLama === 'MENUNGGU APPROVAL BM/DBM' ||
          dataBaru === 'MENUNGGU APPROVAL REGIONAL B&M MANAGER'
        ) {
          signatures.bm_dbm = {
            name: approverName,
            date: approveDate,
            approved: true,
          };
        }

        // Tier 3: Regional B&M Manager
        if (
          dataLama === 'MENUNGGU APPROVAL REGIONAL B&M MANAGER' ||
          dataBaru === 'MENUNGGU APPROVAL DC SPECIALIST'
        ) {
          signatures.reg_bm_mgr = {
            name: approverName,
            date: approveDate,
            approved: true,
          };
        }

        // Tier 4: DC Specialist
        if (
          dataLama === 'MENUNGGU APPROVAL DC SPECIALIST' ||
          dataBaru === 'MENUNGGU APPROVAL B&M GM'
        ) {
          signatures.dc_specialist = {
            name: approverName,
            date: approveDate,
            approved: true,
          };
        }

        // Tier 5: B&M GM
        if (
          dataLama === 'MENUNGGU APPROVAL B&M GM' ||
          dataBaru === 'MENUNGGU APPROVAL OPERATION DIRECTOR'
        ) {
          signatures.bm_gm = {
            name: approverName,
            date: approveDate,
            approved: true,
          };
        }

        // Tier 6: Operation Director
        if (
          dataLama === 'MENUNGGU APPROVAL OPERATION DIRECTOR' ||
          dataBaru === 'MENUNGGU APPROVAL PROPERTY DEV MANAGER'
        ) {
          signatures.op_director = {
            name: approverName,
            date: approveDate,
            approved: true,
          };
        }

        // Tier 7: Property Development Manager (Final)
        if (
          dataLama === 'MENUNGGU APPROVAL PROPERTY DEV MANAGER' ||
          dataBaru === 'APPROVED'
        ) {
          signatures.prop_dev_mgr = {
            name: approverName,
            date: approveDate,
            approved: true,
          };
        }
      }
    }
  }

  // 6. Siapkan Logo Alfamart & SPARTA dalam format Base64
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

  const projectTipe = (submission.project?.tipe || 'DC').toUpperCase();
  const projectCabang = (
    submission.project?.cabang ||
    submission.renovasi?.cabang ||
    '-'
  ).toUpperCase();
  const projectNama = submission.project?.nama_proyek || '';
  const lokasiTipe = projectTipe || 'DC';
  const tglPengajuanIndo = formatDateIndo(submission.created_at);

  const project_type_is_depo = projectTipe.includes('DEPO');
  const project_type_is_bulky = projectTipe.includes('BULKY');
  const project_type_is_warehouse =
    projectTipe.includes('WAREHOUSE') ||
    projectTipe.includes('DC') ||
    (!project_type_is_depo && !project_type_is_bulky && !projectTipe.includes('OFFICE'));
  const project_type_is_office = projectTipe.includes('OFFICE');

  const sign_location = projectCabang !== '-' ? `Branch ${projectCabang}` : 'Tangerang';
  const sign_date = formatDateIndo(submission.updated_at || submission.created_at);

  const is_approved = submission.status === 'APPROVED';

  // 8. Compile Template Nunjucks
  const templatePath = path.resolve(process.cwd(), 'templates/pdf/fungsi-ruang.njk');
  const templateContent = fs.readFileSync(templatePath, 'utf-8');

  const renderedHtml = nunjucks.renderString(templateContent, {
    submission,
    project: submission.project,
    renovasi: submission.renovasi,
    creator_name: creatorName,
    project_cabang: projectCabang,
    project_nama: projectNama,
    lokasi_tipe: lokasiTipe,
    tgl_pengajuan_indo: tglPengajuanIndo,
    project_type_is_depo,
    project_type_is_bulky,
    project_type_is_warehouse,
    project_type_is_office,
    sign_location,
    sign_date,
    signatures,
    is_approved,
    is_revision: isRevision,
    catatan_revisi: catatanRevisi,
    is_draft: !is_approved && !isRevision,
    alfamart_logo_path: alfamart_logo_base64,
    sparta_logo_path: sparta_logo_base64,
    watermark_logo_path: sparta_logo_base64,
    created_at_formatted: formatDateTimeIndo(submission.created_at),
    generated_at: formatDateTimeIndo(new Date()),
  });

  // 9. Render PDF via Puppeteer
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
