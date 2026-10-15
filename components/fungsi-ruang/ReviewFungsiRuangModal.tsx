"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";
import {
  canUserApproveFungsiRuang,
  getNextFungsiRuangApprovalStatus,
} from "@/lib/permissions";
import {
  Building2,
  Calendar,
  Clock,
  User,
  Mail,
  Briefcase,
  Layers,
  MapPin,
  Tag,
  CheckCircle2,
  AlertCircle,
  FileText,
  RotateCcw,
  Check,
  Send,
  Loader2,
  History,
  ShieldCheck,
  HardHat,
  Printer,
  ExternalLink,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ApprovalStepper from "@/components/approval/ApprovalStepper";
import ApprovalNotesHistory from "@/components/approval/ApprovalNotesHistory";
import SubmissionReasonCard from "@/components/approval/SubmissionReasonCard";
import ApprovalActionCard from "@/components/approval/ApprovalActionCard";
import ApprovalActionDialog, { ApprovalActionType } from "@/components/approval/ApprovalActionDialog";

interface ReviewFungsiRuangModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: any | null;
  onSuccess?: (action?: ApprovalActionType | null, updatedItem?: any) => void;
}

export default function ReviewFungsiRuangModal({
  open,
  onOpenChange,
  submission,
  onSuccess,
}: ReviewFungsiRuangModalProps) {
  const { user } = useSession();

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [actionType, setActionType] = useState<ApprovalActionType | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);

  const handleDownloadPdf = async () => {
    if (!submission?.id) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/dc-development/fungsi-ruang/${submission.id}/download-pdf`);
      const json = await res.json();
      if (json.status === "success" && json.data?.file_url) {
        window.open(json.data.file_url, "_blank", "noopener,noreferrer");
      } else {
        window.open(`/api/dc-development/fungsi-ruang/${submission.id}/pdf`, "_blank");
      }
    } catch {
      window.open(`/api/dc-development/fungsi-ruang/${submission.id}/pdf`, "_blank");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (!submission) return null;

  const canApprove = canUserApproveFungsiRuang(user, submission);
  const nextTransition = getNextFungsiRuangApprovalStatus(submission.status);


  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return {
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
          dot: "bg-emerald-500",
        };
      case "REVISI":
        return {
          bg: "bg-orange-50 text-orange-800 border-orange-200/80",
          dot: "bg-orange-500",
        };
      default:
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200/80",
          dot: "bg-amber-500",
        };
    }
  };

  const statusInfo = getStatusBadge(submission.status);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-y-auto p-0 rounded-2xl border-slate-200/90 shadow-xl bg-white flex flex-col [&>button:last-child]:hidden">
        {/* Header Modal: Cohesive enterprise light aesthetic */}
        <div className="px-6 py-5 bg-white border-b border-slate-200/80 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 text-[#E65F2B] flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5 text-[#E65F2B]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border",
                    statusInfo.bg
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", statusInfo.dot)} />
                  {submission.status}
                </span>
                <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/70">
                  {submission.nomor_pengajuan}
                </span>
                {submission.jenis_pengajuan && (
                  <span className="text-xs text-slate-500 font-medium">
                    &bull; {submission.jenis_pengajuan}
                  </span>
                )}
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight truncate">
                Tinjauan & Persetujuan Perubahan Fungsi Ruang
              </DialogTitle>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={downloadingPdf}
              onClick={handleDownloadPdf}
              className="h-8 px-2.5 rounded-xl border-slate-200 text-slate-700 hover:text-[#E65F2B] hover:border-[#E65F2B] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Lihat Dokumen PDF di Google Drive"
            >
              {downloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E65F2B]" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5 text-[#E65F2B]" />
              )}
              <span>Lihat PDF</span>
            </Button>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-7 space-y-6 text-xs">
          {/* Visual Approval Progress Stepper (7 Tahapan) */}
          <ApprovalStepper
            currentStatus={submission.status}
            type="fungsi-ruang"
            catatanRevisi={
              submission.audit_logs?.find((l: any) => l.aksi === "APPROVAL_REVISI")?.data_baru?.catatan || null
            }
          />

          {/* Card Data Pemohon & Proyek */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. Identitas Pemohon */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <User className="w-4 h-4 text-[#E65F2B]" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Identitas Pemohon
                </h4>
              </div>
              <div className="space-y-2 text-slate-700">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400">Nama Pemohon:</span>
                  <span className="font-extrabold text-slate-900">{submission.nama_pemohon}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400">Email:</span>
                  <span className="font-mono text-slate-800 lowercase">{submission.email_pemohon}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400">Jabatan:</span>
                  <span className="font-semibold text-slate-800">{submission.jabatan}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400">Divisi & Departemen:</span>
                  <span className="font-semibold text-slate-800">{submission.divisi} &bull; {submission.departemen}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Maker (Dibuat Oleh):</span>
                  <span className="font-semibold text-slate-600">{submission.created_by}</span>
                </div>
              </div>
            </div>

            {/* 2. Informasi Proyek & Properti */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Building2 className="w-4 h-4 text-[#E65F2B]" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Proyek Renovasi Terkait
                </h4>
              </div>
              <div className="space-y-2 text-slate-700">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400">Nama Proyek:</span>
                  <span className="font-extrabold text-slate-900">{submission.project?.nama_proyek || "DC"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400">Kode Proyek:</span>
                  <span className="font-mono font-semibold text-slate-800">{submission.project?.kode || "-"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400">Tipe Bangunan:</span>
                  <span className="font-bold text-slate-800 px-2 py-0.5 rounded-md bg-slate-100 text-[11px]">
                    {submission.project?.tipe || "-"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400">Cabang Proyek:</span>
                  <span className="font-extrabold text-slate-900">{submission.project?.cabang || submission.renovasi?.cabang || "-"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400">Jenis Pengajuan:</span>
                  <span className="font-bold text-[#E65F2B] px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-[11px]">
                    {submission.jenis_pengajuan || "-"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Ref Penawaran RAB:</span>
                  <span className="font-mono text-[#E65F2B] font-bold">
                    {submission.renovasi?.nomor_pengajuan || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card Rincian & Alasan Pengajuan (Komponen Reusable) */}
          <SubmissionReasonCard data={submission} />

          {/* Riwayat Audit Trail Persetujuan & Catatan Reviewer (Komponen Reusable) */}
          <ApprovalNotesHistory data={submission} />

          {/* Tindakan Persetujuan Reviewer (Komponen Reusable: ApprovalActionCard) */}
          {canApprove && (
            <ApprovalActionCard
              roleName={user?.role}
              nextStepLabel={nextTransition?.label}
              onApprove={() => {
                setActionType("APPROVE");
                setActionDialogOpen(true);
              }}
              onRevisi={() => {
                setActionType("REVISI");
                setActionDialogOpen(true);
              }}
            />
          )}

          {/* Action Close */}
          {!canApprove && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <Button
                type="button"
                onClick={() => window.open(`/api/dc-development/fungsi-ruang/${submission.id}/pdf`, "_blank")}
                className="h-9 px-4 rounded-xl text-xs font-bold bg-[#E65F2B] hover:bg-[#d04f1f] text-white flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / Unduh PDF</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-9 px-5 rounded-xl text-xs font-semibold"
              >
                Tutup
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Modal Dialog Catatan Persetujuan / Permintaan Revisi (Komponen Reusable) */}
      {actionDialogOpen && (
        <ApprovalActionDialog
          open={actionDialogOpen}
          onOpenChange={setActionDialogOpen}
          action={actionType}
          target={submission}
          moduleType="fungsi-ruang"
          roleName={user?.role}
          nextStepLabel={nextTransition?.label}
          onSuccess={(updatedItem) => {
            const currentAction = actionType;
            setActionDialogOpen(false);
            onOpenChange(false);
            if (onSuccess) onSuccess(currentAction, updatedItem);
          }}
        />
      )}
    </Dialog>

  );
}
