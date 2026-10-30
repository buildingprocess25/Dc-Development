import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Fallback safe handler: anotasi sekarang dialihkan ke penyimpan dokumen PDF utuh di Google Drive
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id } = await params;
    const rId = parseInt(id, 10);
    // Mengembalikan dokumen coretan yang tersimpan di Google Drive
    const coretanDocs = await prisma.dc_renovasi_dokumen.findMany({
      where: {
        renovasi_id: rId,
        OR: [
          { kategori_file: { startsWith: "CORETAN" } },
          { nama_file: { startsWith: "Coretan_" } },
        ],
      },
      orderBy: { created_at: "asc" },
    });

    return NextResponse.json({ status: "success", data: coretanDocs });
  } catch (error: any) {
    return NextResponse.json({ status: "success", data: [] });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  return NextResponse.json({
    status: "success",
    message: "Gunakan endpoint coretan-pdf untuk menyimpan file ke Google Drive",
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  return NextResponse.json({ status: "success", message: "OK" });
}
