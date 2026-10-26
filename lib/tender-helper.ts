import { prisma } from "@/lib/db";

export async function getVendorUsers() {
  return await prisma.dc_users.findMany({
    where: {
      OR: [
        { role: { contains: "KONTRAKTOR", mode: "insensitive" } },
        { role: { contains: "KONSULTAN", mode: "insensitive" } },
        { nama_pt: { not: null } },
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
}

export function enrichPesertaWithPic(peserta: any[], vendorUsers: any[]) {
  if (!Array.isArray(peserta)) return [];
  return peserta.map((p) => {
    if (!p.vendor) return p;
    const vName = (p.vendor.nama_perusahaan || "").trim().toUpperCase();
    const vEmail = (p.vendor.email || "").trim().toLowerCase();
    const vCabang = (p.vendor.cabang || "").trim().toUpperCase();

    const matchingPics = vendorUsers.filter((u: any) => {
      const uPt = (u.nama_pt || "").trim().toUpperCase();
      const uEmail = (u.email || "").trim().toLowerCase();
      const isPtMatch = Boolean(uPt && (uPt === vName || vName.includes(uPt) || uPt.includes(vName)));
      const isEmailMatch = Boolean(uEmail && uEmail === vEmail);
      return isPtMatch || isEmailMatch;
    });

    matchingPics.sort((a: any, b: any) => {
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

    const picUser = matchingPics.length > 0 ? matchingPics[0] : null;

    return {
      ...p,
      vendor: {
        ...p.vendor,
        pic_user: picUser,
        pic_users: matchingPics,
      },
    };
  });
}
