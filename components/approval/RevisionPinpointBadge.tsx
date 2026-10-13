"use client";

import React, { useState, useRef } from "react";
import { AlertCircle, CheckCircle2, Check, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface RevisionPinpointBadgeProps {
  catatan: string;
  isModified: boolean;
  label?: string;
  reviewerName?: string;
  reviewedAt?: string;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
}

/**
 * Reusable RevisionPinpointBadge
 * Badge kontekstual in-place untuk menandai item/field formulir yang memerlukan revisi.
 * Menggunakan Radix UI Popover Portal dengan collision avoidance agar anti-terpotong dan anti-numpuk.
 */
export function RevisionPinpointBadge({
  catatan,
  isModified,
  label,
  reviewerName,
  reviewedAt,
  className,
  align = "center",
  side = "top"
}: RevisionPinpointBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  return (
    <div
      className={cn("inline-flex items-center", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((prev) => !prev);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all duration-150 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
              isModified
                ? "bg-emerald-50 text-emerald-800 border-emerald-200/90 hover:bg-emerald-100 hover:border-emerald-300 focus-visible:ring-emerald-400"
                : "bg-amber-50 text-amber-900 border-amber-200/90 hover:bg-amber-100 hover:border-amber-300 focus-visible:ring-amber-400"
            )}
            title="Klik atau arahkan mouse untuk melihat catatan revisi"
          >
            {isModified ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span>Sudah Diubah</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                <span>Perlu Revisi</span>
              </>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={16}
          onMouseEnter={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
          }}
          onMouseLeave={handleMouseLeave}
          className="w-80 max-w-[90vw] p-4 rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/10 text-slate-900 z-50 text-xs focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
                  isModified
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                )}
              >
                {isModified ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
              </div>
              <span className="font-bold text-slate-800 text-xs truncate">
                Catatan Peninjau
              </span>
            </div>

            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shrink-0 border",
                isModified
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              )}
            >
              {isModified ? "Perubahan Terdeteksi" : "Wajib Diperbaiki"}
            </span>
          </div>

          {/* Target Label */}
          {label && (
            <div className="pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Bagian
              </span>
              <p className="text-[11px] font-semibold text-slate-700 truncate mt-0.5">
                {label}
              </p>
            </div>
          )}

          {/* Catatan Peninjau Content */}
          <div className="mt-2 p-3 rounded-xl bg-slate-50/90 border border-slate-100 text-[11px] text-slate-700 leading-relaxed font-normal whitespace-pre-wrap select-text">
            {catatan || "Bagian ini ditandai oleh peninjau untuk dilakukan penyesuaian."}
          </div>

          {/* Footer Metadata & Status Hint */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[10px]">
            <div className="text-slate-400 truncate">
              {reviewerName ? (
                <span>
                  Oleh <span className="font-medium text-slate-600">{reviewerName}</span>
                </span>
              ) : (
                <span>Peninjau Berwenang</span>
              )}
              {reviewedAt && <span> &bull; {reviewedAt}</span>}
            </div>

            <div className="shrink-0">
              {isModified ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                  <Check className="w-3 h-3" /> Siap diajukan
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                  <Clock className="w-3 h-3 text-amber-500" /> Menunggu edit
                </span>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default RevisionPinpointBadge;
