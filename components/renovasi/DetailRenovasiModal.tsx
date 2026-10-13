"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatRupiah, cn, toTitleCase } from "@/lib/utils";
import { useSession } from "@/context/SessionContext";
import { canEditRenovasiSubmission, canUserApproveSubmission } from "@/lib/permissions";
import {
  Building2,
  Calendar,
  Clock,
  Layers,
  FileText,
  ExternalLink,
  MapPin,
  HardHat,
  X,
  Pencil,
  Eye,
  FileCode2,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  User,
  MessageSquare,
  Download,
  Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  parseApprovalNotes,
  getApprovalNotes,
  getRevisionNotes,
  hasPreviousApprovalNotes,
  hasPreviousRevisionNotes
} from "@/lib/approval-notes";
import { normalizeRevisionDetails, RevisionDetailItem } from "@/lib/types/renovasi-revision";

interface DetailRenovasiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renovasi: any | null;
  canEdit?: boolean;
  showApprovalActions?: boolean;
  onApprovalAction?: (action: "APPROVE" | "REVISI" | "TOLAK", item: any) => void;
}

export default function DetailRenovasiModal({
  open,
  onOpenChange,
  renovasi,
  canEdit = true,
  showApprovalActions = false,
  onApprovalAction
}: DetailRenovasiModalProps) {
  const { user } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"INFO" | "GAMBAR" | "FOTO" | "RAB">("INFO");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!renovasi?.id) return;
    const existingDoc = (renovasi?.dokumen || []).find((d: any) => d.kategori_file === "DOKUMEN_RAB_OE_PDF");
    if (existingDoc?.file_url) {
      window.open(existingDoc.file_url, "_blank", "noopener,noreferrer");
      return;
    }

    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/dc-development/renovasi/${renovasi.id}/download-pdf`);
      const json = await res.json();
      if (json.status === "success" && json.data?.file_url) {
        window.open(json.data.file_url, "_blank", "noopener,noreferrer");
      } else {
        alert(json.message || "Gagal mengunduh dokumen PDF.");
      }
    } catch (err: any) {
      alert(`Terjadi kesalahan: ${err.message}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const approvalNotes = React.useMemo(() => {
    return getApprovalNotes(renovasi?.catatan_pengajuan, renovasi?.created_by, renovasi?.created_at);
  }, [renovasi?.catatan_pengajuan, renovasi?.created_by, renovasi?.created_at]);

  const revisionNotes = React.useMemo(() => {
    return getRevisionNotes(renovasi?.catatan_pengajuan, renovasi?.created_by, renovasi?.created_at);
  }, [renovasi?.catatan_pengajuan, renovasi?.created_by, renovasi?.created_at]);

  const revisionDetails: RevisionDetailItem[] = React.useMemo(() => {
    return normalizeRevisionDetails(renovasi?.detail_revisi);
  }, [renovasi?.detail_revisi]);

  const hasApprovalNotes = React.useMemo(() => {
    return hasPreviousApprovalNotes(renovasi?.catatan_pengajuan);
  }, [renovasi?.catatan_pengajuan]);

  const canEditThisSubmission = React.useMemo(() => {
    if (!canEdit) return false;
    return canEditRenovasiSubmission(user, renovasi);
  }, [canEdit, user, renovasi]);

  const canApprove = React.useMemo(() => {
    if (!showApprovalActions || !onApprovalAction) return false;
    return canUserApproveSubmission(user, renovasi);
  }, [showApprovalActions, onApprovalAction, user, renovasi]);

  if (!renovasi) return null;

  const project = renovasi.project || {};
  const dokumen = renovasi.dokumen || [];
  const items = renovasi.item_rab || [];
  const itemsSipil = items.filter((it: any) => (it.lingkup || "").toUpperCase() === "SIPIL");
  const itemsMe = items.filter((it: any) => (it.lingkup || "").toUpperCase() === "ME");

  const getItemTotal = (it: any) => {
    if (it.total_biaya !== undefined && it.total_biaya !== null && it.total_biaya > 0) {
      return Number(it.total_biaya);
    }
    const mat = Number(it.harga_material || 0);
    const upah = Number(it.harga_upah || 0);
    const vol = Number(it.volume || 0);
    return (mat + upah) * vol;
  };

  const subtotalSipil = renovasi.total_biaya_sipil > 0
    ? Number(renovasi.total_biaya_sipil)
    : itemsSipil.reduce((acc: number, it: any) => acc + getItemTotal(it), 0);
  const subtotalMe = renovasi.total_biaya_me > 0
    ? Number(renovasi.total_biaya_me)
    : itemsMe.reduce((acc: number, it: any) => acc + getItemTotal(it), 0);

  const totalSebelumPpn = renovasi.total_sebelum_ppn > 0
    ? Number(renovasi.total_sebelum_ppn)
    : (subtotalSipil + subtotalMe);

  const nilaiPpn = (renovasi.nilai_ppn !== undefined && renovasi.nilai_ppn !== null && Number(renovasi.nilai_ppn) > 0)
    ? Number(renovasi.nilai_ppn)
    : (totalSebelumPpn > 0 ? Math.round(totalSebelumPpn * 0.11) : 0);

  const totalPlusPpn = totalSebelumPpn + nilaiPpn;

  const grandTotalCalc = (renovasi.grand_total !== undefined && renovasi.grand_total !== null && Number(renovasi.grand_total) > 0)
    ? Number(renovasi.grand_total)
    : (totalPlusPpn > 0 ? Math.ceil(totalPlusPpn / 1000) * 1000 : 0);

  const nilaiPembulatan = (renovasi.nilai_pembulatan !== undefined && renovasi.nilai_pembulatan !== null && renovasi.nilai_pembulatan !== 0)
    ? Number(renovasi.nilai_pembulatan)
    : (grandTotalCalc > 0 ? grandTotalCalc - totalPlusPpn : 0);

  const docsSipil = dokumen.filter(
    (d: any) =>
      d.kategori_file === "GAMBAR_SIPIL" ||
      d.kategori_file === "GAMBAR_SIPIL_PDF" ||
      d.kategori_file === "GAMBAR_SIPIL_DWG"
  );
  const docsMe = dokumen.filter(
    (d: any) =>
      d.kategori_file === "GAMBAR_ME" ||
      d.kategori_file === "GAMBAR_ME_PDF" ||
      d.kategori_file === "GAMBAR_ME_DWG"
  );
  const fotos = dokumen.filter((d: any) => d.kategori_file === "FOTO_LINGKUNGAN");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
          dot: "bg-emerald-500",
          label: "Approved"
        };
      case "MENUNGGU APPROVAL B&M MANAGER":
      case "MENUNGGU APPROVAL DC SPECIALIST":
      case "MENUNGGU APPROVAL DC MANAGER":
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200/80",
          dot: "bg-blue-500",
          label: status
        };
      case "REVISI":
      case "DITOLAK":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200/80",
          dot: "bg-rose-500",
          label: status
        };
      case "DRAFT":
      default:
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200/80",
          dot: "bg-amber-500",
          label: "Draft"
        };
    }
  };

  const statusInfo = getStatusBadge(renovasi.status);

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
                  {renovasi.status}
                </span>
                <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/70">
                  {renovasi.nomor_pengajuan}
                </span>
                {renovasi.jenis_renovasi && (
                  <span className="text-xs text-slate-500 font-medium">
                    &bull; {toTitleCase(renovasi.jenis_renovasi)}
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
          Detail pengajuan Penawaran RAB/OE, spesifikasi proyek, dokumen gambar teknis, foto lingkungan, dan rincian item RAB.
        </DialogDescription>

        {/* Tab Navigation: Clean & intentional */}
        <div className="flex items-center gap-1 px-6 bg-slate-50/60 border-b border-slate-200/80 shrink-0 text-xs font-medium overflow-x-auto">
          {[
            { id: "INFO", label: "Informasi Proyek", count: null },
            { id: "GAMBAR", label: "Gambar Teknis", count: docsSipil.length + docsMe.length },
            { id: "FOTO", label: "Foto Lingkungan", count: fotos.length },
            { id: "RAB", label: "Rincian RAB", count: items.length }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "py-3 px-3.5 border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap text-xs",
                  isActive
                    ? "border-[#E65F2B] text-slate-900 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium"
                )}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px] font-semibold font-mono",
                      isActive
                        ? "bg-orange-100/70 text-[#E65F2B]"
                        : "bg-slate-200/70 text-slate-600"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {activeTab === "INFO" && (
            <div className="flex flex-col gap-5">
              {/* Specification Panel */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100">
                <div className="p-4 sm:p-5">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3.5">
                    Spesifikasi & Lingkup Renovasi
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Cabang</span>
                      <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                        {renovasi.cabang || project.cabang || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Tipe Properti</span>
                      <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                        {project.tipe || "DC"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Lingkup Pekerjaan</span>
                      <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                        {renovasi.lingkup_pekerjaan || "Sipil + ME"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Estimasi Durasi</span>
                      <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                        {renovasi.durasi_hari || 0} Hari Kalender
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 bg-slate-50/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-600">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-400">Diajukan oleh:</span>
                      <span className="font-semibold text-slate-800">{renovasi.created_by || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-400">Waktu Pengajuan:</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {new Date(renovasi.created_at).toLocaleString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Catatan Persetujuan Peninjau Terdahulu (HANYA tampil saat tahap Persetujuan / bukan REVISI) */}
              {renovasi.status !== "REVISI" && approvalNotes.length > 0 && (
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/90 text-xs shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold text-blue-900 mb-2 pb-2 border-b border-blue-200/60">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    <span>Catatan Persetujuan Peninjau Sebelumnya ({approvalNotes.length})</span>
                  </div>
                  <div className="space-y-2">
                    {approvalNotes.map((item) => (
                      <div key={item.id} className="p-2.5 rounded-lg bg-white/95 border border-blue-100 text-xs shadow-2xs">
                        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 font-semibold mb-1">
                          <span className="font-bold text-blue-900">
                            {item.author} {item.role ? `(${item.role})` : ""}
                          </span>
                          <span className="font-mono">{item.date}</span>
                        </div>
                        <p className="text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">{item.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Catatan Instruksi Revisi (HANYA tampil saat status pengajuan REVISI) */}
              {renovasi.status === "REVISI" && (revisionNotes.length > 0 || revisionDetails.length > 0) && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/90 text-xs shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-2 pb-2 border-b border-amber-200/60">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Instruksi Catatan Revisi dari Peninjau {revisionNotes.length > 0 ? `(${revisionNotes.length})` : ""}</span>
                  </div>
                  {revisionNotes.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {revisionNotes.map((item) => (
                        <div key={item.id} className="p-2.5 rounded-lg bg-white/95 border border-amber-100 text-xs shadow-2xs">
                          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 font-semibold mb-1">
                            <span className="font-bold text-amber-900">
                              {item.author} {item.role ? `(${item.role})` : ""}
                            </span>
                            <span className="font-mono">{item.date}</span>
                          </div>
                          <p className="text-slate-800 font-medium leading-relaxed whitespace-pre-wrap">{item.note}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {revisionDetails.length > 0 && (
                    <div className="pt-2 border-t border-amber-200/60">
                      <span className="text-[11px] font-bold text-amber-900 block mb-2">
                        Rincian Bagian yang Ditandai Wajib Diperbaiki ({revisionDetails.length}):
                      </span>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {revisionDetails.map((d, idx) => (
                          <div key={d.id || idx} className="p-2 rounded-lg bg-white/90 border border-amber-100 text-[11px] flex flex-col gap-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-800">{d.label}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 uppercase">
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
                              <p className="text-slate-600 text-[10px] italic bg-amber-50/50 p-1 rounded border border-amber-100/60 font-medium">
                                Catatan: &ldquo;{d.catatan}&rdquo;
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Financial Summary Card: Refined, trustworthy enterprise balance */}
              <div className="p-4 sm:p-5 bg-slate-50/70 border border-slate-200/90 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Total Nilai Estimasi (RAB / OE)
                  </span>
                  <span className="text-2xl font-extrabold text-[#E65F2B] tracking-tight font-mono mt-1 block">
                    {formatRupiah(grandTotalCalc)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-3 md:pt-0 border-t md:border-t-0 md:border-l border-slate-200 md:pl-5">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium uppercase">Subtotal Sipil</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                      {formatRupiah(subtotalSipil)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium uppercase">Subtotal ME</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                      {formatRupiah(subtotalMe)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium uppercase">PPN 11%</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                      {formatRupiah(nilaiPpn)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium uppercase">Pembulatan</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                      {formatRupiah(nilaiPembulatan)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "GAMBAR" && (
            <div className="flex flex-col gap-5">
              {/* Gambar Sipil */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCode2 className="w-4 h-4 text-blue-500" />
                    Gambar Kerja Sipil
                  </h4>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {docsSipil.length} berkas terlampir
                  </span>
                </div>
                {docsSipil.length === 0 ? (
                  <div className="p-6 text-center rounded-xl bg-slate-50/60 border border-slate-200/80 text-slate-400 text-xs italic">
                    Tidak ada berkas gambar sipil yang diunggah.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {docsSipil.map((doc: any) => {
                      const isPdf =
                        doc.kategori_file?.endsWith("_PDF") ||
                        doc.nama_file?.toLowerCase().endsWith(".pdf");
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isPdf ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"
                                }`}
                            >
                              {isPdf ? <FileText className="w-4 h-4" /> : <FileCode2 className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-800 text-xs truncate" title={doc.nama_file}>
                                  {doc.nama_file}
                                </span>
                                <span
                                  className={`text-[9px] font-extrabold uppercase px-1 py-0.2 rounded border shrink-0 ${isPdf
                                      ? "bg-rose-100 text-rose-700 border-rose-200"
                                      : "bg-indigo-100 text-indigo-700 border-indigo-200"
                                    }`}
                                >
                                  {isPdf ? "PDF" : "DWG"}
                                </span>
                              </div>
                            </div>
                          </div>
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-[#E65F2B] hover:text-[#d04f1f] bg-orange-50 hover:bg-orange-100/80 px-2.5 py-1 rounded-lg transition-colors shrink-0"
                            >
                              Buka File <ExternalLink className="w-3 h-3 ml-0.5" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Gambar ME */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCode2 className="w-4 h-4 text-emerald-500" />
                    Gambar Kerja Mekanikal &amp; Elektrikal (ME)
                  </h4>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {docsMe.length} berkas terlampir
                  </span>
                </div>
                {docsMe.length === 0 ? (
                  <div className="p-6 text-center rounded-xl bg-slate-50/60 border border-slate-200/80 text-slate-400 text-xs italic">
                    Tidak ada berkas gambar ME yang diunggah.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {docsMe.map((doc: any) => {
                      const isPdf =
                        doc.kategori_file?.endsWith("_PDF") ||
                        doc.nama_file?.toLowerCase().endsWith(".pdf");
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isPdf ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"
                                }`}
                            >
                              {isPdf ? <FileText className="w-4 h-4" /> : <FileCode2 className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-800 text-xs truncate" title={doc.nama_file}>
                                  {doc.nama_file}
                                </span>
                                <span
                                  className={`text-[9px] font-extrabold uppercase px-1 py-0.2 rounded border shrink-0 ${isPdf
                                      ? "bg-rose-100 text-rose-700 border-rose-200"
                                      : "bg-indigo-100 text-indigo-700 border-indigo-200"
                                    }`}
                                >
                                  {isPdf ? "PDF" : "DWG"}
                                </span>
                              </div>
                            </div>
                          </div>
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-[#E65F2B] hover:text-[#d04f1f] bg-orange-50 hover:bg-orange-100/80 px-2.5 py-1 rounded-lg transition-colors shrink-0"
                            >
                              Buka File <ExternalLink className="w-3 h-3 ml-0.5" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "FOTO" && (
            <div>
              {fotos.length === 0 ? (
                <div className="p-12 text-center rounded-xl bg-slate-50/60 border border-slate-200/80 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium text-slate-500">Tidak ada foto lingkungan yang terlampir.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fotos.map((f: any, idx: number) => {
                    const rawTitle = f.nama_label || f.nama_file || `Foto Lingkungan #${idx + 1}`;
                    const title = toTitleCase(rawTitle);
                    return (
                      <div
                        key={f.id || idx}
                        className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-2xs hover:shadow-xs transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[#E65F2B] flex items-center justify-center shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-slate-900 block truncate text-xs" title={title}>
                              {title}
                            </span>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                Tersimpan di Drive
                              </span>
                              {f.latitude && f.longitude && (
                                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                                  <MapPin className="w-3 h-3 text-[#E65F2B] shrink-0" />
                                  {f.latitude.toFixed(4)}, {f.longitude.toFixed(4)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {f.file_url ? (
                          <a
                            href={f.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-slate-50 hover:bg-[#E65F2B] text-slate-700 hover:text-white border border-slate-200 hover:border-[#E65F2B] text-xs font-semibold transition-all group cursor-pointer"
                          >
                            <span>Buka di Google Drive</span>
                            <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </a>
                        ) : (
                          <div className="text-[11px] text-slate-400 italic text-center py-1">
                            Tautan tidak tersedia
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "RAB" && (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto border border-slate-200/90 rounded-xl shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-600 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      <th className="py-2.5 px-3">Lingkup</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3">Deskripsi Item</th>
                      <th className="py-2.5 px-3 text-right">Harga Material</th>
                      <th className="py-2.5 px-3 text-right">Harga Upah</th>
                      <th className="py-2.5 px-3 text-center">Vol</th>
                      <th className="py-2.5 px-3 text-right">Total Biaya</th>
                      <th className="py-2.5 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-10 text-center text-slate-400 italic">
                          Belum ada rincian item RAB terlampir.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {/* SEKSI 1: PEKERJAAN SIPIL */}
                        <tr className="bg-blue-50/90 border-y border-blue-200/90">
                          <td colSpan={5} className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-600 text-white shadow-2xs">
                                SIPIL
                              </span>
                              <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                                A. Pekerjaan Arsitektur & Sipil
                              </span>
                              <span className="text-[11px] text-blue-700 font-mono font-medium">
                                ({itemsSipil.length} item)
                              </span>
                            </div>
                          </td>
                          <td colSpan={4} className="py-2 px-3 text-right font-mono text-xs">
                            <span className="text-slate-500 font-normal mr-1.5">Subtotal Sipil:</span>
                            <span className="font-extrabold text-blue-900">{formatRupiah(subtotalSipil)}</span>
                          </td>
                        </tr>

                        {itemsSipil.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-3 px-3 text-center text-slate-400 italic bg-slate-50/30">
                              Tidak ada rincian item pekerjaan Sipil terlampir.
                            </td>
                          </tr>
                        ) : (
                          itemsSipil.map((it: any, idx: number) => {
                            const rowTotal = getItemTotal(it);
                            return (
                              <tr key={it.id || `sipil-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                                <td className="py-2 px-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200/60">
                                    SIPIL
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-500 font-medium">{it.kategori_pekerjaan}</td>
                                <td className="py-2 px-3 font-semibold text-slate-900">{it.deskripsi}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-700">{formatRupiah(it.harga_material)}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-700">{formatRupiah(it.harga_upah)}</td>
                                <td className="py-2 px-3 text-center font-bold font-mono text-slate-800">
                                  {it.volume} {it.satuan || ""}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">
                                  {formatRupiah(rowTotal)}
                                </td>
                                <td className="py-2 px-3 text-slate-400 max-w-[150px] truncate">{it.catatan ? toTitleCase(it.catatan) : "-"}</td>
                              </tr>
                            );
                          })
                        )}

                        {/* SEKSI 2: PEKERJAAN MEKANIKAL & ELEKTRIKAL (ME) */}
                        <tr className="bg-emerald-50/90 border-y border-emerald-200/90">
                          <td colSpan={5} className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-600 text-white shadow-2xs">
                                ME
                              </span>
                              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                                B. Pekerjaan Mekanikal & Elektrikal (ME)
                              </span>
                              <span className="text-[11px] text-emerald-700 font-mono font-medium">
                                ({itemsMe.length} item)
                              </span>
                            </div>
                          </td>
                          <td colSpan={4} className="py-2.5 px-3 text-right font-mono text-xs">
                            <span className="text-slate-500 font-normal mr-1.5">Subtotal ME:</span>
                            <span className="font-extrabold text-emerald-900">{formatRupiah(subtotalMe)}</span>
                          </td>
                        </tr>

                        {itemsMe.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-3 px-3 text-center text-slate-400 italic bg-slate-50/30">
                              Tidak ada rincian item pekerjaan ME terlampir.
                            </td>
                          </tr>
                        ) : (
                          itemsMe.map((it: any, idx: number) => {
                            const rowTotal = getItemTotal(it);
                            return (
                              <tr key={it.id || `me-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                                <td className="py-2 px-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                    ME
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-500 font-medium">{it.kategori_pekerjaan}</td>
                                <td className="py-2 px-3 font-semibold text-slate-900">{it.deskripsi}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-700">{formatRupiah(it.harga_material)}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-700">{formatRupiah(it.harga_upah)}</td>
                                <td className="py-2 px-3 text-center font-bold font-mono text-slate-800">
                                  {it.volume} {it.satuan || ""}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">
                                  {formatRupiah(rowTotal)}
                                </td>
                                <td className="py-2 px-3 text-slate-400 max-w-[150px] truncate">{it.catatan ? toTitleCase(it.catatan) : "-"}</td>
                              </tr>
                            );
                          })
                        )}
                      </>
                    )}
                  </tbody>
                  {items.length > 0 && (
                    <tfoot className="bg-slate-50/90 font-bold border-t border-slate-200 divide-y divide-slate-200/70">
                      <tr>
                        <td colSpan={7} className="py-2 px-3 text-right text-slate-500 uppercase tracking-wider text-[10px]">
                          Subtotal Pekerjaan Sipil:
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-800 font-bold">
                          {formatRupiah(subtotalSipil)}
                        </td>
                        <td />
                      </tr>
                      <tr>
                        <td colSpan={7} className="py-2 px-3 text-right text-slate-500 uppercase tracking-wider text-[10px]">
                          Subtotal Pekerjaan ME:
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-800 font-bold">
                          {formatRupiah(subtotalMe)}
                        </td>
                        <td />
                      </tr>
                      <tr className="bg-slate-100/70">
                        <td colSpan={7} className="py-2 px-3 text-right text-slate-700 uppercase tracking-wider text-[10px] font-bold">
                          TOTAL (Sebelum PPN):
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-900 font-bold">
                          {formatRupiah(totalSebelumPpn)}
                        </td>
                        <td />
                      </tr>
                      <tr>
                        <td colSpan={7} className="py-2 px-3 text-right text-slate-600 uppercase tracking-wider text-[10px] font-medium">
                          PPN 11%:
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-800 font-bold">
                          {formatRupiah(nilaiPpn)}
                        </td>
                        <td />
                      </tr>
                      <tr>
                        <td colSpan={7} className="py-2 px-3 text-right text-slate-600 uppercase tracking-wider text-[10px] font-medium">
                          Pembulatan (Ribuan ke Atas):
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-800 font-bold">
                          {formatRupiah(nilaiPembulatan)}
                        </td>
                        <td />
                      </tr>
                      <tr className="bg-orange-50/60 border-t-2 border-orange-200">
                        <td colSpan={7} className="py-2.5 px-3 text-right text-slate-700 uppercase tracking-wider text-[10px] font-extrabold">
                          GRAND TOTAL RAB / OE:
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#E65F2B] font-extrabold text-sm">
                          {formatRupiah(grandTotalCalc)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-200/80 flex flex-wrap justify-between items-center gap-3 shrink-0">
          {canApprove ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Menunggu Tindakan Persetujuan Anda</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span>Mode Peninjau (Read Only)</span>
            </div>
          )}

          <div className="flex items-center flex-wrap gap-2.5">
            {canApprove && onApprovalAction && (
              <>
                <Button
                  variant="outline"
                  onClick={() => onApprovalAction("REVISI", renovasi)}
                  className="rounded-xl text-xs h-9 px-3.5 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 font-bold cursor-pointer transition-colors"
                >
                  <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                  Minta Revisi
                </Button>

                <Button
                  onClick={() => onApprovalAction("APPROVE", renovasi)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 px-4 font-bold shadow-xs cursor-pointer transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  Setujui Pengajuan
                </Button>
              </>
            )}

            {canEditThisSubmission && !canApprove && (
              <Link href={`/dc-development/renovasi/tambah?draft_id=${renovasi.id}`}>
                <Button
                  className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white rounded-xl text-xs h-9 px-4 font-bold shadow-xs cursor-pointer transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  {renovasi.status === "REVISI" ? "Lakukan Revisi Pengajuan" : "Lanjutkan Edit Draft"}
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="rounded-xl text-xs h-9 px-3.5 border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-bold cursor-pointer transition-colors"
            >
              {downloadingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-[#E65F2B]" />
                  Mempersiapkan PDF...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 mr-1.5 text-[#E65F2B]" />
                  Unduh Dokumen PDF
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs h-9 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Tutup
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
