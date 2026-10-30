"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileText,
  FileDown,
  Building2,
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RotateCcw,
  Check,
  Loader2,
  Layers,
  MessageSquare,
  X,
  Pencil,
  Send,
  ShieldCheck,
  Eye,
  Search,
} from "lucide-react";
import ApprovalStepper from "@/components/approval/ApprovalStepper";
import ApprovalNotesHistory from "@/components/approval/ApprovalNotesHistory";
import ApprovalActionCard from "@/components/approval/ApprovalActionCard";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { KlarifikasiApprovalDialog } from "./KlarifikasiApprovalDialog";
import { canUserApproveKlarifikasiAanwijzing } from "@/lib/permissions";
import { formatRupiah, cn } from "@/lib/utils";

interface DetailKlarifikasiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  klarifikasi: any | null;
  currentUser?: any;
  showApprovalActions?: boolean;
  onApprovalSuccess?: (feedbackData?: { action: string; title: string; message: string }) => void;
  isReviewMode?: boolean;
  onConfirmSubmit?: () => void;
  isSubmitting?: boolean;
  isRevision?: boolean;
}

export function DetailKlarifikasiModal({
  open,
  onOpenChange,
  klarifikasi,
  currentUser,
  showApprovalActions = false,
  onApprovalSuccess,
  isReviewMode = false,
  onConfirmSubmit,
  isSubmitting: externalSubmitting,
  isRevision = false,
}: DetailKlarifikasiModalProps) {
  const [activeTab, setActiveTab] = useState<"ITEMS" | "PESERTA">("ITEMS");
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Approval Action States
  const [actionType, setActionType] = useState<"APPROVE" | "REVISI" | null>(null);
  const [isInternalSubmitting, setIsInternalSubmitting] = useState(false);
  const isSubmitting = externalSubmitting ?? isInternalSubmitting;

  // Feedback Modal State
  const [feedback, setFeedback] = useState<{
    open: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  const items = klarifikasi?.items || [];
  const pesertaList = klarifikasi?.aanwijzing?.peserta || [];

  const itemsSipil = items.filter(
    (it: any) => (it.lingkup || "SIPIL").toUpperCase() === "SIPIL"
  );
  const itemsMe = items.filter(
    (it: any) => (it.lingkup || "").toUpperCase() === "ME"
  );

  const totalSipil = itemsSipil.reduce(
    (acc: number, it: any) => acc + (Number(it.total_biaya_akhir) || 0),
    0
  );

  const totalMe = itemsMe.reduce(
    (acc: number, it: any) => acc + (Number(it.total_biaya_akhir) || 0),
    0
  );

  const grandTotal = totalSipil + totalMe;

  const canApprove =
    showApprovalActions &&
    klarifikasi &&
    canUserApproveKlarifikasiAanwijzing(currentUser, klarifikasi);

  const getNextStepLabel = () => {
    if (klarifikasi?.status === "MENUNGGU_APPROVAL_BBM_MANAGER") {
      return "DC Building & Development Specialist";
    }
    if (klarifikasi?.status === "MENUNGGU_APPROVAL_DC_SPECIALIST") {
      return "Persetujuan Selesai (Final Approved)";
    }
    return undefined;
  };

  const handleExecuteApproval = async (payload: {
    action: "APPROVE" | "REVISI";
    notes: string;
    detail_revisi?: any[];
  }) => {
    if (!klarifikasi?.id) return;
    setIsInternalSubmitting(true);
    try {
      const res = await fetch(
        `/api/dc-development/klarifikasi-aanwijzing/${klarifikasi.id}/approval`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();

      if (json.status === "success") {
        setActionType(null);
        setFeedback({
          open: true,
          type: "success",
          title: payload.action === "APPROVE" ? "Berhasil Disetujui" : "Berhasil Dikembalikan",
          message:
            json.message ||
            (payload.action === "APPROVE"
              ? "Berita Acara berhasil disetujui (Final Status: APPROVED). Dokumen siap dijadikan dasar penawaran tender."
              : "Dokumen Berita Acara berhasil dikembalikan kepada pembuat untuk diperbaiki (Status: REVISI)."),
        });
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Memproses Tindakan",
          message: json.message || "Terjadi kesalahan saat memproses keputusan persetujuan.",
        });
      }
    } catch (err: any) {
      setFeedback({
        open: true,
        type: "error",
        title: "Kesalahan Sistem",
        message: err.message || "Gagal menghubungi server.",
      });
    } finally {
      setIsInternalSubmitting(false);
    }
  };

  const handleViewPdf = async () => {
    if (!klarifikasi?.id) return;
    const directUrl = klarifikasi.file_url;
    if (directUrl && (directUrl.startsWith("http://") || directUrl.startsWith("https://"))) {
      window.open(directUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/dc-development/klarifikasi-aanwijzing/${klarifikasi.id}/download-pdf`);
      const json = await res.json();
      if (json.status === "success" && json.data?.file_url) {
        window.open(json.data.file_url, "_blank", "noopener,noreferrer");
      } else {
        window.open(`/api/dc-development/klarifikasi-aanwijzing/${klarifikasi.id}/pdf`, "_blank");
      }
    } catch {
      window.open(`/api/dc-development/klarifikasi-aanwijzing/${klarifikasi.id}/pdf`, "_blank");
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (!klarifikasi) return null;

  const isBlurred = Boolean(actionType) || feedback.open;

  return (
    <>
      <Dialog
        open={open || feedback.open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && isBlurred) {
            // Cegah Radix UI menutup modal detail saat dialog approval atau feedback modal sedang aktif
            return;
          }
          onOpenChange(nextOpen);
        }}
      >
        <DialogContent
          overlayClassName="bg-slate-900/20 backdrop-blur-xs z-[89990]"
          onPointerDownOutside={(e) => {
            if (isBlurred) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            if (isBlurred) {
              e.preventDefault();
            }
          }}
          onFocusOutside={(e) => {
            if (isBlurred) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (isBlurred) {
              e.preventDefault();
            }
          }}
          className={cn(
            "max-w-5xl max-h-[92vh] overflow-hidden p-0 rounded-2xl border border-slate-200/80 shadow-2xl bg-white flex flex-col [&>button:last-child]:hidden z-[90000] transition-all duration-300",
            isBlurred ? "filter blur-[3px] pointer-events-none select-none" : ""
          )}
        >
          {/* Header Banner */}
          <div className="bg-slate-50 border-b border-slate-200 p-5 rounded-t-2xl shrink-0">
            <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-[#E65F2B] uppercase tracking-wider bg-orange-50 px-2 py-0.5 rounded border border-orange-200/70 inline-block">
                    SOP SAT/SOP/DCB/003
                  </span>
                  {isReviewMode && (
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block">
                      {isRevision ? "Perbaikan Berkas Revisi" : "Review Pengajuan Baru"}
                    </span>
                  )}
                </div>
                <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#E65F2B] shrink-0" />
                  <span className="truncate">
                    {isReviewMode
                      ? isRevision
                        ? `Review Perbaikan Berita Acara — ${klarifikasi.nomor_klarifikasi || "Klarifikasi Aanwijzing"}`
                        : "Review Berita Acara Klarifikasi Hasil Aanwijzing"
                      : `Berita Acara Aanwijzing — ${klarifikasi.nomor_klarifikasi}`}
                  </span>
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-1 truncate">
                  {isReviewMode
                    ? "Periksa kembali seluruh penyesuaian volume, harga, serta penambahan item pekerjaan baru sebelum diajukan."
                    : `Proyek: ${klarifikasi.project?.nama_proyek || "-"} (${klarifikasi.project?.kode || "-"}) • Cabang ${klarifikasi.cabang || "-"}`}
                </p>
              </div>

              {/* Action Buttons & Clean Non-Overlapping Close Button */}
              <div className="flex items-center gap-3 shrink-0 ml-auto">
                {isReviewMode ? (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
                      Total Biaya Penyesuaian
                    </span>
                    <span className="text-base font-extrabold text-[#E65F2B] font-mono leading-normal">
                      {formatRupiah(grandTotal)}
                    </span>
                  </div>
                ) : (
                  klarifikasi.id > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={downloadingPdf}
                      onClick={handleViewPdf}
                      className="rounded-xl border-slate-200 hover:bg-white text-slate-700 font-bold h-9 text-xs inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      {downloadingPdf ? (
                        <Loader2 className="w-4 h-4 text-[#E65F2B] animate-spin" />
                      ) : (
                        <Eye className="w-4 h-4 text-[#E65F2B]" />
                      )}
                      <span>{downloadingPdf ? "Membuka..." : "Lihat PDF"}</span>
                    </Button>
                  )
                )}

                {/* Clean Close Button in flex container */}
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  title="Tutup Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#FAFAFA]">
            {/* Approval Stepper (Hanya Muncul di Mode Non-Review) */}
            {!isReviewMode && (
              <ApprovalStepper
                currentStatus={klarifikasi.status}
                type="klarifikasi-aanwijzing"
                className="shadow-2xs"
              />
            )}

            {/* Info Metadata Box */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs shadow-2xs">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Nama Proyek</div>
                <div className="font-bold text-slate-800 mt-0.5 truncate">
                  {klarifikasi.project?.nama_proyek || "-"}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Kode: {klarifikasi.project?.kode || "-"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Cabang &amp; Lokasi</div>
                <div className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{klarifikasi.project?.alamat || klarifikasi.cabang || "-"}</span>
                </div>
                <div className="text-[11px] text-slate-500">Cabang {klarifikasi.cabang || "-"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">No. Surat Undangan</div>
                <div className="font-semibold text-slate-800 mt-0.5">
                  {klarifikasi.aanwijzing?.nomor_undangan || "-"}
                </div>
                <div className="text-[11px] text-slate-500">
                  Status: {klarifikasi.aanwijzing?.status || "AANWIJZING_SELESAI"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Pembuat Berita Acara</div>
                <div className="font-semibold text-slate-800 mt-0.5 truncate">
                  {klarifikasi.created_by || "-"}
                </div>
                <div className="text-[11px] text-slate-500">
                  {new Date(klarifikasi.created_at || Date.now()).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>

            {/* Catatan Tambahan Maker (Jika Ada) */}
            {(klarifikasi.catatan_maker || klarifikasi.catatan) && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 space-y-1 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#E65F2B]" />
                  <span>Catatan Tambahan / Ringkasan Rapat Maker</span>
                </span>
                <p className="text-xs text-slate-700 italic leading-relaxed">
                  &quot;{klarifikasi.catatan_maker || klarifikasi.catatan}&quot;
                </p>
              </div>
            )}

            {/* Sub-tab Switcher: Perubahan Item vs Peserta Aanwijzing */}
            <div>
              <div className="flex border-b border-slate-200 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("ITEMS")}
                  className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer inline-flex items-center gap-1.5 ${
                    activeTab === "ITEMS"
                      ? "border-[#E65F2B] text-[#E65F2B]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Daftar Perubahan Item ({items.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("PESERTA")}
                  className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer inline-flex items-center gap-1.5 ${
                    activeTab === "PESERTA"
                      ? "border-[#E65F2B] text-[#E65F2B]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Peserta Aanwijzing ({pesertaList.length})</span>
                </button>
              </div>

              {/* Tab Content: ITEMS (Terpisah: A. Item Sipil, B. Item ME) */}
              {activeTab === "ITEMS" && (
                <div className="space-y-4">
                  {/* Subsection A: Item Pekerjaan Sipil */}
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs bg-white">
                    <div className="bg-slate-50/80 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-[#E65F2B] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          A
                        </span>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Item Pekerjaan Sipil ({itemsSipil.length} item)
                        </span>
                      </div>
                      <span className="text-[11px] font-bold font-mono text-[#E65F2B]">
                        Jumlah Sipil: {formatRupiah(totalSipil)}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                        <thead className="bg-slate-50/50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">No</th>
                            <th className="py-2.5 px-3">Item Pekerjaan</th>
                            <th className="py-2.5 px-3 text-center w-28">Volume</th>
                            <th className="py-2.5 px-3 text-right">Harga Material</th>
                            <th className="py-2.5 px-3 text-right">Harga Upah</th>
                            <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                            <th className="py-2.5 px-3 text-right">Total Biaya</th>
                            <th className="py-2.5 px-3 text-center min-w-[120px]">Status</th>
                            <th className="py-2.5 px-3 min-w-[150px]">Catatan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {itemsSipil.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-6 text-center text-slate-400 italic">
                                Tidak ada penyesuaian volume atau penambahan item pekerjaan Sipil.
                              </td>
                            </tr>
                          ) : (
                            itemsSipil.map((it: any, idx: number) => {
                              const isBaru = it.tipe_perubahan === "ITEM_BARU";
                              const mat = Number(it.harga_material) || 0;
                              const upah = Number(it.harga_upah) || 0;
                              const hrgSatuan = mat + upah;

                              return (
                                <tr key={it.id || idx} className="hover:bg-slate-50/70">
                                  <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-800">{it.deskripsi}</div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wide">{it.kategori_pekerjaan}</div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                                    {isBaru ? (
                                      `${it.volume_akhir} ${it.satuan}`
                                    ) : (
                                      <div className="flex flex-col items-center">
                                        {it.volume_awal !== it.volume_akhir && (
                                          <span className="text-slate-400 line-through text-[10px]">
                                            {it.volume_awal} {it.satuan}
                                          </span>
                                        )}
                                        <span className={it.volume_awal !== it.volume_akhir ? "text-[#E65F2B]" : ""}>
                                          {it.volume_akhir} {it.satuan}
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-slate-600 font-mono text-[11px] whitespace-nowrap">
                                    {formatRupiah(mat)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-slate-600 font-mono text-[11px] whitespace-nowrap">
                                    {formatRupiah(upah)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-slate-800 font-mono text-[11px] whitespace-nowrap">
                                    {formatRupiah(hrgSatuan)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="flex flex-col items-end">
                                      <span className="font-bold text-[#E65F2B] font-mono text-[11px] whitespace-nowrap">
                                        {formatRupiah(it.total_biaya_akhir || 0)}
                                      </span>
                                      {!isBaru && Number(it.total_biaya_awal) > 0 && it.total_biaya_awal !== it.total_biaya_akhir && (
                                        <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                                          Awal: {formatRupiah(it.total_biaya_awal)}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${
                                        isBaru
                                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                          : "bg-blue-50 text-blue-800 border-blue-200"
                                      }`}
                                    >
                                      {it.status_perubahan || (isBaru ? "Item Baru Ditambahkan" : "Item Disesuaikan")}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-700 text-xs font-medium whitespace-pre-line leading-relaxed">
                                    {it.catatan || it.keterangan || "-"}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        {itemsSipil.length > 0 && (
                          <tfoot className="bg-orange-50/60 font-bold border-t border-orange-200/80">
                            <tr>
                              <td colSpan={6} className="py-2.5 px-3 text-right text-[11px] uppercase text-orange-950 font-bold">
                                Jumlah Pekerjaan Sipil :
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-[#E65F2B] text-xs font-bold whitespace-nowrap">
                                {formatRupiah(totalSipil)}
                              </td>
                              <td colSpan={2}></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>

                  {/* Subsection B: Item Pekerjaan ME */}
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs bg-white">
                    <div className="bg-slate-50/80 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-[#E65F2B] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          B
                        </span>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Item Pekerjaan ME (Mechanical &amp; Electrical) ({itemsMe.length} item)
                        </span>
                      </div>
                      <span className="text-[11px] font-bold font-mono text-[#E65F2B]">
                        Jumlah ME: {formatRupiah(totalMe)}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse min-w-[850px]">
                        <thead className="bg-slate-50/50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3 w-10 text-center">No</th>
                            <th className="py-2.5 px-3">Item Pekerjaan</th>
                            <th className="py-2.5 px-3 text-center w-28">Volume</th>
                            <th className="py-2.5 px-3 text-right">Harga Material</th>
                            <th className="py-2.5 px-3 text-right">Harga Upah</th>
                            <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                            <th className="py-2.5 px-3 text-right">Total Biaya</th>
                            <th className="py-2.5 px-3 text-center min-w-[120px]">Status</th>
                            <th className="py-2.5 px-3 min-w-[150px]">Catatan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {itemsMe.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-6 text-center text-slate-400 italic">
                                Tidak ada penyesuaian volume atau penambahan item pekerjaan ME.
                              </td>
                            </tr>
                          ) : (
                            itemsMe.map((it: any, idx: number) => {
                              const isBaru = it.tipe_perubahan === "ITEM_BARU";
                              const mat = Number(it.harga_material) || 0;
                              const upah = Number(it.harga_upah) || 0;
                              const hrgSatuan = mat + upah;

                              return (
                                <tr key={it.id || idx} className="hover:bg-slate-50/70">
                                  <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-800">{it.deskripsi}</div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wide">{it.kategori_pekerjaan}</div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                                    {isBaru ? (
                                      `${it.volume_akhir} ${it.satuan}`
                                    ) : (
                                      <div className="flex flex-col items-center">
                                        {it.volume_awal !== it.volume_akhir && (
                                          <span className="text-slate-400 line-through text-[10px]">
                                            {it.volume_awal} {it.satuan}
                                          </span>
                                        )}
                                        <span className={it.volume_awal !== it.volume_akhir ? "text-[#E65F2B]" : ""}>
                                          {it.volume_akhir} {it.satuan}
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-slate-600 font-mono text-[11px] whitespace-nowrap">
                                    {formatRupiah(mat)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-slate-600 font-mono text-[11px] whitespace-nowrap">
                                    {formatRupiah(upah)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-slate-800 font-mono text-[11px] whitespace-nowrap">
                                    {formatRupiah(hrgSatuan)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="flex flex-col items-end">
                                      <span className="font-bold text-[#E65F2B] font-mono text-[11px] whitespace-nowrap">
                                        {formatRupiah(it.total_biaya_akhir || 0)}
                                      </span>
                                      {!isBaru && Number(it.total_biaya_awal) > 0 && it.total_biaya_awal !== it.total_biaya_akhir && (
                                        <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                                          Awal: {formatRupiah(it.total_biaya_awal)}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${
                                        isBaru
                                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                          : "bg-blue-50 text-blue-800 border-blue-200"
                                      }`}
                                    >
                                      {it.status_perubahan || (isBaru ? "Item Baru Ditambahkan" : "Item Disesuaikan")}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-700 text-xs font-medium whitespace-pre-line leading-relaxed">
                                    {it.catatan || it.keterangan || "-"}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        {itemsMe.length > 0 && (
                          <tfoot className="bg-orange-50/60 font-bold border-t border-orange-200/80">
                            <tr>
                              <td colSpan={6} className="py-2.5 px-3 text-right text-[11px] uppercase text-orange-950 font-bold">
                                Jumlah Pekerjaan ME :
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-[#E65F2B] text-xs font-bold whitespace-nowrap">
                                {formatRupiah(totalMe)}
                              </td>
                              <td colSpan={2}></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>

                  {/* Ringkasan Akumulasi Total Biaya (Jumlah Keduanya) */}
                  <div className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200/90 rounded-xl shadow-2xs">
                    <div>
                      <span className="text-xs font-extrabold text-orange-950 uppercase tracking-wide block">
                        Jumlah Total (Sipil + ME)
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Akumulasi penyesuaian volume dan penambahan pekerjaan aanwijzing
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-extrabold text-[#E65F2B] font-mono">
                        {formatRupiah(grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: PESERTA */}
              {activeTab === "PESERTA" && (
                <div className="border border-slate-200/80 rounded-xl overflow-x-auto shadow-2xs bg-white">
                  <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">No</th>
                        <th className="py-2.5 px-3">Rekanan Kontraktor</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3 text-center">Kehadiran Fisik</th>
                        <th className="py-2.5 px-3">Tanda Tangan / Timestamp Absensi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {pesertaList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            Tidak ada peserta rekanan terdaftar.
                          </td>
                        </tr>
                      ) : (
                        pesertaList.map((p: any, idx: number) => {
                          const isHadir = p.status_kehadiran_aktual === "HADIR_AKTUAL";
                          return (
                            <tr key={p.id || idx} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {p.vendor?.nama_perusahaan || p.vendor?.nama_vendor || "-"}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500">{p.email || "-"}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isHadir
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}
                                >
                                  {isHadir ? "HADIR FISIK" : "TIDAK HADIR"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 text-[11px]">
                                {isHadir ? (
                                  <div>
                                    <div className="font-semibold text-emerald-800">
                                      {p.absen_at ? new Date(p.absen_at).toLocaleString("id-ID") : "-"}
                                    </div>
                                    {p.absen_metode && (
                                      <div className="text-[10px] text-slate-400">Metode: {p.absen_metode}</div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-slate-500 italic">
                                    {p.catatan_absen ? `Catatan BBK: ${p.catatan_absen}` : "Tidak hadir pada rapat"}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Riwayat Persetujuan & Catatan Reviewer (Hanya Muncul jika ada data audit log) */}
            {!isReviewMode && (klarifikasi.audit_logs?.length > 0 || klarifikasi.created_by) && (
              <ApprovalNotesHistory
                auditLogs={klarifikasi.audit_logs || []}
                createdBy={klarifikasi.created_by}
                createdAt={klarifikasi.created_at}
                defaultOpen={false}
              />
            )}
          </div>

          {/* DOCKED SOLID FOOTER FOR APPROVAL MODE (Fixed di Bawah, Opaque, Tidak Mengambang Tembus) */}
          {canApprove && !isReviewMode && (
            <div className="shrink-0 bg-white border-t border-slate-200 px-6 py-3.5 rounded-b-2xl flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap shadow-[0_-4px_25px_rgba(0,0,0,0.06)] z-30">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-[#E65F2B]" />
                </div>
                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Tindakan Persetujuan Anda {currentUser?.role ? `(${currentUser.role})` : ""}
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                      Menunggu Keputusan Anda
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {getNextStepLabel()
                      ? `Menyetujui akan meneruskan dokumen ke tahap: ${getNextStepLabel()}.`
                      : "Menyetujui akan menyelesaikan proses persetujuan (Final Approved)."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 ml-auto shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActionType("REVISI")}
                  disabled={isSubmitting}
                  className="rounded-xl h-9.5 px-4 border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-orange-600" />
                  <span>Kembalikan Revisi</span>
                </Button>

                <Button
                  type="button"
                  onClick={() => setActionType("APPROVE")}
                  disabled={isSubmitting}
                  className="rounded-xl h-9.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  <span>Setujui (Approve)</span>
                </Button>
              </div>
            </div>
          )}

          {/* DOCKED FOOTER FOR READ ONLY MODE (Mode Peninjau) */}
          {!canApprove && !isReviewMode && (
            <div className="shrink-0 bg-white border-t border-slate-200 px-6 py-3 rounded-b-2xl flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap shadow-2xs z-30">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>Mode Peninjau Berkas (Read Only)</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-xl h-9 text-xs border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer ml-auto"
              >
                Tutup
              </Button>
            </div>
          )}

          {/* DOCKED FOOTER FOR REVIEW MODE */}
          {isReviewMode && (
            <div className="shrink-0 bg-white border-t border-slate-200/90 px-6 py-3.5 rounded-b-2xl flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap shadow-xs">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-500">Rekap:</span>
                <span className="font-bold text-slate-800">
                  {items.length} item ({items.filter((it: any) => it.tipe_perubahan === "ITEM_BARU").length} baru, {items.filter((it: any) => it.tipe_perubahan === "UBAH_VOLUME").length} disesuaikan)
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-semibold text-slate-500">Estimasi Total:</span>
                <span className="font-mono font-extrabold text-[#E65F2B] text-sm">
                  {formatRupiah(grandTotal)}
                </span>
              </div>

              <div className="flex items-center gap-2.5 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="rounded-xl h-9 text-xs border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  <span>Kembali Periksa</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={onConfirmSubmit}
                  className="rounded-xl h-9 text-xs font-bold bg-[#E65F2B] hover:bg-[#d04f1f] text-white shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>
                    {isRevision
                      ? "Konfirmasi & Ajukan Ulang Revisi"
                      : "Konfirmasi & Ajukan Berita Acara"}
                  </span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reusable KlarifikasiApprovalDialog (Modal Pop-up dengan Frosted Scrim & Detail Ter-blur) */}
      <KlarifikasiApprovalDialog
        open={actionType !== null}
        onOpenChange={(isOpen) => !isOpen && setActionType(null)}
        actionType={actionType}
        klarifikasi={klarifikasi}
        isSubmitting={isSubmitting}
        onConfirm={handleExecuteApproval}
        onViewPdf={handleViewPdf}
        onErrorFeedback={(title, message) => {
          setFeedback({
            open: true,
            type: "error",
            title,
            message,
          });
        }}
      />

      {/* Feedback Modal Pop-up */}
      <FeedbackModal
        isOpen={feedback.open}
        overlayClassName="z-[100040] bg-slate-900/25 backdrop-blur-xs"
        className="z-[100050]"
        onClose={() => {
          setFeedback((prev) => ({ ...prev, open: false }));
          if (feedback.type === "success") {
            onOpenChange(false);
            onApprovalSuccess?.();
          }
        }}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
      />
    </>
  );
}
