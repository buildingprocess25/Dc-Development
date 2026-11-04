import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getUserCoverageBranches, isBranchAccessible, getBranchesUnderInduk, getIndukFromCabang } from "@/lib/branches";
import {
  canAccessPenawaranRekananApproval,
  canUserActionPenawaranQueue,
  isApprovalAdmin,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
    }

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

    if (!canAccessPenawaranRekananApproval(currentUser.role)) {
      return NextResponse.json(
        {
          status: "error",
          message: "Akses ditolak: Anda tidak memiliki wewenang untuk mengakses antrean Approval Evaluasi Penawaran Rekanan.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const cabangParam = searchParams.get("cabang") || "";
    const statusParam = searchParams.get("status") || "";
    const tab = searchParams.get("tab") || "my-queue"; // "my-queue" | "all"

    const allowedBranches = getUserCoverageBranches(currentUser);

    // Draf penawaran tidak pernah masuk antrean approval evaluasi
    const allPenawaran = await prisma.dc_penawaran_rekanan.findMany({
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
            alamat: true,
          },
        },
        vendor: {
          select: {
            id: true,
            nama_perusahaan: true,
            golongan: true,
            cabang: true,
            nomor_telepon: true,
            email: true,
          },
        },
        klarifikasi: {
          select: {
            id: true,
            nomor_klarifikasi: true,
            durasi_hari_akhir: true,
            status: true,
          },
        },
        audit_logs: {
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Filter berdasarkan wewenang coverage cabang pengguna
    const branchFiltered = allPenawaran.filter((item) => {
      const itemCabang = (item.cabang || "").toUpperCase();
      return isBranchAccessible(itemCabang, allowedBranches);
    });

    // Hitung counter item yang butuh aksi role pengguna saat ini (berdasarkan threshold 1M)
    const myPendingItems = branchFiltered.filter((item) => {
      return canUserActionPenawaranQueue(currentUser.role, item.status, item.grand_total);
    });

    const my_pending_count = myPendingItems.length;
    const total_all = branchFiltered.length;

    let finalItems = tab === "my-queue" ? myPendingItems : branchFiltered;

    // Filter tambahan toolbar cabang jika dipilih
    if (cabangParam && cabangParam !== "ALL" && cabangParam !== "all") {
      const childBranches = getBranchesUnderInduk(cabangParam);
      finalItems = finalItems.filter((item) => {
        const itemCabang = (item.cabang || "").toUpperCase();
        const itemInduk = getIndukFromCabang(itemCabang);
        return itemInduk === cabangParam || childBranches.includes(itemCabang);
      });
    }

    // Filter status jika admin atau approver memilih filter status spesifik
    if (statusParam && statusParam !== "ALL" && statusParam !== "all") {
      finalItems = finalItems.filter((item) => item.status === statusParam);
    }

    // Filter search query
    if (search.trim()) {
      const q = search.toLowerCase();
      finalItems = finalItems.filter(
        (item) =>
          item.nomor_penawaran.toLowerCase().includes(q) ||
          (item.project?.nama_proyek || "").toLowerCase().includes(q) ||
          item.cabang.toLowerCase().includes(q) ||
          (item.vendor_nama || "").toLowerCase().includes(q) ||
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
    console.error("Error in penawaran rekanan approval queue:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Gagal memuat antrean approval penawaran rekanan." },
      { status: 500 }
    );
  }
}
