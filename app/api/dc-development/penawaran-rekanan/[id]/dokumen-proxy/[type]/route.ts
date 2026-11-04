import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDriveClient, downloadFileBuffer } from "@/lib/google-drive";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const { id, type } = await params;
    const penawaranId = parseInt(id, 10);
    const docType = (type || "").toLowerCase(); // "logo" | "ahs" | "asuransi"

    const { searchParams } = new URL(req.url);
    const queryDriveId = searchParams.get("drive_id");
    const queryFileUrl = searchParams.get("file_url");

    let driveFileId: string | null = queryDriveId || null;
    let fileUrl: string | null = queryFileUrl || null;
    let fileName: string = "dokumen";
    let defaultMime: string = "application/octet-stream";

    // 1. Ambil data dari database jika penawaranId valid
    if (!isNaN(penawaranId) && penawaranId > 0) {
      const penawaran = await prisma.dc_penawaran_rekanan.findUnique({
        where: { id: penawaranId },
        select: {
          id: true,
          nomor_penawaran: true,
          kontraktor_logo_url: true,
          kontraktor_logo_drive_id: true,
          analisa_harga_url: true,
          analisa_harga_drive_id: true,
          analisa_harga_nama: true,
          asuransi_file_url: true,
          asuransi_file_drive_id: true,
          asuransi_file_nama: true,
        },
      });

      if (penawaran) {
        if (docType === "logo") {
          driveFileId = penawaran.kontraktor_logo_drive_id || driveFileId;
          fileUrl = penawaran.kontraktor_logo_url || fileUrl;
          fileName = "Logo_Kontraktor.png";
          defaultMime = "image/png";
        } else if (docType === "ahs") {
          driveFileId = penawaran.analisa_harga_drive_id || driveFileId;
          fileUrl = penawaran.analisa_harga_url || fileUrl;
          fileName = penawaran.analisa_harga_nama || "Analisa_Harga_Satuan.xlsx";
          defaultMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        } else if (docType === "asuransi") {
          driveFileId = penawaran.asuransi_file_drive_id || driveFileId;
          fileUrl = penawaran.asuransi_file_url || fileUrl;
          fileName = penawaran.asuransi_file_nama || "Polis_Asuransi.pdf";
          defaultMime = "application/pdf";
        }
      }
    }

    // 2. Jika driveFileId belum ada, coba ekstrak dari fileUrl
    if (!driveFileId && fileUrl) {
      const match = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || fileUrl.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        driveFileId = match[1];
      }
    }

    // 3. Jika ada driveFileId, download file buffer melalui Google Drive Service Account
    if (driveFileId) {
      try {
        const drive = await getDriveClient();

        // Ambil nama & MIME type aktual dari Google Drive jika tersedia
        try {
          const meta = await drive.files.get({
            fileId: driveFileId,
            fields: "name,mimeType",
            supportsAllDrives: true,
          });
          if (meta.data.name) fileName = meta.data.name;
          if (meta.data.mimeType) defaultMime = meta.data.mimeType;
        } catch {
          // Fallback ke default jika metadata gagal
        }

        const buffer = await downloadFileBuffer(drive, driveFileId);

        if (buffer) {
          const ext = fileName.toLowerCase().split(".").pop();
          let resolvedMime = defaultMime;
          if (ext === "pdf") resolvedMime = "application/pdf";
          else if (ext === "xlsx") resolvedMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          else if (ext === "xls") resolvedMime = "application/vnd.ms-excel";
          else if (ext === "png") resolvedMime = "image/png";
          else if (ext === "jpg" || ext === "jpeg") resolvedMime = "image/jpeg";
          else if (ext === "webp") resolvedMime = "image/webp";
          else if (ext === "svg") resolvedMime = "image/svg+xml";

          const isExcel =
            resolvedMime.includes("spreadsheet") ||
            resolvedMime.includes("excel") ||
            ext === "xlsx" ||
            ext === "xls";

          const disposition = isExcel
            ? `attachment; filename="${encodeURIComponent(fileName)}"`
            : `inline; filename="${encodeURIComponent(fileName)}"`;

          return new NextResponse(new Uint8Array(buffer), {
            headers: {
              "Content-Type": resolvedMime,
              "Content-Disposition": disposition,
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
            },
          });
        }
      } catch (driveErr: any) {
        console.error(`[DOKUMEN-PROXY] Gagal download dari Drive ID ${driveFileId}:`, driveErr.message);
      }
    }

    // 4. Fallback ke fileUrl langsung jika buffer gagal atau direct link
    if (fileUrl && (fileUrl.startsWith("http://") || fileUrl.startsWith("https://"))) {
      return NextResponse.redirect(fileUrl);
    }

    return NextResponse.json(
      { status: "error", message: `Berkas ${docType} tidak ditemukan atau belum diunggah` },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("[DOKUMEN-PROXY] Server error:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Gagal memproses dokumen" },
      { status: 500 }
    );
  }
}
