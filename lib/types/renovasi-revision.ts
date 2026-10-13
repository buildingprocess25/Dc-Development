export type RevisionCategory = "PARAMETER" | "GAMBAR" | "FOTO" | "RAB";

export interface RevisionDetailItem {
  id: string; // e.g. "param_durasi_hari", "param_jenis_renovasi", "doc_12", "foto_34", "rab_56"
  category: RevisionCategory;
  fieldOrId: string; // "durasi_hari", "jenis_renovasi", document id, foto id, rab item id
  subCategory?: string; // "SIPIL_PDF" | "SIPIL_DWG" | "ME_PDF" | "ME_DWG" | "FOTO" | "RAB_SIPIL" | "RAB_ME"
  label: string; // "Durasi Pekerjaan (Hari)", "Jenis Renovasi", "Gambar Sipil (PDF): ...", "Foto Lingkungan: ...", "Item RAB: ..."
  catatan: string; // Catatan instruksi peninjau
  initialValue?: any; // Snapshot nilai awal saat revisi diminta
}

/**
 * Normalisasi data detail_revisi dari format JSON / Database
 */
export function normalizeRevisionDetails(data: any): RevisionDetailItem[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
