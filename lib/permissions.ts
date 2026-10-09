export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HEAD_OFFICE: 'HEAD_OFFICE',
  ADMIN_DC: 'ADMIN_DC',
  DC_DOCUMENT_ADMIN: 'DC_DOCUMENT_ADMIN', // Role khusus dokumen yang direquest user
};

export const PERMISSIONS = {
  // Hanya role ini yang boleh menambahkan item custom ("Data Penting Lainnya")
  // DC_DOCUMENT_ADMIN tidak dimasukkan ke sini
  CAN_ADD_CUSTOM_ITEM: [ROLES.SUPER_ADMIN, ROLES.HEAD_OFFICE, ROLES.ADMIN_DC],
  
  // Contoh permission lain untuk ke depannya
  CAN_DELETE_DOCUMENT: [ROLES.SUPER_ADMIN, ROLES.HEAD_OFFICE],
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
