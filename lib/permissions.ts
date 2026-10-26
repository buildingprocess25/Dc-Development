import { getUserCoverageBranches, isBranchAccessible } from './branches';
import {
  isUserGmForDepartment,
  isUserDirectorForDepartment,
  isAnyDepartmentGmRole,
  isAnyDepartmentDirectorRole,
} from './department-roles';

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
  BRANCH_MANAGER: 'BRANCH MANAGER',
  DEPUTI_BRANCH_MANAGER: 'DEPUTI BRANCH MANAGER',
  BRANCH_BUILDING_REGIONAL_MANAGER: 'BRANCH BUILDING & MAINTENANCE REGIONAL MANAGER',
  BUILDING_MAINTENANCE_GM: 'BUILDING & MAINTENANCE GENERAL MANAGER',
  GM_DEPT_PEMOHON: 'GM DEPT PEMOHON',
  DIRECTOR_DEPT_PEMOHON: 'DIRECTOR DEPT PEMOHON',
  PROPERTY_DEV_DIRECTOR: 'PROPERTY & DEVELOPMENT DIRECTOR',
  OPERATION_DIRECTOR: 'OPERATION DIRECTOR',
  PROPERTY_DEV_MANAGER: 'PROPERTY DEVELOPMENT MANAGER',
  KONTRAKTOR: 'KONTRAKTOR',
  KONSULTAN: 'KONSULTAN',
  KONSULTAN_PENGAWAS: 'KONSULTAN PENGAWAS',
  KONSULTAN_PERENCANA: 'KONSULTAN PERENCANA',
};

/**
 * Memeriksa apakah role user merupakan rekanan eksternal (Kontraktor, Konsultan Pengawas, Konsultan Perencana, Vendor, atau Rekanan lain).
 * Rekanan eksternal tidak memiliki akun SAT Alfamart (@alfamart.co.id) sehingga seluruh akses unduh dokumen
 * (seperti PDF Undangan Aanwijzing) harus dilayani melalui proxy streaming SPARTA, bukan tautan mentah Google Drive.
 */
export const isExternalPartnerRole = (userRole: string | undefined | null): boolean => {
  if (!userRole) return false;
  const norm = userRole.trim().toUpperCase();
  return (
    norm.includes('KONTRAKTOR') ||
    norm.includes('KONSULTAN') ||
    norm.includes('VENDOR') ||
    norm.includes('REKANAN')
  );
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
  user?: { email?: string | null; username?: string | null; namaLengkap?: string | null; nama?: string | null } | null,
  createdByRaw?: string | null
): boolean => {
  if (!user || !createdByRaw) return false;
  const createdBy = createdByRaw.trim().toLowerCase();
  const userEmail = (user.email || '').trim().toLowerCase();
  const userUsername = (user.username || '').trim().toLowerCase();
  const userNamaLengkap = (user.namaLengkap || user.nama || '').trim().toLowerCase();

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
 * Cek apakah seorang user berhak melihat dokumen pengajuan Penawaran RAB/OE spesifik:
 * 1. Coverage cabang wajib sesuai (kecuali Admin/HO).
 * 2. Admin dapat melihat seluruh pengajuan.
 * 3. Status DRAFT: HANYA Maker pembuat pengajuan (creator) atau Admin.
 * 4. Maker (Branch Building Koordinator): HANYA dapat melihat pengajuan buatannya sendiri, ATAU pengajuan berstatus final APPROVED.
 * 5. Approver berjenjang & role lain: dokumen hanya boleh dilihat jika statusnya sesuai tingkatan visibilitas perannya.
 */
export const canUserViewRabOeSubmission = (
  user?: { role?: string | null; email?: string | null; username?: string | null; namaLengkap?: string | null; nama?: string | null; coverage_cabang?: string | null; cabang?: string | null } | null,
  submission?: { status?: string | null; created_by?: string | null; cabang?: string | null; project?: { cabang?: string | null } | null } | null
): boolean => {
  if (!user || !user.role || !submission) return false;

  // 1. Validasi coverage cabang
  const itemBranch = submission.cabang || submission.project?.cabang || "";
  const userCoverage = getUserCoverageBranches(user);
  if (itemBranch && !isBranchAccessible(itemBranch, userCoverage)) {
    return false;
  }

  // 2. Admin melihat semua
  if (isApprovalAdmin(user.role)) {
    return true;
  }

  const isMaker = isBranchBuildingKoordinator(user.role);
  const isCreator = isSameCreator(user, submission.created_by);

  // 3. Status DRAFT: HANYA pembuat (creator) atau Admin
  if (submission.status === 'DRAFT') {
    return isMaker && isCreator;
  }

  // 4. Jika user adalah Maker (Branch Building Koordinator):
  // HANYA dapat melihat pengajuan yang dibuat oleh dirinya sendiri, ATAU pengajuan yang sudah final APPROVED
  if (isMaker) {
    if (isCreator) return true;
    return submission.status === 'APPROVED';
  }

  // 5. Approver berjenjang: cek status visibilitas perannya
  const visibleStatuses = getRabOeVisibleStatuses(user.role);
  if (visibleStatuses === 'ALL') return true;
  if (!submission.status) return false;
  return visibleStatuses.includes(submission.status);
};

/**
 * Backward compatibility alias untuk canUserViewRabOeSubmission.
 */
export const canUserViewRenovasiSubmission = canUserViewRabOeSubmission;

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
 * Cek apakah role user memiliki izin membuat / mengajukan Perubahan Fungsi Ruang.
 * Sesuai aturan:
 * - HANYA role "BRANCH BUILDING & MAINTENANCE MANAGER" dan "ADMIN" (DC ADMIN / SUPER ADMIN).
 * - Role lain (Koordinator, Specialist, Manager lain, dll.) HANYA BISA READ ONLY.
 */
export const canManageFungsiRuang = (userRole: string | undefined | null): boolean => {
  if (!userRole) return false;
  const norm = userRole.trim().toUpperCase();

  if (
    norm === 'BRANCH BUILDING & MAINTENANCE MANAGER' ||
    norm === 'BRANCH BUILDING AND MAINTENANCE MANAGER' ||
    norm === 'B&M MANAGER' ||
    norm.includes('MAINTENANCE MANAGER')
  ) {
    return true;
  }

  return isApprovalAdmin(norm);
};

/**
 * Cek apakah user berada dalam status READ ONLY untuk modul Perubahan Fungsi Ruang.
 */
export const isFungsiRuangReadOnly = (userRole: string | undefined | null): boolean => {
  return !canManageFungsiRuang(userRole);
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

  // Syarat Utama 1: Role harus salah satu dari approver RAB/OE, approver Fungsi Ruang, approver Tender, atau Administrator
  const isAllowedRole =
    canAccessRabOeApproval(userRole) ||
    canAccessFungsiRuangApproval(userRole) ||
    canAccessTenderApproval(userRole);
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
 * Menghasilkan daftar status pengajuan Penawaran RAB/OE yang berhak dilihat
 * oleh suatu role tertentu (Tiered Visibility / Visibilitas Bertingkat).
 *
 * Aturan Alur 3-Tier RAB/OE:
 * - Admin: 'ALL' (melihat semua status).
 * - Maker (Branch Building Koordinator): Melihat seluruh siklus pengajuan miliknya ('DRAFT' s/d 'APPROVED', 'REVISI', 'DITOLAK').
 * - Tier 1 Approver (Branch B&M Manager): Mulai melihat sejak tahap 'MENUNGGU APPROVAL B&M MANAGER' s/d 'APPROVED', plus 'REVISI' & 'DITOLAK'. (TIDAK melihat DRAFT orang lain).
 * - Tier 2 Approver (DC Specialist): Baru melihat setelah lolos B&M Manager ('MENUNGGU APPROVAL DC SPECIALIST') s/d 'APPROVED'.
 * - Tier 3 Approver (DC Manager): Baru melihat setelah lolos DC Specialist ('MENUNGGU APPROVAL DC MANAGER') s/d 'APPROVED'.
 * - Role umum lainnya: Hanya pengajuan final ('APPROVED').
 */
export const getRabOeVisibleStatuses = (
  userRole: string | undefined | null
): string[] | 'ALL' => {
  if (!userRole) return ['APPROVED'];
  const norm = userRole.trim().toUpperCase();

  if (isApprovalAdmin(norm)) {
    return 'ALL';
  }

  // Maker: Branch Building Koordinator
  if (isBranchBuildingKoordinator(norm)) {
    return [
      'DRAFT',
      'MENUNGGU APPROVAL B&M MANAGER',
      'MENUNGGU APPROVAL DC SPECIALIST',
      'MENUNGGU APPROVAL DC MANAGER',
      'APPROVED',
      'REVISI',
      'DITOLAK',
    ];
  }

  // Tier 1 Approver: Branch Building & Maintenance Manager
  if (
    norm === 'BRANCH BUILDING & MAINTENANCE MANAGER' ||
    norm === 'BRANCH BUILDING AND MAINTENANCE MANAGER' ||
    norm === 'B&M MANAGER' ||
    norm.includes('MAINTENANCE MANAGER')
  ) {
    return [
      'MENUNGGU APPROVAL B&M MANAGER',
      'MENUNGGU APPROVAL DC SPECIALIST',
      'MENUNGGU APPROVAL DC MANAGER',
      'APPROVED',
      'REVISI',
      'DITOLAK',
    ];
  }

  // Tier 2 Approver: DC Building & Development Specialist
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
    return [
      'MENUNGGU APPROVAL DC SPECIALIST',
      'MENUNGGU APPROVAL DC MANAGER',
      'APPROVED',
    ];
  }

  // Tier 3 Approver: DC Building & Development Manager
  if (
    norm === 'DC BUILDING & DEVELOPMENT MANAGER' ||
    norm === 'DC BUILDING AND DEVELOPMENT MANAGER' ||
    norm.includes('DEVELOPMENT MANAGER')
  ) {
    return [
      'MENUNGGU APPROVAL DC MANAGER',
      'APPROVED',
    ];
  }

  return ['APPROVED'];
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

// =============================================================================
// FUNGSI RUANG APPROVAL ENGINE (SOP SAT/FRM/DCB/010)
// Urutan Matriks Tanda Tangan Resmi (dari kiri ke kanan):
// Dibuat: Pemohon
// Mengetahui: B&M Mgr -> BM/DBM** -> GM Dept Pemohon -> Reg Building & Maintenance Mgr -> DC Building & Dev Mgr -> Building & Maintenance GM
// Menyetujui: Director Dept Pemohon -> Property & Development Director
// =============================================================================

/**
 * Cek apakah role user termasuk dalam daftar approver Perubahan Fungsi Ruang.
 */
export const isFungsiRuangApproverRole = (userRole: string | undefined | null): boolean => {
  if (!userRole) return false;
  const norm = userRole.trim().toUpperCase();

  // Tier 1: Branch Manager / Deputi Branch Manager
  if (
    norm === 'BRANCH MANAGER' ||
    norm === 'DEPUTI BRANCH MANAGER' ||
    norm === 'DEPUTY BRANCH MANAGER' ||
    norm === 'DBM' ||
    norm === 'BM'
  ) {
    return true;
  }

  // Tier 2: GM Dept Pemohon (GENERAL MANAGER FINANCE, GENERAL MANAGER IT, dll.)
  if (isAnyDepartmentGmRole(norm)) {
    return true;
  }

  // Tier 3: Branch Building & Maintenance Regional Manager
  if (
    norm === 'BRANCH BUILDING & MAINTENANCE REGIONAL MANAGER' ||
    norm === 'BRANCH BUILDING AND MAINTENANCE REGIONAL MANAGER' ||
    norm === 'B&M REGIONAL MANAGER' ||
    norm.includes('REGIONAL MANAGER')
  ) {
    return true;
  }

  // Tier 4: DC Building & Development Specialist / Manager
  if (
    norm === 'DC BUILDING & DEVELOPMENT SPECIALIST' ||
    norm === 'DC BUILDING & DEVELOPMENT SPECIALIS' ||
    norm === 'DC BUILDING AND DEVELOPMENT SPECIALIST' ||
    norm === 'DC BUILDING AND DEVELOPMENT SPECIALIS' ||
    norm === 'DC BUILDING & DEVELOPMENT MANAGER' ||
    norm.includes('DEVELOPMENT SPECIALIST') ||
    norm.includes('DEVELOPMENT SPECIALIS') ||
    norm.includes('DC SPECIALIST') ||
    norm.includes('DC SPECIALIS') ||
    norm.includes('DEVELOPMENT MANAGER')
  ) {
    return true;
  }

  // Tier 5: Building & Maintenance General Manager
  if (
    norm === 'BUILDING & MAINTENANCE GENERAL MANAGER' ||
    norm === 'BUILDING AND MAINTENANCE GENERAL MANAGER' ||
    norm === 'B&M GM' ||
    norm === 'GM B&M' ||
    (norm.includes('GENERAL MANAGER') && norm.includes('MAINTENANCE'))
  ) {
    return true;
  }

  // Tier 6: Director Dept Pemohon (DIREKTUR FINANCE, DIREKTUR IT, dll.)
  if (isAnyDepartmentDirectorRole(norm)) {
    return true;
  }

  // Tier 7: Property & Development Director
  if (
    norm === 'PROPERTY & DEVELOPMENT DIRECTOR' ||
    norm === 'PROPERTY AND DEVELOPMENT DIRECTOR' ||
    norm === 'PROPERTY DEVELOPMENT DIRECTOR' ||
    norm === 'PROPERTY DEV DIRECTOR' ||
    norm === 'PROPERTY DEVELOPMENT MANAGER' ||
    norm === 'PROPERTY DEV MANAGER' ||
    norm === 'OPERATION DIRECTOR' ||
    norm.includes('PROPERTY')
  ) {
    return true;
  }

  return false;
};

/**
 * Cek apakah user berhak mengakses fitur approval Perubahan Fungsi Ruang.
 */
export const canAccessFungsiRuangApproval = (userRole: string | undefined | null): boolean => {
  if (!userRole) return false;
  const norm = userRole.trim().toUpperCase();
  return isApprovalAdmin(norm) || isFungsiRuangApproverRole(norm);
};

/**
 * Mendapatkan status antrean Fungsi Ruang yang menjadi tanggung jawab role pengguna saat ini.
 */
export const getFungsiRuangApprovalQueueForRole = (
  userRole: string | undefined | null
): string[] | 'ALL' => {
  if (!userRole) return [];
  const norm = userRole.trim().toUpperCase();

  if (isApprovalAdmin(norm)) {
    return 'ALL';
  }

  // Tier 1: Branch Manager / Deputi Branch Manager
  if (
    norm === 'BRANCH MANAGER' ||
    norm === 'DEPUTI BRANCH MANAGER' ||
    norm === 'DEPUTY BRANCH MANAGER' ||
    norm === 'DBM' ||
    norm === 'BM'
  ) {
    return ['MENUNGGU APPROVAL BM/DBM'];
  }

  // Tier 2: GM Dept Pemohon (GENERAL MANAGER FINANCE, GENERAL MANAGER IT, dll.)
  if (isAnyDepartmentGmRole(norm)) {
    return ['MENUNGGU APPROVAL GM DEPT PEMOHON'];
  }

  // Tier 3: Branch Building & Maintenance Regional Manager
  if (
    norm === 'BRANCH BUILDING & MAINTENANCE REGIONAL MANAGER' ||
    norm === 'BRANCH BUILDING AND MAINTENANCE REGIONAL MANAGER' ||
    norm === 'B&M REGIONAL MANAGER' ||
    norm.includes('REGIONAL MANAGER')
  ) {
    return ['MENUNGGU APPROVAL REGIONAL B&M MANAGER'];
  }

  // Tier 4: DC Building & Development Specialist / Manager
  if (
    norm === 'DC BUILDING & DEVELOPMENT SPECIALIST' ||
    norm === 'DC BUILDING & DEVELOPMENT SPECIALIS' ||
    norm === 'DC BUILDING AND DEVELOPMENT SPECIALIST' ||
    norm === 'DC BUILDING AND DEVELOPMENT SPECIALIS' ||
    norm === 'DC BUILDING & DEVELOPMENT MANAGER' ||
    norm.includes('DEVELOPMENT SPECIALIST') ||
    norm.includes('DEVELOPMENT SPECIALIS') ||
    norm.includes('DC SPECIALIST') ||
    norm.includes('DC SPECIALIS') ||
    norm.includes('DEVELOPMENT MANAGER')
  ) {
    return ['MENUNGGU APPROVAL DC SPECIALIST'];
  }

  // Tier 5: Building & Maintenance General Manager
  if (
    norm === 'BUILDING & MAINTENANCE GENERAL MANAGER' ||
    norm === 'BUILDING AND MAINTENANCE GENERAL MANAGER' ||
    norm === 'B&M GM' ||
    norm === 'GM B&M' ||
    (norm.includes('GENERAL MANAGER') && norm.includes('MAINTENANCE'))
  ) {
    return ['MENUNGGU APPROVAL B&M GM'];
  }

  // Tier 6: Director Dept Pemohon (DIREKTUR FINANCE, DIREKTUR IT, dll.)
  if (isAnyDepartmentDirectorRole(norm)) {
    return ['MENUNGGU APPROVAL DIRECTOR DEPT PEMOHON'];
  }

  // Tier 7: Property & Development Director
  if (
    norm === 'PROPERTY & DEVELOPMENT DIRECTOR' ||
    norm === 'PROPERTY AND DEVELOPMENT DIRECTOR' ||
    norm === 'PROPERTY DEVELOPMENT DIRECTOR' ||
    norm === 'PROPERTY DEV DIRECTOR' ||
    norm === 'PROPERTY DEVELOPMENT MANAGER' ||
    norm === 'PROPERTY DEV MANAGER' ||
    norm === 'OPERATION DIRECTOR' ||
    norm.includes('PROPERTY')
  ) {
    return ['MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR'];
  }

  return [];
};

/**
 * Mendapatkan status transisi berikutnya untuk Perubahan Fungsi Ruang ketika disetujui (APPROVE).
 * Urutan 7-Tahap Berjenjang:
 * Maker (BM Manager) -> BM/DBM -> GM Dept Pemohon -> Reg B&M Mgr -> DC Specialist -> B&M GM -> Director Dept Pemohon -> Property & Dev Director -> APPROVED
 */
export const getNextFungsiRuangApprovalStatus = (
  currentStatus: string
): { nextStatus: string; label: string } | null => {
  switch (currentStatus) {
    case 'MENUNGGU APPROVAL BM/DBM':
      return {
        nextStatus: 'MENUNGGU APPROVAL GM DEPT PEMOHON',
        label: 'GM Dept Pemohon'
      };
    case 'MENUNGGU APPROVAL GM DEPT PEMOHON':
      return {
        nextStatus: 'MENUNGGU APPROVAL REGIONAL B&M MANAGER',
        label: 'Regional B&M Manager'
      };
    case 'MENUNGGU APPROVAL REGIONAL B&M MANAGER':
      return {
        nextStatus: 'MENUNGGU APPROVAL DC SPECIALIST',
        label: 'DC Building & Dev Mgr'
      };
    case 'MENUNGGU APPROVAL DC SPECIALIST':
      return {
        nextStatus: 'MENUNGGU APPROVAL B&M GM',
        label: 'Building & Maintenance GM'
      };
    case 'MENUNGGU APPROVAL B&M GM':
      return {
        nextStatus: 'MENUNGGU APPROVAL DIRECTOR DEPT PEMOHON',
        label: 'Director Dept Pemohon'
      };
    case 'MENUNGGU APPROVAL DIRECTOR DEPT PEMOHON':
      return {
        nextStatus: 'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR',
        label: 'Property & Development Director'
      };
    case 'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR':
    case 'MENUNGGU APPROVAL PROPERTY DEV MANAGER':
    case 'MENUNGGU APPROVAL OPERATION DIRECTOR':
      return {
        nextStatus: 'APPROVED',
        label: 'Approved (Selesai Disetujui)'
      };
    default:
      return null;
  }
};

/**
 * Cek apakah suatu pengajuan Fungsi Ruang spesifik dapat diproses persetujuannya (Approve / Kembalikan Revisi) oleh user saat ini:
 * 1. Coverage cabang user harus mencakup cabang proyek dari pengajuan (atau HO/Admin).
 * 2. Administrator memiliki hak approve untuk semua tahapan approval aktif.
 * 3. Approver spesifik memiliki hak jika status pengajuan saat ini cocok dengan antreannya.
 */
export const canUserApproveFungsiRuang = (
  user?: { role?: string | null; cabang?: string | null; coverage_cabang?: string | null; email?: string | null } | null,
  submission?: { status?: string | null; project?: { cabang?: string | null } | null; renovasi?: { cabang?: string | null } | null; pemohon?: { departemen?: string | null; divisi?: string | null } | null } | null
): boolean => {
  if (!user || !user.role || !submission || !submission.status) return false;

  const itemBranch = submission.project?.cabang || submission.renovasi?.cabang || "";
  const userCoverage = getUserCoverageBranches(user);

  // 1. Cek coverage cabang akun user (kecuali HO / role tanpa pembatasan cabang)
  if (itemBranch && !isBranchAccessible(itemBranch, userCoverage)) {
    return false;
  }

  // 2. Administrator memiliki hak approve untuk seluruh tahapan approval aktif
  if (isApprovalAdmin(user.role)) {
    return (
      submission.status === 'MENUNGGU APPROVAL BM/DBM' ||
      submission.status === 'MENUNGGU APPROVAL GM DEPT PEMOHON' ||
      submission.status === 'MENUNGGU APPROVAL REGIONAL B&M MANAGER' ||
      submission.status === 'MENUNGGU APPROVAL DC SPECIALIST' ||
      submission.status === 'MENUNGGU APPROVAL B&M GM' ||
      submission.status === 'MENUNGGU APPROVAL DIRECTOR DEPT PEMOHON' ||
      submission.status === 'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR' ||
      submission.status === 'MENUNGGU APPROVAL PROPERTY DEV MANAGER' ||
      submission.status === 'MENUNGGU APPROVAL OPERATION DIRECTOR'
    );
  }

  // 3. Validasi spesifik kecocokan role departemen jika approver adalah GM Dept Pemohon atau Director Dept Pemohon
  if (submission.status === 'MENUNGGU APPROVAL GM DEPT PEMOHON') {
    return isUserGmForDepartment(user.role, submission.pemohon?.departemen, submission.pemohon?.divisi);
  }

  if (submission.status === 'MENUNGGU APPROVAL DIRECTOR DEPT PEMOHON') {
    return isUserDirectorForDepartment(user.role, submission.pemohon?.departemen, submission.pemohon?.divisi);
  }

  // 4. Approver spesifik berdasarkan status antrean perannya
  const queueStatus = getFungsiRuangApprovalQueueForRole(user.role);
  if (Array.isArray(queueStatus)) {
    return queueStatus.includes(submission.status);
  }

  return false;
};

/**
 * Daftar seluruh tahapan antrean persetujuan Fungsi Ruang (secara berjenjang).
 */
export const FUNGSI_RUANG_APPROVAL_STAGES = [
  'MENUNGGU APPROVAL BM/DBM',
  'MENUNGGU APPROVAL GM DEPT PEMOHON',
  'MENUNGGU APPROVAL REGIONAL B&M MANAGER',
  'MENUNGGU APPROVAL DC SPECIALIST',
  'MENUNGGU APPROVAL B&M GM',
  'MENUNGGU APPROVAL DIRECTOR DEPT PEMOHON',
  'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR',
  'APPROVED',
] as const;

/**
 * Menghasilkan daftar status pengajuan Perubahan Fungsi Ruang yang berhak dilihat
 * oleh suatu role tertentu (Tiered Visibility / Visibilitas Bertingkat).
 *
 * Aturan Urutan Berjenjang:
 * - Admin: 'ALL' (melihat semua status).
 * - Maker (Branch B&M Manager): Melihat seluruh siklus pengajuan miliknya (REVISI s/d APPROVED).
 * - Approver Tier 1 (BM/DBM): Mulai melihat sejak tahap BM/DBM s/d APPROVED (TIDAK bisa melihat REVISI).
 * - Approver Tier 2 (GM Dept Pemohon): Mulai melihat saat tahap GM Dept Pemohon s/d APPROVED.
 * - Approver Tier 3 (Regional BM): Baru melihat setelah lolos GM Dept Pemohon s/d APPROVED.
 * - Approver Tier 4 (DC Specialist): Baru melihat setelah lolos Regional BM s/d APPROVED.
 * - Approver Tier 5 (B&M GM): Baru melihat setelah lolos DC Specialist s/d APPROVED.
 * - Approver Tier 6 (Director Dept Pemohon): Baru melihat saat tahap Director Dept s/d APPROVED.
 * - Approver Tier 7 (Property & Dev Director): Baru melihat saat tahap Property & Dev Director s/d APPROVED.
 * - Role umum lainnya: Hanya pengajuan final ('APPROVED').
 */
export const getFungsiRuangVisibleStatuses = (
  userRole: string | undefined | null
): string[] | 'ALL' => {
  if (!userRole) return ['APPROVED'];
  const norm = userRole.trim().toUpperCase();

  if (isApprovalAdmin(norm)) {
    return 'ALL';
  }

  // Tier 1: Branch Manager / DBM
  if (
    norm === 'BRANCH MANAGER' ||
    norm === 'DEPUTI BRANCH MANAGER' ||
    norm === 'DEPUTY BRANCH MANAGER' ||
    norm === 'DBM' ||
    norm === 'BM'
  ) {
    return [
      'MENUNGGU APPROVAL BM/DBM',
      'MENUNGGU APPROVAL GM DEPT PEMOHON',
      'MENUNGGU APPROVAL REGIONAL B&M MANAGER',
      'MENUNGGU APPROVAL DC SPECIALIST',
      'MENUNGGU APPROVAL B&M GM',
      'MENUNGGU APPROVAL DIRECTOR DEPT PEMOHON',
      'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR',
      'APPROVED',
    ];
  }

  // Tier 2: GM Dept Pemohon (GENERAL MANAGER FINANCE, GENERAL MANAGER IT, dll.)
  if (isAnyDepartmentGmRole(norm)) {
    return [
      'MENUNGGU APPROVAL GM DEPT PEMOHON',
      'MENUNGGU APPROVAL REGIONAL B&M MANAGER',
      'MENUNGGU APPROVAL DC SPECIALIST',
      'MENUNGGU APPROVAL B&M GM',
      'MENUNGGU APPROVAL DIRECTOR DEPT PEMOHON',
      'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR',
      'APPROVED',
    ];
  }

  // Tier 3: Regional B&M Manager
  if (
    norm === 'BRANCH BUILDING & MAINTENANCE REGIONAL MANAGER' ||
    norm === 'BRANCH BUILDING AND MAINTENANCE REGIONAL MANAGER' ||
    norm === 'B&M REGIONAL MANAGER' ||
    norm.includes('REGIONAL MANAGER')
  ) {
    return [
      'MENUNGGU APPROVAL REGIONAL B&M MANAGER',
      'MENUNGGU APPROVAL DC SPECIALIST',
      'MENUNGGU APPROVAL B&M GM',
      'MENUNGGU APPROVAL DIRECTOR DEPT PEMOHON',
      'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR',
      'APPROVED',
    ];
  }

  // Tier 4: DC Specialist / DC Building & Dev Manager
  if (
    norm === 'DC BUILDING & DEVELOPMENT SPECIALIST' ||
    norm === 'DC BUILDING & DEVELOPMENT SPECIALIS' ||
    norm === 'DC BUILDING AND DEVELOPMENT SPECIALIST' ||
    norm === 'DC BUILDING AND DEVELOPMENT SPECIALIS' ||
    norm === 'DC BUILDING & DEVELOPMENT MANAGER' ||
    norm.includes('DEVELOPMENT SPECIALIST') ||
    norm.includes('DEVELOPMENT SPECIALIS') ||
    norm.includes('DC SPECIALIST') ||
    norm.includes('DC SPECIALIS') ||
    norm.includes('DEVELOPMENT MANAGER')
  ) {
    return [
      'MENUNGGU APPROVAL DC SPECIALIST',
      'MENUNGGU APPROVAL B&M GM',
      'MENUNGGU APPROVAL DIRECTOR DEPT PEMOHON',
      'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR',
      'APPROVED',
    ];
  }

  // Tier 5: B&M GM
  if (
    norm === 'BUILDING & MAINTENANCE GENERAL MANAGER' ||
    norm === 'BUILDING AND MAINTENANCE GENERAL MANAGER' ||
    norm === 'B&M GM' ||
    norm === 'GM B&M' ||
    (norm.includes('GENERAL MANAGER') && norm.includes('MAINTENANCE'))
  ) {
    return [
      'MENUNGGU APPROVAL B&M GM',
      'MENUNGGU APPROVAL DIRECTOR DEPT PEMOHON',
      'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR',
      'APPROVED',
    ];
  }

  // Tier 6: Director Dept Pemohon (DIREKTUR FINANCE, DIREKTUR IT, dll.)
  if (isAnyDepartmentDirectorRole(norm)) {
    return [
      'MENUNGGU APPROVAL DIRECTOR DEPT PEMOHON',
      'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR',
      'APPROVED',
    ];
  }

  // Tier 7: Property & Development Director
  if (
    norm === 'PROPERTY & DEVELOPMENT DIRECTOR' ||
    norm === 'PROPERTY AND DEVELOPMENT DIRECTOR' ||
    norm === 'PROPERTY DEVELOPMENT DIRECTOR' ||
    norm === 'PROPERTY DEV DIRECTOR' ||
    norm === 'PROPERTY DEVELOPMENT MANAGER' ||
    norm === 'PROPERTY DEV MANAGER' ||
    norm === 'OPERATION DIRECTOR' ||
    norm.includes('PROPERTY')
  ) {
    return [
      'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR',
      'APPROVED',
    ];
  }

  // Maker: Branch Building & Maintenance Manager
  if (
    norm === 'BRANCH BUILDING & MAINTENANCE MANAGER' ||
    norm === 'BRANCH BUILDING AND MAINTENANCE MANAGER' ||
    norm === 'B&M MANAGER' ||
    norm.includes('MAINTENANCE MANAGER')
  ) {
    return [
      'REVISI',
      'MENUNGGU APPROVAL BM/DBM',
      'MENUNGGU APPROVAL GM DEPT PEMOHON',
      'MENUNGGU APPROVAL REGIONAL B&M MANAGER',
      'MENUNGGU APPROVAL DC SPECIALIST',
      'MENUNGGU APPROVAL B&M GM',
      'MENUNGGU APPROVAL DIRECTOR DEPT PEMOHON',
      'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR',
      'APPROVED',
    ];
  }

  return ['APPROVED'];
};

/**
 * Cek apakah seorang user berhak melihat dokumen pengajuan Fungsi Ruang spesifik:
 * 1. Coverage cabang wajib sesuai (kecuali Admin/HO).
 * 2. Status REVISI: HANYA Maker pembuat pengajuan dan Admin yang berhak melihat.
 * 3. Approver berjenjang: dokumen hanya boleh dilihat jika sudah mencapai tingkatan perannya.
 */
export const canUserViewFungsiRuangSubmission = (
  user?: { role?: string | null; email?: string | null; username?: string | null; namaLengkap?: string | null; coverage_cabang?: string | null; cabang?: string | null } | null,
  submission?: { status?: string | null; created_by?: string | null; project?: { cabang?: string | null } | null; renovasi?: { cabang?: string | null } | null } | null
): boolean => {
  if (!user || !user.role || !submission || !submission.status) return false;

  // 1. Validasi coverage cabang
  const itemBranch = submission.project?.cabang || submission.renovasi?.cabang || "";
  const userCoverage = getUserCoverageBranches(user);
  if (itemBranch && !isBranchAccessible(itemBranch, userCoverage)) {
    return false;
  }

  // 2. Admin melihat semua
  if (isApprovalAdmin(user.role)) {
    return true;
  }

  const isMaker = canManageFungsiRuang(user.role);
  const isCreator = isSameCreator(user, submission.created_by);

  // 3. Status REVISI: HANYA pembuat (maker yang mengajukan) atau Admin
  if (submission.status === 'REVISI') {
    return isMaker && isCreator;
  }

  // 4. Jika user adalah Maker (Branch B&M Manager):
  // HANYA dapat melihat pengajuan yang dibuat oleh dirinya sendiri, ATAU pengajuan yang sudah final APPROVED
  if (isMaker) {
    if (isCreator) return true;
    return submission.status === 'APPROVED';
  }

  // 5. Approver berjenjang: cek status visibilitas perannya
  const visibleStatuses = getFungsiRuangVisibleStatuses(user.role);
  if (visibleStatuses === 'ALL') return true;
  return visibleStatuses.includes(submission.status);
};

/**
 * Menghasilkan klausa filter Prisma ORM untuk query dc_fungsi_ruang.findMany
 * agar dokumen terfilter bertingkat sesuai tingkatan peran login.
 */
export const getFungsiRuangPrismaFilter = (
  user?: { role?: string | null; email?: string | null; username?: string | null; namaLengkap?: string | null; nama?: string | null } | null
): any => {
  if (!user || !user.role) return { status: 'APPROVED' };

  if (isApprovalAdmin(user.role)) {
    return null;
  }

  const isMaker = canManageFungsiRuang(user.role);

  if (isMaker) {
    const userEmail = (user.email || '').trim().toLowerCase();
    const username = ((user as any).username || '').trim().toLowerCase();
    const nama = ((user as any).nama || (user as any).namaLengkap || '').trim().toLowerCase();
    const emailPrefix = userEmail.includes('@') ? userEmail.split('@')[0] : '';
    const possibleIdentifiers = Array.from(new Set([userEmail, username, nama, emailPrefix].filter(Boolean)));

    return {
      OR: [
        {
          created_by: {
            in: possibleIdentifiers,
            mode: 'insensitive',
          },
        },
        {
          status: 'APPROVED',
        },
      ],
    };
  }

  const visibleStatuses = getFungsiRuangVisibleStatuses(user.role);
  if (visibleStatuses === 'ALL') return null;

  return {
    status: {
      in: visibleStatuses,
    },
  };
};

/**
 * Menghasilkan klausa filter Prisma ORM untuk query dc_renovasi.findMany
 * agar dokumen terfilter bertingkat sesuai tingkatan peran login.
 */
export const getRabOePrismaFilter = (
  user?: { role?: string | null; email?: string | null; username?: string | null; namaLengkap?: string | null; nama?: string | null } | null
): any => {
  if (!user || !user.role) return { status: 'APPROVED' };

  if (isApprovalAdmin(user.role)) {
    return null;
  }

  const isMaker = isBranchBuildingKoordinator(user.role);

  if (isMaker) {
    const userEmail = (user.email || '').trim().toLowerCase();
    const username = ((user as any).username || '').trim().toLowerCase();
    const nama = ((user as any).nama || (user as any).namaLengkap || '').trim().toLowerCase();
    const emailPrefix = userEmail.includes('@') ? userEmail.split('@')[0] : '';
    const possibleIdentifiers = Array.from(new Set([userEmail, username, nama, emailPrefix].filter(Boolean)));

    return {
      OR: [
        {
          created_by: {
            in: possibleIdentifiers,
            mode: 'insensitive',
          },
        },
        {
          status: 'APPROVED',
        },
      ],
    };
  }

  const visibleStatuses = getRabOeVisibleStatuses(user.role);
  if (visibleStatuses === 'ALL') return null;

  return {
    status: {
      in: visibleStatuses,
    },
  };
};

// ============================================================================
// MODUL Pengajuan Proposal Tender REKANAN KONTRAKTOR & KONSULTAN APPROVAL RULES
// ============================================================================

/**
 * Memeriksa apakah user berhak mengakses antrean modul Approval Pengajuan Proposal Tender.
 */
export const canAccessTenderApproval = (userRole: string | undefined | null): boolean => {
  if (!userRole) return false;
  if (isApprovalAdmin(userRole)) return true;
  const norm = userRole.trim().toUpperCase();

  return (
    norm.includes('DC SPECIALIST') ||
    norm.includes('DC BUILDING & DEVELOPMENT SPECIALIST') ||
    norm.includes('DC MANAGER') ||
    norm.includes('DC BUILDING & DEVELOPMENT MANAGER') ||
    norm.includes('B&M GM') ||
    norm.includes('BUILDING & MAINTENANCE GENERAL MANAGER') ||
    norm.includes('PROPERTY & DEV DIRECTOR') ||
    norm.includes('PROPERTY & DEVELOPMENT DIRECTOR') ||
    norm.includes('PROPERTY DEV') ||
    norm.includes('DIRECTOR')
  );
};

/**
 * Memeriksa apakah user saat ini berhak menyetujui (Approve/Revisi/Tolak) tender pada status saat ini.
 * Catatan penting: Status REVISI, APPROVED, DITOLAK, dan DRAFT tidak pernah dapat diapprove oleh siapapun.
 */
export const canUserApproveTender = (
  userRole: string | undefined | null,
  currentStatus: string,
  kategoriNilai?: string | null
): boolean => {
  if (!userRole || !currentStatus) return false;

  // Status non-aktif / terminal / sedang revisi di Maker tidak dapat diapprove oleh siapapun
  if (['REVISI', 'APPROVED', 'DITOLAK', 'DRAFT', 'SELESAI'].includes(currentStatus)) {
    return false;
  }

  // Admin berhak menyetujui seluruh tahapan approval aktif
  if (isApprovalAdmin(userRole)) {
    return (
      currentStatus === 'PRAKUALIFIKASI' ||
      currentStatus === 'MENUNGGU APPROVAL DC SPECIALIST' ||
      currentStatus === 'MENUNGGU APPROVAL B&M GM' ||
      currentStatus === 'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR'
    );
  }

  const norm = userRole.trim().toUpperCase();

  switch (currentStatus) {
    case 'PRAKUALIFIKASI':
    case 'MENUNGGU APPROVAL DC SPECIALIST':
      return (
        norm.includes('DC SPECIALIST') ||
        norm.includes('DC BUILDING & DEVELOPMENT SPECIALIST') ||
        norm.includes('DC MANAGER') ||
        norm.includes('DC BUILDING & DEVELOPMENT MANAGER')
      );

    case 'MENUNGGU APPROVAL B&M GM':
      return (
        norm.includes('B&M GM') ||
        norm.includes('BUILDING & MAINTENANCE GENERAL MANAGER')
      );

    case 'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR':
      return (
        norm.includes('PROPERTY & DEV DIRECTOR') ||
        norm.includes('PROPERTY & DEVELOPMENT DIRECTOR') ||
        norm.includes('PROPERTY DEV') ||
        norm.includes('DIRECTOR')
      );

    default:
      return false;
  }
};

/**
 * Menentukan status berikutnya saat tindakan APPROVE dilakukan.
 */
export const getTenderApprovalNextStatus = (
  currentStatus: string,
  _kategoriNilai?: string
): string => {
  // Seluruh tender (> Rp 1 Miliar) menggunakan alur berjenjang 3 tingkat HO (SOP SPARTA)
  switch (currentStatus) {
    case 'PRAKUALIFIKASI':
      return 'MENUNGGU APPROVAL DC SPECIALIST';
    case 'MENUNGGU APPROVAL DC SPECIALIST':
      return 'MENUNGGU APPROVAL B&M GM';
    case 'MENUNGGU APPROVAL B&M GM':
      return 'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR';
    case 'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR':
      return 'APPROVED';
    default:
      return 'APPROVED';
  }
};

/**
 * Label tahapan berikutnya untuk ditampilkan di ApprovalActionCard.
 */
export const getTenderNextStepLabel = (
  currentStatus: string,
  kategoriNilai?: string
): string => {
  const nextStatus = getTenderApprovalNextStatus(currentStatus, kategoriNilai);
  switch (nextStatus) {
    case 'MENUNGGU APPROVAL DC SPECIALIST':
      return 'DC Building & Development Specialist';
    case 'MENUNGGU APPROVAL B&M GM':
      return 'Building & Maintenance General Manager';
    case 'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR':
      return 'Property & Development Director';
    case 'APPROVED':
      return 'Persetujuan Final (Disetujui)';
    default:
      return nextStatus;
  }
};

/**
 * Menentukan batas wewenang kategori pagu PFR siap tender yang berhak diajukan oleh pengguna:
 * - DC Specialist / Manager -> HANYA proyek > Rp 1 Miliar ("DI_ATAS_1M")
 * - Administrator -> Berhak mengajukan semua pagu ("ALL")
 * - Role lainnya (termasuk Branch B&M) -> Tidak berhak membuat Pengajuan Proposal Tender ("NONE")
 */
export const getTenderMakerAllowedKategori = (
  userRole?: string | null
): "DI_ATAS_1M" | "ALL" | "NONE" => {
  if (!userRole) return "NONE";
  const norm = userRole.trim().toUpperCase();

  if (isApprovalAdmin(norm)) {
    return "ALL";
  }

  // DC Specialist / Manager (Eksklusif Maker HO untuk proyek > 1 Miliar)
  if (
    norm === 'DC BUILDING & DEVELOPMENT SPECIALIST' ||
    norm === 'DC BUILDING AND DEVELOPMENT SPECIALIST' ||
    norm.includes('DC SPECIALIST') ||
    norm.includes('DEVELOPMENT SPECIALIST') ||
    norm.includes('DEVELOPMENT SPECIALIS') ||
    norm === 'DC BUILDING & DEVELOPMENT MANAGER' ||
    norm === 'DC BUILDING AND DEVELOPMENT MANAGER' ||
    norm.includes('DC MANAGER')
  ) {
    return "DI_ATAS_1M";
  }

  return "NONE";
};

/**
 * Menghasilkan daftar status Pengajuan Proposal Tender yang berhak dilihat oleh user
 * berdasarkan tingkatan perannya (Tiered Visibility) di modul arsip Dokumen.
 */
export const getTenderVisibleStatuses = (userRole?: string | null): string[] | 'ALL' => {
  if (!userRole) return ['APPROVED'];

  const norm = userRole.trim().toUpperCase();

  if (isApprovalAdmin(norm)) {
    return 'ALL';
  }

  // Maker / Branch B&M:
  if (
    norm === 'BRANCH BUILDING & MAINTENANCE MANAGER' ||
    norm === 'BRANCH BUILDING AND MAINTENANCE MANAGER' ||
    norm === 'B&M MANAGER' ||
    norm.includes('MAINTENANCE MANAGER') ||
    norm === 'BRANCH BUILDING KOORDINATOR' ||
    norm.includes('BUILDING KOORDINATOR')
  ) {
    return [
      'PRAKUALIFIKASI',
      'MENUNGGU APPROVAL DC SPECIALIST',
      'MENUNGGU APPROVAL B&M GM',
      'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR',
      'APPROVED',
      'REVISI',
      'DITOLAK',
    ];
  }

  // Tier 1 Approver: DC Specialist
  if (
    norm.includes('DC SPECIALIST') ||
    norm.includes('DC BUILDING & DEVELOPMENT SPECIALIST') ||
    norm.includes('DC BUILDING AND DEVELOPMENT SPECIALIST') ||
    norm.includes('DEVELOPMENT SPECIALIST') ||
    norm.includes('DEVELOPMENT SPECIALIS')
  ) {
    return [
      'PRAKUALIFIKASI',
      'MENUNGGU APPROVAL DC SPECIALIST',
      'MENUNGGU APPROVAL B&M GM',
      'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR',
      'APPROVED',
    ];
  }

  // Tier 2 Approver: Building & Maintenance GM
  if (
    norm.includes('B&M GM') ||
    norm.includes('BUILDING & MAINTENANCE GENERAL MANAGER') ||
    norm.includes('BUILDING AND MAINTENANCE GENERAL MANAGER')
  ) {
    return [
      'MENUNGGU APPROVAL B&M GM',
      'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR',
      'APPROVED',
    ];
  }

  // Tier 3 Approver: Property & Development Director
  if (
    norm.includes('PROPERTY & DEV DIRECTOR') ||
    norm.includes('PROPERTY & DEVELOPMENT DIRECTOR') ||
    norm.includes('PROPERTY DEV') ||
    norm.includes('DIRECTOR')
  ) {
    return [
      'MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR',
      'APPROVED',
    ];
  }

  return ['APPROVED'];
};

/**
 * Cek apakah seorang user berhak melihat dokumen Pengajuan Proposal Tender spesifik:
 * 1. Coverage cabang wajib sesuai (kecuali Admin/HO).
 * 2. Status REVISI: HANYA Maker pembuat pengajuan dan Admin yang berhak melihat.
 * 3. Approver berjenjang: dokumen hanya boleh dilihat jika sudah mencapai tingkatan perannya atau dibuat oleh dirinya.
 */
export const canUserViewTenderSubmission = (
  user?: { role?: string | null; email?: string | null; username?: string | null; namaLengkap?: string | null; coverage_cabang?: string | null; cabang?: string | null } | null,
  tender?: { status?: string | null; created_by?: string | null; cabang?: string | null; project?: { cabang?: string | null } | null } | null
): boolean => {
  if (!user || !user.role || !tender || !tender.status) return false;

  // 1. Validasi coverage cabang
  const itemBranch = tender.cabang || tender.project?.cabang || "";
  const userCoverage = getUserCoverageBranches(user);
  if (itemBranch && !isBranchAccessible(itemBranch, userCoverage)) {
    return false;
  }

  // 2. Admin melihat semua
  if (isApprovalAdmin(user.role)) {
    return true;
  }

  const isCreator = isSameCreator(user, tender.created_by);

  // 3. Status REVISI: HANYA pembuat (maker yang mengajukan) atau Admin
  if (tender.status === 'REVISI') {
    return isCreator;
  }

  // 4. Jika user adalah Creator: dapat melihat semua status miliknya
  if (isCreator) {
    return true;
  }

  // 5. Approver berjenjang: cek status visibilitas perannya
  const visibleStatuses = getTenderVisibleStatuses(user.role);
  if (visibleStatuses === 'ALL') return true;
  return visibleStatuses.includes(tender.status);
};

/**
 * Menghasilkan klausa filter Prisma ORM untuk query dc_tender.findMany
 * agar dokumen terfilter bertingkat sesuai tingkatan peran login.
 */
export const getTenderPrismaFilter = (
  user?: { role?: string | null; email?: string | null; username?: string | null; namaLengkap?: string | null; nama?: string | null } | null
): any => {
  if (!user || !user.role) return { status: 'APPROVED' };

  if (isApprovalAdmin(user.role)) {
    return null;
  }

  const userEmail = (user.email || '').trim().toLowerCase();
  const username = ((user as any).username || '').trim().toLowerCase();
  const nama = ((user as any).nama || (user as any).namaLengkap || '').trim().toLowerCase();
  const emailPrefix = userEmail.includes('@') ? userEmail.split('@')[0] : '';
  const possibleIdentifiers = Array.from(new Set([userEmail, username, nama, emailPrefix].filter(Boolean)));

  const visibleStatuses = getTenderVisibleStatuses(user.role);
  if (visibleStatuses === 'ALL') return null;

  return {
    OR: [
      {
        created_by: {
          in: possibleIdentifiers,
          mode: 'insensitive',
        },
      },
      {
        status: {
          in: visibleStatuses,
        },
      },
    ],
  };
};

/**
 * Memeriksa apakah peran pengguna adalah DC Building & Development Manager
 */
export const isDcBuildingManager = (userRole?: string | null): boolean => {
  if (!userRole) return false;
  const norm = userRole.trim().toUpperCase();
  return (
    norm === 'DC BUILDING & DEVELOPMENT MANAGER' ||
    norm === 'DC BUILDING AND DEVELOPMENT MANAGER' ||
    norm === 'DC DEVELOPMENT MANAGER' ||
    norm === 'BUILDING & DEVELOPMENT MANAGER' ||
    norm === 'DC MANAGER' ||
    norm.includes('DEVELOPMENT MANAGER')
  );
};

/**
 * Validasi apakah user berhak melihat dokumen Undangan Aanwijzing
 */
export const canUserViewAanwijzing = (user: any, aanwijzing: any): boolean => {
  if (!user) return false;
  const role = (user.role || '').trim().toUpperCase();

  // Admin dan Direksi Nasional berhak melihat semua
  if (isApprovalAdmin(role) || role.includes('DIRECTOR')) {
    return true;
  }

  // Jika Kontraktor/Konsultan/Rekanan Eksternal: hanya berhak melihat jika perusahaannya termasuk dalam daftar peserta
  if (isExternalPartnerRole(role)) {
    const userEmail = (user.email || '').trim().toLowerCase();
    const userPt = ((user.nama_pt || '') as string).trim().toLowerCase();
    
    const isParticipant = (aanwijzing.peserta || []).some((p: any) => {
      const pEmail = (p.email || p.vendor?.email || '').trim().toLowerCase();
      const pName = (p.vendor?.nama_perusahaan || '').trim().toLowerCase();
      return (userEmail && pEmail === userEmail) || (userPt && pName.includes(userPt));
    });
    return isParticipant;
  }

  // Pemeriksaan coverage cabang
  const userCoverage = getUserCoverageBranches(user);
  const targetBranch = (aanwijzing.cabang || aanwijzing.project?.cabang || '').trim().toUpperCase();
  if (!isBranchAccessible(targetBranch, userCoverage)) {
    return false;
  }

  // DC Building Manager: berhak melihat semua berkas di cabangnya, terutama saat antrean MENUNGGU_APPROVAL_DC_MANAGER
  if (isDcBuildingManager(role)) {
    return true;
  }

  // Pembuat dokumen (Maker)
  if (isSameCreator(user, aanwijzing.created_by)) {
    return true;
  }

  // Status publik di internal (setelah selesai/lanjut atau on hold)
  return true;
};

/**
 * Validasi apakah user berhak melakukan tindakan approval pada Undangan Aanwijzing
 * (Khusus proyek < 1M dengan peserta hadir < 3 orang berstatus MENUNGGU_APPROVAL_DC_MANAGER)
 */
export const canUserApproveAanwijzing = (user: any, aanwijzing: any): boolean => {
  if (!user || !aanwijzing) return false;
  if (aanwijzing.status !== 'MENUNGGU_APPROVAL_DC_MANAGER') return false;

  const role = (user.role || '').trim().toUpperCase();
  if (isApprovalAdmin(role)) return true;

  if (isDcBuildingManager(role)) {
    const userCoverage = getUserCoverageBranches(user);
    const targetBranch = (aanwijzing.cabang || aanwijzing.project?.cabang || '').trim().toUpperCase();
    return isBranchAccessible(targetBranch, userCoverage);
  }

  return false;
};

