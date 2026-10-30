/**
 * Utilitas untuk memetakan status approval pengajuan ke kode tahap alur (Stage Code)
 * dan label resmi pejabat berwenang pada SPARTA DC-Development.
 */

export interface ApprovalStageInfo {
  code: string;
  label: string;
  shortLabel: string;
}

export function getApprovalStageInfo(
  status?: string | null,
  userRole?: string | null
): ApprovalStageInfo {
  const normStatus = (status || "").toUpperCase().trim();
  const normRole = (userRole || "").toUpperCase().trim();

  // 1. Pemetaan berdasarkan Status Persetujuan Aktif (Prioritas Utama)
  if (normStatus.includes("B&M MANAGER") || normStatus.includes("BM MANAGER")) {
    return {
      code: "BM_MGR",
      label: "Branch B&M Manager",
      shortLabel: "B&M Mgr",
    };
  }
  if (normStatus.includes("DC SPECIALIST")) {
    return {
      code: "DC_SPECIALIST",
      label: "DC Building Specialist",
      shortLabel: "DC Specialist",
    };
  }
  if (normStatus.includes("DC MANAGER")) {
    return {
      code: "DC_MGR",
      label: "DC Building Manager",
      shortLabel: "DC Mgr",
    };
  }
  if (normStatus.includes("BM/DBM") || normStatus.includes("BRANCH MANAGER")) {
    return {
      code: "BM_DBM",
      label: "Branch Manager / DBM",
      shortLabel: "BM/DBM",
    };
  }
  if (normStatus.includes("REGIONAL B&M MANAGER")) {
    return {
      code: "REGIONAL_BM",
      label: "Regional B&M Manager",
      shortLabel: "Reg. B&M Mgr",
    };
  }
  if (normStatus.includes("B&M GM")) {
    return {
      code: "BM_GM",
      label: "Building & Maintenance GM",
      shortLabel: "B&M GM",
    };
  }
  if (normStatus.includes("GM DEPT PEMOHON")) {
    return {
      code: "GM_PEMOHON",
      label: "GM Dept. Pemohon",
      shortLabel: "GM Pemohon",
    };
  }
  if (normStatus.includes("DIRECTOR DEPT PEMOHON")) {
    return {
      code: "DIR_PEMOHON",
      label: "Director Dept. Pemohon",
      shortLabel: "Dir. Pemohon",
    };
  }
  if (
    normStatus.includes("PROPERTY & DEV DIRECTOR") ||
    normStatus.includes("PROPERTY DEV") ||
    normStatus.includes("PROPERTY DEV DIRECTOR")
  ) {
    return {
      code: "PROP_DIR",
      label: "Property & Dev. Director",
      shortLabel: "Prop. Director",
    };
  }

  // 2. Fallback jika status pengajuan DRAFT atau REVISI (menggunakan role peninjau)
  if (normRole.includes("SPECIALIST")) {
    return {
      code: "DC_SPECIALIST",
      label: "DC Building Specialist",
      shortLabel: "DC Specialist",
    };
  }
  if (normRole.includes("REGIONAL")) {
    return {
      code: "REGIONAL_BM",
      label: "Regional B&M Manager",
      shortLabel: "Reg. B&M Mgr",
    };
  }
  if (normRole.includes("GM")) {
    return {
      code: "BM_GM",
      label: "Building & Maintenance GM",
      shortLabel: "B&M GM",
    };
  }
  if (normRole.includes("MANAGER") || normRole.includes("BM")) {
    return {
      code: "BM_MGR",
      label: "Branch B&M Manager",
      shortLabel: "B&M Mgr",
    };
  }

  return {
    code: "REVIEWER",
    label: "Reviewer",
    shortLabel: "Reviewer",
  };
}

export function getShortRoleName(userRole?: string | null, stageCode?: string | null): string {
  const normRole = (userRole || "").toUpperCase().trim();
  const normStage = (stageCode || "").toUpperCase().trim();

  if (normStage.includes("BM_MGR") || normRole.includes("BRANCH B&M") || normRole.includes("BRANCH BUILDING")) {
    return "B&M Mgr";
  }
  if (normStage.includes("BM_DBM") || normRole === "BRANCH MANAGER" || normRole.includes("DBM") || normRole.includes("DEPUTI BRANCH")) {
    return "BM/DBM";
  }
  if (normStage.includes("REGIONAL_BM") || normRole.includes("REGIONAL B&M")) {
    return "Reg. B&M Mgr";
  }
  if (normStage.includes("DC_SPECIALIST") || normRole.includes("DC SPECIALIST") || normRole.includes("DC BUILDING & DEV")) {
    return "DC Specialist";
  }
  if (normStage.includes("DC_MGR") || normRole.includes("DC BUILDING MANAGER")) {
    return "DC Mgr";
  }
  if (normStage.includes("BM_GM") || normRole.includes("BUILDING & MAINTENANCE GENERAL") || normRole.includes("B&M GM")) {
    return "B&M GM";
  }
  if (normStage.includes("GM_PEMOHON") || (normRole.includes("GENERAL MANAGER") && !normRole.includes("B&M"))) {
    return "GM Pemohon";
  }
  if (normStage.includes("DIR_PEMOHON") || (normRole.includes("DIRECTOR") && !normRole.includes("PROPERTY"))) {
    return "Dir. Pemohon";
  }
  if (normStage.includes("PROP_DIR") || normRole.includes("PROPERTY & DEV") || normRole.includes("PROPERTY")) {
    return "Prop. Director";
  }
  if (userRole) {
    return userRole
      .replace(/BRANCH /i, "")
      .replace(/BUILDING & MAINTENANCE/i, "B&M")
      .replace(/MANAGER/i, "Mgr")
      .replace(/GENERAL/i, "Gen")
      .trim();
  }
  return "Reviewer";
}

