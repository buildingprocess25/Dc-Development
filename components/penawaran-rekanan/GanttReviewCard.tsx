"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import Link from "next/link";
import GanttChartInteractive from "./GanttChartInteractive";

interface GanttReviewProps {
  penawaran: any;
  isKontraktor?: boolean;
}

export default function GanttReviewCard({ penawaran, isKontraktor = false }: GanttReviewProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: "success" | "error" | "warning";
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: "success",
    title: "",
    message: "",
  });

  const formatNumber = (n: number) => {
    if (!n && n !== 0) return "0";
    return new Intl.NumberFormat("id-ID").format(n);
  };


  const handleSubmitFinal = async () => {
    try {
      setSubmitting(true);
      const res = await fetch(`/api/dc-development/penawaran-rekanan/${penawaran.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "DIAJUKAN",
          catatan_kontraktor: penawaran.catatan_kontraktor || "Penawaran tender resmi diajukan oleh rekanan",
        }),
      });

      const json = await res.json();
      if (json.status === "success") {
        setFeedback({
          isOpen: true,
          type: "success",
          title: "Penawaran Berhasil Diajukan!",
          message: "Berkas harga penawaran BoQ dan jadwal pelaksanaan proyek Anda telah resmi diserahkan ke panitia tender DC.",
        });
      } else {
        setFeedback({
          isOpen: true,
          type: "error",
          title: "Gagal Mengajukan",
          message: json.message || "Terjadi kesalahan saat mengajukan penawaran lelang.",
        });
      }
    } catch (e: any) {
      setFeedback({
        isOpen: true,
        type: "error",
        title: "Error Server",
        message: e.message || "Gagal menghubungi server.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col bg-[#FAFAFA] rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden animate-in fade-in duration-300">
      {/* Scrollable Content Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4">
        {/* Banner Header Review Gantt */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#E65F2B] bg-orange-50 border border-orange-200/60 px-2 py-0.5 rounded-md">
                {penawaran.status === "DRAFT"
                  ? "Langkah 4 dari 4: Final Review & Pengajuan Resmi"
                  : "Detail Jadwal Pelaksanaan (Gantt Chart)"}
              </span>
              <span className="text-slate-300 text-xs">•</span>
              <span className="text-xs text-slate-500 font-mono">No. {penawaran.nomor_penawaran}</span>
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
                ? `/dc-development/penawaran-rekanan/${penawaran.id}/gantt`
                : `/dc-development/penawaran-rekanan/${penawaran.id}/review-penawaran`
            }
          >
            <button
              type="button"
              className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl transition-colors font-medium cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              {penawaran.status === "DRAFT" && isKontraktor ? "Kembali ke Edit Jadwal" : "Kembali ke Detail BoQ"}
            </button>
          </Link>
        </div>

        {/* Kartu Ringkasan Atas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Subtotal Sipil</span>
            <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
              Rp {formatNumber(penawaran.total_biaya_sipil)}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Subtotal ME</span>
            <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
              Rp {formatNumber(penawaran.total_biaya_me)}
            </div>
          </div>

          <div className="bg-orange-50/70 p-4 rounded-2xl border border-orange-200/80 shadow-xs">
            <span className="text-[10px] font-semibold text-[#E65F2B] uppercase tracking-wider">Grand Total Penawaran</span>
            <div className="text-lg font-bold text-[#E65F2B] font-mono mt-0.5">
              Rp {formatNumber(penawaran.grand_total)}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Durasi Pelaksanaan</span>
            <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
              {penawaran.durasi_pekerjaan_hari} Hari
            </div>
          </div>
        </div>

        {/* View Gantt Chart Berjenjang Asli (Read-Only) */}
        <GanttChartInteractive
          penawaran={penawaran}
          totalDays={penawaran.durasi_pekerjaan_hari}
          readOnly={true}
        />
      </div>

      {/* FIXED FOOTER BAR - Opaque, docked at bottom of the card, zero bleed-through */}
      <div className="shrink-0 bg-white border-t border-slate-200/80 px-4 md:px-6 py-3.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] flex items-center justify-between z-20">
        {penawaran.status === "DRAFT" ? (
          <>
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#E65F2B] shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="hidden sm:block">
                <h4 className="font-bold text-slate-900 text-xs">Pernyataan Kesanggupan &amp; Pengajuan Resmi</h4>
                <p className="text-[11px] text-slate-500">
                  Seluruh harga dan durasi telah sah dan siap diajukan ke panitia tender.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <Link href={`/dc-development/penawaran-rekanan/${penawaran.id}/gantt`}>
                <Button variant="outline" className="border-slate-300 text-slate-700 text-xs rounded-xl h-9 hover:bg-slate-50 font-medium cursor-pointer">
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Kembali Edit Jadwal
                </Button>
              </Link>

              <Button
                disabled={submitting}
                onClick={handleSubmitFinal}
                className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white rounded-xl text-xs h-9 px-5 shadow-xs font-semibold cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Mengirim...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Ajukan Penawaran Resmi
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Status Berkas:</span>
              <span className="font-bold font-mono text-[#E65F2B] bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200/60 uppercase">
                {penawaran.status}
              </span>
            </div>

            <Link href={`/dc-development/penawaran-rekanan/${penawaran.id}/review-penawaran`}>
              <Button variant="outline" className="border-slate-300 text-slate-700 text-xs rounded-xl h-9 hover:bg-slate-50 font-medium cursor-pointer">
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Kembali ke Rincian BoQ
              </Button>
            </Link>
          </>
        )}
      </div>

      <FeedbackModal
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => {
          setFeedback((prev) => ({ ...prev, isOpen: false }));
          if (feedback.type === "success") {
            router.push("/dc-development/penawaran-rekanan");
          }
        }}
      />
    </div>
  );
}
