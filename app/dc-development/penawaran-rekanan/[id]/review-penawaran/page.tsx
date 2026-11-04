import React from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isExternalPartnerRole } from "@/lib/permissions";
import ReviewPenawaranCard from "@/components/penawaran-rekanan/ReviewPenawaranCard";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function ReviewPenawaranPage({
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
      klarifikasi: {
        include: {
          dokumen: true,
        },
      },
    },
  });

  if (!penawaran) redirect("/dc-development/penawaran-rekanan");

  const isKontraktor = isExternalPartnerRole(session.role);

  // Kontraktor hanya boleh membuka penawaran miliknya
  if (isKontraktor && penawaran.vendor_email.toLowerCase() !== session.email.toLowerCase()) {
    redirect("/dc-development/penawaran-rekanan");
  }

  // Validasi Kelengkapan: Jika masih DRAFT, kontraktor dilarang ke halaman review jika harga atau dokumen asuransi belum lengkap
  if (isKontraktor && penawaran.status === "DRAFT") {
    const hasIncompletePrices = (penawaran.items || []).some(
      (it: any) =>
        (!it.harga_material || it.harga_material <= 0) && (!it.harga_upah || it.harga_upah <= 0)
    );
    const hasMissingDocuments =
      !penawaran.kontraktor_logo_url ||
      !penawaran.analisa_harga_url ||
      !penawaran.asuransi_no_polis ||
      !penawaran.asuransi_masa_berlaku ||
      !penawaran.asuransi_file_url;

    if (hasIncompletePrices || hasMissingDocuments) {
      redirect(`/dc-development/penawaran-rekanan/${penawaran.id}`);
    }
  }

  const dokumenList = penawaran.klarifikasi?.dokumen || [];

  return (
    <Dashboard title="Review Penawaran Rekanan">
      <div className="flex-1 h-full min-h-0 flex flex-col bg-[#FAFAFA] rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden animate-in fade-in duration-300">
        {/* Scrollable Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4">
          {/* Banner Header Review */}
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E65F2B] bg-orange-50 border border-orange-200/60 px-2 py-0.5 rounded-md">
                  {penawaran.status === "DRAFT"
                    ? "Langkah 2 dari 4: Review Penawaran & Dokumen Teknis"
                    : "Detail Berkas Penawaran Rekanan"}
                </span>
                <span className="text-slate-300 text-xs">•</span>
                <span className="text-xs text-slate-500 font-mono">No. {penawaran.nomor_penawaran}</span>
                {penawaran.status !== "DRAFT" && (
                  <>
                    <span className="text-slate-300 text-xs">•</span>
                    <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                      Status: {penawaran.status}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-lg font-bold text-slate-900 mt-1">{penawaran.project.nama_proyek}</h1>
              <p className="text-xs text-slate-500">
                Cabang: <span className="font-semibold text-slate-700">{penawaran.cabang}</span> • Rekanan:{" "}
                <span className="font-semibold text-slate-700">{penawaran.vendor_nama}</span>
              </p>
            </div>

            <Link
              href={
                penawaran.status === "DRAFT" && isKontraktor
                  ? `/dc-development/penawaran-rekanan/${penawaran.id}`
                  : `/dc-development/penawaran-rekanan`
              }
            >
              <button
                type="button"
                className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl transition-colors font-medium cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                {penawaran.status === "DRAFT" && isKontraktor ? "Kembali ke Edit BoQ" : "Kembali ke Daftar Penawaran"}
              </button>
            </Link>
          </div>

          {/* Komponen Review Penawaran (Tabs & BoQ Tables) */}
          <ReviewPenawaranCard
            penawaran={penawaran}
            dokumenList={dokumenList}
            isKontraktor={isKontraktor}
          />
        </div>

        {/* FIXED FOOTER BAR - Opaque, docked at bottom of the card, zero bleed-through */}
        <div className="shrink-0 bg-white border-t border-slate-200/80 px-4 md:px-6 py-3.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] flex items-center justify-between z-20">
          {penawaran.status === "DRAFT" && isKontraktor ? (
            <>
              <Link href={`/dc-development/penawaran-rekanan/${penawaran.id}`}>
                <Button variant="outline" className="border-slate-300 text-slate-700 text-xs rounded-xl h-9 hover:bg-slate-50 font-medium cursor-pointer">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Kembali Edit Harga BoQ
                </Button>
              </Link>
              <Link href={`/dc-development/penawaran-rekanan/${penawaran.id}/gantt`}>
                <Button className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs rounded-xl h-9 px-5 shadow-xs font-semibold cursor-pointer">
                  Lanjut ke Gantt Chart Jadwal
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/dc-development/penawaran-rekanan">
                <Button variant="outline" className="border-slate-300 text-slate-700 text-xs rounded-xl h-9 hover:bg-slate-50 font-medium cursor-pointer">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Kembali ke Daftar Penawaran
                </Button>
              </Link>

              <div className="flex items-center space-x-3">
                <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Status Berkas:</span>
                  <span className="font-bold font-mono text-[#E65F2B] bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200/60 uppercase">
                    {penawaran.status}
                  </span>
                </div>
                <Link href={`/dc-development/penawaran-rekanan/${penawaran.id}/review-gantt`}>
                  <Button className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs rounded-xl h-9 px-5 shadow-xs font-semibold cursor-pointer">
                    Lihat Jadwal Gantt Chart
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </Dashboard>
  );
}
