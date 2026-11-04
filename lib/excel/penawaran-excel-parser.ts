import * as XLSX from "xlsx";

export interface ParsedItemPrice {
  id?: number;
  deskripsi: string;
  kategori?: string;
  harga_material: number;
  harga_upah: number;
}

export interface ParseResult {
  success: boolean;
  items: ParsedItemPrice[];
  totalRowsParsed: number;
  sheetNames: string[];
  errors: string[];
}

/**
 * Membersihkan dan mengubah nilai dari cell Excel menjadi angka murni
 */
function parseNumeric(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") {
    return isNaN(val) ? 0 : Math.max(0, Math.round(val));
  }

  let str = String(val).replace(/[Rr][Pp]\.?/g, "").trim().replace(/\s+/g, "");
  if (!str) return 0;

  const hasDot = str.includes(".");
  const hasComma = str.includes(",");

  if (hasDot && hasComma) {
    const lastDotIdx = str.lastIndexOf(".");
    const lastCommaIdx = str.lastIndexOf(",");
    if (lastCommaIdx > lastDotIdx) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (hasDot && !hasComma) {
    str = str.replace(/\./g, "");
  } else if (hasComma && !hasDot) {
    if (/^\d{1,3}(,\d{3})+$/.test(str)) {
      str = str.replace(/,/g, "");
    } else {
      str = str.replace(",", ".");
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.max(0, Math.round(num));
}

/**
 * Membaca berkas template Excel yang diisi oleh rekanan
 * Mendukung sheet "Pekerjaan Sipil" & "Pekerjaan ME"
 */
export async function parsePenawaranExcel(file: File): Promise<ParseResult> {
  const result: ParseResult = {
    success: false,
    items: [],
    totalRowsParsed: 0,
    sheetNames: [],
    errors: [],
  };

  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });

    result.sheetNames = workbook.SheetNames;

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      result.errors.push("Berkas Excel tidak memiliki sheet yang valid.");
      return result;
    }

    const parsedItems: ParsedItemPrice[] = [];

    // Baca setiap sheet yang ada di file Excel
    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return;

      // Konversi sheet menjadi array 2D
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        blankrows: false,
      });

      if (!rows || rows.length === 0) return;

      // Cari indeks baris header tabel yang sebenarnya (bukan baris petunjuk / info)
      let headerRowIndex = -1;
      let colIdxId = 0;
      let colIdxDeskripsi = 3;
      let colIdxMaterial = 6;
      let colIdxUpah = 7;

      for (let r = 0; r < Math.min(rows.length, 15); r++) {
        const row = rows[r];
        if (!row || row.length < 5) continue;

        // Abaikan baris instruksi/catatan yang biasanya berupa teks panjang
        const isInstructionRow = row.some((c) => {
          const str = String(c).trim().toUpperCase();
          return str.startsWith("PETUNJUK") || str.startsWith("CATATAN") || str.startsWith("PROYEK:");
        });
        if (isInstructionRow) continue;

        // Header tabel asli memiliki cell terpisah untuk URAIAN PEKERJAAN, HARGA MATERIAL, dan HARGA UPAH
        const hasUraian = row.some((c) => {
          const str = String(c).trim().toUpperCase();
          return str.includes("URAIAN") || str.includes("DESKRIPSI");
        });
        const hasMaterial = row.some((c) => {
          const str = String(c).trim().toUpperCase();
          return str.includes("MATERIAL") || str.includes("BAHAN");
        });
        const hasUpah = row.some((c) => {
          const str = String(c).trim().toUpperCase();
          return str.includes("UPAH") || str.includes("TENAGA");
        });

        if (hasUraian && hasMaterial && hasUpah) {
          headerRowIndex = r;

          // Petakan indeks kolom secara dinamis berdasarkan header aktual
          row.forEach((colHeader, cIdx) => {
            const h = String(colHeader).trim().toUpperCase();
            if (h === "ID" || h === "ITEM_ID" || h === "KODE") colIdxId = cIdx;
            if (h.includes("URAIAN") || h.includes("DESKRIPSI")) colIdxDeskripsi = cIdx;
            if (h.includes("MATERIAL") || h.includes("BAHAN")) colIdxMaterial = cIdx;
            if (h.includes("UPAH") || h.includes("TENAGA")) colIdxUpah = cIdx;
          });
          break;
        }
      }

      // Baris data dimulai setelah baris header
      const dataStartRow = headerRowIndex !== -1 ? headerRowIndex + 1 : 6;

      for (let r = dataStartRow; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const rawId = row[colIdxId];
        const rawDeskripsi = String(row[colIdxDeskripsi] || "").trim();
        const rawMaterial = row[colIdxMaterial];
        const rawUpah = row[colIdxUpah];

        // Lewati baris subtotal atau baris kosong
        if (
          rawDeskripsi.toUpperCase().startsWith("SUBTOTAL") ||
          rawDeskripsi.toUpperCase().startsWith("TOTAL")
        ) {
          continue;
        }

        const idNum = parseInt(String(rawId), 10);
        const hasValidId = !isNaN(idNum) && idNum > 0;

        // Baris valid jika memiliki ID atau teks deskripsi yang jelas
        if (hasValidId || (rawDeskripsi && rawDeskripsi.length > 2)) {
          parsedItems.push({
            id: hasValidId ? idNum : undefined,
            deskripsi: rawDeskripsi,
            kategori: String(row[2] || "").trim(),
            harga_material: parseNumeric(rawMaterial),
            harga_upah: parseNumeric(rawUpah),
          });
        }
      }
    });

    if (parsedItems.length === 0) {
      result.errors.push(
        "Tidak ditemukan butir pekerjaan yang sesuai pada file Excel. Pastikan menggunakan format template resmi SPARTA."
      );
      return result;
    }

    result.success = true;
    result.items = parsedItems;
    result.totalRowsParsed = parsedItems.length;
    return result;
  } catch (err: any) {
    console.error("Gagal membaca file Excel penawaran:", err);
    result.errors.push(err.message || "Gagal memproses file Excel");
    return result;
  }
}
