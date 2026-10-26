import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vendorId = parseInt(id, 10);
    if (isNaN(vendorId)) {
      return NextResponse.json({ status: "error", message: "ID Vendor tidak valid" }, { status: 400 });
    }

    const vendor = await prisma.dc_master_vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      return NextResponse.json({ status: "error", message: "Data vendor tidak ditemukan" }, { status: 404 });
    }

    // Cari PIC akun dc_users yang cocok dengan nama_pt dan role
    const vName = (vendor.nama_perusahaan || "").trim().toUpperCase();
    const vEmail = (vendor.email || "").trim().toLowerCase();
    const vJenis = (vendor.jenis || "").trim().toUpperCase();
    const vCabang = (vendor.cabang || "").trim().toUpperCase();

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

    const vendorWithPic = {
      ...vendor,
      pic_users: matchingPics,
      pic_user: matchingPics.length > 0 ? matchingPics[0] : null,
    };

    return NextResponse.json({ status: "success", data: vendorWithPic });
  } catch (error: any) {
    console.error("Error fetching vendor detail:", error);
    return NextResponse.json({ status: "error", message: error.message || "Gagal memuat detail vendor" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vendorId = parseInt(id, 10);
    if (isNaN(vendorId)) {
      return NextResponse.json({ status: "error", message: "ID Vendor tidak valid" }, { status: 400 });
    }

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
      status_aktif,
    } = body;

    const updated = await prisma.dc_master_vendor.update({
      where: { id: vendorId },
      data: {
        nama_perusahaan: nama_perusahaan ? String(nama_perusahaan).trim() : undefined,
        alamat: alamat ? String(alamat).trim() : undefined,
        nomor_telepon: nomor_telepon ? String(nomor_telepon).trim() : undefined,
        email: email ? String(email).trim().toLowerCase() : undefined,
        golongan: golongan ? String(golongan).trim() : undefined,
        jenis: jenis ? String(jenis).trim() : undefined,
        cabang: cabang ? String(cabang).trim().toUpperCase() : undefined,
        coverage_cabang: coverage_cabang !== undefined ? (coverage_cabang ? String(coverage_cabang).trim().toUpperCase() : null) : undefined,
        pengalaman: Array.isArray(pengalaman) ? pengalaman : undefined,
        sertifikat: Array.isArray(sertifikat) ? sertifikat : undefined,
        sertifikasi_iso: Array.isArray(sertifikasi_iso) ? sertifikasi_iso : undefined,
        status_aktif: typeof status_aktif === "boolean" ? status_aktif : undefined,
      },
    });

    return NextResponse.json({ status: "success", data: updated });
  } catch (error: any) {
    console.error("Error updating vendor:", error);
    return NextResponse.json({ status: "error", message: error.message || "Gagal memperbarui data vendor" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vendorId = parseInt(id, 10);
    if (isNaN(vendorId)) {
      return NextResponse.json({ status: "error", message: "ID Vendor tidak valid" }, { status: 400 });
    }

    await prisma.dc_master_vendor.delete({
      where: { id: vendorId },
    });

    return NextResponse.json({ status: "success", message: "Vendor berhasil dihapus" });
  } catch (error: any) {
    console.error("Error deleting vendor:", error);
    return NextResponse.json({ status: "error", message: error.message || "Gagal menghapus data vendor" }, { status: 500 });
  }
}
