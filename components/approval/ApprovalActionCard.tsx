"use client";

import React from "react";
import { ShieldCheck, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ApprovalActionCardProps {
  roleName?: string;
  nextStepLabel?: string;
  onApprove: () => void;
  onRevisi: () => void;
  disabled?: boolean;
  className?: string;
  approveLabel?: string;
  revisiLabel?: string;
}

/**
 * ApprovalActionCard
 *
 * Komponen reusable untuk area aksi persetujuan (tanpa form input catatan di awal).
 * Menampilkan ringkasan wewenang approver, tahap transisi berikutnya,
 * dan tombol tindakan (Kembalikan Revisi & Setujui) yang akan memicu
 * dialog pop-up konfirmasi catatan approval.
 */
export default function ApprovalActionCard({
  roleName,
  nextStepLabel,
  onApprove,
  onRevisi,
  disabled = false,
  className,
  approveLabel = "Setujui (Approve)",
  revisiLabel = "Kembalikan Revisi",
}: ApprovalActionCardProps) {
  return (
    <div
      className={cn(
        "bg-white border-2 border-orange-200/90 rounded-2xl p-5 space-y-3.5 shadow-sm transition-all",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#E65F2B] shrink-0" />
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Tindakan Persetujuan Anda {roleName ? `(${roleName})` : ""}
          </h4>
        </div>
        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-md">
          Menunggu Keputusan Anda
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <p className="text-[11px] text-slate-500 italic text-center sm:text-left">
          {nextStepLabel
            ? `Menyetujui akan meneruskan dokumen ke tahap: ${nextStepLabel}.`
            : "Menyetujui akan menyelesaikan proses persetujuan (Final Approved)."}
        </p>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Tombol Kembalikan Revisi */}
          <Button
            type="button"
            variant="outline"
            onClick={onRevisi}
            disabled={disabled}
            className="flex-1 sm:flex-initial h-9.5 px-4 rounded-xl border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-orange-600" />
            <span>{revisiLabel}</span>
          </Button>

          {/* Tombol Setujui (Approve) */}
          <Button
            type="button"
            onClick={onApprove}
            disabled={disabled}
            className="flex-1 sm:flex-initial h-9.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>{approveLabel}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
