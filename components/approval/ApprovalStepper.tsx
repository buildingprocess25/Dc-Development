"use client";

import React from "react";
import { Shield, Check, RotateCcw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ApprovalStepConfig {
  id: string;
  stepNumber: number;
  label: string;
  subLabel: string;
  activeStatuses: string[];
}

// 4-Tahap Alur Persetujuan RAB / OE (Sipil & ME)
export const RAB_OE_APPROVAL_STEPS: ApprovalStepConfig[] = [
  {
    id: "maker",
    stepNumber: 1,
    label: "Maker",
    subLabel: "Branch Building Koord.",
    activeStatuses: ["DRAFT"]
  },
  {
    id: "bm_mgr",
    stepNumber: 2,
    label: "B&M Manager",
    subLabel: "Branch B&M Manager",
    activeStatuses: ["MENUNGGU APPROVAL B&M MANAGER"]
  },
  {
    id: "dc_specialist",
    stepNumber: 3,
    label: "DC Specialist",
    subLabel: "DC B&D Specialist",
    activeStatuses: ["MENUNGGU APPROVAL DC SPECIALIST"]
  },
  {
    id: "dc_mgr",
    stepNumber: 4,
    label: "DC Manager",
    subLabel: "DC B&D Manager",
    activeStatuses: ["MENUNGGU APPROVAL DC MANAGER"]
  }
];

// 7-Tahap Alur Persetujuan Perubahan Fungsi Ruang (SOP SAT/FRM/DCB/010)
export const FUNGSI_RUANG_APPROVAL_STEPS: ApprovalStepConfig[] = [
  {
    id: "maker",
    stepNumber: 1,
    label: "Maker (B&M Mgr)",
    subLabel: "Branch B&M Manager",
    activeStatuses: ["DRAFT"]
  },
  {
    id: "bm_dbm",
    stepNumber: 2,
    label: "BM / DBM",
    subLabel: "Branch / Deputi BM",
    activeStatuses: ["MENUNGGU APPROVAL BM/DBM"]
  },
  {
    id: "reg_bm_mgr",
    stepNumber: 3,
    label: "Reg. B&M Mgr",
    subLabel: "Regional B&M Manager",
    activeStatuses: ["MENUNGGU APPROVAL REGIONAL B&M MANAGER"]
  },
  {
    id: "dc_specialist",
    stepNumber: 4,
    label: "DC Specialist",
    subLabel: "DC B&D Specialist",
    activeStatuses: ["MENUNGGU APPROVAL DC SPECIALIST"]
  },
  {
    id: "bm_gm",
    stepNumber: 5,
    label: "B&M GM",
    subLabel: "Building & Maintenance GM",
    activeStatuses: ["MENUNGGU APPROVAL B&M GM"]
  },
  {
    id: "op_dir",
    stepNumber: 6,
    label: "Op. Director",
    subLabel: "Operation Director",
    activeStatuses: ["MENUNGGU APPROVAL OPERATION DIRECTOR"]
  },
  {
    id: "prop_dev_mgr",
    stepNumber: 7,
    label: "Property Dev Mgr",
    subLabel: "Property Development Manager",
    activeStatuses: ["MENUNGGU APPROVAL PROPERTY DEV MANAGER"]
  }
];

export interface ApprovalStepperProps {
  currentStatus: string;
  type?: "rab-oe" | "fungsi-ruang";
  steps?: ApprovalStepConfig[];
  title?: string;
  catatanRevisi?: string | null;
  className?: string;
}

export default function ApprovalStepper({
  currentStatus,
  type = "rab-oe",
  steps: customSteps,
  title,
  catatanRevisi,
  className
}: ApprovalStepperProps) {
  const steps = customSteps || (type === "fungsi-ruang" ? FUNGSI_RUANG_APPROVAL_STEPS : RAB_OE_APPROVAL_STEPS);
  const normalizedStatus = (currentStatus || "").trim().toUpperCase();

  const isApproved = normalizedStatus === "APPROVED";
  const isRevisi = normalizedStatus === "REVISI";
  const isDitolak = normalizedStatus === "DITOLAK";

  // Hitung index tahapan saat ini
  const getCurrentStepIndex = (): number => {
    if (isApproved) return steps.length;
    if (isRevisi || isDitolak) return -1;

    // Untuk fungsi-ruang: jika saat awal diajukan statusnya langsung "MENUNGGU APPROVAL BM/DBM",
    // maka index = 1, sehingga Step 1 (Maker B&M Manager) otomatis dianggap completed (isCompleted = true).
    const idx = steps.findIndex((s) =>
      s.activeStatuses.some((st) => st.toUpperCase() === normalizedStatus)
    );

    if (idx !== -1) return idx;

    // Default fallback: jika ada kata DRAFT, step 0
    if (normalizedStatus.includes("DRAFT")) return 0;

    return 0;
  };

  const currentStepIdx = getCurrentStepIndex();

  const displayTitle = title || `ALUR PERSETUJUAN BERJENJANG (${steps.length} TAHAPAN)`;

  return (
    <div
      className={cn(
        "bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5",
        className
      )}
    >
      {/* Header Stepper: Shield Icon, Judul Alur, & Posisi Status Aktif */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#E65F2B] shrink-0" />
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            {displayTitle}
          </h4>
        </div>
        <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 flex-wrap">
          <span>Posisi:</span>
          {isApproved ? (
            <span className="text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80">
              APPROVED (SELESAI)
            </span>
          ) : isRevisi ? (
            <span className="text-orange-700 font-extrabold bg-orange-50 px-2 py-0.5 rounded border border-orange-200/80">
              REVISI (MENUNGGU PERBAIKAN MAKER)
            </span>
          ) : isDitolak ? (
            <span className="text-rose-700 font-extrabold bg-rose-50 px-2 py-0.5 rounded border border-rose-200/80">
              DITOLAK
            </span>
          ) : (
            <strong className="text-slate-900 font-extrabold font-mono">
              {currentStatus || "DRAFT"}
            </strong>
          )}
        </div>
      </div>

      {/* Banner Khusus Jika Status REVISI */}
      {isRevisi && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-orange-900 text-xs flex items-start gap-2.5">
          <RotateCcw className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="font-bold block">
              Pengajuan ini sedang dikembalikan ke Maker untuk revisi & perbaikan.
            </span>
            {catatanRevisi && (
              <p className="mt-1 text-[11px] text-orange-800 italic bg-white/70 p-2 rounded-lg border border-orange-200/60">
                &ldquo;{catatanRevisi}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}

      {/* Banner Khusus Jika Status DITOLAK */}
      {isDitolak && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-center gap-2.5">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-bold">
            Pengajuan ini telah ditolak dan alur persetujuan dihentikan.
          </span>
        </div>
      )}

      {/* Visual Stepper List (Scrollable horizontally on small screens) */}
      <div className="overflow-x-auto py-1.5 scrollbar-thin scrollbar-thumb-slate-200">
        <div className="flex items-start justify-between min-w-[580px] sm:min-w-[650px] gap-2 px-1 relative">
          {steps.map((step, idx) => {
            const isCompleted = isApproved || (currentStepIdx > -1 && currentStepIdx > idx);
            const isCurrent = currentStepIdx === idx;
            const isUpcoming = currentStepIdx > -1 && currentStepIdx < idx;
            const isRevisionTarget = isRevisi && idx === 0;

            return (
              <div
                key={step.id}
                className="flex-1 flex flex-col items-center text-center relative z-10 px-1"
              >
                {/* Circle Badge Indicator */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300",
                    isCompleted &&
                      "bg-emerald-600 text-white shadow-2xs",
                    isCurrent &&
                      "bg-orange-100 text-[#E65F2B] border-2 border-[#E65F2B] ring-4 ring-orange-100/80 shadow-xs animate-pulse font-extrabold",
                    isRevisionTarget &&
                      "bg-orange-100 text-orange-700 border-2 border-orange-500 ring-4 ring-orange-100/80 font-extrabold",
                    (isUpcoming || (isDitolak && !isCompleted)) &&
                      "bg-slate-100 text-slate-400 border border-slate-200/90 font-semibold"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  ) : isRevisionTarget ? (
                    <RotateCcw className="w-3.5 h-3.5 text-orange-600" />
                  ) : (
                    step.stepNumber
                  )}
                </div>

                {/* Primary Step Label */}
                <span
                  className={cn(
                    "mt-2 text-[10px] sm:text-[11px] leading-tight max-w-[95px]",
                    isCurrent
                      ? "text-[#E65F2B] font-extrabold"
                      : isCompleted
                      ? "text-slate-800 font-bold"
                      : isRevisionTarget
                      ? "text-orange-700 font-extrabold"
                      : "text-slate-500 font-semibold"
                  )}
                >
                  {step.label}
                </span>

                {/* Role Description Sub-Label */}
                <span
                  className="text-[9px] sm:text-[10px] text-slate-400 max-w-[95px] truncate mt-0.5 font-normal"
                  title={step.subLabel}
                >
                  {step.subLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
