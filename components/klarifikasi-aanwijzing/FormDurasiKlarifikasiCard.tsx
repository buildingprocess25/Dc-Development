"use client";

import React from "react";
import { Clock, AlertCircle, CheckCircle2, ArrowRight, ChevronUp, ChevronDown } from "lucide-react";
import { RevisionPinpointBadge } from "@/components/approval/RevisionPinpointBadge";
import { cn } from "@/lib/utils";

interface FormDurasiKlarifikasiCardProps {
  durasiAwal: number;
  durasiAkhir: number;
  onChangeDurasi: (durasi: number) => void;
  catatanDurasi: string;
  onChangeCatatan: (catatan: string) => void;
  isRevision?: boolean;
  pinpoint?: { isFlagged: boolean; catatan: string; isModified: boolean };
}

export function FormDurasiKlarifikasiCard({
  durasiAwal,
  durasiAkhir,
  onChangeDurasi,
  catatanDurasi,
  onChangeCatatan,
  isRevision = false,
  pinpoint,
}: FormDurasiKlarifikasiCardProps) {
  const isChanged = durasiAkhir !== durasiAwal;
  const selisih = durasiAkhir - durasiAwal;

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
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Durasi Pekerjaan Proyek
              </h3>
              {pinpoint?.isFlagged && (
                <RevisionPinpointBadge
                  catatan={pinpoint.catatan}
                  isModified={pinpoint.isModified}
                  label="Revisi Durasi"
                />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Sesuaikan estimasi durasi pekerjaan jika terdapat kesepakatan baru saat rapat klarifikasi.
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {isChanged ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-[#E65F2B] border border-orange-200">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E65F2B]" />
              Durasi Berubah ({selisih > 0 ? `+${selisih}` : selisih} Hari)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Tetap (Sesuai Penawaran RAB/OE)
            </span>
          )}
        </div>
      </div>

      {/* Grid Komparasi Awal vs Klarifikasi */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Box Durasi Awal */}
        <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/70 flex flex-col justify-between">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
            Durasi Awal (Penawaran RAB/OE)
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-700 font-mono">
              {durasiAwal || 0}
            </span>
            <span className="text-xs font-semibold text-slate-500">Hari</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 italic">
            *Data referensi bawaan dari berkas penawaran RAB/OE proyek.
          </div>
        </div>

        {/* Box Durasi Klarifikasi Baru */}
        <div
          className={cn(
            "p-3.5 rounded-xl border flex flex-col justify-between transition-colors",
            isChanged
              ? "border-orange-200 bg-orange-50/20"
              : "border-slate-200/90 bg-white"
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] uppercase font-bold text-slate-700">
              Durasi Klarifikasi Aanwijzing <span className="text-rose-500">*</span>
            </label>
            {isChanged && (
              <span className="text-[10px] font-bold text-[#E65F2B] flex items-center gap-1">
                <ArrowRight className="w-3 h-3" />
                <span>Diperbarui</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={durasiAkhir || ""}
                onChange={(e) => {
                  const sanitized = e.target.value.replace(/[^0-9]/g, "");
                  const val = parseInt(sanitized, 10);
                  onChangeDurasi(isNaN(val) ? 0 : val);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    onChangeDurasi((durasiAkhir || 0) + 1);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    onChangeDurasi(Math.max(1, (durasiAkhir || 1) - 1));
                  }
                }}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Contoh: 45"
                className="w-full h-10 pl-3.5 pr-10 text-base font-bold font-mono text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E65F2B] focus:border-[#E65F2B] bg-white transition-all"
              />

              {/* Stepper Buttons (Tombol Arah Atas & Bawah) */}
              <div className="absolute right-1 flex flex-col items-center justify-center -space-y-0.5">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => onChangeDurasi((durasiAkhir || 0) + 1)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 active:text-[#E65F2B] transition-colors cursor-pointer active:scale-95"
                  title="Tambah 1 Hari (Arah Atas)"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => onChangeDurasi(Math.max(1, (durasiAkhir || 1) - 1))}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 active:text-[#E65F2B] transition-colors cursor-pointer active:scale-95"
                  title="Kurang 1 Hari (Arah Bawah)"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <span className="text-xs font-bold text-slate-600 shrink-0 bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200">
              Hari
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Gunakan tombol arah atas/bawah (&uarr; &darr;) atau ketik langsung angka durasi.</span>
          </div>
        </div>
      </div>

      {/* Input Catatan jika Durasi Berubah */}
      {isChanged && (
        <div className="p-3.5 rounded-xl border border-orange-200 bg-orange-50/30 space-y-1.5 animate-in fade-in duration-200">
          <label className="block text-[11px] font-bold text-orange-950">
            Alasan / Catatan Perubahan Durasi <span className="text-rose-500">* Wajib Diisi</span>
          </label>
          <input
            type="text"
            value={catatanDurasi}
            onChange={(e) => onChangeCatatan(e.target.value)}
            placeholder="Contoh: Penyesuaian waktu pekerjaan struktur bobokan dan perbaikan lantai gudang..."
            className="w-full text-xs p-2.5 rounded-lg border border-orange-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#E65F2B]"
          />
          <p className="text-[10px] text-orange-700/80">
            Catatan ini akan dicetak pada Berita Acara Klarifikasi untuk menjelaskan dasar perubahan durasi kontrak kerja.
          </p>
        </div>
      )}
    </div>
  );
}
