"use client";

import React from "react";
import { CalendarDays, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { RevisionPinpointBadge } from "@/components/approval/RevisionPinpointBadge";
import { cn } from "@/lib/utils";

interface FormTanggalTenderCardProps {
  tanggalTender: string; // YYYY-MM-DD
  onChangeTanggal: (dateStr: string) => void;
  isRevision?: boolean;
  pinpoint?: { isFlagged: boolean; catatan: string; isModified: boolean };
}

export function FormTanggalTenderCard({
  tanggalTender,
  onChangeTanggal,
  isRevision = false,
  pinpoint,
}: FormTanggalTenderCardProps) {
  // Format tanggal ke Bahasa Indonesia untuk preview yang ramah dibaca
  const formattedPreview = React.useMemo(() => {
    if (!tanggalTender) return "-";
    try {
      const d = new Date(tanggalTender);
      if (isNaN(d.getTime())) return "-";
      return new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(d);
    } catch {
      return tanggalTender;
    }
  }, [tanggalTender]);

  // Evaluasi status jadwal terhadap hari ini
  const scheduleStatus = React.useMemo(() => {
    if (!tanggalTender) return null;
    const today = new Date().toISOString().split("T")[0];
    if (tanggalTender === today) {
      return {
        label: "Tender Aktif Hari Ini",
        variant: "active",
      };
    } else if (tanggalTender > today) {
      return {
        label: "Terjadwal Mendatang",
        variant: "future",
      };
    } else {
      return {
        label: "Tanggal Telah Lewat",
        variant: "past",
      };
    }
  }, [tanggalTender]);

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border p-5 space-y-4 shadow-xs transition-all duration-200",
        pinpoint?.isFlagged && !pinpoint.isModified
          ? "border-amber-400 ring-2 ring-amber-300/40 bg-amber-50/10"
          : "border-slate-200/80 hover:border-slate-300"
      )}
    >
      {/* Header Card */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/70 text-[#E65F2B] flex items-center justify-center shrink-0">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Jadwal Pelaksanaan Tender Rekanan
              </h3>
              {pinpoint?.isFlagged && (
                <RevisionPinpointBadge
                  catatan={pinpoint.catatan}
                  isModified={pinpoint.isModified}
                  label="Revisi Jadwal"
                />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tentukan tanggal pelaksanaan lelang penawaran kontraktor setelah klarifikasi aanwijzing disetujui.
            </p>
          </div>
        </div>

        {/* Status Badge */}
        {scheduleStatus && (
          <div>
            {scheduleStatus.variant === "active" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {scheduleStatus.label}
              </span>
            )}
            {scheduleStatus.variant === "future" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                {scheduleStatus.label}
              </span>
            )}
            {scheduleStatus.variant === "past" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                {scheduleStatus.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Grid Kontrol Input Tanggal & Banner Penjelas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        {/* Kolom Input Tanggal */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
            <span>Tanggal Pelaksanaan Tender</span>
            <span className="text-rose-500 font-bold">*</span>
          </label>
          <div className="relative">
            <input
              type="date"
              value={tanggalTender}
              onChange={(e) => onChangeTanggal(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#E65F2B]/30 focus:border-[#E65F2B] transition-all cursor-pointer font-mono"
            />
          </div>
          <div className="text-[11px] text-slate-500 font-medium pt-0.5">
            Terpilih: <span className="font-bold text-slate-800">{formattedPreview}</span>
          </div>
        </div>

        {/* Kolom Informasi Kebijakan Eliminasi */}
        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 text-xs text-amber-950 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px] uppercase tracking-wider">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Ketentuan Waktu &amp; Eliminasi Otomatis</span>
          </div>
          <p className="text-[11px] text-amber-900/90 leading-relaxed">
            Kontraktor yang hadir aktual <strong>hanya dapat mengisi dan mengajukan penawaran tepat pada tanggal ini</strong> (pukul 00:00 s/d 23:59). Rekanan yang tidak mengajukan penawaran hingga tanggal tersebut berakhir akan <strong>otomatis tereliminasi</strong> dari lelang proyek.
          </p>
        </div>
      </div>
    </div>
  );
}
