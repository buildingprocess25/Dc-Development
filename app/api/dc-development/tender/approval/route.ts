import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getUserCoverageBranches, isBranchAccessible, getBranchesUnderInduk, getIndukFromCabang } from "@/lib/branches";
import {
  canAccessTenderApproval,
  canUserApproveTender,
  isApprovalAdmin,
} from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

    // Ambil data user terkini dari dc_users untuk coverage cabang yang up-to-date
    const dbUser = await prisma.dc_users.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        cabang: true,
        role: true,
        coverage_cabang: true,
      },
    });

    const currentUser = dbUser || session;

    if (!canAccessTenderApproval(currentUser.role)) {
      return NextResponse.json(
        {
          status: "error",
          message: "Akses ditolak: Anda tidak memiliki wewenang untuk mengakses transaksi Approval Pengajuan Proposal Tender.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const cabangParam = searchParams.get("cabang") || "";
    const statusParam = searchParams.get("status") || "";
    const tab = searchParams.get("tab") || "my-queue"; // "my-queue" | "all"

    const isAdmin = isApprovalAdmin(currentUser.role);
    const allowedBranches = getUserCoverageBranches(currentUser);
    const userEmail = (currentUser.email || "").toLowerCase();

    // Query semua Pengajuan Proposal Tender yang bukan DRAFT
    const allTenders = await prisma.dc_tender.findMany({
      where: {
        status: { not: "DRAFT" },
      },
      include: {
        project: {
          select: {
            id: true,
            kode: true,
            nama_proyek: true,
            cabang: true,
            dc_induk: true,
          },
        },
        renovasi: {
          select: {
            id: true,
            nomor_pengajuan: true,
            grand_total: true,
            jenis_renovasi: true,
          },
        },
        fungsi_ruang: {
          select: {
            id: true,
            nomor_pengajuan: true,
            jenis_pengajuan: true,
          },
        },
        peserta: {
          include: {
            vendor: true,
          },
          orderBy: { peran: "asc" },
        },
        schedule: {
          orderBy: { urutan: "asc" },
        },
        audit_logs: {
          orderBy: { created_at: "desc" },
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Filter berdasarkan wewenang coverage cabang pengguna
    const branchFilteredTenders = allTenders.filter((item) => {
      const itemCabang = (item.cabang || "").toUpperCase();
      return isBranchAccessible(itemCabang, allowedBranches);
    });

    // Hitung counter summary
    const myPendingItems = branchFilteredTenders.filter((item) => {
      // Status REVISI tidak pernah masuk ke antrean approver lain (hanya creator & admin)
      if (item.status === "REVISI") return false;
      return canUserApproveTender(currentUser.role, item.status, item.kategori_nilai);
    });

    const my_pending_count = myPendingItems.length;
    const total_all = branchFilteredTenders.filter((item) => {
      if (item.status === "REVISI") {
        const creatorEmail = (item.created_by || "").toLowerCase();
        return isAdmin || creatorEmail === userEmail;
      }
      return true;
    }).length;

    // Filter sesuai tab pilihan
    let finalItems = branchFilteredTenders;

    if (tab === "my-queue") {
      finalItems = myPendingItems;
    } else {
      // Tab ALL: sembunyikan REVISI yang bukan milik user login
      finalItems = finalItems.filter((item) => {
        if (item.status === "REVISI") {
          const creatorEmail = (item.created_by || "").toLowerCase();
          return isAdmin || creatorEmail === userEmail;
        }
        return true;
      });
    }

    // Filter tambahan toolbar cabang jika dipilih
    if (cabangParam && cabangParam !== "ALL" && cabangParam !== "all") {
      const childBranches = getBranchesUnderInduk(cabangParam);
      finalItems = finalItems.filter((item) => {
        const itemCabang = (item.cabang || "").toUpperCase();
        const itemInduk = getIndukFromCabang(itemCabang);
        return itemInduk === cabangParam || childBranches.includes(itemCabang);
      });
    }

    // Filter status jika admin memilih filter status spesifik
    if (statusParam && statusParam !== "ALL" && statusParam !== "all") {
      finalItems = finalItems.filter((item) => item.status === statusParam);
    }

    // Filter search query
    if (search.trim()) {
      const q = search.toLowerCase();
      finalItems = finalItems.filter(
        (item) =>
          item.nomor_tender.toLowerCase().includes(q) ||
          (item.project?.nama_proyek || "").toLowerCase().includes(q) ||
          item.cabang.toLowerCase().includes(q) ||
          (item.created_by || "").toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      status: "success",
      summary: {
        my_pending_count,
        total_all,
      },
      data: finalItems,
    });
  } catch (error: any) {
    console.error("Error in tender approval queue:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Gagal memuat antrean approval tender." },
      { status: 500 }
    );
  }
}
