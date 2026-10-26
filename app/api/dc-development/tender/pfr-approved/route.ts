import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getUserCoverageBranches, getBranchesUnderInduk, isBranchAccessible } from "@/lib/branches";
import { getTenderMakerAllowedKategori } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { status: "error", message: "Sesi login tidak valid" },
        { status: 401 }
      );
    }

    // Ambil data user terkini dari dc_users untuk role & coverage cabang aktual
    const dbUser = await prisma.dc_users.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        role: true,
        cabang: true,
        coverage_cabang: true,
      },
    });

    const currentUser = dbUser || session;

    // 1. Filter Wewenang Pembuat Berdasarkan Role (Eksklusif DC Specialist & Admin)
    const allowedKategori = getTenderMakerAllowedKategori(currentUser.role);
    if (allowedKategori === "NONE") {
      return NextResponse.json({
        status: "success",
        data: [],
      });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const cabang = searchParams.get("cabang");

    // 2. Query filter: PFR yang sudah APPROVED dan renovasi strictly > Rp 1 Miliar
    const where: any = {
      status: "APPROVED",
      renovasi: {
        kategori_nilai: "DI_ATAS_1M",
        grand_total: { gt: 1_000_000_000 },
      },
    };

    // 3. Filter Coverage Cabang
    const allowedBranches = getUserCoverageBranches(currentUser);
    if (allowedBranches !== null) {
      if (cabang && cabang !== "ALL" && cabang !== "all") {
        const childBranches = getBranchesUnderInduk(cabang);
        const intersect = childBranches.filter((b) =>
          allowedBranches.includes(b.toUpperCase())
        );
        where.project = {
          cabang: { in: intersect, mode: "insensitive" },
        };
      } else {
        where.project = {
          cabang: { in: allowedBranches, mode: "insensitive" },
        };
      }
    } else if (cabang && cabang !== "ALL" && cabang !== "all") {
      const childBranches = getBranchesUnderInduk(cabang);
      where.project = {
        cabang: { in: childBranches, mode: "insensitive" },
      };
    }

    // 4. Filter Pencarian Text
    if (search.trim()) {
      const q = search.trim();
      where.OR = [
        { nomor_pengajuan: { contains: q, mode: "insensitive" } },
        { project: { nama_proyek: { contains: q, mode: "insensitive" } } },
        { project: { cabang: { contains: q, mode: "insensitive" } } },
      ];
    }

    const pfrApprovedList = await prisma.dc_fungsi_ruang.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            kode: true,
            nama_proyek: true,
            cabang: true,
            dc_induk: true,
            tipe: true,
          },
        },
        renovasi: {
          select: {
            id: true,
            nomor_pengajuan: true,
            jenis_renovasi: true,
            lingkup_pekerjaan: true,
            grand_total: true,
            durasi_hari: true,
            satuan_durasi: true,
            cabang: true,
          },
        },
        pemohon: {
          select: {
            id: true,
            nama_pemohon: true,
            jabatan: true,
            departemen: true,
            divisi: true,
            cabang: true,
          },
        },
        tenders: {
          select: {
            id: true,
            nomor_tender: true,
            status: true,
          },
        },
      },
      orderBy: { updated_at: "desc" },
    });

    // Format respons & filter in-memory pengaman
    const result = pfrApprovedList
      .filter((pfr) => {
        // Validasi akses cabang
        const pfrCabang = pfr.project?.cabang || pfr.renovasi?.cabang || "";
        if (!isBranchAccessible(pfrCabang, allowedBranches)) {
          return false;
        }

        // Validasi strictly > 1 Miliar
        const grandTotal = pfr.renovasi?.grand_total || 0;
        return grandTotal > 1_000_000_000;
      })
      .map((pfr) => {
        const grandTotal = pfr.renovasi?.grand_total || 0;

        // Cek apakah sudah ada tender yang sedang aktif (bukan DITOLAK)
        const activeTender = pfr.tenders.find((t) => t.status !== "DITOLAK");

        return {
          id: pfr.id,
          nomor_pengajuan: pfr.nomor_pengajuan,
          jenis_pengajuan: pfr.jenis_pengajuan,
          alasan_pengajuan: pfr.alasan_pengajuan,
          status: pfr.status,
          project_id: pfr.project_id,
          project_nama: pfr.project.nama_proyek,
          project_kode: pfr.project.kode,
          cabang: pfr.project.cabang,
          dc_induk: pfr.project.dc_induk,
          renovasi_id: pfr.renovasi_id,
          nomor_rab: pfr.renovasi?.nomor_pengajuan || "-",
          nilai_rab: grandTotal,
          kategori_nilai: "DI_ATAS_1M",
          tipe_threshold: "> Rp 1 Miliar",
          pemohon_nama: pfr.pemohon?.nama_pemohon || "-",
          pemohon_dept: pfr.pemohon?.departemen || "-",
          has_active_tender: Boolean(activeTender),
          active_tender_id: activeTender?.id || null,
          active_tender_nomor: activeTender?.nomor_tender || null,
          active_tender_status: activeTender?.status || null,
        };
      });

    return NextResponse.json({
      status: "success",
      data: result,
    });
  } catch (error: any) {
    console.error("Error fetching approved PFR for tender:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Gagal memuat data PFR yang siap ditenderkan.",
      },
      { status: 500 }
    );
  }
}
