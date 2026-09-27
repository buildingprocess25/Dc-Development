export type DcDocumentItemDef = {
  nama_item: string;
  jenis_file: string[];
};

export type DcDocumentCategoryDef = {
  kategori: string;
  items: DcDocumentItemDef[];
};

export const DATA_PENTING_LAINNYA_TEMPLATE: DcDocumentCategoryDef = {
  kategori: "DATA PENTING LAINNYA",
  items: [
    { nama_item: "Foto 0%", jenis_file: ["PDF/JPEG", "PPT"] },
    { nama_item: "Foto Progress Mingguan", jenis_file: ["PDF/JPEG", "PPT"] },
    { nama_item: "Foto 100%", jenis_file: ["PDF/JPEG", "PPT"] },
    { nama_item: "Risalah Rapat Mingguan", jenis_file: ["PDF/JPEG"] },
    { nama_item: "Keterangan Kerja Tambah Kurang / Instruksi Lapangan (Jika Ada)", jenis_file: ["PDF/JPEG"] }
  ]
};

export const PEMBANGUNAN_TEMPLATE: DcDocumentCategoryDef[] = [
  {
    kategori: "SITEPLAN",
    items: [
      { nama_item: "Siteplan dan Office Branch", jenis_file: ["PDF/JPEG", "AUTOCAD"] }
    ]
  },
  {
    kategori: "DATA LEGALITAS",
    items: [
      { nama_item: "Sertifikat Tanah", jenis_file: ["PDF/JPEG"] },
      { nama_item: "IMB atau PBG", jenis_file: ["PDF/JPEG"] },
      { nama_item: "AMDAL atau UKL-UPL", jenis_file: ["PDF/JPEG"] },
      { nama_item: "SLO PLN", jenis_file: ["PDF/JPEG"] },
      { nama_item: "NIDI PLN", jenis_file: ["PDF/JPEG"] },
      { nama_item: "SLF Hydrant System", jenis_file: ["PDF/JPEG"] },
      { nama_item: "SLF Penyalur Petir", jenis_file: ["PDF/JPEG"] },
      { nama_item: "SIPA", jenis_file: ["PDF/JPEG"] }
    ]
  },
  {
    kategori: "SOIL INVESTIGATION & TOPOGRAFI",
    items: [
      { nama_item: "Titik Sondir dan Boring", jenis_file: ["PDF/JPEG", "AUTOCAD"] },
      { nama_item: "Penawaran Harga (Pemenang)", jenis_file: ["PDF/JPEG"] },
      { nama_item: "SPK Kontraktor", jenis_file: ["PDF/JPEG"] },
      { nama_item: "BAST", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Final Report Soil Investigation", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Final Report Topografi (Data Kontur dan Elevasi)", jenis_file: ["PDF/JPEG", "AUTOCAD", "EXCEL"] }
    ]
  },
  {
    kategori: "KONSULTAN PERENCANA",
    items: [
      { nama_item: "KAK & TOR", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Penawaran Harga (Pemenang)", jenis_file: ["PDF/JPEG"] },
      { nama_item: "SPK Konsultan Perencana", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Kontrak PKS", jenis_file: ["PDF/JPEG"] },
      { nama_item: "OE", jenis_file: ["PDF/JPEG", "EXCEL"] },
      { nama_item: "Gambar Forcont (Grading, Struktur, Arsitektur, dan MEP)", jenis_file: ["PDF/JPEG", "AUTOCAD"] },
      { nama_item: "Laporan Analisa Perhitungan Struktur", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Rekap Pembayaran Termin Progress Pekerjaan (Cost Controle)", jenis_file: ["PDF/JPEG"] }
    ]
  },
  {
    kategori: "KONSULTAN PENGAWAS / MK",
    items: [
      { nama_item: "KAK & TOR", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Penawaran Harga (Pemenang)", jenis_file: ["PDF/JPEG"] },
      { nama_item: "SPK Konsultan Pengawas / MK", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Kontrak PKS", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Laporan Bulanan", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Rekap Pembayaran Termin Progress Pekerjaan (Cost Controle)", jenis_file: ["PDF/JPEG"] }
    ]
  },
  {
    kategori: "KONTRAKTOR TIANG PANCANG",
    items: [
      { nama_item: "Penawaran Harga (Pemenang)", jenis_file: ["PDF/JPEG"] },
      { nama_item: "SPK Kontraktor Pancang", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Kontrak PKS", jenis_file: ["PDF/JPEG"] },
      { nama_item: "BAST Pertama", jenis_file: ["PDF/JPEG"] },
      { nama_item: "As-Built Drawing", jenis_file: ["PDF/JPEG", "AUTOCAD"] },
      { nama_item: "BAST Kedua (Retensi)", jenis_file: ["PDF/JPEG"] }
    ]
  },
  {
    kategori: "KONTRAKTOR GRADING (CUT AND FILL)",
    items: [
      { nama_item: "Proposal Peserta Tender", jenis_file: ["PDF/JPEG"] },
      { nama_item: "KAK & TOR", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Absensi dan Notulen Aanwijzing", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Resume Dokumen Pelaksanaan Tender", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Penawaran Harga (Pemenang)", jenis_file: ["PDF/JPEG", "EXCEL"] },
      { nama_item: "SPK Kontraktor Grading", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Kontrak PKS", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Dokumen Tagihan Termin/Progress", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Rekap Pembayaran Termin Progress Pekerjaan (Cost Controle)", jenis_file: ["PDF/JPEG"] },
      { nama_item: "BAST Pertama", jenis_file: ["PDF/JPEG"] },
      { nama_item: "As-Built Drawing", jenis_file: ["PDF/JPEG", "AUTOCAD"] },
      { nama_item: "Dokumen Kerja Tambah/Kurang", jenis_file: ["PDF/JPEG"] },
      { nama_item: "BAST Kedua (Retensi)", jenis_file: ["PDF/JPEG"] }
    ]
  },
  {
    kategori: "KONTRAKTOR UTAMA",
    items: [
      { nama_item: "Proposal Peserta Tender", jenis_file: ["PDF/JPEG"] },
      { nama_item: "KAK & TOR", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Absensi dan Notulen Aanwijzing", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Resume Dokumen Pelaksanaan Tender", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Penawaran Harga (Pemenang)", jenis_file: ["PDF/JPEG", "EXCEL"] },
      { nama_item: "SPK Kontraktor Utama", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Kontrak PKS", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Dokumen Tagihan Termin/Progress", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Rekap Pembayaran Termin Progress Pekerjaan (Cost Controle)", jenis_file: ["PDF/JPEG"] },
      { nama_item: "BAST Pertama", jenis_file: ["PDF/JPEG"] },
      { nama_item: "As-Built Drawing", jenis_file: ["PDF/JPEG", "AUTOCAD"] },
      { nama_item: "Dokumen Kerja Tambah/Kurang", jenis_file: ["PDF/JPEG"] },
      { nama_item: "BAST Kedua (Retensi)", jenis_file: ["PDF/JPEG"] }
    ]
  },
  DATA_PENTING_LAINNYA_TEMPLATE
];

export const RENOVASI_TEMPLATE: DcDocumentCategoryDef[] = [
  {
    kategori: "PEKERJAAN HYDRANT",
    items: [
      { nama_item: "KAK & TOR", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Penawaran Harga (Pemenang)", jenis_file: ["PDF/JPEG", "EXCEL"] },
      { nama_item: "Gambar Shopdrawing (Approval MK/Planner)", jenis_file: ["PDF/JPEG", "AUTOCAD"] },
      { nama_item: "Dokumen Tagihan Termin/Progress", jenis_file: ["PDF/JPEG"] },
      { nama_item: "SPK Kontraktor Hydrant", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Kontrak PKS", jenis_file: ["PDF/JPEG"] },
      { nama_item: "BAST Pertama", jenis_file: ["PDF/JPEG"] },
      { nama_item: "As-Built Drawing", jenis_file: ["PDF/JPEG", "AUTOCAD"] },
      { nama_item: "Dokumen Kerja Tambah/Kurang", jenis_file: ["PDF/JPEG"] },
      { nama_item: "BAST Kedua (Retensi)", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Test Commisioning", jenis_file: ["PDF/JPEG"] }
    ]
  },
  {
    kategori: "PEKERJAAN MEZANIN",
    items: [
      { nama_item: "KAK & TOR", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Penawaran Harga (Pemenang)", jenis_file: ["PDF/JPEG", "EXCEL"] },
      { nama_item: "Gambar Shopdrawing (Approval MK/Planner)", jenis_file: ["PDF/JPEG", "AUTOCAD"] },
      { nama_item: "Dokumen Tagihan Termin/Progress", jenis_file: ["PDF/JPEG"] },
      { nama_item: "SPK Kontraktor Mezanin", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Kontrak PKS", jenis_file: ["PDF/JPEG"] },
      { nama_item: "BAST Pertama", jenis_file: ["PDF/JPEG"] },
      { nama_item: "As-Built Drawing", jenis_file: ["PDF/JPEG", "AUTOCAD"] },
      { nama_item: "Dokumen Kerja Tambah/Kurang", jenis_file: ["PDF/JPEG"] },
      { nama_item: "BAST Kedua (Retensi)", jenis_file: ["PDF/JPEG"] }
    ]
  },
  {
    kategori: "COLD STORAGE",
    items: [
      { nama_item: "Penawaran Harga (Pemenang)", jenis_file: ["PDF/JPEG"] },
      { nama_item: "SPK Suplier Cold Storage", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Kontrak PKS", jenis_file: ["PDF/JPEG"] },
      { nama_item: "BAST Pertama", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Dokumen Tagihan Termin/Progress", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Test Commisioning", jenis_file: ["PDF/JPEG"] },
      { nama_item: "BAST Kedua (Retensi)", jenis_file: ["PDF/JPEG"] }
    ]
  },
  {
    kategori: "PEKERJAAN KONTRAKTOR",
    items: [
      { nama_item: "KAK & TOR", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Penawaran Harga (Pemenang)", jenis_file: ["PDF/JPEG", "EXCEL"] },
      { nama_item: "Gambar Shopdrawing (Approval MK/Planner)", jenis_file: ["PDF/JPEG", "AUTOCAD"] },
      { nama_item: "Dokumen Tagihan Termin/Progress", jenis_file: ["PDF/JPEG"] },
      { nama_item: "SPK Kontraktor", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Kontrak PKS", jenis_file: ["PDF/JPEG"] },
      { nama_item: "BAST Pertama", jenis_file: ["PDF/JPEG"] },
      { nama_item: "As-Built Drawing", jenis_file: ["PDF/JPEG", "AUTOCAD"] },
      { nama_item: "Dokumen Kerja Tambah/Kurang", jenis_file: ["PDF/JPEG"] },
      { nama_item: "BAST Kedua (Retensi)", jenis_file: ["PDF/JPEG"] },
      { nama_item: "Test Commisioning", jenis_file: ["PDF/JPEG"] }
    ]
  },
  DATA_PENTING_LAINNYA_TEMPLATE
];

// Perluasan is a combination of Pembangunan and Renovasi (excluding duplicate Data Penting Lainnya)
export const PERLUASAN_TEMPLATE: DcDocumentCategoryDef[] = [
  ...PEMBANGUNAN_TEMPLATE.filter(cat => cat.kategori !== "DATA PENTING LAINNYA"),
  ...RENOVASI_TEMPLATE.filter(cat => cat.kategori !== "DATA PENTING LAINNYA"),
  DATA_PENTING_LAINNYA_TEMPLATE
];

/** Helper: Hitung Total Wajib Wajib Wajib Wajib Wajib File untuk Progress Bar */
export const getTotalRequiredSlots = (fase: "PEMBANGUNAN" | "RENOVASI" | "PERLUASAN"): number => {
  let template = PEMBANGUNAN_TEMPLATE;
  if (fase === "RENOVASI") template = RENOVASI_TEMPLATE;
  if (fase === "PERLUASAN") template = PERLUASAN_TEMPLATE;

  return template.reduce((acc, cat) => {
    return acc + cat.items.reduce((sum, item) => sum + item.jenis_file.length, 0);
  }, 0);
};
