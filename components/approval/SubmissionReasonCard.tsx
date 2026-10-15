"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

export interface SubmissionReasonCardProps {
  /** Teks alasan atau catatan pengajuan langsung */
  reason?: string | null;
  /** Objek data (submission fungsi-ruang atau renovasi rab-oe) */
  data?: any;
  /** Judul kartu (default: "Rincian & Alasan Pengajuan") */
  title?: string;
  /** ClassName styling tambahan */
  className?: string;
}

/**
 * Mengekstrak catatan awal pengajuan maker dari string catatan_pengajuan (jika ada),
 * sebelum entri log peninjau berikutnya [APPROVE/REVISI/TOLAK oleh ...]
 */
export function getInitialSubmissionReason(text?: string | null): string | null {
  if (!text || !text.trim()) return null;
  const trimmed = text.trim();
  const firstBracket = trimmed.indexOf("[");
  if (firstBracket === 0) {
    // Dimulai langsung dengan log peninjau, tidak ada catatan awal pengajuan
    return null;
  }
  if (firstBracket > 0) {
    const initialNote = trimmed.substring(0, firstBracket).trim();
    return initialNote || null;
  }
  return trimmed;
}

export default function SubmissionReasonCard({
  reason: explicitReason,
  data,
  title = "Rincian & Alasan Pengajuan",
  className
}: SubmissionReasonCardProps) {
  const reasonText = useMemo(() => {
    if (explicitReason && explicitReason.trim()) {
      return explicitReason.trim();
    }
    if (data) {
      if (typeof data.alasan_pengajuan === "string" && data.alasan_pengajuan.trim()) {
        return data.alasan_pengajuan.trim();
      }
      if (typeof data.alasan === "string" && data.alasan.trim()) {
        return data.alasan.trim();
      }
      if (typeof data.keterangan === "string" && data.keterangan.trim()) {
        return data.keterangan.trim();
      }
      if (typeof data.catatan_pengajuan === "string" && data.catatan_pengajuan.trim()) {
        return getInitialSubmissionReason(data.catatan_pengajuan);
      }
      if (typeof data.catatan === "string" && data.catatan.trim()) {
        return getInitialSubmissionReason(data.catatan);
      }
    }
    return null;
  }, [explicitReason, data]);

  // Jika memang tidak ada catatan / alasan pengajuan, jangan ditampilkan sama sekali
  if (!reasonText) {
    return null;
  }

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-slate-200/90 shadow-2xs",
        className
      )}
    >
      <div className="p-4 sm:p-5">
        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
          {title}
        </h4>
        <p className="text-xs text-slate-700 leading-relaxed font-medium bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 whitespace-pre-wrap">
          {reasonText}
        </p>
      </div>
    </div>
  );
}

export { SubmissionReasonCard };
