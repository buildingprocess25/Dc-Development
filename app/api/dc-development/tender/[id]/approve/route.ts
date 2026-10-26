import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  canUserApproveTender,
  getTenderApprovalNextStatus,
  isApprovalAdmin,
} from "@/lib/permissions";
import { syncTenderPdfToDrive } from "@/lib/tender-sync";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenderId = Number(id);

    if (isNaN(tenderId)) {
      return NextResponse.json(
        { status: "error", message: "ID tender tidak valid." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { action, notes } = body; // action: "APPROVE" | "REVISI" | "TOLAK"

    if (!action || !["APPROVE", "REVISI", "TOLAK"].includes(action)) {
      return NextResponse.json(
        { status: "error", message: "Aksi tidak valid. Pilihan: APPROVE, REVISI, TOLAK." },
        { status: 400 }
      );
    }

    // Ambil data user terkini dari dc_users
    const dbUser = await prisma.dc_users.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        role: true,
        cabang: true,
      },
    });

    const currentUser = dbUser || session;
    const isAdmin = isApprovalAdmin(currentUser.role);

    // Ambil tender dari database
    const tender = await prisma.dc_tender.findUnique({
      where: { id: tenderId },
    });

    if (!tender) {
      return NextResponse.json(
        { status: "error", message: "Data Pengajuan Proposal Tender tidak ditemukan." },
        { status: 404 }
      );
    }

    // Cek apakah berkas sedang dalam status non-aktif / REVISI di Maker
    if (["REVISI", "APPROVED", "DITOLAK", "DRAFT"].includes(tender.status)) {
      return NextResponse.json(
        {
          status: "error",
          message: `Dokumen dengan status "${tender.status}" tidak dapat diproses persetujuannya. Pengajuan sedang dalam perbaikan oleh Maker atau sudah selesai.`,
        },
        { status: 400 }
      );
    }

    // Validasi wewenang approval
    const isAuthorized = canUserApproveTender(
      currentUser.role,
      tender.status,
      tender.kategori_nilai
    );

    if (!isAuthorized) {
      return NextResponse.json(
        {
          status: "error",
          message: `Peran Anda (${currentUser.role}) tidak memiliki wewenang untuk menyetujui pengajuan pada status "${tender.status}".`,
        },
        { status: 403 }
      );
    }

    // Sesuai aturan GEMINI.md: Catatan revisi atau tolak WAJIB diisi
    if ((action === "REVISI" || action === "TOLAK") && (!notes || !notes.trim())) {
      return NextResponse.json(
        {
          status: "error",
          message: `Catatan instruksi perbaikan wajib diisi saat memilih tindakan ${action}.`,
        },
        { status: 400 }
      );
    }

    // Hitung status berikutnya
    let nextStatus = tender.status;
    let actionLabel = "Disetujui";

    if (action === "APPROVE") {
      nextStatus = getTenderApprovalNextStatus(tender.status, tender.kategori_nilai);
      actionLabel = nextStatus === "APPROVED" ? "Disetujui Final" : "Disetujui ke Tahap Berikutnya";
    } else if (action === "REVISI") {
      nextStatus = "REVISI";
      actionLabel = "Dikembalikan untuk Revisi";
    } else if (action === "TOLAK") {
      nextStatus = "DITOLAK";
      actionLabel = "Ditolak";
    }

    // Eksekusi transaksi database
    const updatedTender = await prisma.$transaction(async (tx) => {
      const updated = await tx.dc_tender.update({
        where: { id: tenderId },
        data: {
          status: nextStatus,
        },
      });

      // Catat log persetujuan resmi
      await tx.dc_tender_audit_log.create({
        data: {
          tender_id: tenderId,
          user_email: currentUser.email,
          user_name: (currentUser as any).name || currentUser.email.split("@")[0],
          user_role: currentUser.role,
          action: action,
          from_status: tender.status,
          to_status: nextStatus,
          notes: notes?.trim() || null,
        },
      });

      return updated;
    });

    // Jalankan regenerasi PDF dan upload Google Drive secara background (asinkron)
    // sesuai aturan GEMINI.md Rule 5.B agar respon ke antarmuka tetap instan
    syncTenderPdfToDrive(tenderId).catch((err) => {
      console.warn(`[ASYNC-DRIVE-SYNC] Gagal sinkronisasi PDF tender #${tenderId}:`, err);
    });

    return NextResponse.json({
      status: "success",
      message: `Berkas tender ${tender.nomor_tender} berhasil ${actionLabel.toLowerCase()} (Status: ${nextStatus}).`,
      data: updatedTender,
    });
  } catch (error: any) {
    console.error("Error executing tender approval action:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Gagal memproses persetujuan tender." },
      { status: 500 }
    );
  }
}
