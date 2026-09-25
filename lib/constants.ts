// =============================================================================
// lib/constants.ts
// Konstanta global: URL API, konfigurasi menu, role, dan kategori pekerjaan.
// =============================================================================

import {
    FileText, FileSignature, Users, CheckSquare,
    Camera, FilePlus, FolderArchive, BarChartHorizontal,
    AlertTriangle, ClipboardCheck,
    FileStack, ClipboardList, FileEdit, Upload, Building2,
    ShieldAlert, SlidersHorizontal, CalendarClock, Download,
} from "lucide-react";

// -----------------------------------------------------------------------------
// BASE URL API
// -----------------------------------------------------------------------------

/** Server utama (Sparta Backend) */
export const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "https://api-building.sparta-alfamart.web.id";

// -----------------------------------------------------------------------------
// KONFIGURASI MENU APLIKASI
// Setiap menu memiliki id unik yang digunakan di ROLE_CONFIG untuk access control.
// -----------------------------------------------------------------------------

export const ALL_MENUS = [
    {
        id: "menu-dc-development",
        title: "DC Development",
        desc: "Tender, monitoring, termin, dan BAST DC.",
        href: "/dc-development",
        icon: Building2,
    },
    {
        id: "menu-rab",
        title: "Penawaran Final Kontraktor",
        desc: "Buat penawaran final.",
        href: "/rab",
        icon: FileText,
    },
    {
        id: "menu-ubah-rab-item",
        title: "Ubah RAB Item",
        desc: "Ubah item RAB dan replace via CSV.",
        href: "/ubah-rab-item",
        icon: FileEdit,
    },
    {
        id: "menu-migrasi-rab",
        title: "Migrasi RAB",
        desc: "Upload Excel dan pilih RAB untuk migrasi.",
        href: "/rab/migrasi",
        icon: Upload,
    },
    {
        id: "menu-spk",
        title: "Surat Perintah Kerja",
        desc: "Form surat perintah kerja untuk kontraktor.",
        href: "/spk",
        icon: FileSignature,
    },
    {
        id: "menu-migrasi-spk",
        title: "Migrasi SPK",
        desc: "Upload DATA FORM dan pilih SPK untuk migrasi.",
        href: "/spk/migrasi",
        icon: Upload,
    },
    {
        id: "menu-inputpic",
        title: "PIC Pengawasan",
        desc: "Form input PIC pengawasan pekerjaan proyek.",
        href: "/inputpic",
        icon: Users,
    },
    {
        id: "menu-opname",
        title: "Opname",
        desc: "Form opname proyek toko.",
        href: "/opname",
        icon: CheckSquare,
    },
    {
        id: "menu-dokumentasi",
        title: "Dokumentasi Bangunan Toko Baru",
        desc: "Form dokumentasi foto bangunan.",
        href: "/ftdokumen",
        icon: Camera,
    },
    {
        id: "menu-tambahspk",
        title: "Tambah Surat Perintah Kerja",
        desc: "Form pertambahan hari surat perintah kerja.",
        href: "/tambahspk",
        icon: FilePlus,
    },
    {
        id: "menu-migrasi-tambahspk",
        title: "Migrasi Pertambahan SPK",
        desc: "Upload DATA FORM dan migrasikan riwayat pertambahan SPK.",
        href: "/tambahspk/migrasi",
        icon: Upload,
    },
    {
        id: "menu-svdokumen",
        title: "Penyimpanan Dokumen Toko",
        desc: "Form penyimpanan dokumen.",
        href: "/svdokumen",
        icon: FolderArchive,
    },
    {
        id: "menu-migrasi-dokumen",
        title: "Migrasi Dokumen",
        desc: "Upload Excel penyimpanan dokumen.",
        href: "/svdokumen/migrasi",
        icon: Upload,
    },
    {
        id: "menu-gantt",
        title: "Gantt Chart",
        desc: "Progress pekerjaan toko.",
        href: "/gantt",
        icon: BarChartHorizontal,
    },
    {
        id: "menu-migrasi-gantt",
        title: "Migrasi Gantt Chart",
        desc: "Upload Excel Gantt Chart.",
        href: "/gantt/migrasi",
        icon: Upload,
    },
    {
        id: "menu-migrasi-pengawasan",
        title: "Migrasi Pengawasan",
        desc: "Upload Excel pengawasan dan pilih data yang diproses.",
        href: "/pengawasan/migrasi",
        icon: Upload,
    },
    {
        id: "menu-migrasi-opname-final",
        title: "Migrasi Opname",
        desc: "Migrasi Opname Parsial dan Final/KTK.",
        href: "/opname/migrasi",
        icon: Upload,
    },
    {
        id: "menu-migrasi-il",
        title: "Migrasi Instruksi Lapangan",
        desc: "Upload data dan migrasikan riwayat Instruksi Lapangan.",
        href: "/instruksi-lapangan/migrasi",
        icon: Upload,
    },
    {
        id: "menu-migrasi-serah-terima",
        title: "Migrasi Serah Terima",
        desc: "Upload data dan migrasikan riwayat Serah Terima.",
        href: "/serah-terima/migrasi",
        icon: Upload,
    },
    {
        id: "menu-sp",
        title: "Surat Peringatan",
        desc: "Pengajuan dan approval Surat Peringatan.",
        href: "/surat-peringatan",
        icon: AlertTriangle,
    },

    {
        id: "menu-approval",
        title: "Approval Dokumen",
        desc: "Persetujuan RAB, SPK, IL, dan Pertambahan SPK.",
        href: "/approval",
        icon: ClipboardCheck,
    },
    {
        id: "menu-tarikan-data",
        title: "Download Data",
        desc: "Pilih periode, cabang, status SPK, dan jenis data untuk export.",
        href: "/tarikan-data",
        icon: Download,
    },
    {
        id: "menu-daftardokumen",
        title: "Daftar Dokumen",
        desc: "Lihat daftar dokumen RAB, SPK, dan lainnya.",
        href: "/list",
        icon: FileStack,
    },
    {
        id: "menu-request-intervensi",
        title: "Request Intervensi",
        desc: "Ajukan intervensi dokumen untuk approval bertingkat.",
        href: "/request-intervensi",
        icon: ShieldAlert,
    },
    {
        id: "menu-intervensi",
        title: "Intervensi",
        desc: "Pusat perubahan status khusus Super Human.",
        href: "/intervensi",
        icon: ShieldAlert,
    },
    {
        id: "menu-il",
        title: "Instruksi Lapangan",
        desc: "Form Instruksi Lapangan.",
        href: "/instruksi-lapangan",
        icon: FileText,
    },
    {
        id: "menu-users",
        title: "Manajemen User",
        desc: "Kelola data PIC dan akses aplikasi setiap cabang.",
        href: "/users",
        icon: Users,
    },
    {
        id: "menu-system-maintenance",
        title: "Pemeliharaan Sistem",
        desc: "Aktifkan atau nonaktifkan pembatasan akses aplikasi.",
        href: "/system-maintenance",
        icon: SlidersHorizontal,
    },
    {
        id: "menu-spk-backdate-policy",
        title: "Policy Backdate SPK",
        desc: "Atur cabang yang boleh memilih tanggal mulai SPK lampau.",
        href: "/spk/backdate",
        icon: CalendarClock,
    },
    {
        id: "menu-serah-terima-date-correction",
        title: "Tanggal Serah Terima",
        desc: "Koreksi tanggal Serah Terima dan sinkronkan dokumen terkait.",
        href: "/serah-terima/koreksi-tanggal",
        icon: CalendarClock,
    },
    {
        id: "menu-projek-planning",
        title: "Project Planning",
        desc: "Form Permintaan Desain (FPD) dan approval project planning.",
        href: "/projek-planning",
        icon: ClipboardList,
    },
];

// -----------------------------------------------------------------------------
// KONFIGURASI AKSES MENU PER ROLE
// Setiap role hanya dapat mengakses menu yang id-nya terdaftar di bawah ini.
// -----------------------------------------------------------------------------

export const ROLE_CONFIG: Record<string, string[]> = {
    "HEAD OFFICE": [
        "menu-rab", "menu-spk", "menu-inputpic", "menu-opname",
        "menu-dokumentasi", "menu-tambahspk", "menu-svdokumen",
        "menu-gantt", "menu-sp", "menu-approval", "menu-daftardokumen",
        "menu-tarikan-data",
    ],

    "BRANCH MANAGER": [
        "menu-approval", "menu-daftardokumen", "menu-tarikan-data",
    ],

    "BRANCH BUILDING & MAINTENANCE MANAGER": [
        "menu-spk", "menu-opname", "menu-tambahspk",
        "menu-gantt", "menu-sp", "menu-dokumentasi", "menu-svdokumen",
        "menu-approval", "menu-daftardokumen", "menu-tarikan-data", "menu-projek-planning",
    ],

    "BRANCH BUILDING COORDINATOR": [
        "menu-dokumentasi", "menu-svdokumen", "menu-gantt",
        "menu-opname", "menu-sp", "menu-approval", "menu-daftardokumen", "menu-inputpic",
        "menu-request-intervensi", "menu-projek-planning", "menu-tarikan-data",
    ],

    "BRANCH BUILDING SUPPORT": [
        "menu-dokumentasi", "menu-opname", "menu-gantt",
        "menu-svdokumen", "menu-daftardokumen", "menu-il", "menu-tarikan-data",
    ],

    "DIREKTUR KONTRAKTOR": [
        "menu-approval", "menu-daftardokumen",
    ],

    "DIREKTUR": [
        "menu-approval", "menu-daftardokumen", "menu-tarikan-data",
    ],

    "KONTRAKTOR": [
        "menu-rab", "menu-opname", "menu-gantt", "menu-daftardokumen", "menu-sp",
    ],

    "KONSULTAN SOIL INVESTIGATION": [
        "menu-dc-development", "menu-approval", "menu-daftardokumen", "menu-tarikan-data",
    ],

    "KONSULTAN PERENCANA": [
        "menu-dc-development", "menu-approval", "menu-daftardokumen", "menu-tarikan-data",
    ],

    "KONSULTAN PENGAWAS DC": [
        "menu-dc-development", "menu-approval", "menu-daftardokumen", "menu-tarikan-data",
    ],

    "KONTRAKTOR DC": [
        "menu-dc-development", "menu-approval", "menu-daftardokumen",
    ],

    "DC DOCUMENT ADMIN": [
        "menu-dc-development",
    ],

    "DC BUILDING & DEVELOPMENT SPECIALIST": [
        "menu-dc-development", "menu-approval", "menu-daftardokumen", "menu-tarikan-data",
    ],

    "DC BUILDING & DEVELOPMENT MANAGER": [
        "menu-dc-development", "menu-approval", "menu-daftardokumen", "menu-tarikan-data",
    ],

    "BUILDING & DEVELOPMENT GENERAL MANAGER": [
        "menu-dc-development", "menu-approval", "menu-daftardokumen", "menu-tarikan-data",
    ],

    "LOCATION & DEVELOPMENT GENERAL MANAGER": [
        "menu-dc-development", "menu-approval", "menu-daftardokumen", "menu-tarikan-data",
    ],

    "PROPERTY DEVELOPMENT DIRECTOR": [
        "menu-dc-development", "menu-approval", "menu-daftardokumen", "menu-tarikan-data",
    ],

    "PROJECT PLANNING & DEVELOPMENT SPECIALIST": [
        "menu-approval", "menu-daftardokumen", "menu-tarikan-data", "menu-projek-planning",
    ],

    "PROJECT PLANNING & DEVELOPMENT MANAGER": [
        "menu-approval", "menu-daftardokumen", "menu-tarikan-data", "menu-projek-planning",
    ],

    "BUILDING & MAINTENANCE REGIONAL MANAGER": [
        "menu-approval", "menu-daftardokumen", "menu-gantt", "menu-users", "menu-tarikan-data", "menu-projek-planning",
    ],

    "BUILDING MAINTENANCE & ENERGY SYSTEM MANAGER": [
        "menu-approval", "menu-daftardokumen", "menu-gantt", "menu-users", "menu-tarikan-data",
    ],

    "BUILDING & MAINTENANCE GENERAL MANAGER": [
        "menu-approval", "menu-daftardokumen", "menu-gantt", "menu-users", "menu-tarikan-data",
    ],

    "STORE & BRANCH CONTROLLING SPECIALIST": [
        "menu-approval", "menu-daftardokumen", "menu-gantt", "menu-users", "menu-tarikan-data",
        "menu-intervensi", "menu-serah-terima-date-correction",
    ],

    "BUILDING & MAINTENANCE SUPER HUMAN": [
        "menu-dc-development",
        "menu-rab", "menu-ubah-rab-item", "menu-spk", "menu-inputpic", "menu-opname",
        "menu-dokumentasi", "menu-tambahspk", "menu-svdokumen",
        "menu-gantt", "menu-sp", "menu-approval", "menu-daftardokumen",
        "menu-intervensi", "menu-il", "menu-users", "menu-system-maintenance", "menu-spk-backdate-policy", "menu-serah-terima-date-correction",
        "menu-migrasi-rab", "menu-migrasi-spk", "menu-migrasi-tambahspk",
        "menu-migrasi-gantt", "menu-migrasi-pengawasan", "menu-migrasi-opname-final",
        "menu-migrasi-dokumen", "menu-migrasi-il", "menu-migrasi-serah-terima", "menu-tarikan-data",
    ],
};
export const canOpenProjectPlanningMenu = (role?: string | string[] | null): boolean =>
    normalizeRoles(role).some((item) => item.includes("BRANCH BUILDING COORDINATOR") || item.includes("KOORDINATOR") || item.includes("BRANCH BUILDING & MAINTENANCE MANAGER") || item.includes("MAINTENANCE MANAGER") || item.includes("BBMM") || item.includes("BUILDING & MAINTENANCE REGIONAL MANAGER") || item.includes("REGIONAL MANAGER") || item.includes("PROJECT PLANNING & DEVELOPMENT SPECIALIST") || item.includes("PP SPECIALIST") || item.includes("PROJECT PLANNING & DEVELOPMENT MANAGER") || item.includes("PP MANAGER") || item.includes("SUPER HUMAN"));
export const canAccessProjectPlanningByCabang = (
    cabang?: string | null,
    role?: string | string[] | null
): boolean => {
    if (String(cabang ?? "").trim().toUpperCase() === "HEAD OFFICE") return true;

    const roles = Array.isArray(role)
        ? role
        : String(role ?? "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

    return roles
        .map((item) => item.toUpperCase())
        .some((item) =>
            item.includes("BRANCH BUILDING COORDINATOR") ||
            item.includes("KOORDINATOR") ||
            item.includes("BRANCH BUILDING & MAINTENANCE MANAGER") ||
            item.includes("MAINTENANCE MANAGER") ||
            item.includes("BBMM") ||
            item.includes("BUILDING & MAINTENANCE REGIONAL MANAGER") ||
            item.includes("REGIONAL MANAGER") ||
            item.includes("PROJECT PLANNING & DEVELOPMENT SPECIALIST") ||
            item.includes("PP SPECIALIST") ||
            item.includes("PROJECT PLANNING & DEVELOPMENT MANAGER") ||
            item.includes("PP MANAGER") ||
            item.includes("SUPER HUMAN")
        );
};

export const REGIONAL_MANAGER_ROLE = "BUILDING & MAINTENANCE REGIONAL MANAGER";
export const ENERGY_SYSTEM_MANAGER_ROLE = "BUILDING MAINTENANCE & ENERGY SYSTEM MANAGER";
export const GENERAL_MANAGER_ROLE = "BUILDING & MAINTENANCE GENERAL MANAGER";
export const STORE_BRANCH_CONTROLLING_ROLE = "STORE & BRANCH CONTROLLING SPECIALIST";
export const SUPER_HUMAN_ROLE = "BUILDING & MAINTENANCE SUPER HUMAN";
export const DIRECTOR_CONTRACTOR_ROLE = "DIREKTUR KONTRAKTOR";

export const DC_SOIL_CONSULTANT_ROLE = "KONSULTAN SOIL INVESTIGATION";
export const DC_PLANNER_CONSULTANT_ROLE = "KONSULTAN PERENCANA";
export const DC_SUPERVISOR_MK_ROLE = "KONSULTAN PENGAWAS DC";
export const DC_CONTRACTOR_ROLE = "KONTRAKTOR DC";
export const DC_DOCUMENT_ADMIN_ROLE = "DC DOCUMENT ADMIN";
export const DC_BUILDING_DEVELOPMENT_MANAGER_ROLE = "DC BUILDING & DEVELOPMENT MANAGER";
export const DC_BUILDING_DEVELOPMENT_SPECIALIST_ROLE = "DC BUILDING & DEVELOPMENT SPECIALIST";
export const BUILDING_DEVELOPMENT_GM_ROLE = "BUILDING & DEVELOPMENT GENERAL MANAGER";
export const LOCATION_DEVELOPMENT_GM_ROLE = "LOCATION & DEVELOPMENT GENERAL MANAGER";
export const PROPERTY_DEVELOPMENT_DIRECTOR_ROLE = "PROPERTY DEVELOPMENT DIRECTOR";

export const DC_DEVELOPMENT_ROLES = [
    DC_SOIL_CONSULTANT_ROLE,
    DC_PLANNER_CONSULTANT_ROLE,
    DC_SUPERVISOR_MK_ROLE,
    DC_CONTRACTOR_ROLE,
    DC_DOCUMENT_ADMIN_ROLE,
    DC_BUILDING_DEVELOPMENT_MANAGER_ROLE,
    DC_BUILDING_DEVELOPMENT_SPECIALIST_ROLE,
    BUILDING_DEVELOPMENT_GM_ROLE,
    LOCATION_DEVELOPMENT_GM_ROLE,
    PROPERTY_DEVELOPMENT_DIRECTOR_ROLE,
    SUPER_HUMAN_ROLE,
] as const;

export const SHARED_WORKSPACE_MENU_IDS = [
    "menu-approval",
    "menu-daftardokumen",
] as const;

export const GLOBAL_VIEW_ONLY_ROLES = [
    REGIONAL_MANAGER_ROLE,
    ENERGY_SYSTEM_MANAGER_ROLE,
    GENERAL_MANAGER_ROLE,
    STORE_BRANCH_CONTROLLING_ROLE,
];

export const normalizeRoles = (role: string | string[] | undefined | null): string[] => {
    const roles = Array.isArray(role) ? role : String(role ?? "").split(",");
    return roles.map(r => {
        const normalized = r.trim().toUpperCase();
        return normalized === "DIREKTUR" ? DIRECTOR_CONTRACTOR_ROLE : normalized;
    }).filter(Boolean);
};

export const hasRegionalManagerRole = (role: string | string[] | undefined | null): boolean =>
    normalizeRoles(role).some(r => GLOBAL_VIEW_ONLY_ROLES.includes(r));

export const hasSuperHumanRole = (role: string | string[] | undefined | null): boolean =>
    normalizeRoles(role).some(r => r === SUPER_HUMAN_ROLE);

export const hasDcDevelopmentRole = (role: string | string[] | undefined | null): boolean =>
    normalizeRoles(role).some(r =>
        DC_DEVELOPMENT_ROLES.includes(r as typeof DC_DEVELOPMENT_ROLES[number])
        || r.includes("DC")
        || r.includes("KONSULTAN SOIL")
        || r.includes("KONSULTAN PERENCANA")
        || r.includes("KONSULTAN PENGAWAS")
        || r.includes("BUILDING & DEVELOPMENT")
        || r.includes("LOCATION & DEVELOPMENT")
        || r.includes("PROPERTY DEVELOPMENT")
    );

export const hasStoreWorkspaceRole = (role: string | string[] | undefined | null): boolean =>
    normalizeRoles(role).some(r => {
        if (r === SUPER_HUMAN_ROLE) return true;
        if (DC_DEVELOPMENT_ROLES.includes(r as typeof DC_DEVELOPMENT_ROLES[number])) return false;
        return Boolean(ROLE_CONFIG[r]);
    });

export const canViewAllBranches = (
    role: string | string[] | undefined | null,
    isSuperHuman = false
): boolean => isSuperHuman || hasRegionalManagerRole(role) || normalizeRoles(role).includes("HEAD OFFICE");

export const canApproveAllBranches = (
    _role: string | string[] | undefined | null,
    isSuperHuman = false
): boolean => isSuperHuman;

export const isViewOnlyUser = (
    role: string | string[] | undefined | null,
    isSuperHuman = false
): boolean => hasRegionalManagerRole(role) && !isSuperHuman;

/**
 * Hanya BRANCH BUILDING SUPPORT (dan SuperHuman) yang dapat menginput
 * pengawasan pada Gantt Chart. BRANCH BUILDING & MAINTENANCE MANAGER dan
 * BRANCH BUILDING COORDINATOR bersifat read-only untuk pengawasan.
 */
export const canInputPengawasan = (
    role: string | string[] | undefined | null,
    isSuperHuman = false
): boolean => {
    if (isSuperHuman) return true;
    const roles = normalizeRoles(role);
    return roles.includes('BRANCH BUILDING SUPPORT');
};

// -----------------------------------------------------------------------------
// KATEGORI PEKERJAAN
// Digunakan untuk validasi dan tampilan form RAB / Opname.
// -----------------------------------------------------------------------------

/** Kategori pekerjaan lingkup SIPIL */
export const SIPIL_CATEGORIES = [
    "PEKERJAAN PERSIAPAN",
    "PEKERJAAN BOBOKAN / BONGKARAN",
    "PEKERJAAN TANAH",
    "PEKERJAAN PONDASI & BETON",
    "PEKERJAAN PASANGAN",
    "PEKERJAAN BESI",
    "PEKERJAAN KERAMIK",
    "PEKERJAAN PLUMBING",
    "PEKERJAAN SANITARY & ACECORIES",
    "PEKERJAAN JANITOR",
    "PEKERJAAN ATAP",
    "PEKERJAAN KUSEN, PINTU & KACA",
    "PEKERJAAN FINISHING",
    "PEKERJAAN BEANSPOT",
    "PEKERJAAN AREA TERBUKA",
    "PEKERJAAN LIFT BARANG",
    "PEKERJAAN TAMBAHAN",
    "PEKERJAAN SBO",
];

/** Kategori pekerjaan lingkup ME (Mekanikal & Elektrikal) */
export const ME_CATEGORIES = [
    "INSTALASI",
    "FIXTURE",
    "PEKERJAAN TAMBAHAN",
    "PEKERJAAN SBO",
];

// -----------------------------------------------------------------------------
// MAPPING CABANG
// -----------------------------------------------------------------------------

/**
 * Pengelompokan cabang â€” beberapa cabang kecil berada di bawah satu cabang induk.
 * Digunakan untuk filter dan tampilan dashboard.
 */
export const BRANCH_GROUPS: Record<string, string[]> = {
    "BANDUNG RAYA": ["BANDUNG RAYA", "BANDUNG", "BANDUNG 1", "BANDUNG 2"],
    LOMBOK: ["LOMBOK", "SUMBAWA"],
    CILEUNGSI: ["CILEUNGSI", "BOGOR", "BEKASI", "KARAWANG"],
    CIKOKOL: ["CIKOKOL", "PARUNG", "BALARAJA", "SERANG", "BINTAN"], // BINTAN masuk Cikokol group
    MEDAN: ["MEDAN", "ACEH"],
    LAMPUNG: ["LAMPUNG", "KOTABUMI"],
    PALEMBANG: ["PALEMBANG", "BENGKULU", "BANGKA", "BELITUNG"],
    SIDOARJO: ["SIDOARJO", "SIDOARJO BPN SMD", "MANOKWARI", "NTT", "SORONG"], // FIX: spasi bukan underscore
    BANJARMASIN: ["BANJARMASIN", "PALANGKARAYA"],
};

export const normalizeBranchValue = (branch?: string | null): string =>
    String(branch ?? "").trim().replace(/_+/g, " ").replace(/\s+/g, " ").toUpperCase();

export const isBranchSupportRole = (role: string | string[] | undefined | null): boolean =>
    normalizeRoles(role).some(r => r.includes("BRANCH BUILDING SUPPORT"));

export const getSessionBranchCoverage = (): string[] => {
    if (typeof window === "undefined") return [];
    const raw = sessionStorage.getItem("branchCoverage");
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map(item => normalizeBranchValue(String(item)))
            .filter(Boolean);
    } catch {
        return [];
    }
};

export const getBranchGroupForBranch = (branch?: string | null): { name: string; branches: string[] } | null => {
    const upper = normalizeBranchValue(branch);
    if (!upper) return null;
    const entry = Object.entries(BRANCH_GROUPS).find(([, group]) =>
        group.map(normalizeBranchValue).includes(upper)
    );
    return entry ? { name: entry[0], branches: entry[1].map(normalizeBranchValue) } : null;
};

export const getParentBranch = (branch?: string | null): string => {
    const group = getBranchGroupForBranch(branch);
    return group ? group.name : normalizeBranchValue(branch);
};

export const getRabPriceBranch = (branch?: string | null): string => {
    const normalized = normalizeBranchValue(branch);
    if (!normalized) return "";

    if ((BRANCH_GROUPS.CIKOKOL || []).map(normalizeBranchValue).includes(normalized)) return "CIKOKOL";
    if ((BRANCH_GROUPS.CILEUNGSI || []).map(normalizeBranchValue).includes(normalized)) return "CILEUNGSI";

    return normalized;
};

export const SUPPORTED_PRICE_BRANCHES = [
    "ACEH", "BALARAJA", "BALI", "BANDUNG RAYA", "BANGKA", "BANJARMASIN",
    "BATAM", "BEKASI", "BELITUNG", "BENGKULU", "BOGOR", "CIANJUR",
    "CIKOKOL", "BINTAN", "CILACAP", "CILEUNGSI", "GORONTALO", "JAMBI",
    "JEMBER", "KARAWANG", "KLATEN", "KOTABUMI", "LAMPUNG", "LOMBOK",
    "LUWU", "MADIUN", "MAKASSAR", "MALANG", "MANADO", "MANOKWARI",
    "MEDAN", "NTT", "PALANGKARAYA", "PALEMBANG", "PARUNG", "PEKANBARU", "PLUMBON",
    "PONTIANAK", "REMBANG", "SEMARANG", "SERANG", "SIDOARJO",
    "SIDOARJO BPN SMD", "SORONG", "SUMBAWA", "TEGAL", "HEAD OFFICE"
];

/**
 * Expand a parent branch name to all sub-branches.
 * E.g. "CIKOKOL" → ["CIKOKOL", "PARUNG", "BALARAJA", "SERANG", "BINTAN"]
 * If the name is not a group key, returns just the input branch.
 */
export const getSubBranchesForParent = (parentBranch?: string | null): string[] => {
    const upper = normalizeBranchValue(parentBranch);
    if (!upper) return [];
    const group = BRANCH_GROUPS[upper as keyof typeof BRANCH_GROUPS];
    if (group) return group.map(normalizeBranchValue);
    return [upper];
};


export const getAccessibleBranchesForUser = (
    role: string | string[] | undefined | null,
    cabang?: string | null,
    coverage: string[] = []
): string[] => {
    const upperCabang = normalizeBranchValue(cabang);
    const normalizedCoverage = Array.from(new Set(coverage.map(normalizeBranchValue).filter(Boolean)));

    if (isBranchSupportRole(role)) {
        const group = getBranchGroupForBranch(upperCabang);
        if (group) {
            return [...group.branches];
        }
    }

    if (normalizedCoverage.length > 0) return normalizedCoverage;

    const group = getBranchGroupForBranch(upperCabang);
    if (group && group.name !== "CIKOKOL" && group.name !== "CILEUNGSI") {
        return [...group.branches];
    }

    return upperCabang ? [upperCabang] : [];
};

export const canAccessBranchForUser = (
    branch: string | undefined | null,
    role: string | string[] | undefined | null,
    cabang?: string | null,
    coverage: string[] = []
): boolean => {
    const normalizedBranch = normalizeBranchValue(branch);
    if (!normalizedBranch || normalizedBranch === "-") return true;
    return getAccessibleBranchesForUser(role, cabang, coverage).includes(normalizedBranch);
};

/**
 * Mapping nama cabang ke kode ULOK-nya.
 * Digunakan untuk keperluan API yang membutuhkan kode ULOK cabang.
 */

export const BRANCHES_WITH_COORDINATOR_BM_APPROVAL = ["BATAM"] as const;

export const canCoordinatorApproveBmForBranch = (branch?: string | null): boolean =>
    BRANCHES_WITH_COORDINATOR_BM_APPROVAL.includes(normalizeBranchValue(branch) as typeof BRANCHES_WITH_COORDINATOR_BM_APPROVAL[number]);
export const BRANCH_TO_ULOK: Record<string, string> = {
    "LUWU": "2VZ1",
    "KARAWANG": "1JZ1",
    "REMBANG": "2AZ1",
    "BANJARMASIN": "1GZ1",
    "PARUNG": "1MZ1",
    "TEGAL": "2PZ1",
    "GORONTALO": "2SZ1",
    "PONTIANAK": "1PZ1",
    "LOMBOK": "1SZ1",
    "SUMBAWA": "1SZ1",
    "KOTABUMI": "LZ01",
    "SERANG": "2GZ1",
    "CIANJUR": "2JZ1",
    "BALARAJA": "TZ01",
    "SIDOARJO": "UZ01",
    "SIDOARJO BPN SMD": "UZ01",
    "MANOKWARI": "UZ01",
    "NTT": "UZ01",
    "SORONG": "UZ01",
    "MEDAN": "WZ01",
    "ACEH": "WZ01",
    "BOGOR": "XZ01",
    "JEMBER": "YZ01",
    "BALI": "QZ01",
    "PALEMBANG": "PZ01",
    "BENGKULU": "PZ01",
    "BANGKA": "PZ01",
    "BELITUNG": "PZ01",
    "KLATEN": "OZ01",
    "MAKASSAR": "RZ01",
    "PLUMBON": "VZ01",
    "PEKANBARU": "1AZ1",
    "JAMBI": "1DZ1",
    "HEAD OFFICE": "Z001",
    "BANDUNG RAYA": "BZ01",
    "BEKASI": "CZ01",
    "CILACAP": "IZ01",
    "CILEUNGSI": "JZ01",
    "SEMARANG": "HZ01",
    "CIKOKOL": "KZ01",
    "LAMPUNG": "LZ01",
    "MALANG": "MZ01",
    "MANADO": "1YZ1",
    "BATAM": "2DZ1",
    "MADIUN": "2MZ1",
    "BINTAN": "KZ01",
    "PALANGKARAYA": "1GZ1",
};

// -----------------------------------------------------------------------------
// HELPER PERAN PROJECT PLANNING
// -----------------------------------------------------------------------------

export const getPpRoles = (userRole: string | string[], email: string) => {
    const roles = Array.isArray(userRole) ? userRole : [userRole];
    const upperRoles = roles.map(r => r.toUpperCase());

    const isCoor = upperRoles.some(r => r.includes("COORDINATOR") || r.includes("KOORDINATOR"));
    const isBM = upperRoles.some(r =>
        r.includes("BRANCH BUILDING & MAINTENANCE MANAGER") ||
        r.includes("MAINTENANCE MANAGER") ||
        r.includes("BRANCH MANAGER") ||
        r.includes("BBMM") ||
        r.includes("BM ")
    );
    const isBMRegional = upperRoles.some(r =>
        r.includes("BUILDING & MAINTENANCE REGIONAL MANAGER") ||
        r.includes("B&M REGIONAL") ||
        r.includes("REGIONAL MANAGER")
    );
    const isPPMgr = upperRoles.some(r => r.includes("PROJECT PLANNING & DEVELOPMENT MANAGER") || r.includes("PROJECT PLANNING MANAGER") || r.includes("PP MANAGER")) || email === "wildan.pp.manager@gmail.com";
    const isPP = upperRoles.some(r => (r.includes("PROJECT PLANNING & DEVELOPMENT SPECIALIST") || r.includes("PP SPECIALIST") || (r.includes("PROJECT PLANNING") && !r.includes("MANAGER")))) || email === "wildan.pp@gmail.com";

    return { isCoor, isBM, isBMRegional, isPP, isPPMgr };
};
