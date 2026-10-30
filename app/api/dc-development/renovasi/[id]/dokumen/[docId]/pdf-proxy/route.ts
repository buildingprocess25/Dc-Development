import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDriveClient } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { docId } = await params;
    const dId = parseInt(docId, 10);
    if (isNaN(dId)) {
      return NextResponse.json({ status: "error", message: "ID Dokumen tidak valid" }, { status: 400 });
    }

    const doc = await prisma.dc_renovasi_dokumen.findUnique({
      where: { id: dId },
    });

    if (!doc) {
      return NextResponse.json({ status: "error", message: "Dokumen tidak ditemukan" }, { status: 404 });
    }

    // 1. Jika ada drive_file_id, ambil dari Google Drive
    if (doc.drive_file_id) {
      try {
        const drive = await getDriveClient();
        const response = await drive.files.get(
          { fileId: doc.drive_file_id, alt: "media" },
          { responseType: "arraybuffer" }
        );
        const buffer = Buffer.from(response.data as ArrayBuffer);
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": doc.mime_type || "application/pdf",
            "Content-Disposition": `inline; filename="${doc.nama_file}"`,
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
          },
        });
      } catch (driveErr: any) {
        console.warn(`[PDF-PROXY] Gagal mengambil dari Drive ID ${doc.drive_file_id}:`, driveErr.message);
      }
    }

    // 2. Jika ada file_url eksternal
    if (doc.file_url) {
      const res = await fetch(doc.file_url);
      if (!res.ok) {
        throw new Error(`Gagal mengunduh file dari URL (${res.status})`);
      }
      const arrayBuffer = await res.arrayBuffer();
      return new NextResponse(Buffer.from(arrayBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${doc.nama_file}"`,
        },
      });
    }

    return NextResponse.json({ status: "error", message: "File PDF tidak memiliki sumber URL yang valid" }, { status: 404 });
  } catch (error: any) {
    console.error("Error in PDF proxy:", error);
    return NextResponse.json({ status: "error", message: error.message || "Gagal memuat PDF" }, { status: 500 });
  }
}
