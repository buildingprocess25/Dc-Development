import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDriveClient, downloadFileBuffer } from "@/lib/google-drive";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const { itemId } = await params;
    const itId = parseInt(itemId, 10);
    const { searchParams } = new URL(req.url);
    const queryDriveId = searchParams.get("drive_id");

    let driveFileId: string | null = queryDriveId || null;
    let fileName = searchParams.get("nama") || "bukti_pendukung";
    let fileUrl: string | null = null;

    if (!isNaN(itId) && itId > 0) {
      const item = await prisma.dc_penawaran_rekanan_item.findUnique({
        where: { id: itId },
      });

      if (item) {
        driveFileId = item.file_bukti_drive_id || driveFileId;
        fileName = item.file_bukti_nama || fileName;
        fileUrl = item.file_bukti_url || fileUrl;
      }
    }

    // Ekstrak driveFileId dari URL jika belum ada
    if (!driveFileId && fileUrl) {
      const match = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || fileUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        driveFileId = match[1];
      }
    }

    // Jika ada driveFileId, download file buffer melalui Google Drive Service Account
    if (driveFileId) {
      try {
        const drive = await getDriveClient();
        const buffer = await downloadFileBuffer(drive, driveFileId);

        if (buffer) {
          const ext = fileName.toLowerCase().split(".").pop();
          let resolvedMime = "application/octet-stream";
          if (ext === "pdf") resolvedMime = "application/pdf";
          else if (ext === "png") resolvedMime = "image/png";
          else if (ext === "jpg" || ext === "jpeg") resolvedMime = "image/jpeg";
          else if (ext === "webp") resolvedMime = "image/webp";
          else if (ext === "gif") resolvedMime = "image/gif";
          else if (ext === "svg") resolvedMime = "image/svg+xml";
          else if (ext === "dwg") resolvedMime = "application/acad";

          return new NextResponse(new Uint8Array(buffer), {
            headers: {
              "Content-Type": resolvedMime,
              "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
            },
          });
        }
      } catch (driveErr: any) {
        console.error(`[BUKTI-PROXY] Gagal download dari Drive ID ${driveFileId}:`, driveErr.message);
      }
    }

    // Fallback jika fileUrl eksternal
    if (fileUrl && (fileUrl.startsWith("http://") || fileUrl.startsWith("https://"))) {
      return NextResponse.redirect(fileUrl);
    }

    return NextResponse.json(
      { status: "error", message: "Berkas bukti pendukung tidak ditemukan di Google Drive" },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("[BUKTI-PROXY] Server error:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Gagal memproses berkas bukti" },
      { status: 500 }
    );
  }
}
