import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isVendorCoveringBranch } from "@/lib/branches";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const jenis = searchParams.get("jenis");
    const golongan = searchParams.get("golongan");
    const cabang = searchParams.get("cabang");

    const where: any = { status_aktif: true };

    if (search) {
      where.OR = [
        { nama_perusahaan: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { nomor_telepon: { contains: search, mode: "insensitive" } },
        { alamat: { contains: search, mode: "insensitive" } },
        { cabang: { contains: search, mode: "insensitive" } },
        { coverage_cabang: { contains: search, mode: "insensitive" } },
      ];
    }

    if (jenis && jenis !== "ALL") {
      if (jenis === "KONSULTAN") {
        where.jenis = { contains: "KONSULTAN", mode: "insensitive" };
      } else {
        where.jenis = jenis;
      }
    }

    if (golongan && golongan !== "ALL") {
      where.golongan = golongan;
    }

    if (cabang && cabang !== "ALL" && cabang !== "all") {
      where.OR = [
        ...(where.OR || []),
        { cabang: cabang },
        { coverage_cabang: { contains: cabang, mode: "insensitive" } },
      ];
    }

    // Ambil seluruh master vendor aktif
    const vendors = await prisma.dc_master_vendor.findMany({
      where,
      orderBy: { nama_perusahaan: "asc" },
    });

    // Ambil seluruh user dengan role rekanan (KONTRAKTOR / KONSULTAN) untuk dicocokkan berdasarkan nama_pt & cabang
    const vendorUsers = await prisma.dc_users.findMany({
      where: {
        OR: [
          { role: { contains: "KONTRAKTOR", mode: "insensitive" } },
          { role: { contains: "KONSULTAN", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        cabang: true,
        coverage_cabang: true,
        nama_pt: true,
      },
    });

    // Filter cabang menggunakan isVendorCoveringBranch jika parameter cabang disediakan
    let filteredVendors = vendors;
    if (cabang && cabang !== "ALL" && cabang !== "all") {
      filteredVendors = vendors.filter((v) =>
        isVendorCoveringBranch(v.cabang, v.coverage_cabang, cabang)
      );
    }

    // Pasangkan PIC user secara dinamis berdasarkan kecocokan nama_pt, coverage_cabang, dan role
    const vendorsWithPics = filteredVendors.map((vendor) => {
      const vName = (vendor.nama_perusahaan || "").trim().toUpperCase();
      const vEmail = (vendor.email || "").trim().toLowerCase();
      const vJenis = (vendor.jenis || "").trim().toUpperCase();
      const vCabang = (vendor.cabang || "").trim().toUpperCase();

      // Cocokkan PIC: nama_pt sama persis/mengandung nama perusahaan atau email sama, dan role sesuai (KONTRAKTOR / KONSULTAN)
      const matchingPics = vendorUsers.filter((u) => {
        const uPt = (u.nama_pt || "").trim().toUpperCase();
        const uEmail = (u.email || "").trim().toLowerCase();
        const uRole = (u.role || "").trim().toUpperCase();

        const isPtMatch = Boolean(uPt && (uPt === vName || vName.includes(uPt) || uPt.includes(vName)));
        const isEmailMatch = Boolean(uEmail && uEmail === vEmail);

        if (!isPtMatch && !isEmailMatch) return false;

        // Verifikasi kesesuaian role
        if (vJenis.includes("KONTRAKTOR") && !uRole.includes("KONTRAKTOR")) return false;
        if (vJenis.includes("KONSULTAN") && !uRole.includes("KONSULTAN")) return false;

        return true;
      });

      // Prioritaskan yang nama_pt sama persis dan coverage cabang cocok
      matchingPics.sort((a, b) => {
        const aPt = (a.nama_pt || "").trim().toUpperCase();
        const bPt = (b.nama_pt || "").trim().toUpperCase();
        if (aPt === vName && bPt !== vName) return -1;
        if (bPt === vName && aPt !== vName) return 1;

        const aCov = (a.coverage_cabang || "").toUpperCase();
        const bCov = (b.coverage_cabang || "").toUpperCase();
        const aHasCoverage = aCov.includes(vCabang);
        const bHasCoverage = bCov.includes(vCabang);
        if (aHasCoverage && !bHasCoverage) return -1;
        if (bHasCoverage && !aHasCoverage) return 1;

        return 0;
      });

      return {
        ...vendor,
        pic_users: matchingPics,
        pic_user: matchingPics.length > 0 ? matchingPics[0] : null,
      };
    });

    return NextResponse.json({ status: "success", data: vendorsWithPics });
  } catch (error: any) {
    console.error("Error fetching master vendor list:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Gagal mengambil data vendor" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      nama_perusahaan,
      alamat,
      nomor_telepon,
      email,
      golongan,
      jenis,
      cabang,
      coverage_cabang,
      pengalaman,
      sertifikat,
      sertifikasi_iso,
    } = body;

    if (!nama_perusahaan || !alamat || !nomor_telepon || !email || !golongan || !jenis) {
      return NextResponse.json(
        { status: "error", message: "Mohon lengkapi seluruh field wajib profil vendor." },
        { status: 400 }
      );
    }

    const vendor = await prisma.dc_master_vendor.create({
      data: {
        nama_perusahaan: String(nama_perusahaan).trim(),
        alamat: String(alamat).trim(),
        nomor_telepon: String(nomor_telepon).trim(),
        email: String(email).trim().toLowerCase(),
        golongan: String(golongan).trim(),
        jenis: String(jenis).trim(),
        cabang: cabang ? String(cabang).trim().toUpperCase() : "HEAD OFFICE",
        coverage_cabang: coverage_cabang ? String(coverage_cabang).trim().toUpperCase() : null,
        pengalaman: Array.isArray(pengalaman) ? pengalaman : [],
        sertifikat: Array.isArray(sertifikat) ? sertifikat : [],
        sertifikasi_iso: Array.isArray(sertifikasi_iso) ? sertifikasi_iso : [],
        status_aktif: true,
      },
    });

    return NextResponse.json({ status: "success", data: vendor }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating master vendor:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Gagal membuat data vendor" },
      { status: 500 }
    );
  }
}
