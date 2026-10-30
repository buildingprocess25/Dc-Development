"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Building2,
  Calendar,
  User,
  Mail,
  Briefcase,
  Layers,
  MapPin,
  Tag,
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle2,
  HardHat,
  History,
  RotateCcw,
  ExternalLink,
  Loader2,
  X,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatRupiah } from "@/lib/utils";
import ApprovalStepper from "@/components/approval/ApprovalStepper";
import ApprovalNotesHistory from "@/components/approval/ApprovalNotesHistory";
import SubmissionReasonCard from "@/components/approval/SubmissionReasonCard";

export interface DetailFungsiRuangModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: any | null;
  showApprovalActions?: boolean;
  onApprovalAction?: (action: "APPROVE" | "REVISI" | "TOLAK", item: any) => void;
  userRole?: string | null;
}

export default function DetailFungsiRuangModal({
  open,
  onOpenChange,
  submission: initialSubmission,
  showApprovalActions = false,
  onApprovalAction,
  userRole,
}: DetailFungsiRuangModalProps) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [detailData, setDetailData] = useState<any | null>(null);

  // Auto-fetch detail jika grand_total renovasi belum ada di objek awal
  useEffect(() => {
    if (open && initialSubmission?.id) {
      if (initialSubmission.renovasi?.grand_total === undefined) {
        fetch(`/api/dc-development/fungsi-ruang/${initialSubmission.id}`)
          .then((res) => res.json())
          .then((json) => {
            if (json.status === "success" && json.data) {
              setDetailData(json.data);
            }
          })
          .catch((err) => console.error("Gagal memuat detail fungsi ruang:", err));
      }
    } else if (!open) {
      setDetailData(null);
    }
  }, [open, initialSubmission?.id, initialSubmission?.renovasi?.grand_total]);

  const submission = detailData || initialSubmission;

  if (!submission) return null;

  const project = submission.project || {};
  const renovasi = submission.renovasi || {};

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
      case "MENUNGGU APPROVAL BM/DBM":
      case "MENUNGGU APPROVAL REGIONAL B&M MANAGER":
      case "MENUNGGU APPROVAL DC SPECIALIST":
      case "MENUNGGU APPROVAL B&M GM":
      case "MENUNGGU APPROVAL OPERATION DIRECTOR":
      case "MENUNGGU APPROVAL PROPERTY DEV MANAGER":
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200/80",
          dot: "bg-amber-500",
        };
      case "REVISI":
        return {
          bg: "bg-orange-50 text-orange-800 border-orange-200/80",
          dot: "bg-orange-500",
        };
      default:
        return {
          bg: "bg-blue-50 text-blue-800 border-blue-200/80",
          dot: "bg-blue-500",
        };
    }
  };

  const statusInfo = getStatusBadge(submission.status);

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

  const isActionable =
    showApprovalActions &&
    submission.status !== "REVISI" &&
    submission.status !== "APPROVED" &&
    submission.status !== "DITOLAK" &&
    submission.status !== "DRAFT" &&
    submission.status !== "SELESAI";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white border border-slate-200/90 shadow-xl rounded-2xl max-h-[90vh] flex flex-col [&>button:last-child]:hidden">
        {/* Header Modal: Cohesive, light, enterprise aesthetic */}
        <div className="px-6 py-5 bg-white border-b border-slate-200/80 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 text-[#E65F2B] flex items-center justify-center shrink-0 mt-0.5">
              <HardHat className="w-5 h-5 text-[#E65F2B]" />
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
                {project.kode ? `${project.kode} — ` : ""}
                {project.nama_proyek || "Proyek Bangunan DC"}
              </DialogTitle>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer shrink-0 -mr-2 -mt-1"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <DialogDescription className="sr-only">
          Detail pengajuan Perubahan Fungsi Ruang (PFR), identitas pemohon resmi, spesifikasi proyek, dan jejak riwayat persetujuan.
        </DialogDescription>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs space-y-5">
          {/* Visual Approval Progress Stepper (7 Tahapan) */}
          <ApprovalStepper
            currentStatus={submission.status}
            type="fungsi-ruang"
            departemen={submission.pemohon?.departemen || (submission as any).departemen}
            divisi={submission.pemohon?.divisi || (submission as any).divisi}
            catatanRevisi={
              submission.audit_logs?.find((l: any) => l.aksi === "APPROVAL_REVISI")?.data_baru?.catatan || null
            }
          />

          {/* Panel 1: Spesifikasi & Lingkup Proyek */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100">
            <div className="p-4 sm:p-5">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3.5">
                Spesifikasi & Informasi Proyek
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Cabang</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                    {project.cabang || renovasi.cabang || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Grand Total Projek</span>
                  <span className="text-sm font-bold text-[#E65F2B] mt-0.5 block font-mono">
                    {formatRupiah(Number(renovasi.grand_total || 0))}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Ref. Penawaran RAB</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block font-mono">
                    {renovasi.nomor_pengajuan || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Jenis Pengajuan</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                    {submission.jenis_pengajuan || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Tipe Properti</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                    {project.tipe || "DC"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-slate-50/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">Dibuat oleh:</span>
                  <span className="font-semibold text-slate-800">{submission.created_by || "-"}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">Waktu Pengajuan:</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {formatDate(submission.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Panel 2: Identitas Pemohon Resmi */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100">
            <div className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3.5">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Identitas Pemohon Resmi (SOP SAT/FRM/DCB/010)
                </h4>
                {submission.pemohon && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Master Data Terverifikasi
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Nama Pemohon</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                    {submission.pemohon?.nama_pemohon || submission.nama_pemohon || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Email Pemohon</span>
                  <span className="text-sm font-semibold text-slate-800 mt-0.5 block font-mono">
                    {submission.pemohon?.email_pemohon || submission.email_pemohon || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Jabatan</span>
                  <span className="text-sm font-semibold text-slate-800 mt-0.5 block">
                    {submission.pemohon?.jabatan || submission.jabatan || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Divisi</span>
                  <span className="text-sm font-semibold text-slate-800 mt-0.5 block">
                    {submission.pemohon?.divisi || submission.divisi || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Departemen</span>
                  <span className="text-sm font-semibold text-slate-800 mt-0.5 block">
                    {submission.pemohon?.departemen || submission.departemen || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Standar SOP</span>
                  <span className="text-xs font-mono font-bold text-[#E65F2B] mt-1 block">
                    SAT/FRM/DCB/010
                  </span>
                </div>

                {/* Approvers Terkait Departemen Pemohon */}
                {submission.pemohon && (
                  <>
                    <div className="sm:col-span-1 pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-400 block font-medium">
                        {submission.pemohon.gm_role || "GM Dept Pemohon"}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 mt-0.5 block">
                        {submission.pemohon.gm_nama || "-"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {submission.pemohon.gm_email || "-"}
                      </span>
                    </div>
                    <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-400 block font-medium">
                        {submission.pemohon.direktur_role || "Director Dept Pemohon"}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 mt-0.5 block">
                        {submission.pemohon.direktur_nama || "-"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {submission.pemohon.direktur_email || "-"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Panel 3: Rincian & Alasan Pengajuan (Komponen Reusable) */}
          <SubmissionReasonCard data={submission} />

          {/* Panel 4: Riwayat Persetujuan & Catatan Reviewer (Komponen Reusable) */}
          <ApprovalNotesHistory data={submission} />
        </div>

        {/* Footer Actions Standar SPARTA (Fixed di Bawah dengan Aksi Approval, Solid, Tidak Mengambang Tembus) */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-[0_-4px_25px_rgba(0,0,0,0.06)] z-30 rounded-b-2xl">
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="rounded-xl text-xs h-9 px-3.5 border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-bold cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
              title="Lihat Dokumen PDF di Google Drive"
            >
              {downloadingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E65F2B]" />
                  <span>Mempersiapkan PDF...</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-3.5 h-3.5 text-[#E65F2B]" />
                  <span>Lihat PDF</span>
                </>
              )}
            </Button>

            {isActionable ? (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-800 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80">
                <ShieldCheck className="w-3.5 h-3.5 text-[#E65F2B] shrink-0" />
                <span>Menunggu Keputusan Anda {userRole ? `(${userRole})` : ""}</span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Mode Peninjau (Read Only)</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {isActionable && onApprovalAction && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onApprovalAction("REVISI", submission)}
                  className="rounded-xl text-xs h-9 px-4 border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-orange-600" />
                  <span>Minta Revisi</span>
                </Button>

                <Button
                  type="button"
                  onClick={() => onApprovalAction("APPROVE", submission)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 px-5 font-bold shadow-md shadow-emerald-600/20 cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Setujui (Approve)</span>
                </Button>
              </>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs h-9 px-4 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer font-semibold"
            >
              Tutup
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
