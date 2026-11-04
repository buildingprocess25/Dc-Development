"use client";

import React, { useState, useId } from "react";
import {
  Image as ImageIcon,
  FileSpreadsheet,
  ShieldCheck,
  Upload,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
  Calendar,
  FileText,
} from "lucide-react";

export interface DokumenAsuransiData {
  kontraktor_logo_url?: string | null;
  kontraktor_logo_drive_id?: string | null;
  analisa_harga_url?: string | null;
  analisa_harga_drive_id?: string | null;
  analisa_harga_nama?: string | null;
  asuransi_no_polis?: string | null;
  asuransi_masa_berlaku?: string | Date | null;
  asuransi_file_url?: string | null;
  asuransi_file_drive_id?: string | null;
  asuransi_file_nama?: string | null;
}

/**
 * Helper konversi nilai tanggal (baik Date object maupun string ISO/YMD)
 * ke format standar HTML input date: YYYY-MM-DD
 */
export const formatDateToYMD = (val?: string | Date | null): string => {
  if (!val) return "";
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    return val.toLocaleDateString("en-CA");
  }
  const str = String(val).trim();
  if (!str) return "";
  if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  try {
    const d = new Date(str);
    return !isNaN(d.getTime()) ? d.toLocaleDateString("en-CA") : str.substring(0, 10);
  } catch {
    return str.substring(0, 10);
  }
};

interface FormDokumenAsuransiCardProps {
  penawaranId: number;
  data: DokumenAsuransiData;
  onChange: (updated: Partial<DokumenAsuransiData>) => void;
  disabled?: boolean;
}

export default function FormDokumenAsuransiCard({
  penawaranId,
  data,
  onChange,
  disabled = false,
}: FormDokumenAsuransiCardProps) {
  const [uploadingType, setUploadingType] = useState<"LOGO" | "ANALISA_HARGA" | "ASURANSI" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const logoInputId = useId();
  const ahsInputId = useId();
  const asuransiInputId = useId();

  // Tanggal hari ini untuk batas minimum (anti-backdate)
  const todayStr = new Date().toLocaleDateString("en-CA");

  const getDokumenProxyUrl = (
    docType: "logo" | "ahs" | "asuransi",
    driveId?: string | null,
    fileUrl?: string | null
  ) => {
    let url = `/api/dc-development/penawaran-rekanan/${penawaranId}/dokumen-proxy/${docType}`;
    const params = new URLSearchParams();
    if (driveId) params.set("drive_id", driveId);
    if (fileUrl) params.set("file_url", fileUrl);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    return url;
  };

  const formatDateIndo = (val?: string | Date | null) => {
    if (!val) return "-";
    try {
      const d = val instanceof Date ? val : new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return String(val);
    }
  };

  const handleUpload = async (type: "LOGO" | "ANALISA_HARGA" | "ASURANSI", file: File) => {
    try {
      setUploadingType(type);
      setErrorMessage(null);

      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);

      const res = await fetch(`/api/dc-development/penawaran-rekanan/${penawaranId}/upload-dokumen`, {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (json.status === "success" && json.data) {
        if (type === "LOGO") {
          onChange({
            kontraktor_logo_url: json.data.file_url,
            kontraktor_logo_drive_id: json.data.drive_file_id,
          });
        } else if (type === "ANALISA_HARGA") {
          onChange({
            analisa_harga_url: json.data.file_url,
            analisa_harga_drive_id: json.data.drive_file_id,
            analisa_harga_nama: json.data.file_name,
          });
        } else if (type === "ASURANSI") {
          onChange({
            asuransi_file_url: json.data.file_url,
            asuransi_file_drive_id: json.data.drive_file_id,
            asuransi_file_nama: json.data.file_name,
          });
        }
      } else {
        setErrorMessage(json.message || `Gagal mengunggah ${type}`);
      }
    } catch (e: any) {
      setErrorMessage(e.message || "Gagal menghubungi server");
    } finally {
      setUploadingType(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/70 text-[#E65F2B] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-bold text-slate-900">
              Kelengkapan Dokumen Penawaran & Asuransi Proyek
            </h2>
            <p className="text-xs text-slate-500">
              Lengkapi berkas identitas perusahaan, analisa harga satuan, dan jaminan asuransi CAR sebelum mengajukan penawaran lelang.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            Wajib Dilengkapi
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl p-3 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-800 text-xs font-semibold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Grid 3 Bagian: Logo, Analisa Harga Satuan Excel, Asuransi CAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 1. LOGO KONTRAKTOR (4 cols) */}
        <div className="lg:col-span-4 bg-slate-50/60 rounded-xl border border-slate-200/70 p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
              <ImageIcon className="w-4 h-4 text-[#E65F2B]" />
              <span>1. Logo Perusahaan Kontraktor</span>
              <span className="text-rose-500">*</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Format PNG, JPG, atau WebP (Maks. 2MB). Ditampilkan pada lembar resmi penawaran.
            </p>
          </div>

          <div className="pt-1">
            {data.kontraktor_logo_url ? (
              <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#E65F2B] border border-orange-200 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Terpasang
                    </span>
                    <p className="text-xs font-semibold text-slate-800 truncate mt-1">Logo Perusahaan</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <a
                    href={getDokumenProxyUrl("logo", data.kontraktor_logo_drive_id, data.kontraktor_logo_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-500 hover:text-[#E65F2B] hover:bg-orange-50 rounded-lg transition-colors flex items-center text-xs font-medium"
                    title="Buka / Unduh Berkas Logo"
                  >
                    <ExternalLink className="w-4 h-4 text-[#E65F2B]" />
                    <span className="text-[11px] text-[#E65F2B] font-semibold ml-1">Buka</span>
                  </a>
                  {!disabled && (
                    <>
                      <label
                        htmlFor={logoInputId}
                        className="cursor-pointer text-[11px] text-slate-600 hover:text-slate-900 hover:underline font-medium px-1"
                        title="Ganti Berkas Logo"
                      >
                        Ganti
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          onChange({ kontraktor_logo_url: null, kontraktor_logo_drive_id: null })
                        }
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Hapus Logo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label
                  htmlFor={logoInputId}
                  className={`border-2 border-dashed border-slate-300 hover:border-[#E65F2B] bg-white hover:bg-orange-50/20 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                    uploadingType === "LOGO" ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  {uploadingType === "LOGO" ? (
                    <div className="flex flex-col items-center py-2 space-y-1">
                      <Loader2 className="w-6 h-6 text-[#E65F2B] animate-spin" />
                      <span className="text-[11px] text-slate-500 font-medium">Mengunggah logo...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-1 space-y-1">
                      <div className="w-8 h-8 rounded-full bg-orange-50 text-[#E65F2B] flex items-center justify-center mb-1">
                        <Upload className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">Pilih Berkas Logo</span>
                      <span className="text-[10px] text-slate-400">PNG / JPG / WebP</span>
                    </div>
                  )}
                </label>
              </div>
            )}

            <input
              id={logoInputId}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              className="hidden"
              disabled={disabled || uploadingType !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload("LOGO", file);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* 2. ANALISA HARGA SATUAN (EXCEL) (4 cols) */}
        <div className="lg:col-span-4 bg-slate-50/60 rounded-xl border border-slate-200/70 p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>2. Analisa Harga Satuan (AHS)</span>
              <span className="text-rose-500">*</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Unggah rincian perhitungan analisa harga satuan lengkap dalam format Excel (.xlsx / .xls, Maks. 15MB).
            </p>
          </div>

          <div className="pt-1">
            {data.analisa_harga_url ? (
              <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Terunggah
                    </span>
                    <p className="text-xs font-semibold text-slate-800 truncate mt-1" title={data.analisa_harga_nama || "Analisa_Harga_Satuan.xlsx"}>
                      {data.analisa_harga_nama || "Analisa_Harga_Satuan.xlsx"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <a
                    href={getDokumenProxyUrl("ahs", data.analisa_harga_drive_id, data.analisa_harga_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors flex items-center text-xs font-medium"
                    title="Buka / Unduh Berkas Excel AHS"
                  >
                    <ExternalLink className="w-4 h-4 text-emerald-600" />
                    <span className="text-[11px] text-emerald-700 font-semibold ml-1">Buka</span>
                  </a>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          analisa_harga_url: null,
                          analisa_harga_drive_id: null,
                          analisa_harga_nama: null,
                        })
                      }
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Hapus Berkas"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label
                  htmlFor={ahsInputId}
                  className={`border-2 border-dashed border-slate-300 hover:border-emerald-600 bg-white hover:bg-emerald-50/20 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                    uploadingType === "ANALISA_HARGA" ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  {uploadingType === "ANALISA_HARGA" ? (
                    <div className="flex flex-col items-center py-2 space-y-1">
                      <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
                      <span className="text-[11px] text-slate-500 font-medium">Mengunggah file Excel AHS...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-1 space-y-1">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1">
                        <Upload className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">Unggah Berkas Excel AHS</span>
                      <span className="text-[10px] text-slate-400">.xlsx / .xls</span>
                    </div>
                  )}
                </label>
              </div>
            )}

            <input
              id={ahsInputId}
              type="file"
              accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              disabled={disabled || uploadingType !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload("ANALISA_HARGA", file);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* 3. ASURANSI PROYEK (CAR) (4 cols) */}
        <div className="lg:col-span-4 bg-slate-50/60 rounded-xl border border-slate-200/70 p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>3. Asuransi Proyek (CAR)</span>
              <span className="text-rose-500">*</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Wajib melampirkan nomor polis, masa berlaku aktif, dan berkas polis PDF.
            </p>
          </div>

          <div className="space-y-2.5 pt-1">
            {/* Input No Polis */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Nomor Polis Asuransi <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: POL-CAR/2026/0881"
                value={data.asuransi_no_polis || ""}
                disabled={disabled}
                onChange={(e) => onChange({ asuransi_no_polis: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#E65F2B] focus:border-[#E65F2B]"
              />
            </div>

            {/* Input Masa Berlaku (Anti-Backdate: min={todayStr}) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  Masa Berlaku Hingga <span className="text-rose-500">*</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type="date"
                  min={todayStr}
                  value={formatDateToYMD(data.asuransi_masa_berlaku)}
                  disabled={disabled}
                  onChange={(e) => onChange({ asuransi_masa_berlaku: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#E65F2B] focus:border-[#E65F2B]"
                />
              </div>
              {data.asuransi_masa_berlaku && (
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Berlaku s/d: <span className="font-semibold text-slate-700">{formatDateIndo(data.asuransi_masa_berlaku)}</span>
                </p>
              )}
            </div>

            {/* Upload PDF Asuransi */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Berkas Polis Asuransi (PDF) <span className="text-rose-500">*</span>
              </label>

              {data.asuransi_file_url ? (
                <div className="bg-white rounded-lg border border-slate-200 p-2 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center space-x-2 min-w-0">
                    <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-[11px] font-medium text-slate-800 truncate" title={data.asuransi_file_nama || "Polis_Asuransi.pdf"}>
                      {data.asuransi_file_nama || "Polis_Asuransi.pdf"}
                    </p>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <a
                      href={getDokumenProxyUrl("asuransi", data.asuransi_file_drive_id, data.asuransi_file_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded flex items-center"
                      title="Lihat Berkas Polis (PDF)"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-[10px] text-amber-700 font-semibold ml-1">Buka</span>
                    </a>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            asuransi_file_url: null,
                            asuransi_file_drive_id: null,
                            asuransi_file_nama: null,
                          })
                        }
                        className="p-1 text-rose-500 hover:text-rose-700 rounded"
                        title="Hapus PDF"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor={asuransiInputId}
                    className={`border-2 border-dashed border-slate-300 hover:border-amber-500 bg-white hover:bg-amber-50/20 rounded-lg p-2.5 flex items-center justify-center space-x-2 cursor-pointer transition-colors ${
                      uploadingType === "ASURANSI" ? "opacity-60 pointer-events-none" : ""
                    }`}
                  >
                    {uploadingType === "ASURANSI" ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                        <span className="text-[11px] text-slate-500">Mengunggah PDF...</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5 text-amber-600" />
                        <span className="text-xs font-semibold text-slate-700">Unggah PDF Polis</span>
                      </>
                    )}
                  </label>
                </div>
              )}

              <input
                id={asuransiInputId}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                disabled={disabled || uploadingType !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload("ASURANSI", file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
