import { getUserCoverageBranches, isBranchAccessible } from './branches';

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HEAD_OFFICE: 'HEAD_OFFICE',
  ADMIN_DC: 'ADMIN_DC',
  DC_DOCUMENT_ADMIN: 'DC_DOCUMENT_ADMIN', // Role khusus dokumen yang direquest user
  DC_ADMIN: 'DC ADMIN',
  BRANCH_BUILDING_KOORDINATOR: 'BRANCH BUILDING KOORDINATOR',
  BRANCH_BUILDING_MANAGER: 'BRANCH BUILDING & MAINTENANCE MANAGER',
  DC_SPECIALIST: 'DC BUILDING & DEVELOPMENT SPECIALIST',
  DC_MANAGER: 'DC BUILDING & DEVELOPMENT MANAGER',
};

export const PERMISSIONS = {
  // Hanya role ini yang boleh menambahkan item custom ("Data Penting Lainnya")
  // DC_DOCUMENT_ADMIN tidak dimasukkan ke sini
  CAN_ADD_CUSTOM_ITEM: [ROLES.SUPER_ADMIN, ROLES.HEAD_OFFICE, ROLES.ADMIN_DC, ROLES.DC_ADMIN],

  // Contoh permission lain untuk ke depannya
  CAN_DELETE_DOCUMENT: [ROLES.SUPER_ADMIN, ROLES.HEAD_OFFICE],

  // Role yang diizinkan untuk mengajukan atau mengelola Penawaran RAB/OE
  CAN_MANAGE_RENOVASI: [
    ROLES.BRANCH_BUILDING_KOORDINATOR,
    ROLES.DC_ADMIN,
    ROLES.SUPER_ADMIN,
    ROLES.HEAD_OFFICE,
    ROLES.ADMIN_DC
  ]
};

/**
 * Cek apakah role user memiliki izin mengajukan renovasi (membuat, mengubah, menghapus draft/pengajuan).
 * Sesuai aturan:
 * - Role "BRANCH BUILDING KOORDINATOR" dan "ADMIN" memiliki hak penuh untuk mengajukan renovasi.
 * - Role selain itu (Manager, DC Document Admin, Specialist, dll.) HANYA BISA READ ONLY.
 */
export const canManageRenovasi = (userRole: string | undefined | null): boolean => {
  if (!userRole) return false;
  const norm = userRole.trim().toUpperCase();

  // 1. Branch Building Koordinator
  if (norm === 'BRANCH BUILDING KOORDINATOR') return true;

  // 2. DC Document Admin khusus dokumen
  if (norm === 'DC DOCUMENT ADMIN' || norm === 'DC_DOCUMENT_ADMIN') return false;

  // 3. Admin (DC ADMIN, SUPER ADMIN, HEAD OFFICE, ADMIN_DC, atau role admin lainnya)
  if (
    norm === 'DC ADMIN' ||
    norm === 'ADMIN_DC' ||
    norm === 'ADMIN' ||
    norm === 'SUPER_ADMIN' ||
    norm === 'SUPER ADMIN' ||
    norm === 'HEAD_OFFICE' ||
    norm === 'HEAD OFFICE' ||
    (norm.includes('ADMIN') && !norm.includes('DOCUMENT'))
  ) {
    return true;
  }

  return false;
};

/**
 * Cek apakah user berada dalam status READ ONLY untuk modul Penawaran RAB/OE.
 */
export const isRenovasiReadOnly = (userRole: string | undefined | null): boolean => {
  return !canManageRenovasi(userRole);
};

/**
 * Memeriksa apakah pembuat (created_by) identik dengan akun user saat ini.
 * Memeriksa kecocokan exact email, username, maupun prefix email (contoh: balic@gmail.com vs balic).
 */
export const isSameCreator = (
  user?: { email?: string | null; username?: string | null; namaLengkap?: string | null } | null,
  createdByRaw?: string | null
): boolean => {
  if (!user || !createdByRaw) return false;
  const createdBy = createdByRaw.trim().toLowerCase();
  const userEmail = (user.email || '').trim().toLowerCase();
  const userUsername = (user.username || '').trim().toLowerCase();
  const userNamaLengkap = (user.namaLengkap || '').trim().toLowerCase();

  if (userEmail && createdBy === userEmail) return true;
  if (userUsername && createdBy === userUsername) return true;
  if (userNamaLengkap && createdBy === userNamaLengkap) return true;

  const emailPrefix = userEmail.includes('@') ? userEmail.split('@')[0] : '';
  const createdByPrefix = createdBy.includes('@') ? createdBy.split('@')[0] : '';

  if (emailPrefix && createdByPrefix && emailPrefix === createdByPrefix) return true;
  if (emailPrefix && createdBy === emailPrefix) return true;
  if (createdByPrefix && (userUsername === createdByPrefix || userNamaLengkap === createdByPrefix)) return true;

  return false;
};

/**
 * Cek apakah role user adalah Branch Building Koordinator.
 */
export const isBranchBuildingKoordinator = (userRole: string | undefined | null): boolean => {
  if (!userRole) return false;
  const norm = userRole.trim().toUpperCase();
  return norm === 'BRANCH BUILDING KOORDINATOR' || norm.includes('BUILDING KOORDINATOR');
};

/**
 * Cek apakah user berhak melihat suatu pengajuan renovasi spesifik:
 * - Branch Building Koordinator: HANYA bisa melihat pengajuan yang dibuat/diajukan oleh dirinya sendiri (created_by === user.email).
 * - Role lain (Admin, B&M Manager, Specialist, DC Manager, dll.): Bisa melihat seluruh pengajuan dalam coverage cabangnya.
 */
export const canUserViewRenovasiSubmission = (
  user?: { role?: string | null; email?: string | null; username?: string | null; namaLengkap?: string | null } | null,
  submission?: { created_by?: string | null; cabang?: string | null; project?: { cabang?: string | null } | null } | null
): boolean => {
  if (!user) return false;
  if (!submission) return true;

  // Jika Branch Building Koordinator: HANYA boleh melihat jika dibuat oleh dirinya sendiri
  if (isBranchBuildingKoordinator(user.role)) {
    if (!submission.created_by) return false;
    return isSameCreator(user, submission.created_by);
  }

  // Role lainnya (Admin, Manager, Specialist, dll.) diizinkan melihat semua dalam coverage
  return true;
};

/**
 * Filter daftar pengajuan renovasi (array di memory) berdasarkan kepemilikan akun.
 * Untuk role Branch Building Koordinator: hanya menyisakan pengajuan yang diajukan oleh akun user tersebut.
 * Untuk role lainnya (Admin, Approver B&M Manager, DC Specialist, dll.): tidak memfilter created_by.
 */
export const filterRenovasiByCreator = <T extends { created_by?: string | null }>(
  list: T[],
  user?: { role?: string | null; email?: string | null; username?: string | null; namaLengkap?: string | null } | null
): T[] => {
  if (!user || !user.role || !Array.isArray(list)) return list;

  if (isBranchBuildingKoordinator(user.role)) {
    return list.filter((item) => isSameCreator(user, item.created_by));
  }

  return list;
};

/**
 * Menghasilkan kondisi klausa WHERE untuk Prisma ORM / database query.
 * Untuk role Branch Building Koordinator: membatasi query dc_renovasi hanya untuk created_by milik user.
 * Untuk role lain: return null (tidak ada pembatasan created_by).
 */
export const getRenovasiUserFilter = (
  user?: { role?: string | null; email?: string | null; username?: string | null; namaLengkap?: string | null } | null
): any | null => {
  if (!user || !user.role) return null;

  if (isBranchBuildingKoordinator(user.role)) {
    const userEmail = (user.email || '').trim();
    const username = (user.username || '').trim();
    const prefix = userEmail.includes('@') ? userEmail.split('@')[0] : '';

    const possibleIdentifiers = Array.from(new Set([userEmail, username, prefix].filter(Boolean)));
    if (possibleIdentifiers.length > 0) {
      if (possibleIdentifiers.length === 1) {
        return {
          created_by: { equals: possibleIdentifiers[0], mode: 'insensitive' }
        };
      }
      return {
        OR: possibleIdentifiers.map((ident) => ({
          created_by: { equals: ident, mode: 'insensitive' }
        }))
      };
    }
  }

  return null;
};

/**
 * Cek apakah user berhak mengedit atau merevisi suatu pengajuan renovasi spesifik:
 * - Admin (DC Admin, Super Admin, dsb.): Selalu bisa mengedit/merevisi semua pengajuan ("kecuali admin bisa semua").
 * - Branch Building Koordinator: HANYA bisa mengedit pengajuan jika diajukan oleh akun yang sama (created_by === user.email || user.username).
 * - Role lain (Manager, Specialist, Dokumen Admin, dll.): Tidak memiliki hak edit (Read-Only).
 * Berlaku untuk status 'DRAFT' dan 'REVISI'.
 */
export const canEditRenovasiSubmission = (
  user?: { role?: string | null; email?: string | null; username?: string | null; namaLengkap?: string | null } | null,
  submission?: { status?: string | null; created_by?: string | null } | null
): boolean => {
  if (!user) return false;

  // Jika pengajuan spesifik diperiksa, cek statusnya (hanya DRAFT dan REVISI yang dapat diedit)
  if (submission && submission.status) {
    const status = submission.status.trim().toUpperCase();
    if (status !== 'DRAFT' && status !== 'REVISI') {
      return false;
    }
  }

  // 1. Admin bisa mengedit semua pengajuan ("kecuali admin bisa semua")
  if (isApprovalAdmin(user.role)) {
    return true;
  }

  const role = (user.role || '').trim().toUpperCase();

  // 2. Branch Building Koordinator: HANYA akun yang sama dengan yang mengajukan
  if (isBranchBuildingKoordinator(role)) {
    if (!submission || !submission.created_by) {
      // Jika pembuatan baru (belum ada data submission sebelumnya)
      return true;
    }
    return isSameCreator(user, submission.created_by);
  }

  return false;
};

/**
 * Fungsi utama untuk mengecek apakah user memiliki hak akses tertentu.
 * @param userRole Role dari user yang sedang login
 * @param action Nama aksi/permission yang ingin dicek
 * @returns boolean
 */
export const hasPermission = (userRole: string | undefined | null, action: keyof typeof PERMISSIONS) => {
  if (!userRole) return false;
  const allowedRoles = PERMISSIONS[action];
  return allowedRoles.includes(userRole.toUpperCase());
};

/**
 * Cek apakah role user adalah Administrator (bisa melihat semua antrean persetujuan).
 */
export const isApprovalAdmin = (userRole: string | undefined | null): boolean => {
  if (!userRole) return false;
  const norm = userRole.trim().toUpperCase();
  return (
    norm === 'DC ADMIN' ||
    norm === 'ADMIN_DC' ||
    norm === 'ADMIN' ||
    norm === 'SUPER_ADMIN' ||
    norm === 'SUPER ADMIN' ||
    norm === 'HEAD_OFFICE' ||
    norm === 'HEAD OFFICE' ||
    (norm.includes('ADMIN') && !norm.includes('DOCUMENT'))
  );
};

/**
 * Cek apakah role user termasuk dalam 3 role khusus Approver RAB / OE Penawaran RAB/OE:
 * 1. BRANCH BUILDING & MAINTENANCE MANAGER (Tier 1)
 * 2. DC BUILDING & DEVELOPMENT SPECIALIST (Tier 2)
 * 3. DC BUILDING & DEVELOPMENT MANAGER (Tier 3)
 */
export const isRabOeApproverRole = (userRole: string | undefined | null): boolean => {
  if (!userRole) return false;
  const norm = userRole.trim().toUpperCase();

  // 1. Branch Building & Maintenance Manager
  if (
    norm === 'BRANCH BUILDING & MAINTENANCE MANAGER' ||
    norm === 'BRANCH BUILDING AND MAINTENANCE MANAGER' ||
    norm === 'B&M MANAGER' ||
    norm.includes('MAINTENANCE MANAGER')
  ) {
    return true;
  }

  // 2. DC Building & Development Specialist / Specialis
  if (
    norm === 'DC BUILDING & DEVELOPMENT SPECIALIST' ||
    norm === 'DC BUILDING & DEVELOPMENT SPECIALIS' ||
    norm === 'DC BUILDING AND DEVELOPMENT SPECIALIST' ||
    norm === 'DC BUILDING AND DEVELOPMENT SPECIALIS' ||
    norm.includes('DEVELOPMENT SPECIALIST') ||
    norm.includes('DEVELOPMENT SPECIALIS') ||
    norm.includes('DC SPECIALIST') ||
    norm.includes('DC SPECIALIS')
  ) {
    return true;
  }

  // 3. DC Building & Development Manager
  if (
    norm === 'DC BUILDING & DEVELOPMENT MANAGER' ||
    norm === 'DC BUILDING AND DEVELOPMENT MANAGER' ||
    norm.includes('DEVELOPMENT MANAGER')
  ) {
    return true;
  }

  return false;
};

/**
 * Cek apakah user berhak mengakses Card RAB/OE maupun transaksi persetujuan RAB/OE.
 * Aturan di folder lib:
 * Khusus untuk 3 role Approver RAB/OE atau Administrator.
 */
export const canAccessRabOeApproval = (userRole: string | undefined | null): boolean => {
  if (!userRole) return false;
  const norm = userRole.trim().toUpperCase();
  return isApprovalAdmin(norm) || isRabOeApproverRole(norm);
};

/**
 * Backward compatibility alias untuk canAccessRabOeApproval.
 */
export const canAccessApproval = (userRole: string | undefined | null): boolean => {
  return canAccessRabOeApproval(userRole);
};

/**
 * Aturan Tambahan Menu Navigasi 'Approval':
 * Mengombinasikan pengaturan hak akses per menu di Manajemen User (akses_menu)
 * dengan aturan role khusus di lib:
 *
 * Menu navigasi 'Approval' HANYA akan ditampilkan jika:
 * 1. User memenuhi aturan role di lib (Branch Building & Maintenance Manager, DC Building & Development Specialist, DC Building & Development Manager, atau Admin).
 * 2. User memiliki izin menu 'approval' atau 'all' di manajemen user (atau jika daftar akses_menu belum diset / approver default).
 */
export const canAccessApprovalNavigation = (
  userRole: string | undefined | null,
  userAksesMenu?: string[] | string | null
): boolean => {
  if (!userRole) return false;

  // Syarat Utama 1: Role harus salah satu dari 3 approver RAB/OE atau Administrator
  const isAllowedRole = canAccessRabOeApproval(userRole);
  if (!isAllowedRole) return false;

  // Syarat Utama 2: Jika user memiliki konfigurasi akses_menu spesifik dari Manajemen User
  if (userAksesMenu) {
    const menus = Array.isArray(userAksesMenu)
      ? userAksesMenu.map((m) => m.trim().toLowerCase())
      : userAksesMenu.split(',').map((m) => m.trim().toLowerCase());

    const hasAll = menus.includes('all');
    const hasApproval = menus.includes('approval');

    // Jika daftar menu terkonfigurasi dan tidak memiliki 'all' maupun 'approval', sembunyikan
    if (menus.length > 0 && !hasAll && !hasApproval) {
      return false;
    }
  }

  return true;
};

/**
 * Mendapatkan status antrean yang menjadi kewajiban dari role pengguna saat ini.
 */
export const getApprovalQueueFilterForRole = (userRole: string | undefined | null): string[] | 'ALL' => {
  if (!userRole) return [];
  const norm = userRole.trim().toUpperCase();

  if (isApprovalAdmin(norm)) {
    return 'ALL';
  }

  if (
    norm === 'BRANCH BUILDING & MAINTENANCE MANAGER' ||
    norm === 'BRANCH BUILDING AND MAINTENANCE MANAGER' ||
    norm === 'B&M MANAGER' ||
    norm.includes('MAINTENANCE MANAGER')
  ) {
    return ['MENUNGGU APPROVAL B&M MANAGER'];
  }

  if (
    norm === 'DC BUILDING & DEVELOPMENT SPECIALIST' ||
    norm === 'DC BUILDING & DEVELOPMENT SPECIALIS' ||
    norm === 'DC BUILDING AND DEVELOPMENT SPECIALIST' ||
    norm === 'DC BUILDING AND DEVELOPMENT SPECIALIS' ||
    norm.includes('DEVELOPMENT SPECIALIST') ||
    norm.includes('DEVELOPMENT SPECIALIS') ||
    norm.includes('DC SPECIALIST') ||
    norm.includes('DC SPECIALIS')
  ) {
    return ['MENUNGGU APPROVAL DC SPECIALIST'];
  }

  if (
    norm === 'DC BUILDING & DEVELOPMENT MANAGER' ||
    norm === 'DC BUILDING AND DEVELOPMENT MANAGER' ||
    norm.includes('DEVELOPMENT MANAGER')
  ) {
    return ['MENUNGGU APPROVAL DC MANAGER'];
  }

  return [];
};

/**
 * Mendapatkan status transisi berikutnya ketika suatu pengajuan disetujui (APPROVE).
 * 3-Tier: B&M Manager -> DC Specialist -> DC Manager -> APPROVED
 */
export const getNextApprovalStatus = (
  currentStatus: string
): { nextStatus: string; label: string } | null => {
  switch (currentStatus) {
    case 'MENUNGGU APPROVAL B&M MANAGER':
      return {
        nextStatus: 'MENUNGGU APPROVAL DC SPECIALIST',
        label: 'Menunggu Approval DC Specialist'
      };
    case 'MENUNGGU APPROVAL DC SPECIALIST':
      return {
        nextStatus: 'MENUNGGU APPROVAL DC MANAGER',
        label: 'Menunggu Approval DC Manager'
      };
    case 'MENUNGGU APPROVAL DC MANAGER':
      return {
        nextStatus: 'APPROVED',
        label: 'Approved (Selesai Disetujui)'
      };
    default:
      return null;
  }
};

/**
  * Cek apakah suatu pengajuan renovasi spesifik dapat diapprove atau direvisi oleh user saat ini:
  * 1. Coverage cabang user harus mencakup cabang dari pengajuan tersebut (atau DC Admin).
  * 2. Administrator memiliki hak approve untuk semua tahapan approval aktif.
  * 3. Approver spesifik (B&M Manager, DC Specialist, DC Manager) memiliki hak approve
  *    jika status pengajuan saat ini sesuai dengan antrean tugasnya.
  */
export const canUserApproveSubmission = (
  user?: { role?: string | null; cabang?: string | null; coverage_cabang?: string | null } | null,
  submission?: { status?: string | null; cabang?: string | null; project?: { cabang?: string | null } | null } | null
): boolean => {
  if (!user || !user.role || !submission || !submission.status) return false;

  const itemBranch = submission.cabang || submission.project?.cabang || "";
  const userCoverage = getUserCoverageBranches(user);

  // 1. Cek coverage cabang akun user
  if (!isBranchAccessible(itemBranch, userCoverage)) {
    return false;
  }

  // 2. Administrator memiliki hak approve untuk semua tahapan approval aktif
  if (isApprovalAdmin(user.role)) {
    return (
      submission.status === "MENUNGGU APPROVAL B&M MANAGER" ||
      submission.status === "MENUNGGU APPROVAL DC SPECIALIST" ||
      submission.status === "MENUNGGU APPROVAL DC MANAGER"
    );
  }

  // 3. Approver spesifik berdasarkan status antrean perannya
  const queueStatus = getApprovalQueueFilterForRole(user.role);
  if (Array.isArray(queueStatus)) {
    return queueStatus.includes(submission.status);
  }

  return false;
};

