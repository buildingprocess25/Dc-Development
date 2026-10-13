"use client";

import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  ArrowDownRight,
  User,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RevisionDetailItem } from "@/lib/types/renovasi-revision";

export interface RevisionInstructionNote {
  id: string;
  author: string;
  role?: string;
  date: string;
  note: string;
}

export interface RevisionInstructionBannerProps {
  nomorPengajuan: string;
  statusLabel?: string;
  instructionNotes?: RevisionInstructionNote[];
  flaggedItems: Array<{
    item: RevisionDetailItem;
    isModified: boolean;
  }>;
  totalCount: number;
  modifiedCount: number;
  allModified: boolean;
  onViewAllNotesModal?: () => void;
  onJumpToItem?: (item: RevisionDetailItem) => void;
  className?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  PARAMETER: "Parameter Pengajuan",
  GAMBAR: "Gambar Kerja (Sipil/ME)",
  FOTO: "Foto Lingkungan Eksisting",
  RAB: "Estimasi Item RAB"
};

/**
 * Reusable RevisionInstructionBanner
 * Banner instruksi revisi bergaya enterprise modern di bagian atas formulir/detail pengajuan.
 * Menyajikan status revisi, instruksi peninjau, progress granular, dan quick-jump ke bagian yang wajib diperbaiki.
 */
export function RevisionInstructionBanner({
  nomorPengajuan,
  statusLabel = "STATUS: REVISI",
  instructionNotes = [],
  flaggedItems = [],
  totalCount,
  modifiedCount,
  allModified,
  onViewAllNotesModal,
  onJumpToItem,
  className
}: RevisionInstructionBannerProps) {
  const percentComplete = totalCount > 0 ? Math.round((modifiedCount / totalCount) * 100) : 100;
  const latestNote = instructionNotes.length > 0 ? instructionNotes[instructionNotes.length - 1] : null;

  return (
    <div
      className={cn(
        "rounded-2xl border-l-4 border-l-amber-500 border-y border-r border-slate-200/90 bg-white shadow-xs overflow-hidden transition-all",
        className
      )}
    >
      {/* 1. Header Section */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/40 via-amber-50/10 to-transparent border-b border-slate-100">
        <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 border border-amber-200/70 flex items-center justify-center shrink-0 shadow-2xs">
              <AlertCircle className="w-5 h-5 text-amber-700" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-slate-900 text-sm sm:text-base tracking-tight">
                  Pengajuan Memerlukan Revisi ({nomorPengajuan})
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100/90 text-amber-800 border border-amber-200/80">
                  {statusLabel}
                </span>
              </div>

              <p className="text-slate-600 text-[11px] sm:text-xs mt-1 leading-relaxed">
                Peninjau menandai beberapa bagian pada pengajuan ini. Anda{" "}
                <strong className="text-slate-900">wajib melakukan minimal 1 kali penyesuaian</strong> pada setiap bagian yang ditandai agar dapat mengajukan ulang revisi.
              </p>
            </div>
          </div>

          {instructionNotes.length > 0 && onViewAllNotesModal && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onViewAllNotesModal}
              className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs h-8 px-3 shrink-0 shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
              <span>Lihat Seluruh Catatan ({instructionNotes.length})</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Latest Revision Note Box (Instruksi Utama Peninjau) */}
      {latestNote && (
        <div className="px-4 sm:px-5 py-3.5 bg-slate-50/60 border-b border-slate-100">
          <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 text-[11px] flex-wrap">
              <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-900 font-bold">{latestNote.author}</span>
                {latestNote.role && (
                  <span className="text-slate-500 text-[10px]">({latestNote.role})</span>
                )}
                <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 uppercase tracking-wide">
                  Instruksi Peninjau
                </span>
              </div>

              {latestNote.date && (
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                  <Calendar className="w-3 h-3" />
                  <span>{latestNote.date}</span>
                </div>
              )}
            </div>

            <p className="text-slate-700 text-xs font-normal leading-relaxed whitespace-pre-wrap">
              {latestNote.note}
            </p>
          </div>
        </div>
      )}

      {/* 3. Granular Progress Checklist */}
      {flaggedItems.length > 0 && (
        <div className="p-4 sm:p-5 space-y-3.5">
          {/* Progress Header & Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">
                  Rincian Bagian yang Wajib Diperbaiki ({totalCount} Poin):
                </span>
                <span
                  className={cn(
                    "text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
                    allModified
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  )}
                >
                  {modifiedCount} dari {totalCount} Telah Diubah
                </span>
              </div>

              <span className="text-xs font-semibold text-slate-600">
                {percentComplete}% Selesai
              </span>
            </div>

            {/* Slim modern progress bar */}
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  allModified ? "bg-emerald-500" : "bg-[#E65F2B]"
                )}
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>

          {/* Grid Checklist Poin Revisi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {flaggedItems.map(({ item, isModified }) => {
              const categoryTitle = CATEGORY_LABELS[item.category] || item.category;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 transition-all duration-150",
                    isModified
                      ? "bg-emerald-50/20 border-emerald-200/90 shadow-2xs"
                      : "bg-white hover:bg-slate-50/50 border-slate-200/90 shadow-2xs"
                  )}
                >
                  {/* Top Row: Category & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {categoryTitle}
                      </span>
                      <h4
                        className="font-bold text-slate-800 text-xs truncate mt-0.5"
                        title={item.label}
                      >
                        {item.label}
                      </h4>
                    </div>

                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 border",
                        isModified
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      )}
                    >
                      {isModified ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Sudah Diubah</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Belum Diubah</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Catatan Peninjau */}
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-700 leading-relaxed">
                    <span className="font-semibold text-slate-900">Catatan: </span>
                    <span className="italic text-slate-800">&ldquo;{item.catatan}&rdquo;</span>
                  </div>

                  {/* Bottom Action: Quick Jump */}
                  {onJumpToItem && (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onJumpToItem(item)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E65F2B] hover:text-[#c44919] hover:underline cursor-pointer transition-colors"
                      >
                        <span>Lompat ke bagian ini</span>
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default RevisionInstructionBanner;
