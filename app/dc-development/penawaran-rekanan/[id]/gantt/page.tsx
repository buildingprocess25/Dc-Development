import React from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import GanttChartInteractive from "@/components/penawaran-rekanan/GanttChartInteractive";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function PenawaranGanttPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/dc-development");

  const { id } = await params;
  const penawaranId = parseInt(id);

  const penawaran = await prisma.dc_penawaran_rekanan.findUnique({
    where: { id: penawaranId },
    include: {
      project: true,
      vendor: true,
      items: { orderBy: { id: "asc" } },
      gantt_items: true,
      dependencies: true,
    },
  });

  if (!penawaran) redirect("/dc-development/penawaran-rekanan");

  const roleUpper = (session.role || "").toUpperCase();
  const isKontraktor = roleUpper.includes("KONTRAKTOR") || roleUpper.includes("VENDOR");

  // Kontraktor hanya boleh membuka penawaran miliknya
  if (isKontraktor && penawaran.vendor_email.toLowerCase() !== session.email.toLowerCase()) {
    redirect("/dc-development/penawaran-rekanan");
  }

  return (
    <Dashboard title="Penyusunan Jadwal (Gantt Chart)">
      <div className="flex flex-col bg-[#FAFAFA] p-4 md:p-6 space-y-4 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)]">
        {/* Banner Header Gantt */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#E65F2B] bg-orange-50 border border-orange-200/60 px-2 py-0.5 rounded-md">
                Langkah 3 dari 4: Penjadwalan & Keterikatan
              </span>
              <span className="text-slate-300 text-xs">•</span>
              <span className="text-xs text-slate-500 font-mono">Target: {penawaran.durasi_pekerjaan_hari} Hari</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-1">{penawaran.project.nama_proyek}</h1>
            <p className="text-xs text-slate-500">
              Cabang: <span className="font-semibold text-slate-700">{penawaran.cabang}</span> • Rekanan:{" "}
              <span className="font-semibold text-slate-700">{penawaran.vendor_nama}</span>
            </p>
          </div>

          <Link href={`/dc-development/penawaran-rekanan/${penawaran.id}/review-penawaran`}>
            <button
              type="button"
              className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl transition-colors font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Kembali ke Review Finansial
            </button>
          </Link>
        </div>

        {/* Komponen Gantt Chart Interaktif Canvas */}
        <GanttChartInteractive
          penawaran={penawaran}
          totalDays={penawaran.durasi_pekerjaan_hari || 30}
        />
      </div>
    </Dashboard>
  );
}
