"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatRupiah, cn, toTitleCase } from "@/lib/utils";
import { getNextApprovalStatus } from "@/lib/permissions";
import { RevisionDetailItem } from "@/lib/types/renovasi-revision";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  SlidersHorizontal,
  FileCode2,
  Camera,
  Coins,
  ChevronDown,
  ChevronUp,
  Search,
  ExternalLink,
  Check
} from "lucide-react";

export type ApprovalActionType = "APPROVE" | "REVISI" | "TOLAK";

interface ApprovalActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ApprovalActionType | null;
  target: any | null;
  onSuccess: (updatedItem?: any) => void;
}

export default function ApprovalActionDialog({
  open,
  onOpenChange,
  action,
  target,
  onSuccess
}: ApprovalActionDialogProps) {
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Full item data if target passed is partial
  const [fullTarget, setFullTarget] = useState<any>(target);

  // Granular Revision States
  const [revParamDurasi, setRevParamDurasi] = useState(false);
  const [revParamDurasiNote, setRevParamDurasiNote] = useState("");

  const [revParamJenis, setRevParamJenis] = useState(false);
  const [revParamJenisNote, setRevParamJenisNote] = useState("");

  // Map of document ID -> { selected: boolean, note: string }
  const [revDrawings, setRevDrawings] = useState<Record<string, { selected: boolean; note: string }>>({});

  // Map of foto ID -> { selected: boolean, note: string }
  const [revPhotos, setRevPhotos] = useState<Record<string, { selected: boolean; note: string }>>({});

  // Map of rab item ID -> { selected: boolean, note: string }
  const [revRabItems, setRevRabItems] = useState<Record<string, { selected: boolean; note: string }>>({});

  // Accordion active sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    params: true,
    drawings: true,
    photos: true,
    rab: false
  });

  // Filter search for RAB items in revision dialog
  const [rabSearch, setRabSearch] = useState("");

  // Load and reset states on open
  useEffect(() => {
    if (open) {
      setCatatan("");
      setErrorMessage(null);
      setRevParamDurasi(false);
      setRevParamDurasiNote("");
      setRevParamJenis(false);
      setRevParamJenisNote("");
      setRevDrawings({});
      setRevPhotos({});
      setRevRabItems({});
      setRabSearch("");
      setOpenSections({
        params: true,
        drawings: true,
        photos: true,
        rab: false
      });

      setFullTarget(target);

      // Fetch full target if dokumen or item_rab is not present
      if (target?.id && (!target.dokumen || !target.item_rab)) {
        fetch(`/api/dc-development/renovasi?id=${target.id}`)
          .then((res) => res.json())
          .then((json) => {
            if (json.status === "success" && json.data) {
              setFullTarget(json.data);
            }
          })
          .catch((err) => console.error("Gagal memuat detail renovasi untuk modal revisi:", err));
      }
    }
  }, [open, action, target]);

  if (!target || !action) return null;

  const currentData = fullTarget || target;
  const nextStep = action === "APPROVE" ? getNextApprovalStatus(currentData.status) : null;
  const isNotesMandatory = action === "REVISI" || action === "TOLAK";

  // Documents separation
  const allDocs = currentData.dokumen || [];
  const drawingsList = allDocs.filter((d: any) =>
    d.kategori_file?.startsWith("GAMBAR_") || d.kategori_file === "GAMBAR_SIPIL" || d.kategori_file === "GAMBAR_ME"
  );
  const photosList = allDocs.filter((d: any) => d.kategori_file === "FOTO_LINGKUNGAN");
  const rabList = currentData.item_rab || [];

  // Filtered RAB items for search
  const filteredRabList = rabList.filter((r: any) => {
    if (!rabSearch.trim()) return true;
    const q = rabSearch.toLowerCase();
    return (
      (r.deskripsi || "").toLowerCase().includes(q) ||
      (r.kategori_pekerjaan || "").toLowerCase().includes(q) ||
      (r.lingkup || "").toLowerCase().includes(q)
    );
  });

  // Total flagged items count
  const flaggedCount = useMemo(() => {
    let count = 0;
    if (revParamDurasi) count++;
    if (revParamJenis) count++;
    count += Object.values(revDrawings).filter((d) => d.selected).length;
    count += Object.values(revPhotos).filter((p) => p.selected).length;
    count += Object.values(revRabItems).filter((r) => r.selected).length;
    return count;
  }, [revParamDurasi, revParamJenis, revDrawings, revPhotos, revRabItems]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getActionConfig = () => {
    switch (action) {
      case "APPROVE":
        return {
          title: "Konfirmasi Persetujuan Pengajuan",
          description: "Pengajuan ini akan disetujui dan dialihkan ke tahap proses selanjutnya.",
          icon: CheckCircle2,
          iconBg: "bg-emerald-50 text-emerald-600 border border-emerald-200/80",
          submitText: nextStep?.nextStatus === "APPROVED" ? "Setujui & Terbitkan (Final)" : "Setujui Pengajuan",
          submitBtnClass: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20",
          notePlaceholder: "Tuliskan catatan persetujuan jika diperlukan (Opsional)..."
        };
      case "REVISI":
        return {
          title: "Permintaan Revisi Pengajuan",
          description: "Tandai elemen yang wajib diperbaiki dan berikan catatan instruksi untuk Branch Building Koordinator.",
          icon: AlertCircle,
          iconBg: "bg-amber-50 text-amber-600 border border-amber-200/80",
          submitText: flaggedCount > 0 ? `Kirim Revisi (${flaggedCount} Poin Ditandai)` : "Kirim Permintaan Revisi",
          submitBtnClass: "bg-[#E65F2B] hover:bg-[#d45524] text-white shadow-[#E65F2B]/20",
          notePlaceholder: "Tuliskan ringkasan umum instruksi revisi pengajuan (Wajib diisi)..."
        };
      case "TOLAK":
        return {
          title: "Penolakan Pengajuan Renovasi",
          description: "Pengajuan ini akan ditolak dan statusnya akan ditutup sebagai ditolak.",
          icon: XCircle,
          iconBg: "bg-rose-50 text-rose-600 border border-rose-200/80",
          submitText: "Tolak Pengajuan",
          submitBtnClass: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20",
          notePlaceholder: "Jelaskan alasan penolakan pengajuan renovasi ini (Wajib diisi)..."
        };
    }
  };

  const config = getActionConfig();
  const IconComponent = config.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedNote = catatan.trim();
    if (isNotesMandatory && !trimmedNote && flaggedCount === 0) {
      setErrorMessage(`Catatan umum atau poin revisi wajib diisi untuk tindakan ${action === "REVISI" ? "Permintaan Revisi" : "Penolakan"}`);
      return;
    }

    // Build detail_revisi payload when action === "REVISI"
    const detailRevisiPayload: RevisionDetailItem[] = [];

    if (action === "REVISI") {
      // 1. Parameter: Durasi Pekerjaan (Hari)
      if (revParamDurasi) {
        detailRevisiPayload.push({
          id: "param_durasi_hari",
          category: "PARAMETER",
          fieldOrId: "durasi_hari",
          label: "Durasi Pekerjaan (Hari)",
          catatan: revParamDurasiNote.trim() || "Perlu disesuaikan estimasi durasi hari",
          initialValue: currentData.durasi_hari || 0
        });
      }

      // 1. Parameter: Jenis Renovasi
      if (revParamJenis) {
        detailRevisiPayload.push({
          id: "param_jenis_renovasi",
          category: "PARAMETER",
          fieldOrId: "jenis_renovasi",
          label: "Jenis Renovasi",
          catatan: revParamJenisNote.trim() || "Perlu disesuaikan jenis renovasi",
          initialValue: currentData.jenis_renovasi || ""
        });
      }

      // 2. Gambar Kerja (Sipil & ME)
      Object.entries(revDrawings).forEach(([id, data]) => {
        if (data.selected) {
          const doc = drawingsList.find((d: any) => String(d.id) === id);
          if (doc) {
            const subCat = doc.kategori_file?.includes("SIPIL") ? "SIPIL" : "ME";
            const ext = doc.nama_file?.toLowerCase().endsWith(".dwg") ? "DWG" : "PDF";
            detailRevisiPayload.push({
              id: `doc_${doc.id}`,
              category: "GAMBAR",
              fieldOrId: String(doc.id),
              subCategory: `${subCat}_${ext}`,
              label: `${doc.nama_label || doc.nama_file} (${subCat} ${ext})`,
              catatan: data.note.trim() || "Perlu perbaikan gambar teknik dan diunggah ulang",
              initialValue: doc.nama_file || doc.file_url || String(doc.id)
            });
          }
        }
      });

      // 3. Foto Lingkungan & Eksisting
      Object.entries(revPhotos).forEach(([id, data]) => {
        if (data.selected) {
          const photo = photosList.find((p: any) => String(p.id) === id);
          if (photo) {
            detailRevisiPayload.push({
              id: `foto_${photo.id}`,
              category: "FOTO",
              fieldOrId: String(photo.id),
              subCategory: "FOTO_LINGKUNGAN",
              label: photo.nama_label || photo.nama_file || `Foto Lingkungan #${photo.id}`,
              catatan: data.note.trim() || "Perlu difoto ulang atau diperbaiki",
              initialValue: photo.nama_file || photo.file_url || String(photo.id)
            });
          }
        }
      });

      // 4. Estimasi Item RAB / OE
      Object.entries(revRabItems).forEach(([id, data]) => {
        if (data.selected) {
          const item = rabList.find((r: any) => String(r.id) === id);
          if (item) {
            detailRevisiPayload.push({
              id: `rab_${item.id}`,
              category: "RAB",
              fieldOrId: String(item.id),
              subCategory: item.lingkup || "SIPIL",
              label: `[${item.lingkup || "SIPIL"}] ${item.deskripsi}`,
              catatan: data.note.trim() || "Perlu penyesuaian volume atau spesifikasi pekerjaan",
              initialValue: {
                deskripsi: item.deskripsi,
                volume: item.volume,
                harga_material: item.harga_material,
                harga_upah: item.harga_upah,
                total_biaya: item.total_biaya
              }
            });
          }
        }
      });
    }

    try {
      setLoading(true);

      // Auto-fill general notes if approver checked specific items but left main notes blank
      let finalCatatan = trimmedNote;
      if (!finalCatatan && action === "REVISI" && detailRevisiPayload.length > 0) {
        finalCatatan = `Mohon perbaiki ${detailRevisiPayload.length} poin yang ditandai pada formulir pengajuan renovasi.`;
      }

      const res = await fetch("/api/dc-development/renovasi/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentData.id,
          action,
          catatan: finalCatatan || undefined,
          detail_revisi: action === "REVISI" ? detailRevisiPayload : undefined
        })
      });

      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Gagal memproses persetujuan");
      }

      onOpenChange(false);
      onSuccess(json.data);
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat memproses data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 overflow-hidden rounded-2xl border-slate-200/80 shadow-2xl flex flex-col max-h-[92vh]",
          action === "REVISI" ? "max-w-3xl" : "max-w-lg"
        )}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start gap-4 shrink-0 bg-white">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-2xs", config.iconBg)}>
            <IconComponent className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-bold text-slate-900 leading-snug">
                {config.title}
              </DialogTitle>
              {action === "REVISI" && flaggedCount > 0 && (
                <span className="text-[11px] font-extrabold bg-[#E65F2B] text-white px-2 py-0.5 rounded-full shadow-2xs animate-in zoom-in-95">
                  {flaggedCount} Ditandai
                </span>
              )}
            </div>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed">
              {config.description}
            </DialogDescription>
          </div>
        </div>

        {/* Content Body - Scrollable */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Target Info Card */}
          <div className="bg-slate-50/90 rounded-xl p-4 border border-slate-200/70 space-y-2 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Nomor Pengajuan:</span>
              <span className="font-mono font-bold text-slate-900">{currentData.nomor_pengajuan}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Proyek DC:</span>
              <span className="font-bold text-slate-800 text-right">
                {currentData.project?.kode ? `${currentData.project.kode} - ` : ""}
                {currentData.project?.nama_proyek || "-"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Cabang / Wilayah:</span>
              <span className="font-semibold text-slate-700">
                {currentData.cabang || currentData.project?.cabang || "-"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Total Nilai RAB / OE:</span>
              <span className="font-mono font-extrabold text-[#E65F2B]">
                {formatRupiah(currentData.grand_total || 0)}
              </span>
            </div>

            {/* Status Transition Preview */}
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Status Saat Ini:</span>
              <span className="px-2 py-0.5 rounded-md font-bold bg-slate-200/80 text-slate-700 text-[10px]">
                {currentData.status}
              </span>
            </div>

            {action === "APPROVE" && nextStep && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  Status Setelah Disetujui:
                </span>
                <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800 text-[10px]">
                  {nextStep.nextStatus}
                </span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Granular Revision Selector (HANYA MUNCUL KETIKA ACTION === 'REVISI') */}
          {action === "REVISI" && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#E65F2B]" />
                    Pilih & Tandai Bagian Spesifik yang Perlu Direvisi
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Elemen yang Anda tandai akan memiliki badge peringatan dan wajib diubah minimal satu kali oleh pemohon.
                  </p>
                </div>
                {flaggedCount > 0 && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md shrink-0">
                    {flaggedCount} bagian dipilih
                  </span>
                )}
              </div>

              {/* 1. SEKSI PARAMETER PENGAJUAN (Durasi Hari & Jenis Renovasi Saja) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleSection("params")}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[11px]">
                      1
                    </div>
                    <span className="font-bold text-slate-800 text-xs">Parameter Pengajuan Renovasi</span>
                    {(revParamDurasi || revParamJenis) && (
                      <span className="text-[10px] font-bold bg-[#E65F2B] text-white px-1.5 py-0.2 rounded-full">
                        {(revParamDurasi ? 1 : 0) + (revParamJenis ? 1 : 0)}
                      </span>
                    )}
                  </div>
                  {openSections.params ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {openSections.params && (
                  <div className="p-4 space-y-3.5 divide-y divide-slate-100">
                    {/* Item 1: Durasi Pekerjaan (Hari) */}
                    <div className="space-y-2">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={revParamDurasi}
                          onChange={(e) => setRevParamDurasi(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800">Durasi Pekerjaan (Hari)</span>
                            <span className="font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              Saat ini: {currentData.durasi_hari || 0} {currentData.satuan_durasi || "Hari"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Tandai jika estimasi hari pengerjaan tidak realistis atau perlu dikurangi/ditambah.
                          </p>
                        </div>
                      </label>
                      {revParamDurasi && (
                        <div className="pl-6.5">
                          <Input
                            placeholder="Catatan spesifik revisi durasi (contoh: Kurangi durasi pengerjaan menjadi 30 hari)..."
                            value={revParamDurasiNote}
                            onChange={(e) => setRevParamDurasiNote(e.target.value)}
                            className="text-xs h-8 rounded-lg border-amber-300 bg-amber-50/40 focus-visible:ring-[#E65F2B]"
                          />
                        </div>
                      )}
                    </div>

                    {/* Item 2: Jenis Renovasi */}
                    <div className="pt-3 space-y-2">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={revParamJenis}
                          onChange={(e) => setRevParamJenis(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800">Jenis Renovasi</span>
                            <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                              Saat ini: {currentData.jenis_renovasi || "-"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Tandai jika klasifikasi jenis renovasi tidak sesuai dengan scope riil.
                          </p>
                        </div>
                      </label>
                      {revParamJenis && (
                        <div className="pl-6.5">
                          <Input
                            placeholder="Catatan spesifik revisi jenis renovasi (contoh: Sesuaikan menjadi Renovasi Berat)..."
                            value={revParamJenisNote}
                            onChange={(e) => setRevParamJenisNote(e.target.value)}
                            className="text-xs h-8 rounded-lg border-amber-300 bg-amber-50/40 focus-visible:ring-[#E65F2B]"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. SEKSI GAMBAR KERJA (Sipil & ME) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleSection("drawings")}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-[11px]">
                      2
                    </div>
                    <span className="font-bold text-slate-800 text-xs">Gambar Kerja (Sipil & ME)</span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      ({drawingsList.length} berkas terlampir)
                    </span>
                    {Object.values(revDrawings).filter((d) => d.selected).length > 0 && (
                      <span className="text-[10px] font-bold bg-[#E65F2B] text-white px-1.5 py-0.2 rounded-full">
                        {Object.values(revDrawings).filter((d) => d.selected).length}
                      </span>
                    )}
                  </div>
                  {openSections.drawings ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {openSections.drawings && (
                  <div className="p-4 space-y-3">
                    {drawingsList.length === 0 ? (
                      <p className="text-slate-400 italic text-[11px] text-center py-2">
                        Tidak ada berkas gambar teknis terlampir.
                      </p>
                    ) : (
                      drawingsList.map((doc: any) => {
                        const isSipil = doc.kategori_file?.includes("SIPIL");
                        const isDwg = doc.nama_file?.toLowerCase().endsWith(".dwg");
                        const badgeType = `${isSipil ? "Sipil" : "ME"} ${isDwg ? "AutoCAD (DWG)" : "PDF"}`;
                        const isSelected = Boolean(revDrawings[String(doc.id)]?.selected);
                        const noteVal = revDrawings[String(doc.id)]?.note || "";

                        return (
                          <div
                            key={doc.id}
                            className={cn(
                              "p-3 rounded-xl border transition-all space-y-2",
                              isSelected
                                ? "bg-amber-50/50 border-amber-300 ring-1 ring-amber-300/40"
                                : "bg-slate-50/40 border-slate-200"
                            )}
                          >
                            <label className="flex items-start gap-2.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setRevDrawings((prev) => ({
                                    ...prev,
                                    [String(doc.id)]: {
                                      selected: checked,
                                      note: checked ? prev[String(doc.id)]?.note || "" : ""
                                    }
                                  }));
                                }}
                                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileCode2 className="w-4 h-4 text-blue-500 shrink-0" />
                                    <span className="font-bold text-slate-800 truncate" title={doc.nama_file}>
                                      {doc.nama_label || doc.nama_file}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">
                                    {badgeType}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                                  <span className="truncate">{doc.nama_file}</span>
                                  {doc.file_url && (
                                    <a
                                      href={doc.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-blue-600 hover:underline flex items-center gap-0.5 shrink-0"
                                    >
                                      Buka <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </label>

                            {isSelected && (
                              <div className="pl-6.5 pt-1">
                                <Input
                                  placeholder={`Catatan spesifik revisi berkas ${badgeType} ini (contoh: Gambar denah loading dock belum ada dimensi detail)...`}
                                  value={noteVal}
                                  onChange={(e) =>
                                    setRevDrawings((prev) => ({
                                      ...prev,
                                      [String(doc.id)]: {
                                        selected: true,
                                        note: e.target.value
                                      }
                                    }))
                                  }
                                  className="text-xs h-8 rounded-lg border-amber-300 bg-white focus-visible:ring-[#E65F2B]"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* 3. SEKSI FOTO LINGKUNGAN & EKSISTING */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleSection("photos")}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-[11px]">
                      3
                    </div>
                    <span className="font-bold text-slate-800 text-xs">Foto Lingkungan & Eksisting</span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      ({photosList.length} foto terlampir)
                    </span>
                    {Object.values(revPhotos).filter((p) => p.selected).length > 0 && (
                      <span className="text-[10px] font-bold bg-[#E65F2B] text-white px-1.5 py-0.2 rounded-full">
                        {Object.values(revPhotos).filter((p) => p.selected).length}
                      </span>
                    )}
                  </div>
                  {openSections.photos ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {openSections.photos && (
                  <div className="p-4 space-y-3">
                    {photosList.length === 0 ? (
                      <p className="text-slate-400 italic text-[11px] text-center py-2">
                        Tidak ada foto lingkungan terlampir.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {photosList.map((photo: any, idx: number) => {
                          const isSelected = Boolean(revPhotos[String(photo.id)]?.selected);
                          const noteVal = revPhotos[String(photo.id)]?.note || "";

                          return (
                            <div
                              key={photo.id}
                              className={cn(
                                "p-3 rounded-xl border transition-all space-y-2.5 flex flex-col justify-between",
                                isSelected
                                  ? "bg-amber-50/50 border-amber-300 ring-1 ring-amber-300/40"
                                  : "bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs"
                              )}
                            >
                              <div className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  id={`photo-check-${photo.id}`}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setRevPhotos((prev) => ({
                                      ...prev,
                                      [String(photo.id)]: {
                                        selected: checked,
                                        note: checked ? prev[String(photo.id)]?.note || "" : ""
                                      }
                                    }));
                                  }}
                                  className="mt-1 w-4 h-4 rounded border-slate-300 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer shrink-0"
                                />

                                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
                                  <Camera className="w-4 h-4" />
                                </div>

                                <label htmlFor={`photo-check-${photo.id}`} className="flex-1 min-w-0 cursor-pointer">
                                  <span
                                    className="font-bold text-slate-800 text-xs block truncate"
                                    title={photo.nama_label || photo.nama_file}
                                  >
                                    {photo.nama_label || `Foto #${idx + 1}`}
                                  </span>
                                  <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                                    {photo.nama_file}
                                  </span>
                                </label>
                              </div>

                              {/* Tombol langsung buka ke Google Drive */}
                              {photo.file_url ? (
                                <a
                                  href={photo.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-2.5 rounded-lg bg-slate-50 hover:bg-[#E65F2B] text-slate-700 hover:text-white border border-slate-200 hover:border-[#E65F2B] text-[11px] font-semibold transition-all group cursor-pointer"
                                >
                                  <span>Buka di Google Drive</span>
                                  <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </a>
                              ) : (
                                <div className="text-[10px] text-slate-400 italic text-center py-1">
                                  Tautan Drive tidak tersedia
                                </div>
                              )}

                              {isSelected && (
                                <div className="pt-0.5">
                                  <Input
                                    placeholder="Catatan revisi foto ini (contoh: Foto buram, ambil ulang sudut tampak depan)..."
                                    value={noteVal}
                                    onChange={(e) =>
                                      setRevPhotos((prev) => ({
                                        ...prev,
                                        [String(photo.id)]: {
                                          selected: true,
                                          note: e.target.value
                                        }
                                      }))
                                    }
                                    className="text-[11px] h-7.5 rounded-lg border-amber-300 bg-white focus-visible:ring-[#E65F2B]"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 4. SEKSI RINCIAN ITEM ESTIMASI RAB / OE */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => toggleSection("rab")}
                  className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-[11px]">
                      4
                    </div>
                    <span className="font-bold text-slate-800 text-xs">Rincian Estimasi Item RAB / OE</span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      ({rabList.length} item total)
                    </span>
                    {Object.values(revRabItems).filter((r) => r.selected).length > 0 && (
                      <span className="text-[10px] font-bold bg-[#E65F2B] text-white px-1.5 py-0.2 rounded-full">
                        {Object.values(revRabItems).filter((r) => r.selected).length}
                      </span>
                    )}
                  </div>
                  {openSections.rab ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {openSections.rab && (
                  <div className="p-4 space-y-3">
                    {/* Search bar inside RAB list */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <Input
                        value={rabSearch}
                        onChange={(e) => setRabSearch(e.target.value)}
                        placeholder="Cari item RAB berdasarkan nama pekerjaan atau kategori..."
                        className="pl-8 text-xs h-8 rounded-lg border-slate-200"
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                      {filteredRabList.length === 0 ? (
                        <p className="text-slate-400 italic text-[11px] text-center py-3">
                          Tidak ada item RAB yang cocok dengan pencarian.
                        </p>
                      ) : (
                        filteredRabList.map((item: any) => {
                          const isSelected = Boolean(revRabItems[String(item.id)]?.selected);
                          const noteVal = revRabItems[String(item.id)]?.note || "";
                          const total = item.total_biaya || (item.volume * (item.harga_material + item.harga_upah)) || 0;

                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "pt-2 pb-2 space-y-1.5 rounded-lg px-2 transition-colors",
                                isSelected ? "bg-amber-50/60 ring-1 ring-amber-300" : ""
                              )}
                            >
                              <label className="flex items-start gap-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setRevRabItems((prev) => ({
                                      ...prev,
                                      [String(item.id)]: {
                                        selected: checked,
                                        note: checked ? prev[String(item.id)]?.note || "" : ""
                                      }
                                    }));
                                  }}
                                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span
                                        className={cn(
                                          "text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0",
                                          item.lingkup === "ME"
                                            ? "bg-purple-100 text-purple-700"
                                            : "bg-blue-100 text-blue-700"
                                        )}
                                      >
                                        {item.lingkup || "SIPIL"}
                                      </span>
                                      <span className="font-bold text-slate-800 truncate text-xs" title={item.deskripsi}>
                                        {item.deskripsi}
                                      </span>
                                    </div>
                                    <span className="font-mono font-bold text-slate-700 text-xs shrink-0">
                                      {formatRupiah(total)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                                    <span>Kategori: {item.kategori_pekerjaan || "Umum"}</span>
                                    <span className="font-mono">Volume: {item.volume}</span>
                                  </div>
                                </div>
                              </label>

                              {isSelected && (
                                <div className="pl-6.5 pt-1">
                                  <Input
                                    placeholder="Catatan revisi item RAB ini (contoh: Volume 100 terlalu besar, kurangi ke 75)..."
                                    value={noteVal}
                                    onChange={(e) =>
                                      setRevRabItems((prev) => ({
                                        ...prev,
                                        [String(item.id)]: {
                                          selected: true,
                                          note: e.target.value
                                        }
                                      }))
                                    }
                                    className="text-xs h-7.5 rounded-lg border-amber-300 bg-white focus-visible:ring-[#E65F2B]"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Catatan Field (Ringkasan / Catatan Utama) */}
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700">
                {action === "APPROVE"
                  ? "Catatan Persetujuan (Opsional)"
                  : action === "REVISI"
                  ? "Ringkasan Catatan Instruksi Revisi"
                  : "Alasan Penolakan (Wajib Diisi)"}
              </label>
              {isNotesMandatory && (
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
                  {action === "REVISI" && flaggedCount > 0 ? "Opsional Jika Ada Poin" : "Wajib Diisi"}
                </span>
              )}
            </div>
            <Textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder={config.notePlaceholder}
              rows={action === "REVISI" ? 3 : 4}
              className="rounded-xl border-slate-200 text-xs focus-visible:ring-[#E65F2B]/30"
              required={isNotesMandatory && flaggedCount === 0}
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-xl text-xs h-9 px-4 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={loading || (isNotesMandatory && !catatan.trim() && flaggedCount === 0)}
              className={cn("rounded-xl text-xs h-9 px-4 font-bold shadow-md cursor-pointer transition-all", config.submitBtnClass)}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Memproses...
                </>
              ) : (
                config.submitText
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
