/**
 * Utility untuk pemetaan Departemen / Divisi Pemohon dengan Role Approver di dc_users:
 * - General Manager Departemen (e.g. GENERAL MANAGER FINANCE, GENERAL MANAGER IT, dsb.)
 * - Direktur Departemen (e.g. DIREKTUR FINANCE, DIREKTUR IT, dsb.)
 */

export interface DepartmentApproverMapping {
  key: string;
  label: string;
  matchKeywords: string[];
  gmRole: string;
  directorRole: string;
}

export const DEPARTMENT_APPROVER_MAPPINGS: DepartmentApproverMapping[] = [
  {
    key: "FINANCE",
    label: "Finance & Accounting",
    matchKeywords: ["FINANCE", "ACCOUNTING", "KEUANGAN", "AKUNTANSI", "COST CONTROL"],
    gmRole: "GENERAL MANAGER FINANCE",
    directorRole: "DIREKTUR FINANCE",
  },
  {
    key: "IT",
    label: "Information & Technology",
    matchKeywords: ["IT", "INFORMATION", "TECHNOLOGY", "INFRASTRUCTURE", "SUPPORT"],
    gmRole: "GENERAL MANAGER IT",
    directorRole: "DIREKTUR IT",
  },
  {
    key: "HUMAN_CAPITAL",
    label: "Human Capital",
    matchKeywords: ["HUMAN CAPITAL", "HC", "HRD", "PEOPLE", "ORGANIZATION DEVELOPMENT"],
    gmRole: "GENERAL MANAGER HUMAN CAPITAL",
    directorRole: "DIREKTUR HUMAN CAPITAL",
  },
  {
    key: "OPERATIONS",
    label: "Operations & Warehouse",
    matchKeywords: ["OPERATION", "OPERASIONAL", "WAREHOUSE", "LOGISTIK", "DISTRIBUTION"],
    gmRole: "GENERAL MANAGER OPERATIONS",
    directorRole: "DIREKTUR OPERATIONS",
  },
  {
    key: "MERCHANDISING",
    label: "Merchandising & Supply Chain",
    matchKeywords: ["MERCHANDISING", "MD", "SUPPLY CHAIN", "SPACE PLANNING", "CATEGORY"],
    gmRole: "GENERAL MANAGER MERCHANDISING",
    directorRole: "DIREKTUR MERCHANDISING",
  },
  {
    key: "BMES",
    label: "Property Development & BMES",
    matchKeywords: ["BMES", "ENERGY", "MAINTENANCE SYSTEM", "PROPERTY DEVELOPMENT"],
    gmRole: "GENERAL MANAGER BMES",
    directorRole: "DIREKTUR PROPERTY DEVELOPMENT",
  },
];

/**
 * Mendeteksi DepartmentMapping yang sesuai berdasarkan departemen dan divisi
 */
export function getDepartmentMapping(
  departemen?: string | null,
  divisi?: string | null
): DepartmentApproverMapping | null {
  const combined = `${departemen || ""} ${divisi || ""}`.trim().toUpperCase();
  if (!combined) return null;

  for (const mapping of DEPARTMENT_APPROVER_MAPPINGS) {
    if (mapping.matchKeywords.some((kw) => combined.includes(kw))) {
      return mapping;
    }
  }

  return null;
}

/**
 * Cek apakah user role adalah GM yang membawahi departemen/divisi pemohon
 */
export function isUserGmForDepartment(
  userRole: string | undefined | null,
  departemen?: string | null,
  divisi?: string | null
): boolean {
  if (!userRole) return false;
  const normRole = userRole.trim().toUpperCase();

  // Harus role GM (kecuali Building & Maintenance General Manager yang merupakan stage terpisah)
  const isGm =
    (normRole.startsWith("GENERAL MANAGER") || normRole.startsWith("GM")) &&
    !normRole.includes("BUILDING & MAINTENANCE") &&
    !normRole.includes("B&M");

  if (!isGm) return false;

  const mapping = getDepartmentMapping(departemen, divisi);
  if (!mapping) {
    // Fallback jika departemen custom: cek apakah ada irisan kata antara role dengan departemen/divisi
    const combined = `${departemen || ""} ${divisi || ""}`.trim().toUpperCase();
    const roleWithoutGm = normRole.replace(/^(GENERAL MANAGER|GM)\s+/, "");
    return combined.includes(roleWithoutGm) || roleWithoutGm.includes(combined);
  }

  // Cek apakah role mengandung keyword departemen pemohon
  return mapping.matchKeywords.some((kw) => normRole.includes(kw)) || normRole.includes(mapping.key);
}

/**
 * Cek apakah user role adalah Direktur yang membawahi departemen/divisi pemohon
 */
export function isUserDirectorForDepartment(
  userRole: string | undefined | null,
  departemen?: string | null,
  divisi?: string | null
): boolean {
  if (!userRole) return false;
  const normRole = userRole.trim().toUpperCase();

  // Harus role Direktur (kecuali Property & Development Director yang merupakan stage final)
  const isDirector =
    (normRole.startsWith("DIREKTUR") || normRole.startsWith("DIRECTOR") || normRole.startsWith("DIR")) &&
    !normRole.includes("PROPERTY & DEVELOPMENT") &&
    !normRole.includes("PROP.DEV");

  if (!isDirector) return false;

  const mapping = getDepartmentMapping(departemen, divisi);
  if (!mapping) {
    // Fallback jika departemen custom
    const combined = `${departemen || ""} ${divisi || ""}`.trim().toUpperCase();
    const roleWithoutDir = normRole.replace(/^(DIREKTUR|DIRECTOR|DIR)\s+/, "");
    return combined.includes(roleWithoutDir) || roleWithoutDir.includes(combined);
  }

  return mapping.matchKeywords.some((kw) => normRole.includes(kw)) || normRole.includes(mapping.key);
}

/**
 * Cek apakah suatu role adalah role GM departemen apapun (bukan B&M GM)
 */
export function isAnyDepartmentGmRole(role: string | undefined | null): boolean {
  if (!role) return false;
  const norm = role.trim().toUpperCase();
  return (
    (norm.startsWith("GENERAL MANAGER") || norm.startsWith("GM")) &&
    !norm.includes("BUILDING & MAINTENANCE") &&
    !norm.includes("B&M")
  );
}

/**
 * Cek apakah suatu role adalah role Direktur departemen apapun (bukan Property & Dev Director)
 */
export function isAnyDepartmentDirectorRole(role: string | undefined | null): boolean {
  if (!role) return false;
  const norm = role.trim().toUpperCase();
  return (
    (norm.startsWith("DIREKTUR") || norm.startsWith("DIRECTOR") || norm.startsWith("DIR")) &&
    !norm.includes("PROPERTY & DEVELOPMENT") &&
    !norm.includes("PROP.DEV")
  );
}

/**
 * Menemukan data user GM dan Direktur dari daftar users dc_users
 */
export function findDepartmentApprovers(
  users: Array<{ email: string; nama: string; role: string }>,
  departemen?: string | null,
  divisi?: string | null
): {
  gm: { email: string; nama: string; role: string } | null;
  director: { email: string; nama: string; role: string } | null;
} {
  const gm = users.find((u) => isUserGmForDepartment(u.role, departemen, divisi)) || null;
  const director = users.find((u) => isUserDirectorForDepartment(u.role, departemen, divisi)) || null;

  return { gm, director };
}

/**
 * Mengambil nama pendek departemen (misal: "Finance", "IT", "Operations", dsb.)
 */
export function getDepartmentShortName(departemen?: string | null, divisi?: string | null): string {
  const mapping = getDepartmentMapping(departemen, divisi);
  if (mapping) {
    switch (mapping.key) {
      case "FINANCE":
        return "Finance";
      case "IT":
        return "IT";
      case "HUMAN_CAPITAL":
        return "Human Capital";
      case "OPERATIONS":
        return "Operations";
      case "MERCHANDISING":
        return "Merchandising";
      case "BMES":
        return "BMES";
      default:
        return mapping.label;
    }
  }
  const raw = departemen || divisi || "Dept Pemohon";
  return raw.replace(/^(Departemen|Divisi|Department|Division)\s+/i, "").trim();
}

/**
 * Menghasilkan label dinamis untuk GM Dept Pemohon (misal: "GM Finance", "GM IT", dsb.)
 */
export function getDepartmentGmLabel(departemen?: string | null, divisi?: string | null): string {
  const shortName = getDepartmentShortName(departemen, divisi);
  return `GM ${shortName}`;
}

/**
 * Menghasilkan label dinamis untuk Direktur Dept Pemohon (misal: "Direktur Finance", "Direktur IT", dsb.)
 */
export function getDepartmentDirectorLabel(departemen?: string | null, divisi?: string | null): string {
  const mapping = getDepartmentMapping(departemen, divisi);
  if (mapping?.key === "BMES") {
    return "Direktur Property Development";
  }
  const shortName = getDepartmentShortName(departemen, divisi);
  return `Direktur ${shortName}`;
}

