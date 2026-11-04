import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDriveClient, downloadFileBuffer } from "@/lib/google-drive";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const { docId } = await params;
    const documentId = parseInt(docId, 10);
    const { searchParams } = new URL(req.url);
    const queryDriveId = searchParams.get("drive_id");

    let driveFileId: string | null = queryDriveId || null;
    let fileName = searchParams.get("nama") || "dokumen";
    let mimeType: string | null = null;
    let fileUrl: string | null = null;

    if (!isNaN(documentId) && documentId > 0) {
      // 1. Cari di tabel dc_aanwijzing_klarifikasi_dokumen
      const klarifDoc = await prisma.dc_aanwijzing_klarifikasi_dokumen.findUnique({
        where: { id: documentId },
      });

      if (klarifDoc) {
        driveFileId = klarifDoc.drive_file_id || driveFileId;
        fileName = klarifDoc.nama_file || fileName;
        mimeType = klarifDoc.mime_type || mimeType;
        fileUrl = klarifDoc.file_url || fileUrl;
      } else {
        // 2. Cek di tabel dc_penawaran_rekanan_item (bukti pendukung upload item)
        const penawaranItem = await prisma.dc_penawaran_rekanan_item.findUnique({
          where: { id: documentId },
        });

        if (penawaranItem && (penawaranItem.file_bukti_drive_id || penawaranItem.file_bukti_url)) {
          driveFileId = penawaranItem.file_bukti_drive_id || driveFileId;
          fileName = penawaranItem.file_bukti_nama || fileName;
          fileUrl = penawaranItem.file_bukti_url || fileUrl;
        } else {
          // 3. Fallback: cari di dc_renovasi_dokumen jika dokumen warisan dari RAB
          const renoDoc = await prisma.dc_renovasi_dokumen.findUnique({
            where: { id: documentId },
          });
          if (renoDoc) {
            driveFileId = renoDoc.drive_file_id || driveFileId;
            fileName = renoDoc.nama_file || fileName;
            mimeType = renoDoc.mime_type || mimeType;
            fileUrl = renoDoc.file_url || fileUrl;
          }
        }
      }
    }

    // 2. Ekstrak driveFileId dari fileUrl jika belum ada
    if (!driveFileId && fileUrl) {
      const match = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || fileUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        driveFileId = match[1];
      }
    }

    // 3. Jika ada driveFileId, ambil buffer melalui Google Drive Service Account
    if (driveFileId) {
      try {
        const drive = await getDriveClient();
        const buffer = await downloadFileBuffer(drive, driveFileId);

        if (buffer) {
          const ext = fileName.toLowerCase().split(".").pop();
          let resolvedMime = mimeType;
          if (!resolvedMime || resolvedMime === "application/octet-stream") {
            if (ext === "pdf") resolvedMime = "application/pdf";
            else if (ext === "png") resolvedMime = "image/png";
            else if (ext === "jpg" || ext === "jpeg") resolvedMime = "image/jpeg";
            else if (ext === "webp") resolvedMime = "image/webp";
            else if (ext === "dwg") resolvedMime = "application/acad";
            else resolvedMime = "application/octet-stream";
          }

          return new NextResponse(new Uint8Array(buffer), {
            headers: {
              "Content-Type": resolvedMime,
              "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
            },
          });
        }
      } catch (driveErr: any) {
        console.error(`[DOKUMEN-PROXY] Gagal mengambil dari Google Drive (fileId: ${driveFileId}):`, driveErr.message);
      }
    }

    // 4. Jika ada fileUrl langsung yang bisa diakses
    if (fileUrl && (fileUrl.startsWith("http://") || fileUrl.startsWith("https://"))) {
      return NextResponse.redirect(fileUrl);
    }

    return NextResponse.json(
      { status: "error", message: "Dokumen tidak memiliki berkas Google Drive yang valid" },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("[DOKUMEN-PROXY] Server error:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Gagal memproses dokumen proxy" },
      { status: 500 }
    );
  }
}
