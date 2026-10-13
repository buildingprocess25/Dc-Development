export const CABANG_TUNGGAL = [
  "LUWU", "REMBANG", "TEGAL", "GORONTALO", "PONTIANAK", "CIANJUR", "JEMBER", 
  "BALI", "KLATEN", "MAKASSAR", "PLUMBON", "PEKANBARU", "JAMBI", "HEAD OFFICE", 
  "CILACAP", "SEMARANG", "MALANG", "MANADO", "BATAM", "MADIUN"
];

export const CABANG_GRUP: Record<string, string[]> = {
  "BANDUNG RAYA": ["BANDUNG RAYA", "BANDUNG", "BANDUNG 1", "BANDUNG 2"],
  "LOMBOK": ["LOMBOK", "SUMBAWA"],
  "MEDAN": ["MEDAN", "ACEH"],
  "LAMPUNG": ["LAMPUNG", "KOTABUMI"],
  "PALEMBANG": ["PALEMBANG", "BENGKULU", "BANGKA", "BELITUNG"],
  "SIDOARJO": ["SIDOARJO", "SIDOARJO BPN SMD", "MANOKWARI", "NTT", "SORONG"],
  "BANJARMASIN": ["BANJARMASIN", "PALANGKARAYA"],
  "CIKOKOL": ["CIKOKOL", "PARUNG", "BALARAJA", "SERANG", "BINTAN"],
  "CILEUNGSI": ["CILEUNGSI", "BOGOR", "BEKASI", "KARAWANG"]
};

export const ALL_INDUK_CABANG = [...CABANG_TUNGGAL, ...Object.keys(CABANG_GRUP)].sort();

export const ALL_BRANCHES = Array.from(new Set([
  ...CABANG_TUNGGAL,
  ...Object.values(CABANG_GRUP).flat()
])).sort();

/**
 * Mendapatkan semua anak cabang dari suatu induk cabang.
 * Jika induk = "BANDUNG RAYA" -> ["BANDUNG RAYA", "BANDUNG", "BANDUNG 1", "BANDUNG 2"]
 */
export function getBranchesUnderInduk(induk: string): string[] {
  const upper = (induk || "").trim().toUpperCase();
  if (CABANG_GRUP[upper]) {
    return CABANG_GRUP[upper];
  }
  return [upper];
}

/**
 * Mencari induk cabang dari suatu nama cabang anak.
 * Contoh: "BANDUNG 1" -> "BANDUNG RAYA", "BOGOR" -> "CILEUNGSI", "BALI" -> "BALI"
 */
export function getIndukFromCabang(cabang: string): string {
  const upper = (cabang || "").trim().toUpperCase();
  for (const [induk, children] of Object.entries(CABANG_GRUP)) {
    if (children.some(c => c.toUpperCase() === upper) || induk.toUpperCase() === upper) {
      return induk;
    }
  }
  return upper;
}

/**
 * Mendapatkan daftar Induk Cabang yang dicakup oleh daftar coverage_cabang user.
 */
export function getIndukCabangFromCoverage(coverageStr: string): string[] {
  if (!coverageStr) return [];
  const list = coverageStr.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  const indukSet = new Set<string>();
  
  for (const branch of list) {
    indukSet.add(getIndukFromCabang(branch));
  }
  
  return Array.from(indukSet).sort();
}

/**
 * Mengecek apakah user memiliki role DC Admin (satu-satunya role dengan akses penuh ke seluruh cabang).
 */
export function isDcAdmin(user?: { role?: string | null } | null): boolean {
  if (!user || !user.role) return false;
  const r = user.role.trim().toUpperCase();
  return (
    r === "DC ADMIN" ||
    r === "ADMIN_DC" ||
    r === "ADMINISTRATOR DC" ||
    r === "SUPER ADMIN" ||
    r === "SUPER_ADMIN"
  );
}

/**
 * @deprecated Gunakan isDcAdmin() karena akun HEAD OFFICE pun dibatasi oleh coverage_cabang, hanya role DC Admin yang memiliki akses penuh ke seluruh cabang.
 */
export function isHeadOfficeUser(user?: { cabang?: string | null; role?: string | null; isHO?: boolean } | null): boolean {
  return isDcAdmin(user);
}

/**
 * Mendapatkan daftar seluruh nama cabang (baik nama induk maupun anak cabang) yang dicakup oleh akun user.
 * Return null HANYA jika role user adalah DC ADMIN (satu-satunya role dengan akses penuh ke seluruh cabang).
 * Untuk akun HEAD OFFICE sekalipun (seperti Specialist dan Manager), wajib mengikuti kolom coverage_cabang!
 */
export function getUserCoverageBranches(user?: { cabang?: string | null; coverage_cabang?: string | null; role?: string | null; isHO?: boolean } | null): string[] | null {
  if (!user) return [];
  
  // HANYA role DC ADMIN yang punya akses penuh ke seluruh cabang
  if (isDcAdmin(user)) {
    return null;
  }

  const rawList: string[] = [];

  // Seluruh role selain DC ADMIN (termasuk user dengan cabang HEAD OFFICE):
  // Wajib mengikuti kolom coverage_cabang!
  if (user.coverage_cabang) {
    const list = user.coverage_cabang.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    rawList.push(...list);
  }

  // Jika coverage_cabang tidak diisi dan cabangnya bukan HEAD OFFICE, gunakan user.cabang
  if (rawList.length === 0 && user.cabang) {
    const c = user.cabang.trim().toUpperCase();
    if (c && c !== "HEAD OFFICE") {
      rawList.push(c);
    }
  }

  if (rawList.length === 0) {
    return [];
  }

  const branchSet = new Set<string>();
  for (const b of rawList) {
    branchSet.add(b);
    const induk = getIndukFromCabang(b);
    if (induk) branchSet.add(induk);
    const children = getBranchesUnderInduk(b);
    for (const child of children) {
      branchSet.add(child.toUpperCase());
    }
  }

  return Array.from(branchSet);
}

/**
 * Mengecek apakah suatu cabang proyek/data boleh diakses oleh user berdasarkan daftar coverage.
 */
export function isBranchAccessible(itemCabang: string, allowedBranches: string[] | null): boolean {
  if (allowedBranches === null) return true; // Bebas akses (HEAD OFFICE)
  if (!itemCabang) return false;
  const upper = itemCabang.trim().toUpperCase();
  const induk = getIndukFromCabang(upper);
  return allowedBranches.includes(upper) || (Boolean(induk) && allowedBranches.includes(induk));
}

// Re-export creator filtering helpers for convenience
export {
  isBranchBuildingKoordinator,
  isSameCreator,
  canUserViewRenovasiSubmission,
  filterRenovasiByCreator,
  getRenovasiUserFilter
} from './permissions';

