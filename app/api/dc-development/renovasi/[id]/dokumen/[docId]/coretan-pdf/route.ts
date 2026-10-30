import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  getDriveClient,
  getDcRenovasiFolderHierarchyId,
  uploadFileToFolder,
  updateFileInDrive,
} from "@/lib/google-drive";
import { getApprovalStageInfo } from "@/lib/approval-stage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET: Ambil daftar file coretan PDF untuk dokumen / pengajuan renovasi ini
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params;
    const rId = parseInt(id, 10);
    const dId = parseInt(docId, 10);

    if (isNaN(rId)) {
      return NextResponse.json(
        { status: "error", message: "ID Renovasi tidak valid" },
        { status: 400 }
      );
    }

    // Ambil data dokumen acuan asli jika dId valid
    const originalDoc = !isNaN(dId)
      ? await prisma.dc_renovasi_dokumen.findUnique({ where: { id: dId } })
      : null;

    const isSipil = originalDoc?.kategori_file?.includes("SIPIL") ?? null;

    // Ambil dokumen coretan dan revisi approver pada renovasi ini
    const coretanDocs = await prisma.dc_renovasi_dokumen.findMany({
      where: {
        renovasi_id: rId,
        OR: [
          { kategori_file: { startsWith: "CORETAN" } },
          { kategori_file: { startsWith: "REVISI" } },
          { nama_file: { startsWith: "Coretan_" } },
          { nama_file: { startsWith: "Revisi_DWG_" } },
        ],
        ...(isSipil !== null
          ? {
              OR: [
                { kategori_file: isSipil ? "CORETAN_GAMBAR_SIPIL" : "CORETAN_GAMBAR_ME" },
                { kategori_file: isSipil ? "REVISI_GAMBAR_SIPIL_DWG" : "REVISI_GAMBAR_ME_DWG" },
              ],
            }
          : {}),
      },
      include: {
        anotasi: true,
      },
      orderBy: { created_at: "asc" },
    });

    // Perkaya data dengan stage info yang terdeteksi
    const enrichedDocs = coretanDocs.map((doc) => {
      let stageCode = "REVIEWER";
      const fileName = doc.nama_file || "";
      const matchTimestamp = fileName.match(/^(?:Coretan|Revisi_DWG)_([A-Z0-9_]+?)_\d{8}_\d{6}_/i);
      if (matchTimestamp) {
        stageCode = matchTimestamp[1].toUpperCase();
      } else {
        const matchKnown = fileName.match(/^(?:Coretan|Revisi_DWG)_(BM_MGR|DC_SPECIALIST|DC_MGR|BM_DBM|REGIONAL_BM|BM_GM|GM_PEMOHON|DIR_PEMOHON|PROP_DIR|REVIEWER)_/i);
        if (matchKnown) {
          stageCode = matchKnown[1].toUpperCase();
        } else {
          const matchGeneral = fileName.match(/^(?:Coretan|Revisi_DWG)_([A-Z0-9_]+?)_/i);
          if (matchGeneral) stageCode = matchGeneral[1].toUpperCase();
        }
      }
      return {
        ...doc,
        tahap_alur: stageCode,
        anotasi_json: doc.anotasi?.[0]?.anotasi_json || null,
      };
    });

    return NextResponse.json({ status: "success", data: enrichedDocs });
  } catch (error: any) {
    console.error("Error fetching coretan PDF documents:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Gagal memuat dokumen coretan" },
      { status: 500 }
    );
  }
}

// POST: Menerima file PDF hasil coretan, mengunggah ke Google Drive, dan menyimpan ke database (dc_renovasi_dokumen)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params;
    const rId = parseInt(id, 10);
    const dId = parseInt(docId, 10);

    if (isNaN(rId) || isNaN(dId)) {
      return NextResponse.json(
        { status: "error", message: "Parameter ID tidak valid" },
        { status: 400 }
      );
    }

    const session = await getSession();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const user_email = (formData.get("user_email") as string) || session?.email;
    const user_nama = (formData.get("user_nama") as string) || (session as any)?.nama || user_email || "Reviewer";
    const user_role = (formData.get("user_role") as string) || session?.role || "APPROVER";
    const status_aksi = (formData.get("status_aksi") as string) || "REVISI";
    const customLabel = formData.get("nama_label") as string | null;
    const status_tahap = formData.get("status_tahap") as string | null;
    const tahap_alur = formData.get("tahap_alur") as string | null;

    if (!file) {
      return NextResponse.json(
        { status: "error", message: "File PDF coretan tidak ditemukan dalam payload" },
        { status: 400 }
      );
    }

    // 1. Ambil data proyek & pengajuan renovasi
    const renovasi = await prisma.dc_renovasi.findUnique({
      where: { id: rId },
      include: {
        project: {
          select: {
            kode: true,
            nama_proyek: true,
            cabang: true,
            inisial: true,
          },
        },
      },
    });

    if (!renovasi) {
      return NextResponse.json(
        { status: "error", message: "Data pengajuan renovasi tidak ditemukan" },
        { status: 404 }
      );
    }

    // 2. Evaluasi tahap alur approval untuk coretan ini
    const activeApprovalStatus = status_tahap || renovasi.status;
    const stageInfo = getApprovalStageInfo(activeApprovalStatus, user_role);
    const stageCode = (tahap_alur || stageInfo.code).toUpperCase();

    // 3. Ambil metadata dokumen acuan asli
    const originalDoc = await prisma.dc_renovasi_dokumen.findUnique({
      where: { id: dId },
    });

    const isSipil = originalDoc?.kategori_file?.includes("SIPIL") ?? true;
    const isDwgFile = file.name.toLowerCase().endsWith(".dwg") || originalDoc?.nama_file?.toLowerCase().endsWith(".dwg");
    const kategori_file = isDwgFile
      ? (isSipil ? "REVISI_GAMBAR_SIPIL_DWG" : "REVISI_GAMBAR_ME_DWG")
      : (isSipil ? "CORETAN_GAMBAR_SIPIL" : "CORETAN_GAMBAR_ME");

    const namaLabel =
      customLabel ||
      (isDwgFile
        ? `Revisi Berkas DWG (Tahap ${stageInfo.label}) oleh ${user_nama} (${user_role})`
        : `Coretan ${status_aksi === "APPROVE" ? "Persetujuan" : "Revisi"} (Tahap ${stageInfo.label}) oleh ${user_nama} (${user_role})`);

    const cleanBaseName = (file.name || originalDoc?.nama_file || "Gambar")
      .replace(/\.(pdf|dwg)$/i, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    
    const now = new Date();
    const timeStampStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const cleanFileName = isDwgFile
      ? `Revisi_DWG_${stageCode}_${timeStampStr}_${cleanBaseName}.dwg`
      : `Coretan_${stageCode}_${timeStampStr}_${cleanBaseName}.pdf`;

    // 4. Periksa apakah memperbarui coretan yang sudah ada pada tahap ini
    const existingCoretanIdStr = formData.get("existing_coretan_id") as string | null;
    const existingCoretanId = existingCoretanIdStr ? parseInt(existingCoretanIdStr, 10) : null;

    const existingRecord = existingCoretanId && !isNaN(existingCoretanId)
      ? await prisma.dc_renovasi_dokumen.findFirst({
          where: { id: existingCoretanId, renovasi_id: rId },
        })
      : null;

    const drive = await getDriveClient();
    let uploadedData: { id?: string | null; webViewLink?: string | null } = {};

    // Jika memperbarui file yang sudah ada di Drive, lakukan update in-place (hemat waktu & tanpa re-traversal folder)
    if (existingRecord?.drive_file_id) {
      try {
        uploadedData = await updateFileInDrive(
          drive,
          existingRecord.drive_file_id,
          file,
          cleanFileName
        );
      } catch (driveErr: any) {
        console.warn("Gagal update in-place file di Google Drive, membuat file baru:", driveErr.message);
        const cabang = renovasi.cabang || renovasi.project?.cabang || "HEAD OFFICE";
        const kode = renovasi.project?.kode || "DC";
        const namaProyek = renovasi.project?.nama_proyek || "RENOVASI";
        const inisial = renovasi.project?.inisial || null;
        const nomorPengajuan = renovasi.nomor_pengajuan || "DRAFT";
        const targetFolderId = await getDcRenovasiFolderHierarchyId(
          drive,
          cabang,
          kode,
          namaProyek,
          inisial,
          nomorPengajuan,
          "Coretan Gambar"
        );
        uploadedData = await uploadFileToFolder(drive, targetFolderId, file, cleanFileName);
      }
    } else {
      const cabang = renovasi.cabang || renovasi.project?.cabang || "HEAD OFFICE";
      const kode = renovasi.project?.kode || "DC";
      const namaProyek = renovasi.project?.nama_proyek || "RENOVASI";
      const inisial = renovasi.project?.inisial || null;
      const nomorPengajuan = renovasi.nomor_pengajuan || "DRAFT";
      const targetFolderId = await getDcRenovasiFolderHierarchyId(
        drive,
        cabang,
        kode,
        namaProyek,
        inisial,
        nomorPengajuan,
        "Coretan Gambar"
      );
      uploadedData = await uploadFileToFolder(drive, targetFolderId, file, cleanFileName);
    }

    const fileUrl =
      uploadedData.webViewLink ||
      `https://drive.google.com/file/d/${uploadedData.id || existingRecord?.drive_file_id}/view`;

    // 5. Simpan URL Google Drive & metadata ke tabel database dc_renovasi_dokumen (update jika ada, create jika baru)
    let savedDoc;
    if (existingRecord) {
      savedDoc = await prisma.dc_renovasi_dokumen.update({
        where: { id: existingRecord.id },
        data: {
          nama_file: cleanFileName,
          nama_label: namaLabel,
          file_url: fileUrl,
          drive_file_id: uploadedData.id || existingRecord.drive_file_id,
          mime_type: isDwgFile ? "application/acad" : "application/pdf",
        },
      });
    } else {
      savedDoc = await prisma.dc_renovasi_dokumen.create({
        data: {
          renovasi_id: rId,
          kategori_file,
          nama_file: cleanFileName,
          nama_label: namaLabel,
          file_url: fileUrl,
          drive_file_id: uploadedData.id,
          mime_type: isDwgFile ? "application/acad" : "application/pdf",
        },
      });
    }

    // 6. Simpan struktur vektor anotasi_json ke tabel dc_renovasi_dokumen_anotasi (agar edit ulang selalu tajam & berbasis vektor)
    const anotasiJsonStr = formData.get("anotasi_json") as string | null;
    let parsedAnotasiJson: any = null;
    if (anotasiJsonStr) {
      try {
        parsedAnotasiJson = JSON.parse(anotasiJsonStr);
      } catch (err: any) {
        console.warn("Gagal parse anotasi_json:", err);
      }
    }

    if (parsedAnotasiJson && !isDwgFile) {
      try {
        await prisma.dc_renovasi_dokumen_anotasi.deleteMany({
          where: { dokumen_id: savedDoc.id },
        });
        await prisma.dc_renovasi_dokumen_anotasi.create({
          data: {
            dokumen_id: savedDoc.id,
            user_email: user_email || "reviewer@sat.co.id",
            user_nama: user_nama || "Reviewer",
            user_role: user_role || "APPROVER",
            status_aksi: status_aksi || "REVISI",
            catatan: customLabel || null,
            anotasi_json: parsedAnotasiJson,
          },
        });
      } catch (anotasiErr: any) {
        console.warn("Gagal menyimpan riwayat dc_renovasi_dokumen_anotasi:", anotasiErr);
      }
    }

    return NextResponse.json({
      status: "success",
      message: existingRecord
        ? `Coretan Tahap ${stageInfo.label} berhasil diperbarui di Google Drive & database`
        : `Coretan Baru Tahap ${stageInfo.label} berhasil disimpan ke Google Drive & database`,
      data: {
        ...savedDoc,
        tahap_alur: stageCode,
        is_updated: Boolean(existingRecord),
        anotasi_json: parsedAnotasiJson,
      },
    });
  } catch (error: any) {
    console.error("Error saving coretan PDF to Google Drive & DB:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Gagal menyimpan dan mengunggah coretan ke Google Drive",
      },
      { status: 500 }
    );
  }
}

// DELETE: Hapus dokumen coretan
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const coretanIdStr = searchParams.get("coretan_id");
    const coretanId = coretanIdStr ? parseInt(coretanIdStr, 10) : NaN;

    if (isNaN(coretanId)) {
      return NextResponse.json(
        { status: "error", message: "ID Coretan tidak valid" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const rId = parseInt(id, 10);

    await prisma.dc_renovasi_dokumen.deleteMany({
      where: {
        id: coretanId,
        ...(!isNaN(rId) && rId > 0 ? { renovasi_id: rId } : {}),
      },
    });

    return NextResponse.json({
      status: "success",
      message: "Dokumen coretan berhasil dihapus dari database",
    });
  } catch (error: any) {
    console.error("Error deleting coretan document:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Gagal menghapus dokumen coretan" },
      { status: 500 }
    );
  }
}
