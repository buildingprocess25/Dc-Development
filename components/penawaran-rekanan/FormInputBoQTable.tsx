"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Check,
  AlertCircle,
  Loader2,
  Save,
  ArrowRight,
  FileText,
  CheckCircle2,
  RotateCcw,
  Download,
  FileSpreadsheet,
  Folder,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import PinpointNegosiasiBadge from "./PinpointNegosiasiBadge";
import { parsePenawaranExcel } from "@/lib/excel/penawaran-excel-parser";
import FormDokumenAsuransiCard, { DokumenAsuransiData, formatDateToYMD } from "./FormDokumenAsuransiCard";

interface BoQTableProps {
  penawaran: any;
}

export default function FormInputBoQTable({ penawaran }: BoQTableProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"SIPIL" | "ME">("SIPIL");
  const [items, setItems] = useState<any[]>(penawaran.items || []);
  const [savingDraft, setSavingDraft] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

  // State Dokumen Penawaran & Asuransi CAR
  const [dokumenAsuransi, setDokumenAsuransi] = useState<DokumenAsuransiData>({
    kontraktor_logo_url: penawaran.kontraktor_logo_url || null,
    kontraktor_logo_drive_id: penawaran.kontraktor_logo_drive_id || null,
    analisa_harga_url: penawaran.analisa_harga_url || null,
    analisa_harga_drive_id: penawaran.analisa_harga_drive_id || null,
    analisa_harga_nama: penawaran.analisa_harga_nama || null,
    asuransi_no_polis: penawaran.asuransi_no_polis || null,
    asuransi_masa_berlaku: formatDateToYMD(penawaran.asuransi_masa_berlaku) || null,
    asuransi_file_url: penawaran.asuransi_file_url || null,
    asuransi_file_drive_id: penawaran.asuransi_file_drive_id || null,
    asuransi_file_nama: penawaran.asuransi_file_nama || null,
  });

  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: "success" | "error" | "warning";
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: "success",
    title: "",
    message: "",
  });

  const formatNumber = (num: number) => {
    if (!num && num !== 0) return "0";
    return new Intl.NumberFormat("id-ID").format(num);
  };

  const handlePriceChange = (id: number, field: "harga_material" | "harga_upah", value: string) => {
    const rawVal = parseFloat(value.replace(/[^0-9]/g, "")) || 0;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const updated = { ...it, [field]: rawVal };
          updated.total_harga = (updated.volume || 0) * ((updated.harga_material || 0) + (updated.harga_upah || 0));
          return updated;
        }
        return it;
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleDownloadTemplate = async () => {
    if (isDownloadingTemplate) return;
    try {
      setIsDownloadingTemplate(true);
      const res = await fetch(`/api/dc-development/penawaran-rekanan/${penawaran.id}/template-excel`);

      if (!res.ok) {
        throw new Error(`Gagal mengunduh template (Status: ${res.status})`);
      }

      // Ambil nama file dari header Content-Disposition jika ada
      const disposition = res.headers.get("content-disposition");
      let filename = `Template_BoQ_${(penawaran.nomor_penawaran || "Tender").replace(/[\/\\?%*:|"<>]/g, "_")}.xlsx`;
      if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/i);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1]);
        }
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      setFeedback({
        isOpen: true,
        type: "error",
        title: "Gagal Mengunduh Template",
        message: err.message || "Terjadi kesalahan saat menyiapkan file template Excel.",
      });
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsParsingExcel(true);
      const parseResult = await parsePenawaranExcel(file);

      if (!parseResult.success || parseResult.items.length === 0) {
        setFeedback({
          isOpen: true,
          type: "error",
          title: "Gagal Membaca File Excel",
          message:
            parseResult.errors.join(". ") ||
            "Format file Excel tidak sesuai dengan template resmi SPARTA.",
        });
        return;
      }

      // Buat map pencocokan berdasarkan ID atau Deskripsi
      const excelMapById = new Map<number, { material: number; upah: number }>();
      const excelMapByDesc = new Map<string, { material: number; upah: number }>();

      parseResult.items.forEach((it) => {
        if (it.id) {
          excelMapById.set(it.id, {
            material: it.harga_material,
            upah: it.harga_upah,
          });
        }
        if (it.deskripsi) {
          excelMapByDesc.set(it.deskripsi.trim().toLowerCase(), {
            material: it.harga_material,
            upah: it.harga_upah,
          });
        }
      });

      let updatedCount = 0;
      setItems((prev) =>
        prev.map((it) => {
          let matched = it.id ? excelMapById.get(it.id) : undefined;
          if (!matched && it.deskripsi) {
            matched = excelMapByDesc.get(it.deskripsi.trim().toLowerCase());
          }

          if (matched) {
            updatedCount++;
            const newMaterial = matched.material;
            const newUpah = matched.upah;
            const newTotal = (it.volume || 0) * (newMaterial + newUpah);
            return {
              ...it,
              harga_material: newMaterial,
              harga_upah: newUpah,
              total_harga: newTotal,
            };
          }
          return it;
        })
      );

      setHasUnsavedChanges(true);

      setFeedback({
        isOpen: true,
        type: "success",
        title: "Impor Excel Berhasil",
        message: `Sebanyak ${updatedCount} butir pekerjaan berhasil diperbarui harganya dari file Excel. Silakan periksa kembali angka harga dan lengkapi berkas bukti pendukung sebelum menyimpan.`,
      });
    } catch (err: any) {
      setFeedback({
        isOpen: true,
        type: "error",
        title: "Terjadi Kesalahan",
        message: err.message || "Gagal memproses file Excel.",
      });
    } finally {
      setIsParsingExcel(false);
      e.target.value = "";
    }
  };

  const saveToServer = async (targetStatus?: string) => {
    const res = await fetch(`/api/dc-development/penawaran-rekanan/${penawaran.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(targetStatus ? { status: targetStatus } : {}),
        kontraktor_logo_url: dokumenAsuransi.kontraktor_logo_url,
        kontraktor_logo_drive_id: dokumenAsuransi.kontraktor_logo_drive_id,
        analisa_harga_url: dokumenAsuransi.analisa_harga_url,
        analisa_harga_drive_id: dokumenAsuransi.analisa_harga_drive_id,
        analisa_harga_nama: dokumenAsuransi.analisa_harga_nama,
        asuransi_no_polis: dokumenAsuransi.asuransi_no_polis,
        asuransi_masa_berlaku: dokumenAsuransi.asuransi_masa_berlaku,
        asuransi_file_url: dokumenAsuransi.asuransi_file_url,
        asuransi_file_drive_id: dokumenAsuransi.asuransi_file_drive_id,
        asuransi_file_nama: dokumenAsuransi.asuransi_file_nama,
        items: items.map((it) => ({
          id: it.id,
          volume: it.volume,
          lingkup: it.lingkup,
          harga_material: it.harga_material || 0,
          harga_upah: it.harga_upah || 0,
        })),
      }),
    });
    return await res.json();
  };

  const handleSaveDraft = async () => {
    try {
      setSavingDraft(true);
      const json = await saveToServer("DRAFT");
      if (json.status === "success") {
        setHasUnsavedChanges(false);
        setFeedback({
          isOpen: true,
          type: "success",
          title: "Draft Berhasil Disimpan",
          message: "Seluruh data harga penawaran dan dokumen kelengkapan telah tersimpan dengan aman.",
        });
      } else {
        setFeedback({
          isOpen: true,
          type: "error",
          title: "Gagal Menyimpan Draft",
          message: json.message || "Terjadi kesalahan saat menyimpan draft penawaran.",
        });
      }
    } catch (e: any) {
      setFeedback({
        isOpen: true,
        type: "error",
        title: "Error Server",
        message: e.message || "Gagal menghubungi server.",
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleProceedReview = async () => {
    if (!isReadyToReview) {
      const missingList: string[] = [];
      if (!isAllPricesFilled) {
        missingList.push(`${emptyPriceItems.length} butir pekerjaan belum terisi harga satuan`);
      }
      if (!isLogoUploaded) {
        missingList.push("Logo Perusahaan Kontraktor belum diunggah");
      }
      if (!isAhsUploaded) {
        missingList.push("Berkas Analisa Harga Satuan (Excel) belum diunggah");
      }
      if (!isPolisNoFilled) {
        missingList.push("Nomor Polis Asuransi belum diisi");
      }
      if (!isMasaBerlakuFilled) {
        missingList.push("Masa Berlaku Asuransi belum ditentukan");
      } else if (!isMasaBerlakuValid) {
        missingList.push("Masa Berlaku Asuransi tidak boleh tanggal lampau (anti-backdate)");
      }
      if (!isAsuransiPdfUploaded) {
        missingList.push("Berkas Dokumen Polis Asuransi (PDF) belum diunggah");
      }

      setFeedback({
        isOpen: true,
        type: "warning",
        title: "Penawaran Belum Lengkap",
        message: `Silakan lengkapi data penawaran berikut sebelum dapat melanjutkan ke tahapan review:\n• ${missingList.join("\n• ")}`,
      });
      return;
    }

    try {
      setProceeding(true);
      const json = await saveToServer();
      if (json.status === "success") {
        setHasUnsavedChanges(false);
        router.push(`/dc-development/penawaran-rekanan/${penawaran.id}/review-penawaran`);
      } else {
        setFeedback({
          isOpen: true,
          type: "error",
          title: "Gagal Melanjutkan",
          message: json.message || "Gagal menyimpan data penawaran sebelum ke review.",
        });
      }
    } catch (e: any) {
      setFeedback({
        isOpen: true,
        type: "error",
        title: "Error Server",
        message: e.message,
      });
    } finally {
      setProceeding(false);
    }
  };

  const isNegosiasiMode = penawaran.status === "NEGOSIASI_REKANAN";

  // Validasi: Wajib mengubah minimal 1 nilai harga pada item yang ditandai
  const hasModifiedAnyFlaggedItem = useMemo(() => {
    if (!isNegosiasiMode) return true;
    return items.some((it) => {
      const orig = (penawaran.items || []).find((pi: any) => pi.id === it.id);
      if (!orig || !orig.is_flagged_specialist) return false;
      return (
        (orig.harga_material || 0) !== (it.harga_material || 0) ||
        (orig.harga_upah || 0) !== (it.harga_upah || 0)
      );
    });
  }, [items, penawaran.items, isNegosiasiMode]);

  const handleResubmitNegosiasi = async () => {
    try {
      setProceeding(true);
      const res = await fetch(`/api/dc-development/penawaran-rekanan/${penawaran.id}/resubmit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({
            id: it.id,
            volume: it.volume,
            lingkup: it.lingkup,
            harga_material: it.harga_material || 0,
            harga_upah: it.harga_upah || 0,
          })),
          catatan_perbaikan: "Perbaikan penawaran hasil negosiasi diajukan oleh rekanan",
        }),
      });

      const json = await res.json();
      if (json.status === "success") {
        setHasUnsavedChanges(false);
        setFeedback({
          isOpen: true,
          type: "success",
          title: "Pengajuan Ulang Berhasil",
          message: "Penyesuaian penawaran negosiasi Anda telah berhasil dikirimkan kembali ke panitia lelang.",
        });
      } else {
        setFeedback({
          isOpen: true,
          type: "error",
          title: "Gagal Mengajukan Ulang",
          message: json.message || "Terjadi kesalahan.",
        });
      }
    } catch (e: any) {
      setFeedback({
        isOpen: true,
        type: "error",
        title: "Error Server",
        message: e.message,
      });
    } finally {
      setProceeding(false);
    }
  };

  const currentItems = items.filter((it) => (it.lingkup || "").toUpperCase() === activeTab);

  // Kelompokkan butir pekerjaan berdasarkan kategori pekerjaan pada tab aktif
  const currentCategoryGroups = useMemo(() => {
    const map = new Map<string, { list: any[]; subtotal: number }>();
    currentItems.forEach((it) => {
      const cat = (it.kategori_pekerjaan || "PEKERJAAN LAINNYA").trim();
      if (!map.has(cat)) {
        map.set(cat, { list: [], subtotal: 0 });
      }
      const group = map.get(cat)!;
      group.list.push(it);
      group.subtotal += Number(it.total_harga || 0);
    });

    return Array.from(map.entries()).map(([kategori, data]) => ({
      kategori,
      list: data.list,
      subtotal: data.subtotal,
    }));
  }, [currentItems]);

  // 1. Validasi Harga: Setiap butir pekerjaan wajib terisi harga satuan (material > 0 atau upah > 0)
  const emptyPriceItems = items.filter(
    (it) => (!it.harga_material || it.harga_material <= 0) && (!it.harga_upah || it.harga_upah <= 0)
  );
  const isAllPricesFilled = emptyPriceItems.length === 0;

  // 2. Validasi Kelengkapan Dokumen & Asuransi Penawaran
  const todayStr = new Date().toLocaleDateString("en-CA");
  const isLogoUploaded = Boolean(dokumenAsuransi.kontraktor_logo_url);
  const isAhsUploaded = Boolean(dokumenAsuransi.analisa_harga_url);
  const isPolisNoFilled = Boolean(dokumenAsuransi.asuransi_no_polis && dokumenAsuransi.asuransi_no_polis.trim());
  const masaBerlakuYMD = formatDateToYMD(dokumenAsuransi.asuransi_masa_berlaku);
  const isMasaBerlakuFilled = Boolean(masaBerlakuYMD);
  const isMasaBerlakuValid = Boolean(masaBerlakuYMD && masaBerlakuYMD >= todayStr);
  const isAsuransiPdfUploaded = Boolean(dokumenAsuransi.asuransi_file_url);

  const isDokumenAsuransiComplete =
    isLogoUploaded &&
    isAhsUploaded &&
    isPolisNoFilled &&
    isMasaBerlakuFilled &&
    isMasaBerlakuValid &&
    isAsuransiPdfUploaded;

  // Siap lanjut review jika seluruh harga terisi DAN dokumen asuransi lengkap
  const isReadyToReview = isAllPricesFilled && isDokumenAsuransiComplete;

  // Penghitungan status kelengkapan per lingkup Sipil & ME (berdasarkan harga satuan)
  const sipilItems = items.filter((it) => (it.lingkup || "").toUpperCase() === "SIPIL");
  const meItems = items.filter((it) => (it.lingkup || "").toUpperCase() === "ME");

  const sipilIncompleteCount = sipilItems.filter(
    (it) => (!it.harga_material || it.harga_material <= 0) && (!it.harga_upah || it.harga_upah <= 0)
  ).length;

  const meIncompleteCount = meItems.filter(
    (it) => (!it.harga_material || it.harga_material <= 0) && (!it.harga_upah || it.harga_upah <= 0)
  ).length;

  const totalSipil = sipilItems.reduce((sum, it) => sum + (it.total_harga || 0), 0);
  const totalMe = meItems.reduce((sum, it) => sum + (it.total_harga || 0), 0);
  const grandTotal = totalSipil + totalMe;

  return (
    <div className="space-y-4">
      {/* Kartu Kelengkapan Dokumen & Asuransi Penawaran */}
      <FormDokumenAsuransiCard
        penawaranId={penawaran.id}
        data={dokumenAsuransi}
        onChange={(upd) => {
          setDokumenAsuransi((prev) => ({ ...prev, ...upd }));
          setHasUnsavedChanges(true);
        }}
      />

      {/* Banner Negosiasi Resmi untuk Kontraktor */}
      {isNegosiasiMode && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs text-amber-950 space-y-2 shadow-2xs">
          <div className="flex items-center space-x-2 font-bold text-amber-900 text-sm">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <span>Instruksi Negosiasi dari Panitia Tender DC:</span>
          </div>
          <p className="bg-white/80 p-3 rounded-xl border border-amber-200 text-amber-900 font-medium">
            {penawaran.catatan_negosiasi_specialist || "Harap sesuaikan item-item harga penawaran yang ditandai di bawah."}
          </p>
          <p className="text-[11px] text-amber-700">
            * Anda wajib mengubah minimal satu nilai harga pada item pekerjaan yang ditandai sebelum tombol pengajuan ulang aktif.
          </p>
        </div>
      )}

      {/* Bilah Aksi Cepat Excel Template & Upload */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/70 via-white to-blue-50/60 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/60">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              Pengisian Cepat via Spreadsheet Excel
            </div>
            <div className="text-[11px] text-slate-500">
              Unduh template resmi (volume &amp; total terkunci), isi harga material &amp; upah di komputer Anda, lalu unggah kembali.
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate}
            className={`inline-flex items-center text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer ${
              isDownloadingTemplate ? "opacity-75 cursor-not-allowed" : ""
            }`}
            title="Unduh template Excel dengan formula otomatis dan volume terkunci"
          >
            {isDownloadingTemplate ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            )}
            <span>{isDownloadingTemplate ? "Menyiapkan Template..." : "Download Template Excel"}</span>
          </button>

          <label className="inline-flex items-center text-xs font-semibold text-blue-800 bg-white hover:bg-blue-50 border border-blue-300 px-3 py-1.5 rounded-xl transition-all shadow-2xs cursor-pointer">
            {isParsingExcel ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 text-blue-600 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            )}
            <span>{isParsingExcel ? "Membaca..." : "Upload Excel"}</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleExcelUpload}
              disabled={isParsingExcel}
            />
          </label>
        </div>
      </div>

      {/* Tab Kontrol Sipil vs ME & Ringkasan Penawaran */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab("SIPIL")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 ${activeTab === "SIPIL"
                ? "bg-[#E65F2B] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
          >
            <span>Pekerjaan Sipil ({sipilItems.length} Item)</span>
            {sipilIncompleteCount > 0 ? (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeTab === "SIPIL" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
                  }`}
              >
                {sipilIncompleteCount} Belum Lengkap
              </span>
            ) : (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${activeTab === "SIPIL" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                  }`}
              >
                ✓ Lengkap
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ME")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 ${activeTab === "ME"
                ? "bg-[#E65F2B] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
          >
            <span>Pekerjaan ME ({meItems.length} Item)</span>
            {meIncompleteCount > 0 ? (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeTab === "ME" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
                  }`}
              >
                {meIncompleteCount} Belum Lengkap
              </span>
            ) : (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${activeTab === "ME" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                  }`}
              >
                ✓ Lengkap
              </span>
            )}
          </button>
        </div>

        {/* Ringkasan Subtotal Cepat */}
        <div className="flex items-center space-x-4 pr-1">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Subtotal {activeTab}:</span>
            <div className="text-xs font-bold text-slate-700 font-mono">
              Rp {formatNumber(activeTab === "SIPIL" ? totalSipil : totalMe)}
            </div>
          </div>
          <div className="h-7 w-[1px] bg-slate-200" />
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Grand Total:</span>
            <div className="text-sm font-bold text-[#E65F2B] font-mono">Rp {formatNumber(grandTotal)}</div>
          </div>
        </div>
      </div>

      {/* Tabel BoQ Input */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/70 text-slate-600 font-medium uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">No</th>
                <th className="py-3 px-3 min-w-[260px]">Kategori & Uraian Pekerjaan</th>
                <th className="py-3 px-3 w-28 text-center">Volume (Terkunci)</th>
                <th className="py-3 px-3 w-36 text-right">Harga Material (Rp)</th>
                <th className="py-3 px-3 w-36 text-right">Harga Upah (Rp)</th>
                <th className="py-3 px-3 w-40 text-right">Total Biaya (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tidak ada item pada lingkup {activeTab}
                  </td>
                </tr>
              ) : (
                (() => {
                  let runningItemNo = 0;
                  return currentCategoryGroups.map((catGroup) => (
                    <React.Fragment key={`cat-${catGroup.kategori}`}>
                      {/* Baris Header Kategori Pekerjaan */}
                      <tr className="bg-slate-100/75 border-y border-slate-200/80">
                        <td colSpan={5} className="py-2.5 px-3">
                          <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
                            <Folder className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
                            <span className="uppercase tracking-wider">{catGroup.kategori}</span>
                            <span className="text-[11px] text-slate-400 font-normal">
                              ({catGroup.list.length} Item)
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 text-xs">
                          Rp {formatNumber(catGroup.subtotal)}
                        </td>
                      </tr>

                      {/* Baris-baris Butir Pekerjaan di Kategori Ini */}
                      {catGroup.list.map((it) => {
                        runningItemNo++;
                        const itemNo = runningItemNo;

                        return (
                          <tr key={it.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="py-3 px-3 text-center text-slate-400 font-mono font-medium">{itemNo}</td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-800 text-[12px]">{it.deskripsi}</div>
                              {it.is_flagged_specialist && (
                                <PinpointNegosiasiBadge catatan={it.catatan_specialist} tipe="HARGA" />
                              )}
                            </td>
                            <td className="py-3 px-3 text-center font-mono">
                              <span
                                className="inline-block bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-semibold text-[11px]"
                                title="Volume telah dikonfirmasi pada tahap klarifikasi aanwijzing"
                              >
                                {it.volume} {it.satuan}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <input
                                type="text"
                                inputMode="numeric"
                                className="w-full text-right font-mono bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-[#E65F2B] focus:border-[#E65F2B] outline-none font-medium"
                                value={it.harga_material ? formatNumber(it.harga_material) : ""}
                                placeholder="0"
                                onChange={(e) => handlePriceChange(it.id, "harga_material", e.target.value)}
                              />
                            </td>
                            <td className="py-3 px-3 text-right">
                              <input
                                type="text"
                                inputMode="numeric"
                                className="w-full text-right font-mono bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-[#E65F2B] focus:border-[#E65F2B] outline-none font-medium"
                                value={it.harga_upah ? formatNumber(it.harga_upah) : ""}
                                placeholder="0"
                                onChange={(e) => handlePriceChange(it.id, "harga_upah", e.target.value)}
                              />
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              Rp {formatNumber(it.total_harga || 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ));
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Bar Bawah */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <Button
          type="button"
          variant="outline"
          disabled={savingDraft}
          onClick={handleSaveDraft}
          className="border-slate-300 text-slate-700 rounded-xl text-xs h-9 px-4 hover:bg-slate-50 font-medium"
        >
          {savingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
          Simpan Draft Penawaran
        </Button>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isAllPricesFilled && (
            <span className="text-[11px] text-amber-700 flex items-center bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80 font-medium">
              <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-500 shrink-0" />
              Sisa {emptyPriceItems.length} item belum terisi harga
            </span>
          )}
          {!isDokumenAsuransiComplete && (
            <span className="text-[11px] text-amber-700 flex items-center bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80 font-medium">
              <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-500 shrink-0" />
              Dokumen & Asuransi Belum Lengkap
            </span>
          )}
          {isReadyToReview && (
            <span className="text-[11px] text-emerald-700 flex items-center bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600 shrink-0" />
              Harga & Dokumen Asuransi 100% Lengkap
            </span>
          )}
          {isNegosiasiMode ? (
            <Button
              type="button"
              disabled={!hasModifiedAnyFlaggedItem || proceeding}
              onClick={handleResubmitNegosiasi}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs h-9 px-5 shadow-xs font-semibold disabled:opacity-50"
            >
              {proceeding ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Mengirim Ulang...
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Ajukan Ulang Hasil Negosiasi
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!isReadyToReview || proceeding}
              onClick={handleProceedReview}
              className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white rounded-xl text-xs h-9 px-5 shadow-xs font-semibold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              title={
                !isReadyToReview
                  ? "Wajib mengisi seluruh harga satuan, mengunggah logo, analisa harga satuan (Excel), dan polis asuransi CAR"
                  : "Lanjut ke review penawaran & dokumen teknis"
              }
            >
              {proceeding ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Menyimpan...
                </>
              ) : (
                <>
                  Review Penawaran & Dokumen Teknis
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <FeedbackModal
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => setFeedback((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
