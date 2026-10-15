"use client";

import React, { useMemo, useState } from "react";
import { MessageSquare, CheckCircle2, RotateCcw, XCircle, AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseApprovalNotes, ApprovalNoteItem } from "@/lib/approval-notes";
import { RevisionDetailItem } from "@/lib/types/renovasi-revision";

export interface NormalizedHistoryItem {
  id: string | number;
  actionType: "APPROVE" | "REVISI" | "TOLAK" | "RESUBMIT" | "CREATE" | "OTHER";
  actionLabel: string;
  userName: string;
  userRole?: string;
  date: string;
  note?: string | null;
}

export interface ApprovalNotesHistoryProps {
  /** Objek submission (Fungsi Ruang) atau renovasi (Penawaran RAB/OE) */
  data?: any;
  /** Daftar audit logs langsung (misal: submission.audit_logs) */
  auditLogs?: any[];
  /** String catatan pengajuan mentah dari database */
  catatanPengajuan?: string | null;
  /** Email / Nama pembuat jika ingin ditampilkan pada log awal */
  createdBy?: string | null;
  /** Tanggal pembuatan */
  createdAt?: string | Date | null;
  /** Butir rincian bagian yang wajib diperbaiki (jika ada pada revisi RAB/OE) */
  revisionDetails?: RevisionDetailItem[];
  /** Judul kartu (default: "Riwayat Persetujuan & Catatan Reviewer") */
  title?: string;
  /** Sembunyikan komponen jika tidak ada riwayat (default: true) */
  hideIfEmpty?: boolean;
  /** Status awal buka/tutup (default: false) */
  defaultOpen?: boolean;
  /** ClassName styling tambahan untuk kontainer */
  className?: string;
}

function formatHistoryDate(dateVal: any): string {
  if (!dateVal) return "-";
  if (typeof dateVal === "string") {
    // Jika format tanggal sudah dalam bahasa Indonesia (contoh: "14 Okt 2026, 15.49")
    if (
      dateVal.includes("Jan") ||
      dateVal.includes("Feb") ||
      dateVal.includes("Mar") ||
      dateVal.includes("Apr") ||
      dateVal.includes("Mei") ||
      dateVal.includes("Jun") ||
      dateVal.includes("Jul") ||
      dateVal.includes("Agu") ||
      dateVal.includes("Sep") ||
      dateVal.includes("Okt") ||
      dateVal.includes("Nov") ||
      dateVal.includes("Des")
    ) {
      return dateVal;
    }
  }

  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(dateVal);
  }
}

export default function ApprovalNotesHistory({
  data,
  auditLogs: explicitAuditLogs,
  catatanPengajuan: explicitCatatan,
  createdBy: explicitCreatedBy,
  createdAt: explicitCreatedAt,
  revisionDetails: explicitRevisionDetails,
  title = "Riwayat Persetujuan & Catatan Reviewer",
  hideIfEmpty = true,
  defaultOpen = false,
  className
}: ApprovalNotesHistoryProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Normalisasi data masukan
  const auditLogs = explicitAuditLogs || data?.audit_logs || null;
  const rawCatatan = explicitCatatan !== undefined ? explicitCatatan : data?.catatan_pengajuan;
  const createdBy = explicitCreatedBy || data?.created_by || null;
  const createdAt = explicitCreatedAt || data?.created_at || null;
  const revisionDetails = explicitRevisionDetails || data?.detail_revisi || [];

  const items: NormalizedHistoryItem[] = useMemo(() => {
    // 1. Jika tersedia audit_logs (seperti pada modul Fungsi Ruang)
    if (Array.isArray(auditLogs) && auditLogs.length > 0) {
      return auditLogs.map((log: any, idx: number) => {
        const dataBaru = log.data_baru || {};
        const aksi = (log.aksi || "").toUpperCase();

        let actionType: NormalizedHistoryItem["actionType"] = "OTHER";
        let actionLabel = "CATATAN";

        if (aksi === "APPROVAL_APPROVE" || aksi === "APPROVE" || aksi === "DISETUJUI") {
          actionType = "APPROVE";
          actionLabel = "DISETUJUI";
        } else if (aksi === "APPROVAL_REVISI" || aksi === "REVISI") {
          actionType = "REVISI";
          actionLabel = "REVISI";
        } else if (aksi === "APPROVAL_TOLAK" || aksi === "TOLAK" || aksi === "DITOLAK") {
          actionType = "TOLAK";
          actionLabel = "DITOLAK";
        } else if (aksi === "RESUBMIT_REVISI" || aksi === "PENGAJUAN ULANG") {
          actionType = "RESUBMIT";
          actionLabel = "PENGAJUAN ULANG";
        } else if (aksi === "CREATE_SUBMISSION" || aksi === "CREATE" || aksi === "PENGAJUAN") {
          actionType = "CREATE";
          actionLabel = "CREATE_SUBMISSION";
        } else {
          actionLabel = aksi.replace("APPROVAL_", "");
        }

        const userName = dataBaru.action_by_name || log.user_name || log.user_email || "Pengguna";
        const userRole = dataBaru.action_by_role || log.user_role || (actionType === "CREATE" ? "Reviewer" : "Approver");
        const note = dataBaru.catatan || log.catatan || null;

        return {
          id: log.id || `audit-log-${idx}`,
          actionType,
          actionLabel,
          userName,
          userRole,
          date: formatHistoryDate(log.created_at),
          note
        };
      });
    }

    // 2. Jika tersedia catatan_pengajuan (seperti pada modul Penawaran RAB/OE)
    if (rawCatatan && rawCatatan.trim()) {
      const parsed = parseApprovalNotes(rawCatatan, createdBy, createdAt);
      return parsed.map((item: ApprovalNoteItem, idx: number) => {
        let actionType: NormalizedHistoryItem["actionType"] = "OTHER";
        let actionLabel = "CATATAN";

        if (item.action === "APPROVE") {
          actionType = "APPROVE";
          actionLabel = "DISETUJUI";
        } else if (item.action === "REVISI") {
          actionType = "REVISI";
          actionLabel = "REVISI";
        } else if (item.action === "TOLAK") {
          actionType = "TOLAK";
          actionLabel = "DITOLAK";
        } else if (item.action === "PENGAJUAN") {
          actionType = "CREATE";
          actionLabel = "CREATE_SUBMISSION";
        }

        return {
          id: item.id || `note-${idx}`,
          actionType,
          actionLabel,
          userName: item.author || "Pengguna",
          userRole: item.role || (actionType === "CREATE" ? "Maker" : "Approver"),
          date: formatHistoryDate(item.date),
          note: item.note || null
        };
      });
    }

    return [];
  }, [auditLogs, rawCatatan, createdBy, createdAt]);

  const hasItems = items.length > 0;
  const hasRevisionDetails = Array.isArray(revisionDetails) && revisionDetails.length > 0;

  if (!hasItems && !hasRevisionDetails && hideIfEmpty) {
    return null;
  }

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all",
        className
      )}
    >
      {/* Header Kartu Interaktif (Bisa Buka Tutup) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer select-none",
          isOpen
            ? "bg-white border-b border-slate-100 hover:bg-slate-50/50"
            : "bg-white hover:bg-slate-50/70"
        )}
        aria-expanded={isOpen}
        title={isOpen ? "Klik untuk menutup riwayat persetujuan" : "Klik untuk membuka riwayat persetujuan"}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />
          <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
            {title}
          </h4>
          {hasItems && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80 font-mono">
              {items.length} {items.length === 1 ? "Catatan" : "Riwayat"}
            </span>
          )}
          {hasRevisionDetails && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 font-semibold">
              {revisionDetails.length} Poin Revisi
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium shrink-0">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            {isOpen ? "Tutup" : "Buka"}
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-slate-400 transition-transform duration-200",
              isOpen && "rotate-180 text-slate-700"
            )}
          />
        </div>
      </button>

      {/* Konten Terbuka (Daftar Log & Pinpoint Revisi) */}
      {isOpen && (
        <div className="p-4 sm:p-5">
          {/* Daftar Log Persetujuan */}
          {hasItems ? (
            <div className="space-y-2.5">
              {items.map((item) => {
                const isApprove = item.actionType === "APPROVE";
                const isRevisi = item.actionType === "REVISI";
                const isTolak = item.actionType === "TOLAK";
                const isResubmit = item.actionType === "RESUBMIT";

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "p-3.5 rounded-xl border text-xs flex flex-col gap-1 transition-colors",
                      isApprove
                        ? "bg-emerald-50/50 border-emerald-200/80 text-emerald-950"
                        : isRevisi
                        ? "bg-orange-50/60 border-orange-200/80 text-orange-950"
                        : isTolak
                        ? "bg-rose-50/60 border-rose-200/80 text-rose-950"
                        : isResubmit
                        ? "bg-blue-50/60 border-blue-200/80 text-blue-950"
                        : "bg-slate-50 border-slate-200 text-slate-800"
                    )}
                  >
                    <div className="flex items-center justify-between text-[11px] flex-wrap gap-1">
                      <span className="font-extrabold flex items-center gap-1.5 flex-wrap">
                        {isApprove ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : isRevisi ? (
                          <RotateCcw className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                        ) : isTolak ? (
                          <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        )}
                        <span className="tracking-tight">{item.actionLabel}</span>
                        <span className="text-slate-500 font-normal">
                          oleh <strong>{item.userName}</strong>{" "}
                          {item.userRole ? `(${item.userRole})` : ""}
                        </span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {item.date}
                      </span>
                    </div>

                    {/* Kutipan Catatan Reviewer */}
                    {item.note && (
                      <p className="mt-1.5 pl-5 text-[11px] text-slate-700 italic border-l-2 border-slate-300 leading-relaxed whitespace-pre-wrap">
                        &ldquo;{item.note}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Belum ada riwayat persetujuan atau catatan.</p>
          )}

          {/* Bagian Tambahan: Rincian Bagian yang Ditandai Wajib Diperbaiki (Pinpoint Revisi) */}
          {hasRevisionDetails && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs mb-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  Rincian Bagian yang Ditandai Wajib Diperbaiki ({revisionDetails.length}):
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {revisionDetails.map((d: any, idx: number) => (
                  <div
                    key={d.id || idx}
                    className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/70 text-[11px] flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800">{d.label}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                        {d.category === "PARAMETER"
                          ? "Parameter"
                          : d.category === "GAMBAR"
                          ? "Gambar Kerja"
                          : d.category === "FOTO"
                          ? "Foto Lingkungan"
                          : "Item RAB"}
                      </span>
                    </div>
                    {d.catatan && (
                      <p className="text-slate-600 text-[11px] italic mt-0.5 pl-2 border-l border-amber-300">
                        &ldquo;{d.catatan}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { ApprovalNotesHistory };
