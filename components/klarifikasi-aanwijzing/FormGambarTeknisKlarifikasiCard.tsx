"use client";

import React, { useState } from "react";
import {
  FileText,
  FileCode,
  Upload,
  CheckCircle2,
  ExternalLink,
  Trash2,
  Loader2,
  RefreshCw,
  AlertCircle,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RevisionPinpointBadge } from "@/components/approval/RevisionPinpointBadge";
import { cn } from "@/lib/utils";

export interface KlarifikasiDokumenItem {
  id?: number | string;
  kategori_file: string;
  nama_file: string;
  nama_label?: string | null;
  file_url?: string | null;
  drive_file_id?: string | null;
  mime_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lokasi_wilayah?: string | null;
  timestamp_watermark?: string | Date | null;
  sumber?: string; // "DARI_RAB" | "BARU" | "REVISI"
  catatan?: string | null;
  uploading?: boolean;
  localPreviewUrl?: string | null;
  revisi_dari_url?: string | null;
  revisi_dari_nama?: string | null;
  revisi_dari_id?: any;
}

interface FormGambarTeknisKlarifikasiCardProps {
  rabDokumenList: any[]; // Dokumen dari Penawaran RAB/OE
  klarifikasiDokumenList: KlarifikasiDokumenItem[]; // Dokumen yang sedang aktif di klarifikasi
  onChangeDokumen: (updater: (prev: KlarifikasiDokumenItem[]) => KlarifikasiDokumenItem[]) => void;
  projectInfo: {
    cabang?: string;
    kode?: string;
    nama_proyek?: string;
    inisial?: string | null;
    nomor_undangan?: string;
  };
  pinpoint?: { isFlagged: boolean; catatan: string; isModified: boolean };
}

interface DocSlotConfig {
  key: "GAMBAR_SIPIL_PDF" | "GAMBAR_SIPIL_DWG" | "GAMBAR_ME_PDF" | "GAMBAR_ME_DWG";
  title: string;
  subTitle: string;
  accept: string;
  icon: any;
  colorScheme: {
    bg: string;
    border: string;
    text: string;
    hoverBorder: string;
    hoverBg: string;
  };
  subFolder: string;
}

const DOC_SLOTS: DocSlotConfig[] = [
  {
    key: "GAMBAR_SIPIL_PDF",
    title: "Gambar Teknis Sipil (PDF)",
    subTitle: "Denah arsitektur & struktur fisik bangunan format PDF",
    accept: ".pdf,application/pdf",
    icon: FileText,
    colorScheme: {
      bg: "bg-rose-50",
      border: "border-rose-200/80",
      text: "text-rose-600",
      hoverBorder: "hover:border-rose-400",
      hoverBg: "hover:bg-rose-50/20",
    },
    subFolder: "Gambar Sipil",
  },
  {
    key: "GAMBAR_SIPIL_DWG",
    title: "Gambar Teknis Sipil (CAD / DWG)",
    subTitle: "Master denah revisi sipil format DWG / CAD",
    accept: ".dwg,.dxf,application/acad,application/x-acad,application/autocad_dwg,image/vnd.dwg",
    icon: FileCode,
    colorScheme: {
      bg: "bg-indigo-50",
      border: "border-indigo-200/80",
      text: "text-indigo-600",
      hoverBorder: "hover:border-indigo-400",
      hoverBg: "hover:bg-indigo-50/20",
    },
    subFolder: "Gambar Sipil",
  },
  {
    key: "GAMBAR_ME_PDF",
    title: "Gambar Teknis ME (PDF)",
    subTitle: "Instalasi mekanikal, elektrikal, & plumbing format PDF",
    accept: ".pdf,application/pdf",
    icon: FileText,
    colorScheme: {
      bg: "bg-amber-50",
      border: "border-amber-200/80",
      text: "text-amber-600",
      hoverBorder: "hover:border-amber-400",
      hoverBg: "hover:bg-amber-50/20",
    },
    subFolder: "Gambar ME",
  },
  {
    key: "GAMBAR_ME_DWG",
    title: "Gambar Teknis ME (CAD / DWG)",
    subTitle: "Master denah instalasi ME format DWG / CAD",
    accept: ".dwg,.dxf,application/acad,application/x-acad,application/autocad_dwg,image/vnd.dwg",
    icon: FileCode,
    colorScheme: {
      bg: "bg-blue-50",
      border: "border-blue-200/80",
      text: "text-blue-600",
      hoverBorder: "hover:border-blue-400",
      hoverBg: "hover:bg-blue-50/20",
    },
    subFolder: "Gambar ME",
  },
];

export function FormGambarTeknisKlarifikasiCard({
  rabDokumenList = [],
  klarifikasiDokumenList = [],
  onChangeDokumen,
  projectInfo,
  pinpoint,
}: FormGambarTeknisKlarifikasiCardProps) {
  const [uploadingSlots, setUploadingSlots] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper mencari dokumen bawaan RAB AWAL
  const findRabDoc = (slotKey: string) => {
    return rabDokumenList.find((d) => {
      const k = d.kategori_file;
      const fn = (d.nama_file || "").toLowerCase();
      if (slotKey === "GAMBAR_SIPIL_PDF") {
        return k === "GAMBAR_SIPIL_PDF" || (k === "GAMBAR_SIPIL" && fn.endsWith(".pdf"));
      }
      if (slotKey === "GAMBAR_SIPIL_DWG") {
        return k === "GAMBAR_SIPIL_DWG" || (k === "GAMBAR_SIPIL" && fn.endsWith(".dwg"));
      }
      if (slotKey === "GAMBAR_ME_PDF") {
        return k === "GAMBAR_ME_PDF" || (k === "GAMBAR_ME" && fn.endsWith(".pdf"));
      }
      if (slotKey === "GAMBAR_ME_DWG") {
        return k === "GAMBAR_ME_DWG" || (k === "GAMBAR_ME" && fn.endsWith(".dwg"));
      }
      return false;
    });
  };

  // Helper mencari dokumen klarifikasi aktif
  const findActiveDoc = (slotKey: string) => {
    return klarifikasiDokumenList.find((d) => d.kategori_file === slotKey);
  };

  // Helper mencari dokumen revisi baru hasil klarifikasi
  const findRevisionDoc = (slotKey: string) => {
    return klarifikasiDokumenList.find(
      (d) => d.kategori_file === slotKey && (d.sumber === "REVISI" || d.sumber === "BARU")
    );
  };

  // Handler Upload Gambar Teknis ke Google Drive
  const handleUploadFile = async (slotKey: string, subFolder: string, file: File) => {
    setUploadingSlots((prev) => ({ ...prev, [slotKey]: true }));
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("cabang", projectInfo.cabang || "TANPA CABANG");
      formData.append("kode", projectInfo.kode || "XXX");
      formData.append("nama_proyek", projectInfo.nama_proyek || "PROYEK");
      if (projectInfo.inisial) formData.append("inisial", projectInfo.inisial);
      formData.append("nomor_undangan", projectInfo.nomor_undangan || "DRAFT");
      formData.append("sub_folder", subFolder);

      const res = await fetch("/api/dc-development/klarifikasi-aanwijzing/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.status === "success" && json.data) {
        const newDoc: KlarifikasiDokumenItem = {
          kategori_file: slotKey,
          nama_file: json.data.file_name || file.name,
          nama_label: json.data.file_name || file.name,
          file_url: json.data.file_url,
          drive_file_id: json.data.drive_file_id,
          mime_type: json.data.mime_type,
          sumber: "REVISI",
        };

        onChangeDokumen((prev) => {
          const filtered = prev.filter((d) => d.kategori_file !== slotKey);
          return [...filtered, newDoc];
        });
      } else {
        setErrorMessage(json.message || "Gagal mengunggah file ke Google Drive.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat mengunggah file.");
    } finally {
      setUploadingSlots((prev) => ({ ...prev, [slotKey]: false }));
    }
  };

  // Update catatan alasan revisi berkas gambar teknis
  const handleUpdateNote = (slotKey: string, noteText: string) => {
    onChangeDokumen((prev) =>
      prev.map((d) => (d.kategori_file === slotKey ? { ...d, catatan: noteText } : d))
    );
  };

  // Batalkan revisi & kembalikan ke acuan RAB
  const handleCancelRevision = (slotKey: string, rabDoc: any) => {
    onChangeDokumen((prev) => {
      const filtered = prev.filter((d) => d.kategori_file !== slotKey);
      if (rabDoc) {
        const item: KlarifikasiDokumenItem = {
          kategori_file: slotKey,
          nama_file: rabDoc.nama_file,
          nama_label: rabDoc.nama_label || rabDoc.nama_file,
          file_url: rabDoc.file_url,
          drive_file_id: rabDoc.drive_file_id,
          mime_type: rabDoc.mime_type,
          sumber: "DARI_RAB",
        };
        return [...filtered, item];
      }
      return filtered;
    });
  };

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border p-5 space-y-4 shadow-xs transition-all duration-200",
        pinpoint?.isFlagged && !pinpoint.isModified
          ? "border-amber-400 ring-2 ring-amber-300/40 bg-amber-50/10"
          : "border-slate-200/80 hover:border-slate-300"
      )}
    >
      {/* Header Card */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/70 text-[#E65F2B] flex items-center justify-center shrink-0">
            <FileCheck2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Gambar Teknis Proyek (Sipil &amp; ME)
              </h3>
              {pinpoint?.isFlagged && (
                <RevisionPinpointBadge
                  catatan={pinpoint.catatan}
                  isModified={pinpoint.isModified}
                  label="Revisi Gambar Teknis"
                />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Komparasi berdampingan: berkas acuan penawaran RAB/OE di Kolom 1 dan berkas revisi klarifikasi baru di Kolom 2.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Grid 4 Slot Gambar Teknis: Masing-masing memiliki 2 Kolom Berdampingan */}
      <div className="grid grid-cols-1 gap-4">
        {DOC_SLOTS.map((slot) => {
          const Icon = slot.icon;
          const rabDoc = findRabDoc(slot.key);
          const revisionDoc = findRevisionDoc(slot.key);
          const isUploading = uploadingSlots[slot.key];

          return (
            <div
              key={slot.key}
              className={cn(
                "rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-all duration-200 bg-white",
                revisionDoc
                  ? "border-orange-300 shadow-xs ring-1 ring-orange-200/50"
                  : "border-slate-200/90 shadow-2xs hover:border-slate-300"
              )}
            >
              {/* Header Slot */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                      slot.colorScheme.bg,
                      slot.colorScheme.border,
                      slot.colorScheme.text
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 truncate">{slot.title}</h4>
                    <p className="text-[10px] text-slate-400 truncate">{slot.subTitle}</p>
                  </div>
                </div>

                {/* Status Chip */}
                <div>
                  {revisionDoc ? (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-orange-50 text-[#E65F2B] border border-orange-200 whitespace-nowrap">
                      Ada Revisi Baru
                    </span>
                  ) : rabDoc ? (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                      Tetap Mengacu RAB
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                      Belum Ada Berkas
                    </span>
                  )}
                </div>
              </div>

              {/* DUA KOLOM BERDAMPINGAN: KOLOM RAB AWAL vs KOLOM KLARIFIKASI BARU */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                {/* KOLOM 1: Berkas Acuan Penawaran RAB/OE */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Kolom 1: Berkas Acuan Penawaran RAB/OE
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700">
                        Baseline RAB
                      </span>
                    </div>

                    {rabDoc ? (
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-slate-800 truncate" title={rabDoc.nama_file}>
                          {rabDoc.nama_file}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Berkas resmi dari Penawaran RAB/OE proyek (tetap tersimpan sebagai acuan).
                        </div>
                      </div>
                    ) : (
                      <div className="py-3 text-[11px] text-slate-400 italic">
                        Tidak ada berkas {slot.title} pada penawaran RAB/OE.
                      </div>
                    )}
                  </div>

                  {rabDoc?.file_url && (
                    <a
                      href={rabDoc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      <span>Buka Berkas Acuan RAB di Drive</span>
                    </a>
                  )}
                </div>

                {/* KOLOM 2: Berkas Klarifikasi Aanwijzing (Kolom Baru) */}
                <div
                  className={cn(
                    "p-3.5 rounded-xl border flex flex-col justify-between gap-3 transition-colors",
                    revisionDoc
                      ? "border-orange-200 bg-orange-50/20"
                      : "border-slate-200 bg-white"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                        Kolom 2: Berkas Klarifikasi Aanwijzing
                      </span>
                      {revisionDoc ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-[#E65F2B] border border-orange-200">
                          Revisi Baru
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Sama dgn RAB
                        </span>
                      )}
                    </div>

                    {revisionDoc ? (
                      <div className="space-y-1">
                        <div className="text-xs font-bold text-slate-900 truncate" title={revisionDoc.nama_file}>
                          {revisionDoc.nama_file}
                        </div>
                        <div className="text-[10px] text-[#E65F2B] font-semibold">
                          Berkas revisi baru diunggah untuk klarifikasi aanwijzing.
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-[11px] text-slate-500">
                        {rabDoc
                          ? "Tetap menggunakan berkas acuan RAB di Kolom 1 (belum ada perubahan)."
                          : "Belum ada berkas klarifikasi diunggah."}
                      </div>
                    )}
                  </div>

                  {/* Actions for Kolom 2 */}
                  <div>
                    {revisionDoc ? (
                      <div className="space-y-2">
                        {revisionDoc.file_url && (
                          <a
                            href={revisionDoc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50 hover:bg-[#E65F2B] text-[#E65F2B] hover:text-white border border-orange-200 text-xs font-bold transition-all shadow-2xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Buka Berkas Revisi di Drive</span>
                          </a>
                        )}

                        <div className="flex items-center gap-2">
                          <label className="flex-1 cursor-pointer">
                            <input
                              type="file"
                              accept={slot.accept}
                              disabled={isUploading}
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadFile(slot.key, slot.subFolder, f);
                                e.target.value = "";
                              }}
                            />
                            <span className="w-full py-1.5 px-2 rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 inline-flex items-center justify-center text-[10px] font-bold transition-colors shadow-2xs">
                              {isUploading ? (
                                <Loader2 className="w-3 h-3 animate-spin mr-1 text-[#E65F2B]" />
                              ) : (
                                <RefreshCw className="w-3 h-3 mr-1 text-slate-500" />
                              )}
                              Ganti File Revisi
                            </span>
                          </label>

                          <button
                            type="button"
                            onClick={() => handleCancelRevision(slot.key, rabDoc)}
                            className="py-1.5 px-2.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-[10px] font-bold transition-colors cursor-pointer"
                            title="Batalkan revisi & kembalikan ke acuan RAB"
                          >
                            <Trash2 className="w-3 h-3 inline mr-1" />
                            Batal Revisi
                          </button>
                        </div>

                        {/* Catatan Wajib Alasan Perubahan Gambar Teknis */}
                        <div className="space-y-1.5 pt-2 border-t border-orange-200/70">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                              Catatan Alasan Perubahan Gambar <span className="text-rose-500">* Wajib Diisi</span>
                            </label>
                            {revisionDoc.catatan?.trim() ? (
                              <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Terisi
                              </span>
                            ) : (
                              <span className="text-[9px] text-rose-500 font-bold animate-pulse">
                                * Wajib diisi
                              </span>
                            )}
                          </div>
                          <textarea
                            rows={2}
                            value={revisionDoc.catatan || ""}
                            onChange={(e) => handleUpdateNote(slot.key, e.target.value)}
                            placeholder={`Jelaskan alasan atau bagian revisi ${slot.title}... (Contoh: Penyesuaian denah tata letak dan posisi pintu loading dock)`}
                            className={cn(
                              "w-full text-xs p-2.5 rounded-xl border bg-white focus:outline-none transition-all resize-none",
                              !revisionDoc.catatan?.trim()
                                ? "border-amber-300 ring-2 ring-amber-200/60 placeholder:text-slate-400"
                                : "border-slate-200 focus:border-[#E65F2B] focus:ring-1 focus:ring-orange-200 text-slate-800"
                            )}
                          />
                        </div>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <input
                          type="file"
                          accept={slot.accept}
                          disabled={isUploading}
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadFile(slot.key, slot.subFolder, f);
                            e.target.value = "";
                          }}
                        />
                        <span className="w-full py-2 px-3 rounded-xl text-[#E65F2B] bg-orange-50 hover:bg-orange-100 border border-orange-200 inline-flex items-center justify-center text-xs font-bold transition-colors shadow-2xs">
                          {isUploading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                              <span>Mengunggah ke Drive...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5 mr-1.5" />
                              <span>Unggah Berkas Revisi Baru</span>
                            </>
                          )}
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
