import nodemailer from "nodemailer";
import { google, gmail_v1 } from "googleapis";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";
// @ts-ignore
import MailComposer from "nodemailer/lib/mail-composer";

export interface AanwijzingEmailPayload {
  aanwijzingId?: number;
  nomorUndangan: string;
  namaProyek: string;
  cabang: string;
  tanggalPelaksanaan: string; // e.g. "Kamis, 28 Oktober 2026"
  waktuPelaksanaan: string;   // e.g. "09:00 WIB"
  lokasi: string;
  catatan?: string | null;
  deadlineKonfirmasi: string; // e.g. "Rabu, 28 Oktober 2026 pukul 23:59 WIB (Jam 24:00)"
  vendorNama: string;
  vendorEmail: string;        // email vendor dari dc_aanwijzing_vendor
  toEmail?: string;           // email PIC dari dc_users (jika ditemukan)
  toNama?: string;            // nama PIC dari dc_users
  ccEmail?: string;           // email vendor untuk di-cc
  portalUrl?: string;
  pdfBuffer?: Buffer | null;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

/**
 * Helper untuk membuat Google Gmail API client dari token.json (SPARTA Ecosystem)
 */
function getGmailClient(): gmail_v1.Gmail | null {
  const tokenPath = process.env.GOOGLE_TOKEN_PATH;
  if (!tokenPath) {
    return null;
  }

  const resolvedPath = path.isAbsolute(tokenPath)
    ? tokenPath
    : path.resolve(process.cwd(), tokenPath);

  if (!fs.existsSync(resolvedPath)) {
    console.warn(`[GMAIL-INIT] File token tidak ditemukan di path: ${resolvedPath}. Periksa GOOGLE_TOKEN_PATH di .env`);
    return null;
  }

  try {
    const raw = fs.readFileSync(resolvedPath, "utf-8");
    const data = JSON.parse(raw);
    const auth = new google.auth.OAuth2(data.client_id, data.client_secret);
    auth.setCredentials({ refresh_token: data.refresh_token });
    return google.gmail({ version: "v1", auth });
  } catch (err: any) {
    console.warn("[GMAIL-INIT] Gagal memuat token dari GOOGLE_TOKEN_PATH:", err?.message);
    return null;
  }
}

/**
 * Helper untuk membuat transporter nodemailer jika SMTP_HOST tersedia,
 * atau null jika berjalan di environment dev tanpa kredensial SMTP.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Helper untuk mencari akun PIC kontraktor di dc_users berdasarkan nama_pt yang sesuai dengan nama perusahaan vendor
 */
export async function findPicUserForVendor(vendorNama: string) {
  if (!vendorNama || !vendorNama.trim()) return null;
  const cleanNama = vendorNama.trim();

  // 1. Coba pencocokan exact (case-insensitive)
  let pic = await prisma.dc_users.findFirst({
    where: {
      nama_pt: {
        equals: cleanNama,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      email: true,
      nama: true,
      role: true,
      nama_pt: true,
    },
  });

  // 2. Jika tidak ditemukan exact, coba pencocokan contains (case-insensitive)
  if (!pic) {
    pic = await prisma.dc_users.findFirst({
      where: {
        nama_pt: {
          contains: cleanNama,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        email: true,
        nama: true,
        role: true,
        nama_pt: true,
      },
    });
  }

  return pic;
}

/**
 * Template Email HTML Formal Corporate Enterprise SPARTA DC-Development
 * Berbasis tabel email-client safe (kompatibel penuh dengan Outlook, Gmail, Apple Mail, dan Mobile)
 */
function generateEmailHtml(payload: AanwijzingEmailPayload): string {
  const portalLink = payload.portalUrl || process.env.WEB_SPARTA;

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="id">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Undangan Aanwijzing Resmi — PT Sumber Alfaria Trijaya, Tbk.</title>
  <style type="text/css">
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    td { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    .btn-cta { background-color: #E65F2B; color: #ffffff !important; display: inline-block; font-weight: 700; font-size: 13px; line-height: 44px; text-align: center; text-decoration: none; border-radius: 8px; padding: 0 28px; letter-spacing: 0.3px; box-shadow: 0 4px 10px rgba(230, 95, 43, 0.25); }
    @media only screen and (max-width: 620px) {
      .responsive-table { width: 100% !important; }
      .mobile-p-20 { padding: 20px !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9;">
  <center>
    <!-- MAIN CONTAINER -->
    <table class="responsive-table" border="0" cellpadding="0" cellspacing="0" width="620" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); text-align: left;">
      
      <!-- TOP CORPORATE ACCENT BAR -->
      <tr>
        <td height="4" style="background: linear-gradient(90deg, #E65F2B 0%, #d97706 50%, #0284c7 100%);"></td>
      </tr>

      <!-- CORPORATE HEADER / KOP SURAT -->
      <tr>
        <td style="padding: 28px 32px 20px 32px; border-bottom: 2px solid #f1f5f9; background-color: #ffffff;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td>
                <div style="font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; text-transform: uppercase;">
                  PT SUMBER ALFARIA TRIJAYA, TBK.
                </div>
                <div style="font-size: 12px; font-weight: 600; color: #64748b; margin-top: 2px;">
                  Property &amp; DC Development Directorate &bull; Building &amp; Maintenance Energy System Department
                </div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                  Alfa Tower, Jl. Jalur Sutera Barat Kav. 7-9, Alam Sutera, Tangerang 15143
                </div>
              </td>
              <td align="right" valign="top">
                <span style="display: inline-block; background-color: #fff7ed; border: 1px solid #ffedd5; color: #c2410c; padding: 4px 10px; border-radius: 6px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                  SPARTA DC
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- METADATA SURAT RESMI -->
      <tr>
        <td style="padding: 16px 32px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 12.5px;">
            <tr>
              <td width="90" style="color: #64748b; font-weight: 600; padding: 3px 0;">Nomor</td>
              <td width="15" style="color: #94a3b8; padding: 3px 0;">:</td>
              <td style="color: #0f172a; font-weight: 700; font-family: monospace, monospace; font-size: 12px; padding: 3px 0;">${payload.nomorUndangan}</td>
              <td align="right" style="color: #b91c1c; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 3px 0;">
                [ PENTING &bull; SEGERA ]
              </td>
            </tr>
            <tr>
              <td style="color: #64748b; font-weight: 600; padding: 3px 0;">Lampiran</td>
              <td style="color: #94a3b8; padding: 3px 0;">:</td>
              <td colspan="2" style="color: #334155; font-weight: 500; padding: 3px 0;">1 (Satu) Berkas PDF (Surat Undangan Resmi)</td>
            </tr>
            <tr>
              <td style="color: #64748b; font-weight: 600; padding: 3px 0;">Perihal</td>
              <td style="color: #94a3b8; padding: 3px 0;">:</td>
              <td colspan="2" style="color: #0f172a; font-weight: 700; padding: 3px 0;">Undangan Rapat Penjelasan Pekerjaan (Aanwijzing) &amp; Peninjauan Lapangan</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- BODY CONTENT -->
      <tr>
        <td class="mobile-p-20" style="padding: 28px 32px 32px 32px; color: #1e293b;">
          
          <!-- SALUTATION -->
          <div style="font-size: 13.5px; line-height: 1.5; margin-bottom: 16px;">
            <strong>Kepada Yth.</strong><br />
            <strong>Pimpinan / Direktur ${payload.vendorNama}</strong><br />
            <span style="color: #64748b;">Di Tempat</span>
          </div>

          <!-- MUKADIMAH FORMAL -->
          <div style="font-size: 13px; line-height: 1.65; color: #334155; margin-bottom: 20px;">
            Dengan hormat,<br />
            Sehubungan dengan rencana pelaksanaan pekerjaan pada fasilitas Distribution Center (DC) <strong>PT Sumber Alfaria Trijaya, Tbk.</strong>, bersama ini kami mengundang perwakilan resmi dari perusahaan Bapak/Ibu untuk menghadiri rapat penjelasan teknis pekerjaan (<em>Aanwijzing</em>) dan peninjauan fisik lapangan (<em>Site Visit</em>), dengan jadwal serta rincian sebagai berikut:
          </div>

          <!-- TABEL RINCIAN PELAKSANAAN -->
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-bottom: 22px; font-size: 12.5px;">
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td width="150" style="padding: 10px 14px; font-weight: 600; color: #475569; border-right: 1px solid #e2e8f0;">Paket Proyek</td>
              <td style="padding: 10px 14px; font-weight: 700; color: #0f172a;">${payload.namaProyek}</td>
            </tr>
            <tr style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; font-weight: 600; color: #475569; border-right: 1px solid #e2e8f0;">Cabang DC</td>
              <td style="padding: 10px 14px; font-weight: 600; color: #0f172a;">${payload.cabang}</td>
            </tr>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; font-weight: 600; color: #475569; border-right: 1px solid #e2e8f0;">Hari / Tanggal</td>
              <td style="padding: 10px 14px; font-weight: 700; color: #c2410c;">${payload.tanggalPelaksanaan}</td>
            </tr>
            <tr style="background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; font-weight: 600; color: #475569; border-right: 1px solid #e2e8f0;">Waktu Pelaksanaan</td>
              <td style="padding: 10px 14px; font-weight: 700; color: #0f172a;">${payload.waktuPelaksanaan} s/d Selesai</td>
            </tr>
            <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; font-weight: 600; color: #475569; border-right: 1px solid #e2e8f0;">Tempat / Lokasi</td>
              <td style="padding: 10px 14px; font-weight: 500; color: #0f172a; line-height: 1.4;">${payload.lokasi}</td>
            </tr>
            <tr style="background-color: #ffffff;">
              <td style="padding: 10px 14px; font-weight: 600; color: #475569; border-right: 1px solid #e2e8f0;" valign="top">Agenda Utama</td>
              <td style="padding: 10px 14px; color: #334155; line-height: 1.5;">
                1. Pemaparan Lingkup Pekerjaan &amp; Gambar Teknis<br />
                2. Penjelasan Dokumen Rencana Anggaran Biaya (RAB)<br />
                3. Peninjauan Langsung Lapangan Fisik DC (<em>Site Visit</em>)<br />
                4. Tanya Jawab &amp; Penandatanganan Berita Acara Aanwijzing
              </td>
            </tr>
          </table>

          <!-- KETENTUAN K3 & TATA TERTIB -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #0284c7; border-radius: 6px; padding: 14px 16px; margin-bottom: 22px;">
            <div style="font-size: 12px; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
              Ketentuan Kehadiran &amp; Keselamatan Kerja (K3 / APD):
            </div>
            <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #475569; line-height: 1.6;">
              <li>Perwakilan yang hadir wajib membawa <strong>Surat Tugas / Surat Kuasa resmi</strong> bertanda tangan Direksi (maksimal 2 orang perwakilan).</li>
              <li>Peserta wajib hadir tepat waktu selambat-lambatnya 15 menit sebelum rapat dimulai.</li>
              <li>Wajib mengenakan <strong>Alat Pelindung Diri (APD) standar</strong> saat peninjauan lapangan: <em>Safety Helmet</em>, Rompi Reflektor (<em>Safety Vest</em>), dan Sepatu Safety (<em>Safety Shoes</em>).</li>
              ${payload.catatan ? `<li><strong>Catatan Khusus:</strong> ${payload.catatan}</li>` : ""}
            </ul>
          </div>

          <!-- KOTAK PERINGATAN KONFIRMASI 2x24 JAM (JAM 24:00 HARI KE-2) -->
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 8px; margin-bottom: 26px;">
            <tr>
              <td style="padding: 16px;">
                <div style="font-size: 12.5px; font-weight: 800; color: #92400e; margin-bottom: 4px;">
                  ⚠️ PENTING: Batas Waktu Konfirmasi Kehadiran
                </div>
                <div style="font-size: 12px; color: #78350f; line-height: 1.55;">
                  Sesuai ketentuan SOP Pengadaan Fasilitas DC Alfamart, rekanan kontraktor wajib mengonfirmasi kesediaan hadir melalui portal sistem paling lambat pada:<br />
                  <div style="margin: 6px 0; font-size: 13px; font-weight: 800; color: #b45309;">
                    📅 ${payload.deadlineKonfirmasi}
                  </div>
                  <em>Apabila melewati batas waktu tersebut tanpa konfirmasi, sistem SPARTA secara otomatis menetapkan status sebagai <strong>TIDAK HADIR</strong> dan mendiskualifikasi rekanan dari pengajuan penawaran harga pada proyek ini.</em>
                </div>
              </td>
            </tr>
          </table>

          <!-- TOMBOL CTA RESMI (Jalur 1: Direct Portal Link) -->
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
            <tr>
              <td align="center">
                <a href="${portalLink}" class="btn-cta" target="_blank" style="background-color: #E65F2B; color: #ffffff !important; display: inline-block; font-weight: 700; font-size: 13px; line-height: 44px; text-align: center; text-decoration: none; border-radius: 8px; padding: 0 32px; letter-spacing: 0.3px;">
                  KONFIRMASI KEHADIRAN PORTAL SPARTA &rarr;
                </a>
              </td>
            </tr>
          </table>
          <div style="text-align: center; font-size: 11px; color: #64748b; margin-bottom: 24px;">
            Atau akses langsung melalui tautan: <a href="${portalLink}" target="_blank" style="color: #E65F2B; text-decoration: underline; word-break: break-all;">${portalLink}</a>
          </div>

          <!-- PENUTUP FORMAL -->
          <div style="font-size: 12.5px; line-height: 1.6; color: #334155; margin-bottom: 24px;">
            Demikian surat undangan ini kami sampaikan. Atas perhatian, kerja sama, dan kehadiran tepat waktu Bapak/Ibu, kami ucapkan terima kasih.<br /><br />
            <strong>Hormat kami,</strong><br />
            <strong>Building &amp; Maintenance Energy System Department</strong><br />
            <span style="color: #64748b;">PT Sumber Alfaria Trijaya, Tbk.</span>
          </div>

          <!-- INFORMASI LAMPIRAN PDF -->
          <div style="padding: 10px 14px; background-color: #f1f5f9; border-radius: 6px; font-size: 11.5px; color: #475569;">
            📎 <strong>Lampiran Berkas Resmi:</strong> Surat Undangan resmi berkop SAT berformat PDF telah dilampirkan pada email ini untuk kelengkapan administrasi rekanan.
          </div>

        </td>
      </tr>

      <!-- FOOTER LEGAL & DISCLAIMER -->
      <tr>
        <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5; text-align: center;">
          <div style="font-weight: 700; color: #475569; margin-bottom: 4px;">
            SPARTA &bull; System of Project Architecture &amp; Renovation Tracking Alfamart
          </div>
          <div>
            PT Sumber Alfaria Trijaya, Tbk. Head Office &bull; Property &amp; DC Development Directorate
          </div>
          <div style="color: #94a3b8; font-size: 10px; margin-top: 8px; text-align: justify; line-height: 1.4;">
            <strong>PEMBERITAHUAN KERAHASIAAN:</strong> Email ini dikirimkan secara otomatis oleh sistem, mohon tidak membalas langsung ke alamat email ini. Informasi dan berkas lampiran yang terdapat dalam pesan ini bersifat rahasia dan hanya diperuntukkan bagi rekanan penerima yang sah. Dilarang menyebarluaskan, menyalin, atau mendistribusikan isi email ini kepada pihak lain tanpa izin tertulis dari PT Sumber Alfaria Trijaya, Tbk.
          </div>
        </td>
      </tr>

    </table>
  </center>
</body>
</html>
  `.trim();
}

/**
 * Service Utama: Kirim email undangan aanwijzing ke kontraktor
 */
export async function sendUndanganAanwijzingEmail(payload: AanwijzingEmailPayload): Promise<SendEmailResult> {
  const emailUser = process.env.EMAIL_USER || "building_development@sat.co.id";
  const fromAddress = process.env.SMTP_FROM || `"SPARTA DC-Development" <${emailUser}>`;
  const subject = `[UNDANGAN AANWIJZING] ${payload.nomorUndangan} - ${payload.namaProyek} (${payload.cabang})`;
  const htmlContent = generateEmailHtml(payload);

  let toEmail = payload.toEmail?.trim();
  let toNama = payload.toNama?.trim();
  let ccEmail = payload.ccEmail?.trim();

  // Jika toEmail belum ditentukan, cari otomatis PIC di dc_users dengan nama_pt yang sama
  if (!toEmail && payload.vendorNama) {
    try {
      const pic = await findPicUserForVendor(payload.vendorNama);
      if (pic?.email) {
        toEmail = pic.email.trim();
        toNama = pic.nama?.trim();
        // CC email vendor dari dc_aanwijzing_vendor jika berbeda dengan email PIC
        const vEmail = payload.vendorEmail?.trim();
        if (vEmail && vEmail.toLowerCase() !== toEmail.toLowerCase()) {
          ccEmail = vEmail;
        }
      }
    } catch (picErr) {
      console.warn("[EMAIL] Gagal mencari PIC di dc_users:", picErr);
    }
  }

  // Fallback toEmail ke vendorEmail jika PIC tidak ditemukan
  if (!toEmail) {
    toEmail = payload.vendorEmail?.trim();
  }

  // Pastikan CC tidak duplikat dengan To
  if (ccEmail && toEmail && ccEmail.toLowerCase() === toEmail.toLowerCase()) {
    ccEmail = undefined;
  }

  const safeNomor = payload.nomorUndangan.replace(/[\/\\?%*:|"<>]/g, '_');
  const attachments = [];
  if (payload.pdfBuffer) {
    attachments.push({
      filename: `Surat_Undangan_Aanwijzing_${safeNomor}.pdf`,
      content: payload.pdfBuffer,
      contentType: 'application/pdf',
    });
  }

  // JALUR 1: Google Gmail API Resmi via token.json (SPARTA Ecosystem)
  const gmail = getGmailClient();
  if (gmail) {
    try {
      const mailOptions: any = {
        from: fromAddress,
        to: toEmail,
        subject,
        html: htmlContent,
        attachments,
      };
      if (ccEmail) {
        mailOptions.cc = ccEmail;
      }

      const mail = new MailComposer(mailOptions);
      const rawMime = await mail.compile().build();
      const encodedRaw = Buffer.from(rawMime)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encodedRaw },
      });

      console.log(`[GMAIL API SUCCESS] Email undangan terkirim ke ${toEmail}${ccEmail ? ` (CC: ${ccEmail})` : ''} (Message ID: ${res.data.id})`);
      return {
        success: true,
        messageId: res.data.id || undefined,
        simulated: false,
      };
    } catch (gmailErr: any) {
      console.warn(`[GMAIL API WARN] Gagal via Gmail API (${gmailErr?.message}), mencoba jalur fallback SMTP...`);
    }
  }

  // JALUR 2: SMTP Transporter (jika disetel di .env)
  const transporter = createTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        cc: ccEmail,
        subject,
        html: htmlContent,
        attachments,
      });

      console.log(`[SMTP SUCCESS] Email undangan terkirim ke ${toEmail}${ccEmail ? ` (CC: ${ccEmail})` : ''} (Message ID: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
        simulated: false,
      };
    } catch (smtpErr: any) {
      console.error(`[SMTP ERROR] Gagal mengirim ke ${toEmail}:`, smtpErr);
      return {
        success: false,
        error: smtpErr?.message || 'Gagal mengirim email via SMTP',
      };
    }
  }

  // JALUR 3: Mode Simulasi jika token.json maupun SMTP tidak tersedia
  console.log(`\n======================================================`);
  console.log(`[EMAIL SIMULATOR] Undangan Aanwijzing ke Kontraktor`);
  console.log(`To: ${toNama ? `${toNama} ` : `${payload.vendorNama} `}<${toEmail}>`);
  if (ccEmail) {
    console.log(`Cc: <${ccEmail}>`);
  }
  console.log(`Subject: ${subject}`);
  console.log(`Portal Link: ${payload.portalUrl || process.env.WEB_SPARTA}`);
  console.log(`Nomor: ${payload.nomorUndangan} | Waktu: ${payload.tanggalPelaksanaan} ${payload.waktuPelaksanaan}`);
  console.log(`Lokasi: ${payload.lokasi}`);
  console.log(`Deadline: ${payload.deadlineKonfirmasi}`);
  console.log(`PDF Attachment: ${payload.pdfBuffer ? `${payload.pdfBuffer.length} bytes` : 'None'}`);
  console.log(`[CATATAN]: Email disimulasikan karena token.json / SMTP belum terhubung.`);
  console.log(`======================================================\n`);

  return {
    success: false,
    simulated: true,
    error: "Gmail API / SMTP belum terhubung (Mode Simulasi)",
    messageId: `simulated-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  };
}
