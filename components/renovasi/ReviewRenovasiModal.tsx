"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatRupiah, cn, toTitleCase } from "@/lib/utils";
import SubmissionReasonCard from "@/components/approval/SubmissionReasonCard";
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
  FileCode2,
  Image as ImageIcon,
  CheckCircle2,
  Send,
  Loader2,
  Calculator,
  AlertCircle
} from "lucide-react";

interface UploadedDoc {
  id: string;
  nama_file: string;
  nama_label?: string;
  file_url: string;
  preview_url?: string;
  drive_file_id?: string;
  kategori_file:
  | "GAMBAR_SIPIL_PDF"
  | "GAMBAR_SIPIL_DWG"
  | "GAMBAR_ME_PDF"
  | "GAMBAR_ME_DWG"
  | "GAMBAR_SIPIL"
  | "GAMBAR_ME"
  | "FOTO_LINGKUNGAN";
  latitude?: number | null;
  longitude?: number | null;
  timestamp_watermark?: string | null;
  lokasi_wilayah?: string | null;
  uploading?: boolean;
}

interface RabItem {
  id: string;
  lingkup: "SIPIL" | "ME";
  kategori_pekerjaan: string;
  master_item_id: number | null;
  deskripsi: string;
  harga_material: number;
  harga_upah: number;
  satuan?: string;
  volume: number | "";
  total_biaya?: number;
  catatan?: string;
}

interface ReviewRenovasiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProject: any | null;
  jenisRenovasi: string;
  lingkupPekerjaan: string;
  durasiHari: number | "";
  catatanPengajuan: string;
  docsSipil: UploadedDoc[];
  docsMe: UploadedDoc[];
  fotosLingkungan: UploadedDoc[];
  rabItems: RabItem[];
  totalSipil: number;
  totalMe: number;
  grandTotal: number;
  totalSebelumPpn?: number;
  nilaiPpn?: number;
  nilaiPembulatan?: number;
  isSubmitting: boolean;
  isRevision?: boolean;
  onConfirmSubmit: () => void;
  onBackToEdit: () => void;
}

export default function ReviewRenovasiModal({
  open,
  onOpenChange,
  selectedProject,
  jenisRenovasi,
  lingkupPekerjaan,
  durasiHari,
  catatanPengajuan,
  docsSipil,
  docsMe,
  fotosLingkungan,
  rabItems,
  totalSipil,
  totalMe,
  grandTotal,
  totalSebelumPpn,
  nilaiPpn,
  nilaiPembulatan,
  isSubmitting,
  isRevision = false,
  onConfirmSubmit,
  onBackToEdit
}: ReviewRenovasiModalProps) {
  const [activeTab, setActiveTab] = useState<"INFO" | "GAMBAR" | "FOTO" | "RAB">("INFO");

  const itemsSipil = rabItems.filter((it: any) => (it.lingkup || "").toUpperCase() === "SIPIL");
  const itemsMe = rabItems.filter((it: any) => (it.lingkup || "").toUpperCase() === "ME");

  const getItemTotal = (it: any) => {
    if (it.total_biaya !== undefined && it.total_biaya !== null && it.total_biaya > 0) {
      return Number(it.total_biaya);
    }
    const mat = Number(it.harga_material || 0);
    const upah = Number(it.harga_upah || 0);
    const vol = Number(it.volume || 0);
    return (mat + upah) * vol;
  };

  const calculatedSubtotalSipil = totalSipil > 0
    ? totalSipil
    : itemsSipil.reduce((acc: number, it: any) => acc + getItemTotal(it), 0);
  const calculatedSubtotalMe = totalMe > 0
    ? totalMe
    : itemsMe.reduce((acc: number, it: any) => acc + getItemTotal(it), 0);

  const calculatedTotalSebelumPpn = (totalSebelumPpn !== undefined && totalSebelumPpn > 0)
    ? totalSebelumPpn
    : (calculatedSubtotalSipil + calculatedSubtotalMe);

  const calculatedPpn = (nilaiPpn !== undefined && nilaiPpn > 0)
    ? nilaiPpn
    : (calculatedTotalSebelumPpn > 0 ? Math.round(calculatedTotalSebelumPpn * 0.11) : 0);

  const calculatedTotalPlusPpn = calculatedTotalSebelumPpn + calculatedPpn;

  const calculatedGrandTotal = (grandTotal > 0 && grandTotal !== (calculatedSubtotalSipil + calculatedSubtotalMe))
    ? grandTotal
    : (calculatedTotalPlusPpn > 0 ? Math.ceil(calculatedTotalPlusPpn / 1000) * 1000 : 0);

  const calculatedPembulatan = (nilaiPembulatan !== undefined)
    ? nilaiPembulatan
    : (calculatedGrandTotal > 0 ? calculatedGrandTotal - calculatedTotalPlusPpn : 0);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-5xl p-0 overflow-hidden bg-white border border-slate-200/90 shadow-2xl rounded-2xl max-h-[92vh] flex flex-col [&>button:last-child]:hidden z-50">
        {/* Header Modal: Enterprise, clear visual hierarchy */}
        <div className="px-6 py-4.5 bg-white border-b border-slate-200/80 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-[#E65F2B] flex items-center justify-center shrink-0 mt-0.5">
              <HardHat className="w-5 h-5 text-[#E65F2B]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {isRevision ? "Pratinjau / Review Pengajuan Revisi" : "Pratinjau / Review Pengajuan"}
                </span>
                {jenisRenovasi && (
                  <span className="text-xs text-slate-500 font-medium">
                    &bull; {toTitleCase(jenisRenovasi)}
                  </span>
                )}
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight truncate">
                {selectedProject?.nama_proyek || "Proyek Penawaran RAB/OE"}
              </DialogTitle>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                Cabang {selectedProject?.cabang || "-"} &bull; {selectedProject?.alamat || "Alamat belum tercatat"}
              </p>
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
          Modal review pengajuan Penawaran RAB/OE untuk memeriksa kelengkapan data sebelum diajukan ke B&M Manager.
        </DialogDescription>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 bg-slate-50/70 border-b border-slate-200/80 shrink-0 text-xs font-medium overflow-x-auto">
          {[
            { id: "INFO", label: "Informasi Proyek & Rencana", count: null },
            { id: "GAMBAR", label: "Gambar Teknis", count: docsSipil.length + docsMe.length },
            { id: "FOTO", label: "Foto Lingkungan", count: fotosLingkungan.length },
            { id: "RAB", label: "Rincian Item RAB", count: rabItems.length }
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
                        ? "bg-orange-100 text-[#E65F2B]"
                        : "bg-slate-200 text-slate-600"
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
          {/* TAB 1: INFORMASI */}
          {activeTab === "INFO" && (
            <div className="flex flex-col gap-5">
              {/* Data Proyek DC & Spesifikasi Renovasi */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100">
                <div className="p-4 sm:p-5">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3.5 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    Data Proyek DC
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Nama Proyek</span>
                      <span className="text-sm font-bold text-slate-900 mt-0.5 block truncate">
                        {selectedProject?.nama_proyek || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Cabang</span>
                      <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                        {selectedProject?.cabang || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Tipe Properti</span>
                      <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                        {selectedProject?.tipe || "DC"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Luas Bangunan</span>
                      <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                        {selectedProject?.luas_tanah_bangunan || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 bg-slate-50/40">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3.5 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Rencana Pelaksanaan Renovasi
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Jenis Renovasi</span>
                      <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                        {jenisRenovasi ? toTitleCase(jenisRenovasi) : "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Lingkup Pekerjaan</span>
                      <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                        {lingkupPekerjaan || "Sipil + ME"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Estimasi Durasi</span>
                      <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                        {durasiHari ? `${durasiHari} Hari` : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rincian & Catatan Pengajuan (Komponen Reusable) */}
              <SubmissionReasonCard
                reason={catatanPengajuan}
                title="Catatan Khusus Pengajuan"
              />

              {/* Financial Summary Card */}
              <div className="p-4 sm:p-5 bg-orange-50/40 border border-orange-200/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Total Nilai Estimasi (RAB / OE)
                  </span>
                  <span className="text-2xl font-extrabold text-[#E65F2B] tracking-tight font-mono mt-1 block">
                    {formatRupiah(calculatedGrandTotal)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-3 md:pt-0 border-t md:border-t-0 md:border-l border-orange-200/80 md:pl-5">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium uppercase">Subtotal Sipil</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                      {formatRupiah(calculatedSubtotalSipil)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium uppercase">Subtotal ME</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                      {formatRupiah(calculatedSubtotalMe)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium uppercase">PPN 11%</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                      {formatRupiah(calculatedPpn)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium uppercase">Pembulatan</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                      {formatRupiah(calculatedPembulatan)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GAMBAR TEKNIS */}
          {activeTab === "GAMBAR" && (
            <div className="flex flex-col gap-5">
              {/* Gambar Sipil */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5 text-blue-500" />
                  Gambar Arsitektur &amp; Sipil ({docsSipil.length})
                </h4>
                {docsSipil.length === 0 ? (
                  <p className="text-slate-400 italic bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-center">
                    Tidak ada dokumen gambar sipil terlampir.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {docsSipil.map((doc, idx) => {
                      const isPdf =
                        doc.kategori_file?.endsWith("_PDF") ||
                        doc.nama_file?.toLowerCase().endsWith(".pdf");
                      return (
                        <div
                          key={doc.id || idx}
                          className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-[#E65F2B] transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isPdf ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"
                                }`}
                            >
                              {isPdf ? <FileText className="w-4 h-4" /> : <FileCode2 className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-900 block truncate" title={doc.nama_file}>
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
                              <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Tersimpan di Drive
                              </span>
                            </div>
                          </div>
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 text-slate-400 hover:text-[#E65F2B] hover:bg-orange-50 rounded-lg transition-colors shrink-0"
                              title="Buka dokumen di Drive"
                            >
                              <ExternalLink className="w-4 h-4" />
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
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <FileCode2 className="w-3.5 h-3.5 text-emerald-500" />
                  Gambar Mekanikal &amp; Elektrikal (ME) ({docsMe.length})
                </h4>
                {docsMe.length === 0 ? (
                  <p className="text-slate-400 italic bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-center">
                    Tidak ada dokumen gambar ME terlampir.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {docsMe.map((doc, idx) => {
                      const isPdf =
                        doc.kategori_file?.endsWith("_PDF") ||
                        doc.nama_file?.toLowerCase().endsWith(".pdf");
                      return (
                        <div
                          key={doc.id || idx}
                          className="p-3 bg-white border border-slate-200/90 rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-[#E65F2B] transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isPdf ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"
                                }`}
                            >
                              {isPdf ? <FileText className="w-4 h-4" /> : <FileCode2 className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-900 block truncate" title={doc.nama_file}>
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
                              <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Tersimpan di Drive
                              </span>
                            </div>
                          </div>
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 text-slate-400 hover:text-[#E65F2B] hover:bg-orange-50 rounded-lg transition-colors shrink-0"
                              title="Buka dokumen di Drive"
                            >
                              <ExternalLink className="w-4 h-4" />
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

          {/* TAB 3: FOTO LINGKUNGAN */}
          {activeTab === "FOTO" && (
            <div>
              {fotosLingkungan.length === 0 ? (
                <div className="p-12 text-center rounded-xl bg-slate-50/60 border border-slate-200/80 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-medium text-slate-500">Tidak ada foto lingkungan yang terlampir.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fotosLingkungan.map((f, idx) => {
                    const rawName = f.nama_label?.trim()
                      ? f.nama_label
                      : (f.nama_file ? f.nama_file.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ") : `Foto Lingkungan #${idx + 1}`);
                    const title = toTitleCase(rawName);
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
                              {(f.lokasi_wilayah || (f.latitude && f.longitude)) && (
                                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                                  <MapPin className="w-3 h-3 text-[#E65F2B] shrink-0" />
                                  {f.lokasi_wilayah || `${f.latitude?.toFixed(4)}, ${f.longitude?.toFixed(4)}`}
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

          {/* TAB 4: RINCIAN ITEM RAB */}
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
                    {rabItems.length === 0 ? (
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
                            <span className="font-extrabold text-blue-900">{formatRupiah(calculatedSubtotalSipil)}</span>
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
                            <span className="font-extrabold text-emerald-900">{formatRupiah(calculatedSubtotalMe)}</span>
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
                  {rabItems.length > 0 && (
                    <tfoot className="bg-slate-50/90 font-bold border-t border-slate-200 divide-y divide-slate-200/70">
                      <tr>
                        <td colSpan={7} className="py-2 px-3 text-right text-slate-500 uppercase tracking-wider text-[10px]">
                          Subtotal Pekerjaan Sipil:
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-800 font-bold">
                          {formatRupiah(calculatedSubtotalSipil)}
                        </td>
                        <td />
                      </tr>
                      <tr>
                        <td colSpan={7} className="py-2 px-3 text-right text-slate-500 uppercase tracking-wider text-[10px]">
                          Subtotal Pekerjaan ME:
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-800 font-bold">
                          {formatRupiah(calculatedSubtotalMe)}
                        </td>
                        <td />
                      </tr>
                      <tr className="bg-slate-100/70">
                        <td colSpan={7} className="py-2 px-3 text-right text-slate-700 uppercase tracking-wider text-[10px] font-bold">
                          TOTAL (Sebelum PPN):
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-900 font-bold">
                          {formatRupiah(calculatedTotalSebelumPpn)}
                        </td>
                        <td />
                      </tr>
                      <tr>
                        <td colSpan={7} className="py-2 px-3 text-right text-slate-600 uppercase tracking-wider text-[10px] font-medium">
                          PPN 11%:
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-800 font-bold">
                          {formatRupiah(calculatedPpn)}
                        </td>
                        <td />
                      </tr>
                      <tr>
                        <td colSpan={7} className="py-2 px-3 text-right text-slate-600 uppercase tracking-wider text-[10px] font-medium">
                          Pembulatan (Ribuan ke Atas):
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-800 font-bold">
                          {formatRupiah(calculatedPembulatan)}
                        </td>
                        <td />
                      </tr>
                      <tr className="bg-orange-50/60 border-t-2 border-orange-200">
                        <td colSpan={7} className="py-2.5 px-3 text-right text-slate-700 uppercase tracking-wider text-[10px] font-extrabold">
                          GRAND TOTAL RAB / OE:
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#E65F2B] font-extrabold text-sm">
                          {formatRupiah(calculatedGrandTotal)}
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

        {/* Modal Footer: Action Bar Review */}
        <div className="px-6 py-4 bg-slate-50/90 border-t border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              Total <b>{rabItems.length}</b> item RAB &bull; Estimasi:{" "}
              <b className="font-mono text-slate-900">{formatRupiah(calculatedGrandTotal)}</b>
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {/* Tombol Kembali Edit */}
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onBackToEdit}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs h-10 px-4 font-semibold cursor-pointer shadow-2xs"
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Kembali Edit
            </Button>

            {/* Tombol Ajukan (Ajukan Revisi jika status Revisi) */}
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={onConfirmSubmit}
              className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white rounded-xl text-xs h-10 px-5 font-bold shadow-md shadow-[#E65F2B]/20 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {isRevision ? "Ajukan Revisi" : "Ajukan Renovasi"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
