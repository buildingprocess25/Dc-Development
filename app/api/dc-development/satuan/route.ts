import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Hardcoded base units (rekomendasi minimal: m2 & ls)
const BASE_UNITS = ["m2", "ls"];

export async function GET() {
  try {
    // 1. Ambil seluruh variasi satuan yang pernah diinput dari dc_renovasi_item (Penawaran RAB/OE)
    let fromRenovasi: { satuan: string | null }[] = [];
    try {
      fromRenovasi = await prisma.dc_renovasi_item.findMany({
        select: { satuan: true },
        distinct: ["satuan"],
        where: {
          satuan: { not: "" },
        },
      });
    } catch (err) {
      console.warn("Gagal membaca satuan dari dc_renovasi_item:", err);
    }

    // 2. Ambil seluruh variasi satuan yang pernah diinput dari dc_aanwijzing_klarifikasi_item (Klarifikasi Aanwijzing)
    let fromKlarifikasi: { satuan: string | null }[] = [];
    try {
      fromKlarifikasi = await prisma.dc_aanwijzing_klarifikasi_item.findMany({
        select: { satuan: true },
        distinct: ["satuan"],
        where: {
          satuan: { not: "" },
        },
      });
    } catch (err) {
      console.warn("Gagal membaca satuan dari dc_aanwijzing_klarifikasi_item:", err);
    }

    // 3. Gabungkan dan deduplikasi (case-insensitive & trimmed)
    const unitMap = new Map<string, string>();

    // Masukkan base hardcoded pertama kali
    BASE_UNITS.forEach((u) => {
      const clean = u.trim().toLowerCase();
      if (clean) unitMap.set(clean, clean);
    });

    // Masukkan hasil input user dari kedua tabel (duplikat dilebur jadi satu)
    [...fromRenovasi, ...fromKlarifikasi].forEach((row) => {
      if (row.satuan && typeof row.satuan === "string") {
        const clean = row.satuan.trim().toLowerCase();
        if (clean && !unitMap.has(clean)) {
          unitMap.set(clean, clean);
        }
      }
    });

    const units = Array.from(unitMap.values());

    return NextResponse.json({
      status: "success",
      data: units,
    });
  } catch (error: any) {
    console.error("Error fetching aggregated satuan recommendations:", error);
    return NextResponse.json(
      {
        status: "success",
        data: BASE_UNITS,
      },
      { status: 200 }
    );
  }
}
