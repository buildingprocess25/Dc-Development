// =============================================================================
// lib/fungsi-ruang/utils.ts
// Helper dan utilitas khusus modul Pengajuan Perubahan Fungsi Ruang (PFR).
// SOP: SAT/FRM/DCB/010_Rev_000_200323 & Reff NRA: SAT/SOP/DCB/008
// =============================================================================

import { toTitleCase } from "@/lib/utils";

export interface FungsiRuangInputRaw {
  nama_pemohon: string;
  email_pemohon: string;
  jabatan: string;
  divisi: string;
  departemen: string;
  jenis_pengajuan: string;
  alasan_pengajuan: string;
}

/**
 * Menerapkan standardisasi teks untuk pengajuan Fungsi Ruang:
 * - Seluruh inputan teks bebas (nama, jabatan, divisi, departemen, alasan)
 *   wajib menggunakan Title Case terstandarisasi.
 * - Alamat email selalu diformat menjadi huruf kecil semua (lowercase).
 */
export function sanitizeFungsiRuangInput(data: Partial<FungsiRuangInputRaw>) {
  return {
    nama_pemohon: toTitleCase(data.nama_pemohon || ""),
    email_pemohon: (data.email_pemohon || "").trim().toLowerCase(),
    jabatan: toTitleCase(data.jabatan || ""),
    divisi: toTitleCase(data.divisi || ""),
    departemen: toTitleCase(data.departemen || ""),
    jenis_pengajuan: (data.jenis_pengajuan || "").trim(),
    alasan_pengajuan: toTitleCase(data.alasan_pengajuan || ""),
  };
}

/**
 * Konversi angka bulan (1 - 12) ke angka Romawi (I s/d XII)
 */
export function toRomanMonth(monthNumber: number): string {
  const romanMonths = [
    "I", "II", "III", "IV", "V", "VI",
    "VII", "VIII", "IX", "X", "XI", "XII"
  ];
  return romanMonths[monthNumber - 1] || "I";
}

/**
 * Menghasilkan Nomor Pengajuan Fungsi Ruang resmi berformat:
 * [NO]/PROPNDEV-[dc_project.kode]/[bulan romawi]/[tahun]
 * Contoh: 001/PROPNDEV-DC01/X/2026
 *
 * Aturan:
 * - NO: 3 digit angka dengan padding nol di depan (001, 002, dst.).
 * - Tiap bulan akan di-reset kembali ke 001.
 */
export async function generateNomorPengajuanFungsiRuang(
  prismaClient: any,
  projectKode?: string | null
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const monthNum = now.getMonth() + 1;
  const romanMonth = toRomanMonth(monthNum);
  const cleanProjectKode = (projectKode || "DC").trim().replace(/[\/\\]/g, "-").toUpperCase();

  // Pattern suffix bulan dan tahun: /[ROMAN_MONTH]/[YEAR] (contoh: /X/2026)
  const monthSuffix = `/${romanMonth}/${year}`;

  // Ambil semua pengajuan fungsi ruang pada bulan & tahun aktif
  const submissionsThisMonth = await prismaClient.dc_fungsi_ruang.findMany({
    where: {
      nomor_pengajuan: {
        endsWith: monthSuffix,
      },
    },
    select: {
      nomor_pengajuan: true,
    },
  });

  let maxSequence = 0;
  for (const item of submissionsThisMonth) {
    if (item.nomor_pengajuan) {
      const parts = item.nomor_pengajuan.split("/");
      if (parts.length >= 4) {
        const parsedSeq = parseInt(parts[0], 10);
        if (!isNaN(parsedSeq) && parsedSeq > maxSequence) {
          maxSequence = parsedSeq;
        }
      }
    }
  }

  const nextSequence = maxSequence + 1;
  const formattedNo = String(nextSequence).padStart(3, "0");

  return `${formattedNo}/PROPNDEV-${cleanProjectKode}/${romanMonth}/${year}`;
}

