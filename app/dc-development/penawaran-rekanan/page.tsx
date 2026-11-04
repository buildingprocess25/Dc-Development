import React from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canUserAccessPenawaranRekanan, isExternalPartnerRole } from "@/lib/permissions";
import { getUserCoverageBranches } from "@/lib/branches";
import { prisma } from "@/lib/db";
import { Scale } from "lucide-react";
import PenawaranRekananClient from "@/components/penawaran-rekanan/PenawaranRekananClient";

export default async function PenawaranRekananPage() {
  const session = await getSession();
  if (!session || !canUserAccessPenawaranRekanan(session)) {
    redirect("/dc-development");
  }

  const isRekananUser = isExternalPartnerRole(session.role);
  const userCoverage = getUserCoverageBranches(session);

  const where: any = {};

  if (isRekananUser) {
    // Rekanan hanya melihat penawaran yang dibuat oleh dirinya sendiri
    const orConditions: any[] = [
      { vendor_email: { equals: session.email, mode: "insensitive" } },
      { created_by: { equals: session.email, mode: "insensitive" } },
    ];
    if (session.nama_pt) {
      orConditions.push({
        vendor_nama: { contains: session.nama_pt.trim(), mode: "insensitive" },
      });
    }
    where.OR = orConditions;
  } else {
    // Pengguna internal (BBM Manager, DC Specialist, Admin, dll.) disaring berdasarkan coverage_cabang
    if (userCoverage && userCoverage.length > 0) {
      where.cabang = { in: userCoverage, mode: "insensitive" };
    }
  }

  const initialPenawaran = await prisma.dc_penawaran_rekanan.findMany({
    where,
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
      klarifikasi: {
        select: {
          id: true,
          nomor_klarifikasi: true,
          durasi_hari_akhir: true,
          status: true,
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
      audit_logs: {
        orderBy: { created_at: "desc" },
        take: 1,
      },
    },
    orderBy: { created_at: "desc" },
  });

  return (
    <Dashboard title="Penawaran Rekanan">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 space-y-4 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)]">
        {/* Banner Header SPARTA */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#E65F2B] shadow-2xs">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-100/80 text-[#E65F2B]">
                  SOP SAT/SOP/DCB/003
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-xs font-medium text-slate-500">Proses Tender Rekanan DC</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">Pemasukan Penawaran Rekanan</h1>
            </div>
          </div>
        </div>

        {/* Client Wrapper dengan Toolbar & Modal Tambah */}
        <PenawaranRekananClient
          initialData={Array.isArray(initialPenawaran) ? JSON.parse(JSON.stringify(initialPenawaran)) : []}
          user={{
            email: session.email || "",
            role: session.role || "",
            nama_pt: session.nama_pt || null,
          }}
        />
      </div>
    </Dashboard>
  );
}
