import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const penawaranId = parseInt(id);

    const penawaran = await prisma.dc_penawaran_rekanan.findUnique({
      where: { id: penawaranId },
      include: {
        project: true,
        vendor: true,
        items: {
          orderBy: { id: "asc" },
        },
      },
    });

    if (!penawaran) {
      return NextResponse.json(
        { status: "error", message: "Data penawaran tidak ditemukan" },
        { status: 404 }
      );
    }

    // Pisahkan item berdasarkan lingkup pekerjaan
    const itemsSipil = (penawaran.items || []).filter(
      (it) => (it.lingkup || "SIPIL").toUpperCase() === "SIPIL"
    );
    const itemsMe = (penawaran.items || []).filter(
      (it) => (it.lingkup || "").toUpperCase() === "ME"
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SPARTA DC-Development";
    workbook.lastModifiedBy = "SPARTA DC-Development";
    workbook.created = new Date();
    workbook.modified = new Date();

    const buildSheet = (
      sheetTitle: string,
      lingkupCode: "SIPIL" | "ME",
      sheetItems: typeof penawaran.items
    ) => {
      const sheet = workbook.addWorksheet(sheetTitle, {
        views: [{ showGridLines: true }],
      });

      // Konfigurasi Kolom
      sheet.columns = [
        { key: "id", width: 1 }, // Hidden Item ID
        { key: "no", width: 6 },
        { key: "kategori", width: 26 },
        { key: "deskripsi", width: 44 },
        { key: "satuan", width: 10 },
        { key: "volume", width: 14 },
        { key: "harga_material", width: 22 },
        { key: "harga_upah", width: 22 },
        { key: "total_harga_satuan", width: 24 },
        { key: "total_biaya", width: 26 },
      ];

      // Sembunyikan kolom ID (Kolom A) agar tidak mengganggu kontraktor
      sheet.getColumn(1).hidden = true;

      // 1. Header Informasi Proyek
      const titleRow = sheet.addRow([
        "",
        `FORMULIR PENAWARAN HARGA BOQ — PEKERJAAN ${lingkupCode}`,
      ]);
      titleRow.font = { bold: true, size: 14, color: { argb: "FFE65F2B" } };
      sheet.mergeCells("B1:J1");

      const projRow = sheet.addRow([
        "",
        `Proyek: ${penawaran.project.nama_proyek} (${penawaran.project.kode})`,
      ]);
      projRow.font = { bold: true, size: 11, color: { argb: "FF1E293B" } };
      sheet.mergeCells("B2:J2");

      const infoRow = sheet.addRow([
        "",
        `Cabang: ${penawaran.cabang}  |  Rekanan: ${penawaran.vendor_nama}  |  No. Penawaran: ${penawaran.nomor_penawaran}`,
      ]);
      infoRow.font = { size: 10, color: { argb: "FF475569" } };
      sheet.mergeCells("B3:J3");

      const noteRow = sheet.addRow([
        "",
        `PETUNJUK: Masukkan Harga Material (Kolom G) & Harga Upah (Kolom H) pada sel kuning muda. Kolom Volume & Total Biaya terkunci otomatis.`,
      ]);
      noteRow.font = { italic: true, size: 9, color: { argb: "FFB45309" } };
      sheet.mergeCells("B4:J4");

      // Spacing row
      sheet.addRow([]);

      // 2. Table Header (Baris 6)
      const headerRow = sheet.addRow([
        "ID",
        "NO",
        "KATEGORI PEKERJAAN",
        "URAIAN PEKERJAAN",
        "SATUAN",
        "VOLUME",
        "HARGA MATERIAL (RP)",
        "HARGA UPAH (RP)",
        "HARGA SATUAN (RP)",
        "TOTAL BIAYA (RP)",
      ]);
      headerRow.height = 26;
      headerRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE65F2B" }, // SPARTA Orange
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber === 4 ? "left" : "center",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "medium", color: { argb: "FF94A3B8" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
        cell.protection = { locked: true };
      });

      // Format khusus header input (Kolom G & H) diberi indikator kuning tegas
      [7, 8].forEach((colIdx) => {
        const c = headerRow.getCell(colIdx);
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFD97706" }, // Amber Darker Header
        };
      });

      const startDataRow = 7;
      let currentRowIdx = startDataRow;

      // Group items by category for tidy presentation
      const categories: { [cat: string]: typeof sheetItems } = {};
      sheetItems.forEach((it) => {
        const cat = it.kategori_pekerjaan || "PEKERJAAN UTAMA";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(it);
      });

      let itemNo = 1;

      Object.entries(categories).forEach(([categoryName, catItems]) => {
        // Baris Header Kategori
        const catRow = sheet.addRow([
          "",
          "",
          categoryName.toUpperCase(),
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ]);
        catRow.height = 20;
        catRow.eachCell((cell) => {
          cell.font = { bold: true, size: 10, color: { argb: "FF334155" } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F5F9" }, // Slate 100
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
          cell.protection = { locked: true };
        });
        sheet.mergeCells(`C${currentRowIdx}:J${currentRowIdx}`);
        currentRowIdx++;

        // Baris-baris Data Pekerjaan
        catItems.forEach((it) => {
          const row = sheet.addRow([
            it.id,
            itemNo++,
            it.kategori_pekerjaan || "",
            it.deskripsi || "",
            it.satuan || "",
            Number(it.volume) || 0,
            it.harga_material ? Number(it.harga_material) : 0,
            it.harga_upah ? Number(it.harga_upah) : 0,
            { formula: `G${currentRowIdx}+H${currentRowIdx}` },
            { formula: `F${currentRowIdx}*I${currentRowIdx}` },
          ]);
          row.height = 22;

          // Proteksi & Styling per Cell
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.border = {
              top: { style: "thin", color: { argb: "FFE2E8F0" } },
              bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
              left: { style: "thin", color: { argb: "FFE2E8F0" } },
              right: { style: "thin", color: { argb: "FFE2E8F0" } },
            };

            // Kolom ID (A)
            if (colNumber === 1) {
              cell.protection = { locked: true };
            }
            // Kolom NO (B)
            else if (colNumber === 2) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
              cell.font = { size: 9, color: { argb: "FF64748B" } };
              cell.protection = { locked: true };
            }
            // Kolom Kategori (C)
            else if (colNumber === 3) {
              cell.alignment = { vertical: "middle" };
              cell.font = { size: 9, color: { argb: "FF475569" } };
              cell.protection = { locked: true };
            }
            // Kolom Deskripsi (D)
            else if (colNumber === 4) {
              cell.alignment = { vertical: "middle" };
              cell.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
              cell.protection = { locked: true };
            }
            // Kolom Satuan (E)
            else if (colNumber === 5) {
              cell.alignment = { horizontal: "center", vertical: "middle" };
              cell.font = { size: 9, color: { argb: "FF475569" } };
              cell.protection = { locked: true };
            }
            // Kolom Volume (F) — TERKUNCI RAPAT
            else if (colNumber === 6) {
              cell.alignment = { horizontal: "right", vertical: "middle" };
              cell.font = { bold: true, size: 9.5, color: { argb: "FF1E293B" } };
              cell.numFmt = "#,##0.00";
              cell.protection = { locked: true };
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF8FAFC" }, // Slate 50
              };
            }
            // Kolom Harga Material (G) — UNLOCKED (BISA DIEDIT)
            else if (colNumber === 7) {
              cell.alignment = { horizontal: "right", vertical: "middle" };
              cell.font = { bold: true, size: 9.5, color: { argb: "FF1E293B" } };
              cell.numFmt = "#,##0";
              cell.protection = { locked: false };
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFFFBEB" }, // Amber 50
              };
            }
            // Kolom Harga Upah (H) — UNLOCKED (BISA DIEDIT)
            else if (colNumber === 8) {
              cell.alignment = { horizontal: "right", vertical: "middle" };
              cell.font = { bold: true, size: 9.5, color: { argb: "FF1E293B" } };
              cell.numFmt = "#,##0";
              cell.protection = { locked: false };
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFFFBEB" }, // Amber 50
              };
            }
            // Kolom Harga Satuan Total (I) — TERKUNCI (FORMULA)
            else if (colNumber === 9) {
              cell.alignment = { horizontal: "right", vertical: "middle" };
              cell.font = { size: 9.5, color: { argb: "FF334155" } };
              cell.numFmt = "#,##0";
              cell.protection = { locked: true };
            }
            // Kolom Total Biaya (J) — TERKUNCI (FORMULA)
            else if (colNumber === 10) {
              cell.alignment = { horizontal: "right", vertical: "middle" };
              cell.font = { bold: true, size: 9.5, color: { argb: "FF0F172A" } };
              cell.numFmt = "#,##0";
              cell.protection = { locked: true };
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF8FAFC" }, // Slate 50
              };
            }
          });

          currentRowIdx++;
        });
      });

      // Baris Subtotal di bagian bawah tabel
      const subtotalRow = sheet.addRow([
        "",
        "",
        "",
        `SUBTOTAL PEKERJAAN ${lingkupCode} :`,
        "",
        "",
        "",
        "",
        "",
        {
          formula:
            currentRowIdx > startDataRow
              ? `SUM(J${startDataRow}:J${currentRowIdx - 1})`
              : "0",
        },
      ]);
      subtotalRow.height = 24;
      subtotalRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1F5F9" }, // Slate 100
        };
        cell.border = {
          top: { style: "medium", color: { argb: "FF94A3B8" } },
          bottom: { style: "double", color: { argb: "FF475569" } },
        };
        cell.protection = { locked: true };
        if (colNumber === 4) {
          cell.alignment = { horizontal: "right", vertical: "middle" };
        }
        if (colNumber === 10) {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = "#,##0";
          cell.font = { bold: true, size: 10.5, color: { argb: "FFE65F2B" } };
        }
      });
      sheet.mergeCells(`D${currentRowIdx}:I${currentRowIdx}`);

      // AKTIFKAN WORKSHEET PROTECTION (Volume Anti-Edit)
      sheet.protect("sparta_boq_2026", {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertRows: false,
        insertColumns: false,
        insertHyperlinks: false,
        deleteRows: false,
        deleteColumns: false,
        sort: false,
        autoFilter: false,
        pivotTables: false,
      });
    };

    // Bangun 2 Sheet Terpisah
    buildSheet("Pekerjaan Sipil", "SIPIL", itemsSipil);
    buildSheet("Pekerjaan ME", "ME", itemsMe);

    const buffer = await workbook.xlsx.writeBuffer();

    const cleanProjectName = (penawaran.project.nama_proyek || "PROYEK")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 30);
    const cleanNo = (penawaran.nomor_penawaran || "PEN")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Template_BoQ_${cleanNo}_${cleanProjectName}.xlsx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Gagal membuat template Excel penawaran:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Gagal membuat file template Excel",
      },
      { status: 500 }
    );
  }
}
