"use client";

import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  ArrowRight,
  Pencil,
  FileText,
  Building2,
  MapPin,
  Sparkles,
  ShieldCheck,
  XCircle,
  HelpCircle
} from "lucide-react";
import { cn, toTitleCase } from "@/lib/utils";
import { parseApprovalNotes, ApprovalNoteItem } from "@/lib/approval-notes";
import { normalizeRevisionDetails, RevisionDetailItem } from "@/lib/types/renovasi-revision";
import { useSession } from "@/context/SessionContext";
import { canEditRenovasiSubmission } from "@/lib/permissions";

export interface ApprovalNotesHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renovasi: any | null;
  mode?: "approval" | "revisi" | "view";
  onProceedApprove?: () => void;
  onProceedRevisi?: () => void;
  onProceedRevisionForm?: () => void;
}

export default function ApprovalNotesHistoryModal({
  open,
  onOpenChange,
  renovasi,
  mode = "view",
  onProceedApprove,
  onProceedRevisi,
  onProceedRevisionForm
}: ApprovalNotesHistoryModalProps) {
  const { user } = useSession();

  const canEdit = useMemo(() => {
    return !!(user && renovasi && canEditRenovasiSubmission(user, renovasi) && renovasi.status === "REVISI");
  }, [user, renovasi]);

  const notesList: ApprovalNoteItem[] = useMemo(() => {
    if (!renovasi) return [];
    const all = parseApprovalNotes(
      renovasi.catatan_pengajuan,
      renovasi.created_by,
      renovasi.created_at
    );
    if (mode === "revisi") {
      return all.filter((item) => item.action === "REVISI");
    }
    if (mode === "approval") {
      return all.filter((item) => item.action === "APPROVE");
    }
    return all;
  }, [renovasi?.catatan_pengajuan, renovasi?.created_by, renovasi?.created_at, mode, renovasi]);

  const revisionDetails: RevisionDetailItem[] = useMemo(() => {
    if (!renovasi) return [];
    return normalizeRevisionDetails(renovasi.detail_revisi);
  }, [renovasi?.detail_revisi, renovasi]);

  if (!renovasi) return null;

  const project = renovasi.project || {};
  const nomorPengajuan = renovasi.nomor_pengajuan || "-";
  const namaProyek = project.nama_proyek || renovasi.nama_proyek || "-";
  const cabang = renovasi.cabang || project.cabang || "-";

  // Konfigurasi header berdasarkan mode
  const getHeaderConfig = () => {
    switch (mode) {
      case "revisi":
        return {
          badge: "Instruksi Perbaikan",
          badgeClass: "bg-amber-50 text-amber-700 border-amber-200/80",
          title: "Instruksi Catatan Revisi Pengajuan",
          description:
            "Harap perhatikan seluruh catatan dan poin perbaikan dari peninjau berikut sebelum melakukan perubahan formulir revisi.",
          icon: AlertCircle,
          iconBg: "bg-amber-100 text-amber-600 ring-4 ring-amber-50"
        };
      case "approval":
        return {
          badge: "Catatan Peninjau Terdahulu",
          badgeClass: "bg-blue-50 text-blue-700 border-blue-200/80",
          title: "Riwayat Catatan Persetujuan Sebelumnya",
          description:
            "Terdapat catatan dari tahapan persetujuan sebelumnya. Silakan pelajari riwayat berikut sebelum menentukan tindakan Anda.",
          icon: MessageSquare,
          iconBg: "bg-blue-100 text-blue-600 ring-4 ring-blue-50"
        };
      case "view":
      default:
        return {
          badge: "Riwayat Catatan",
          badgeClass: "bg-slate-100 text-slate-700 border-slate-200/80",
          title: "Riwayat Catatan & Evaluasi Pengajuan",
          description:
            "Seluruh kronologi catatan dari pembuat maupun peninjau selama proses pengajuan dan evaluasi.",
          icon: FileText,
          iconBg: "bg-slate-100 text-slate-600 ring-4 ring-slate-50"
        };
    }
  };

  const headerConfig = getHeaderConfig();
  const HeaderIcon = headerConfig.icon;

  const getActionBadge = (action: ApprovalNoteItem["action"]) => {
    switch (action) {
      case "APPROVE":
        return {
          label: "Disetujui",
          icon: CheckCircle2,
          className: "bg-emerald-50 text-emerald-700 border-emerald-200"
        };
      case "REVISI":
        return {
          label: "Permintaan Revisi",
          icon: AlertCircle,
          className: "bg-amber-50 text-amber-700 border-amber-200"
        };
      case "TOLAK":
        return {
          label: "Ditolak",
          icon: XCircle,
          className: "bg-rose-50 text-rose-700 border-rose-200"
        };
      case "PENGAJUAN":
      default:
        return {
          label: "Catatan Pengajuan",
          icon: Sparkles,
          className: "bg-slate-100 text-slate-700 border-slate-200"
        };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl border-slate-200/80 shadow-2xl bg-white max-h-[90vh] flex flex-col">
        {/* Header Section */}
        <div className="p-5 md:p-6 border-b border-slate-100 bg-linear-to-b from-slate-50/70 to-white shrink-0">
          <div className="flex items-start gap-4">
            <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform", headerConfig.iconBg)}>
              <HeaderIcon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", headerConfig.badgeClass)}>
                  {headerConfig.badge}
                </span>
                <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-full">
                  {nomorPengajuan}
                </span>
              </div>
              <DialogTitle className="text-base md:text-lg font-bold text-slate-900 leading-snug">
                {headerConfig.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
                {headerConfig.description}
              </DialogDescription>
            </div>
          </div>

          {/* Mini Info Card Proyek */}
          <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-[#E65F2B] shrink-0" />
              <div className="truncate">
                <span className="font-bold text-slate-800 block truncate">{namaProyek}</span>
                <span className="text-[10px] text-slate-400 font-semibold">{project.kode || "DC"} • Cabang {cabang}</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 bg-slate-50 text-slate-700 border-slate-200">
              {renovasi.status}
            </span>
          </div>
        </div>

        {/* Scrollable Content: Notes Timeline */}
        <div className="p-5 md:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Rincian Butir Revisi jika ada */}
          {(mode === "revisi" || mode === "view") && revisionDetails.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/90 text-xs shadow-2xs">
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-amber-200/60">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Daftar Bagian Ditandai Wajib Diperbaiki ({revisionDetails.length})</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900">
                  Wajib Diubah
                </span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {revisionDetails.map((item, idx) => (
                  <div key={item.id || idx} className="p-2.5 rounded-lg bg-white/95 border border-amber-100/90 text-xs shadow-2xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-slate-800">{item.label}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase tracking-wide">
                        {item.category === "PARAMETER"
                          ? "Parameter"
                          : item.category === "GAMBAR"
                          ? "Gambar Kerja"
                          : item.category === "FOTO"
                          ? "Foto Lingkungan"
                          : "Item RAB"}
                      </span>
                    </div>
                    {item.catatan ? (
                      <p className="text-slate-600 text-[11px] leading-relaxed bg-amber-50/50 p-2 rounded border border-amber-100/60 font-medium">
                        &ldquo;{item.catatan}&rdquo;
                      </p>
                    ) : (
                      <p className="text-slate-400 text-[11px] italic">Tidak ada catatan spesifik</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {notesList.length === 0 && revisionDetails.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-700">Belum Ada Catatan Khusus</p>
              <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs leading-relaxed">
                Tidak ada riwayat catatan tertulis untuk pengajuan ini.
              </p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200/80">
              {notesList.map((item, idx) => {
                const actionBadge = getActionBadge(item.action);
                const BadgeIcon = actionBadge.icon;
                const isLatest = idx === notesList.length - 1;

                return (
                  <div key={item.id} className="relative group">
                    {/* Timeline dot */}
                    <div className={cn(
                      "absolute -left-6 top-1.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] shadow-xs z-10",
                      item.action === "APPROVE" ? "bg-emerald-500 text-white" :
                      item.action === "REVISI" ? "bg-amber-500 text-white" :
                      item.action === "TOLAK" ? "bg-rose-500 text-white" :
                      "bg-slate-400 text-white"
                    )}>
                      <BadgeIcon className="w-3 h-3" />
                    </div>

                    {/* Note Box */}
                    <div className={cn(
                      "p-4 rounded-xl border transition-all text-xs bg-white shadow-2xs",
                      isLatest ? "border-amber-200/90 ring-2 ring-amber-100/50" : "border-slate-200/80"
                    )}>
                      {/* Meta info */}
                      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border", actionBadge.className)}>
                            <BadgeIcon className="w-3 h-3" />
                            {actionBadge.label}
                          </span>
                          <span className="font-bold text-slate-800 flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            {item.author}
                          </span>
                          {item.role && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              ({item.role})
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3 text-slate-300" />
                          {item.date}
                        </span>
                      </div>

                      {/* Isi Catatan */}
                      <div className="bg-slate-50/80 rounded-lg p-3 border border-slate-100 text-slate-700 text-xs leading-relaxed whitespace-pre-wrap font-medium">
                        {item.note}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 md:p-5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs h-9 px-4 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Tutup
          </Button>

          <div className="flex items-center gap-2">
            {/* Mode Revisi: Pembuat yang berhak siap melanjutkan ke form revisi */}
            {mode === "revisi" && onProceedRevisionForm && canEdit && (
              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onProceedRevisionForm();
                }}
                className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md shadow-[#E65F2B]/20 cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Lanjutkan Revisi Pengajuan
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            )}

            {/* Mode Approval: Approver siap menentukan tindakan berikutnya */}
            {mode === "approval" && (
              <>
                {onProceedRevisi && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      onProceedRevisi();
                    }}
                    className="border-amber-200 text-amber-700 hover:bg-amber-50 font-bold text-xs h-9 px-3.5 rounded-xl cursor-pointer transition-colors"
                  >
                    <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                    Minta Revisi
                  </Button>
                )}

                {onProceedApprove && (
                  <Button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onProceedApprove();
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Lanjut Setujui Pengajuan
                    <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
