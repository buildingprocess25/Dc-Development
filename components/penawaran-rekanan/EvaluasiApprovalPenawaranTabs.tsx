"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Camera,
  Eye,
  MapPin,
  TrendingUp,
  TrendingDown,
  Layers,
  Folder,
  FileCode,
  Clock,
  Building2,
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  FileSpreadsheet,
  CheckCircle2,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import GanttChartInteractive from "@/components/penawaran-rekanan/GanttChartInteractive";
import EvaluasiBbmModal from "@/components/penawaran-rekanan/EvaluasiBbmModal";
import EvaluasiSpecialistModal from "@/components/penawaran-rekanan/EvaluasiSpecialistModal";

interface EvaluasiApprovalTabsProps {
  penawaran: any;
  dokumenList: any[];
  isBbm: boolean;
  isSpecialist: boolean;
  isAdmin: boolean;
}

export default function EvaluasiApprovalPenawaranTabs({
  penawaran,
  dokumenList = [],
  isBbm,
  isSpecialist,
  isAdmin,
}: EvaluasiApprovalTabsProps) {
  const [activeTab, setActiveTab] = useState<
    "FINANSIAL" | "RAB_OE" | "GANTT" | "FOTO" | "GAMBAR"
  >("FINANSIAL");
  const [lingkupFilter, setLingkupFilter] = useState<"SEMUA" | "SIPIL" | "ME">("SEMUA");
  const [rabLingkupFilter, setRabLingkupFilter] = useState<"SEMUA" | "SIPIL" | "ME">("SEMUA");
  const [showBbmModal, setShowBbmModal] = useState(false);
  const [showSpecialistModal, setShowSpecialistModal] = useState(false);

  const formatNumber = (n: number) => {
    if (!n && n !== 0) return "0";
    return new Intl.NumberFormat("id-ID").format(n);
  };

  // Helper penapis dokumen: Berkas RAB/OE dilarang masuk ke tab Gambar Teknis (PDF Gambar/Foto Lingkungan tetap ada)
  const isRabOeDoc = (d: any) => {
    const cat = (d.kategori_file || "").toUpperCase();
    const name = (d.nama_file || "").toUpperCase();
    const label = (d.nama_label || "").toUpperCase();
    return (
      cat.includes("RAB") ||
      cat.includes("OE") ||
      cat.includes("ESTIMATE") ||
      name.includes("RAB_OE") ||
      name.includes("RAB-OE") ||
      name.includes("RAB_") ||
      name.startsWith("RAB") ||
      label.includes("RAB") ||
      label.includes("OE") ||
      label.includes("OWNER ESTIMATE")
    );
  };

  const fotoLingkungan = useMemo(
    () => dokumenList.filter((d) => d.kategori_file === "FOTO_LINGKUNGAN"),
    [dokumenList]
  );
  // Gambar Teknis: Menampilkan berkas gambar teknis arsitektur, sipil, ME, dan PDF gambar/foto lingkungan (tanpa berkas RAB/OE)
  const gambarTeknis = useMemo(
    () => dokumenList.filter((d) => d.kategori_file !== "FOTO_LINGKUNGAN" && !isRabOeDoc(d)),
    [dokumenList]
  );

  // Pemisahan item item pekerjaan Sipil & ME yang diajukan Rekanan
  const itemsSipil = useMemo(
    () => (penawaran.items || []).filter((it: any) => (it.lingkup || "SIPIL").toUpperCase() === "SIPIL"),
    [penawaran.items]
  );
  const itemsMe = useMemo(
    () => (penawaran.items || []).filter((it: any) => (it.lingkup || "").toUpperCase() === "ME"),
    [penawaran.items]
  );

  const totalSipilRekanan = useMemo(
    () => itemsSipil.reduce((sum: number, it: any) => sum + (it.total_harga || 0), 0),
    [itemsSipil]
  );
  const totalMeRekanan = useMemo(
    () => itemsMe.reduce((sum: number, it: any) => sum + (it.total_harga || 0), 0),
    [itemsMe]
  );

  // OE per scope untuk item penawaran rekanan
  const totalSipilOe = useMemo(() => {
    return itemsSipil.reduce((sum: number, it: any) => {
      const oe = (penawaran.klarifikasi?.items || []).find((ki: any) => ki.id === it.klarifikasi_item_id);
      return sum + (oe?.total_biaya_akhir || 0);
    }, 0);
  }, [itemsSipil, penawaran.klarifikasi]);

  const totalMeOe = useMemo(() => {
    return itemsMe.reduce((sum: number, it: any) => {
      const oe = (penawaran.klarifikasi?.items || []).find((ki: any) => ki.id === it.klarifikasi_item_id);
      return sum + (oe?.total_biaya_akhir || 0);
    }, 0);
  }, [itemsMe, penawaran.klarifikasi]);

  // Total Keseluruhan OE Pasca-Klarifikasi Aanwijzing
  const totalOe = useMemo(() => {
    return (penawaran.klarifikasi?.items || []).reduce(
      (sum: number, it: any) => sum + (it.total_biaya_akhir || 0),
      0
    );
  }, [penawaran.klarifikasi]);

  const deviasiPersen = totalOe > 0 ? ((penawaran.grand_total - totalOe) / totalOe) * 100 : 0;

  // TAB 2 DATA: SELURUH ITEM RAB/OE LENGKAP HASIL KLARIFIKASI AANWIJZING (FULL ITEMS)
  const fullClarifiedRabItems = useMemo(() => {
    const clarItems = penawaran.klarifikasi?.items || [];
    const rabItems = penawaran.klarifikasi?.renovasi?.item_rab || [];

    // Jika item klarifikasi sudah berisi seluruh item (>= original RAB), gunakan langsung
    if (clarItems.length >= rabItems.length && clarItems.length > 0) {
      return clarItems;
    }

    // Gabungkan item baseline RAB dengan data klarifikasi aanwijzing
    const clarMapByOrigId = new Map<number, any>();
    const clarMapByDesc = new Map<string, any>();
    clarItems.forEach((ci: any) => {
      if (ci.original_renovasi_item_id) clarMapByOrigId.set(ci.original_renovasi_item_id, ci);
      if (ci.deskripsi) clarMapByDesc.set(ci.deskripsi.trim().toLowerCase(), ci);
    });

    const merged: any[] = [];
    const usedClarIds = new Set<number>();

    rabItems.forEach((orig: any) => {
      const matched =
        clarMapByOrigId.get(orig.id) ||
        clarMapByDesc.get((orig.deskripsi || "").trim().toLowerCase());
      if (matched) {
        usedClarIds.add(matched.id);
        merged.push(matched);
      } else {
        const vol = Number(orig.volume) || 0;
        const mat = Number(orig.harga_material) || 0;
        const upah = Number(orig.harga_upah) || 0;
        merged.push({
          id: `orig-${orig.id}`,
          lingkup: orig.lingkup || "SIPIL",
          kategori_pekerjaan: orig.kategori_pekerjaan || "Pekerjaan Persiapan",
          deskripsi: orig.deskripsi,
          satuan: orig.satuan || "m2",
          volume_awal: vol,
          volume_akhir: vol,
          harga_material: mat,
          harga_upah: upah,
          total_biaya_awal: orig.total_biaya || vol * (mat + upah),
          total_biaya_akhir: orig.total_biaya || vol * (mat + upah),
          tipe_perubahan: "SAMA_DENGAN_RAB",
          status_perubahan: "Sama dengan RAB/OE",
        });
      }
    });

    // Tambahkan item baru dari klarifikasi aanwijzing yang belum ada di RAB awal
    clarItems.forEach((ci: any) => {
      if (!usedClarIds.has(ci.id)) {
        merged.push(ci);
      }
    });

    return merged;
  }, [penawaran.klarifikasi]);

  const fullSipilItems = useMemo(
    () => fullClarifiedRabItems.filter((it: any) => (it.lingkup || "SIPIL").toUpperCase() === "SIPIL"),
    [fullClarifiedRabItems]
  );
  const fullMeItems = useMemo(
    () => fullClarifiedRabItems.filter((it: any) => (it.lingkup || "").toUpperCase() === "ME"),
    [fullClarifiedRabItems]
  );

  const fullOeTotalSipil = useMemo(
    () => fullSipilItems.reduce((s: number, it: any) => s + (it.total_biaya_akhir || 0), 0),
    [fullSipilItems]
  );
  const fullOeTotalMe = useMemo(
    () => fullMeItems.reduce((s: number, it: any) => s + (it.total_biaya_akhir || 0), 0),
    [fullMeItems]
  );

  // Grouping kategori helper
  const groupByCategory = (items: any[]) => {
    const map = new Map<string, any[]>();
    items.forEach((it) => {
      const cat = (it.kategori_pekerjaan || "PEKERJAAN LAINNYA").trim();
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(it);
    });
    return Array.from(map.entries()).map(([kategori, list]) => ({
      kategori,
      list,
    }));
  };

  const sipilCategories = useMemo(() => groupByCategory(itemsSipil), [itemsSipil]);
  const meCategories = useMemo(() => groupByCategory(itemsMe), [itemsMe]);

  const fullSipilCategories = useMemo(() => groupByCategory(fullSipilItems), [fullSipilItems]);
  const fullMeCategories = useMemo(() => groupByCategory(fullMeItems), [fullMeItems]);

  // Helper URL berkas aanwijzing (Foto Lingkungan & Gambar Teknis):
  // Pada menu evaluasi/approval internal (BBM, DC Specialist, Admin), buka langsung Google Drive mentah tanpa proxy
  const getDocumentUrl = (doc: any) => {
    if (doc.file_url && (doc.file_url.startsWith("http://") || doc.file_url.startsWith("https://"))) {
      return doc.file_url;
    }
    if (doc.drive_file_id) {
      return `https://drive.google.com/file/d/${doc.drive_file_id}/view`;
    }
    return "#";
  };

  // Dokumen Resmi RAB/OE Pasca-Aanwijzing: Tautan Google Drive mentah
  const rabOeDirectUrl = useMemo(() => {
    const docs = [
      ...(penawaran.klarifikasi?.dokumen || []),
      ...(dokumenList || []),
    ];
    const doc = docs.find(
      (d: any) =>
        d.kategori_file === "DOKUMEN_RAB_OE_PASCA_AANWIJZING_PDF" && d.file_url
    );
    if (doc?.file_url) return doc.file_url;
    if (penawaran.klarifikasi?.id) {
      return `/api/dc-development/klarifikasi-aanwijzing/${penawaran.klarifikasi.id}/rab-oe-pdf`;
    }
    return "#";
  }, [penawaran.klarifikasi, dokumenList]);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden">
      {/* Scrollable Content Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4">
        {/* Banner Header SPARTA */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#E65F2B] bg-orange-50 border border-orange-200/60 px-2 py-0.5 rounded-md">
                Tahap Evaluasi &amp; Negosiasi Tender
              </span>
              <span className="text-slate-300 text-xs">•</span>
              <span className="text-xs text-slate-500 font-mono">Status: {penawaran.status}</span>
              <span className="text-slate-300 text-xs">•</span>
              <span className="text-xs text-slate-500 font-mono">No. {penawaran.nomor_penawaran}</span>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-1">{penawaran.project?.nama_proyek}</h1>
            <p className="text-xs text-slate-500">
              Cabang: <span className="font-semibold text-slate-700">{penawaran.cabang}</span> • Rekanan:{" "}
              <span className="font-semibold text-slate-700">{penawaran.vendor_nama}</span>
            </p>
          </div>

          <div className="flex items-center">
            <Link href={`/dc-development/penawaran-rekanan/komparasi/${penawaran.project_id}?from=approval`}>
              <button
                type="button"
                className="inline-flex items-center text-xs text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 px-3.5 py-2 rounded-xl transition-colors font-medium cursor-pointer shadow-2xs"
              >
                <span>Komparasi Rekanan</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5 text-slate-400" />
              </button>
            </Link>
          </div>
        </div>

        {/* Tab Navigasi Utama Halaman Approval */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("FINANSIAL")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === "FINANSIAL"
                ? "bg-[#E65F2B] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              Ringkasan Finansial Penawaran
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("RAB_OE")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === "RAB_OE"
                ? "bg-[#E65F2B] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              Dokumen RAB/OE ({fullClarifiedRabItems.length} Item)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("GANTT")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === "GANTT"
                ? "bg-[#E65F2B] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              Jadwal Gantt Chart ({penawaran.durasi_pekerjaan_hari} Hari)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("FOTO")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === "FOTO"
                ? "bg-[#E65F2B] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              Foto Lingkungan ({fotoLingkungan.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("GAMBAR")}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === "GAMBAR"
                ? "bg-[#E65F2B] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              Gambar Teknis ({gambarTeknis.length})
            </button>
          </div>

          <div className="text-right px-2 hidden sm:block">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Nilai Penawaran:</span>
            <div className="text-sm font-bold text-[#E65F2B] font-mono">
              Rp {formatNumber(penawaran.grand_total)}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: RINGKASAN FINANSIAL PENAWARAN (KOMPARASI VS OE + AKSI APPROVAL) */}
        {/* ========================================================================= */}
        {activeTab === "FINANSIAL" && (
          <div className="space-y-4">
            {/* Panel Informasi Eksekutif Terpadu Finansial & Komparasi vs OE */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              {/* Baris Metrik Finansial Komparasi */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Kelompok Kiri: OE, Penawaran Rekanan, Deviasi & Durasi */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  {/* 1. Owner Estimate */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Owner Estimate (OE)
                    </span>
                    <div className="text-base sm:text-lg font-bold text-slate-800 font-mono mt-0.5">
                      Rp {formatNumber(totalOe)}
                    </div>
                    <span className="text-[11px] text-slate-400 block">Pagu Pasca-Aanwijzing</span>
                  </div>

                  <div className="hidden sm:block h-9 w-px bg-slate-200" />

                  {/* 2. Nilai Penawaran Rekanan + Deviasi Badge */}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Penawaran Rekanan
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold font-mono border ${deviasiPersen <= 0
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                      >
                        {deviasiPersen >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                        {deviasiPersen >= 0 ? `+${deviasiPersen.toFixed(1)}%` : `${deviasiPersen.toFixed(1)}%`}
                      </span>
                    </div>
                    <div className="text-base sm:text-lg font-bold text-[#E65F2B] font-mono mt-0.5">
                      Rp {formatNumber(penawaran.grand_total)}
                    </div>
                    <span className="text-[11px] text-slate-400 block">
                      {deviasiPersen <= 0 ? "Di bawah pagu OE (Kompetitif)" : "Di atas pagu OE"}
                    </span>
                  </div>

                  <div className="hidden sm:block h-9 w-px bg-slate-200" />

                  {/* 3. Durasi Pelaksanaan */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Durasi Pelaksanaan
                    </span>
                    <div className="text-base sm:text-lg font-bold text-slate-800 font-mono mt-0.5">
                      {penawaran.durasi_pekerjaan_hari} Hari
                    </div>
                    <span className="text-[11px] text-slate-400 block">
                      Target Aanwijzing: {penawaran.klarifikasi?.durasi_hari_akhir || "-"} Hari
                    </span>
                  </div>
                </div>

                {/* Kelompok Kanan: Breakdown Komposisi Subtotal Sipil & ME */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-5 lg:border-l lg:border-slate-200 lg:pl-6 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Subtotal Sipil:</span>
                    <span className="font-mono font-bold text-slate-800 block text-xs sm:text-sm">
                      Rp {formatNumber(totalSipilRekanan)}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      OE: Rp {formatNumber(totalSipilOe)} ({itemsSipil.length} item)
                    </span>
                  </div>

                  <div className="h-7 w-px bg-slate-200" />

                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Subtotal ME:</span>
                    <span className="font-mono font-bold text-slate-800 block text-xs sm:text-sm">
                      Rp {formatNumber(totalMeRekanan)}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      OE: Rp {formatNumber(totalMeOe)} ({itemsMe.length} item)
                    </span>
                  </div>
                </div>
              </div>

              {/* Baris Kelengkapan Dokumen Rekanan & Asuransi CAR */}
              <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/60">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 text-[#E65F2B] border border-orange-200 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <span>Dokumen &amp; Polis Rekanan:</span>
                      <span className="font-mono text-slate-600 font-normal">
                        {penawaran.asuransi_no_polis ? `Polis No. ${penawaran.asuransi_no_polis}` : "Belum Ada Polis"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Masa Berlaku:{" "}
                      <span className="font-semibold text-slate-700">
                        {penawaran.asuransi_masa_berlaku
                          ? new Date(penawaran.asuransi_masa_berlaku).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-2 shrink-0">
                  {penawaran.kontraktor_logo_url && (
                    <a
                      href={`/api/dc-development/penawaran-rekanan/${penawaran.id}/dokumen-proxy/logo`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-semibold text-orange-800 bg-white hover:bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg transition-all shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-[#E65F2B]" />
                      <span>Logo Kontraktor</span>
                    </a>
                  )}
                  {penawaran.analisa_harga_url && (
                    <a
                      href={`/api/dc-development/penawaran-rekanan/${penawaran.id}/dokumen-proxy/ahs`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-lg transition-all shadow-2xs"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      <span>Analisa Harga Satuan (Excel)</span>
                    </a>
                  )}
                  {penawaran.asuransi_file_url && (
                    <a
                      href={`/api/dc-development/penawaran-rekanan/${penawaran.id}/dokumen-proxy/asuransi`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-semibold text-amber-800 bg-white hover:bg-amber-50 border border-amber-300 px-3 py-1.5 rounded-lg transition-all shadow-2xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                      <span>Polis Asuransi (PDF)</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Baris Filter Lingkup Terpadu */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setLingkupFilter("SEMUA")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${lingkupFilter === "SEMUA"
                      ? "bg-white text-slate-800 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Semua Lingkup ({penawaran.items?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLingkupFilter("SIPIL")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${lingkupFilter === "SIPIL"
                      ? "bg-[#E65F2B] text-white shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Pekerjaan Sipil ({itemsSipil.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLingkupFilter("ME")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${lingkupFilter === "ME"
                      ? "bg-[#E65F2B] text-white shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Pekerjaan ME ({itemsMe.length})
                  </button>
                </div>

                <span className="text-xs text-slate-400 font-medium">
                  {lingkupFilter === "SEMUA"
                    ? "Menampilkan komparasi rincian harga satuan & total Pekerjaan Sipil dan ME vs OE"
                    : `Menampilkan hanya rincian komparasi Pekerjaan ${lingkupFilter}`}
                </span>
              </div>
            </div>

            {/* Banner Evaluasi Awal BBM Manager (Tersampaikan Jelas ke DC Specialist & Admin) */}
            {(penawaran.catatan_internal_bbm || (penawaran.items || []).some((it: any) => it.is_flagged_bbm)) && (
              <div className="bg-orange-50/70 border border-orange-200/90 rounded-2xl p-4 md:p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white border border-orange-200 flex items-center justify-center text-[#E65F2B] shrink-0 shadow-2xs">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#E65F2B] bg-white border border-orange-200 px-2 py-0.5 rounded-md">
                          Evaluasi Awal BBM Manager
                        </span>
                        <span className="text-slate-300 text-xs">•</span>
                        <span className="text-[11px] text-slate-500 font-mono font-medium">Catatan Internal Rahasia</span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm mt-0.5">
                        Rekomendasi &amp; Sorotan Pemeriksaan BBM Manager untuk DC Specialist
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold bg-white border border-orange-200 text-[#E65F2B] px-2.5 py-1 rounded-xl font-mono shadow-2xs">
                      {(penawaran.items || []).filter((it: any) => it.is_flagged_bbm).length} item Disoroti BBM
                    </span>
                  </div>
                </div>

                {penawaran.catatan_internal_bbm && (
                  <div className="bg-white/90 border border-orange-200/60 rounded-xl p-3 text-xs text-slate-800 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
                      Catatan Umum BBM:
                    </span>
                    <p className="italic leading-relaxed font-medium text-slate-700">
                      &ldquo;{penawaran.catatan_internal_bbm}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TABEL A: KOMPARASI PEKERJAAN SIPIL */}
            {(lingkupFilter === "SEMUA" || lingkupFilter === "SIPIL") && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-6 h-6 rounded-lg bg-[#E65F2B] text-white text-xs font-bold flex items-center justify-center shrink-0">
                      A
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">
                        Komparasi Pekerjaan Sipil ({itemsSipil.length} Item)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Pekerjaan persiapan, pondasi, struktur, dinding, lantai, dan arsitektur
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Subtotal Sipil:</span>
                    <div className="text-sm font-bold text-[#E65F2B] font-mono">
                      Rp {formatNumber(totalSipilRekanan)}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200/70 text-slate-600 uppercase font-medium">
                        <th className="py-2.5 px-3 w-10 text-center">No</th>
                        <th className="py-2.5 px-3 min-w-[240px]">Item Pekerjaan</th>
                        <th className="py-2.5 px-3 w-28 text-center">Volume</th>
                        <th className="py-2.5 px-3 w-36 text-right bg-slate-100/70">Harga OE (Rp)</th>
                        <th className="py-2.5 px-3 w-36 text-right">Harga Rekanan (Rp)</th>
                        <th className="py-2.5 px-3 w-28 text-center">Selisih</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemsSipil.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                            Tidak ada item pekerjaan sipil yang diajukan
                          </td>
                        </tr>
                      ) : (
                        sipilCategories.map((catGroup) => (
                          <React.Fragment key={`sipil-${catGroup.kategori}`}>
                            <tr className="bg-slate-50/90 border-y border-slate-200/60">
                              <td colSpan={6} className="py-1.5 px-3">
                                <div className="flex items-center space-x-1.5 text-slate-700 font-bold text-[11px]">
                                  <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                  <span>{catGroup.kategori} ({catGroup.list.length} Item)</span>
                                </div>
                              </td>
                            </tr>

                            {catGroup.list.map((it: any) => {
                              const itemIndex = itemsSipil.findIndex((x: any) => x.id === it.id) + 1;
                              const oeItem = (penawaran.klarifikasi?.items || []).find(
                                (ki: any) => ki.id === it.klarifikasi_item_id
                              );
                              const oeTotal = oeItem?.total_biaya_akhir || 0;
                              const rekananTotal = it.total_harga || 0;
                              const delta = rekananTotal - oeTotal;

                              return (
                                <tr key={it.id} className="hover:bg-slate-50/40">
                                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{itemIndex}</td>
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                                      <span className="font-semibold text-slate-800">{it.deskripsi}</span>
                                      {it.is_flagged_bbm && (
                                        <span className="inline-flex items-center text-[10px] bg-orange-100 text-[#E65F2B] border border-orange-200/80 px-1.5 py-0.2 rounded font-bold shrink-0">
                                          <AlertTriangle className="w-2.5 h-2.5 mr-1 text-[#E65F2B]" />
                                          Disorot BBM
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400">{it.kategori_pekerjaan}</div>
                                    {it.is_flagged_bbm && it.catatan_bbm && (
                                      <div className="mt-1.5 p-2 rounded-lg bg-orange-50/90 border border-orange-200 text-[11px] text-orange-950 flex items-start space-x-1.5">
                                        <span className="font-bold text-[#E65F2B] shrink-0 text-[10px] uppercase tracking-wider">
                                          Catatan Sorotan BBM:
                                        </span>
                                        <span className="italic leading-relaxed">{it.catatan_bbm}</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono">
                                    {it.volume} {it.satuan}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono bg-slate-50/60 font-medium text-slate-700">
                                    Rp {formatNumber(oeTotal)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                                    Rp {formatNumber(rekananTotal)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${delta <= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                                        }`}
                                    >
                                      {delta >= 0 ? `+${formatNumber(delta)}` : formatNumber(delta)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                    {itemsSipil.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-50/80 border-t border-slate-200 font-semibold">
                          <td colSpan={3} className="py-2.5 px-3 text-right text-slate-600 uppercase text-[11px]">
                            Subtotal Pekerjaan Sipil :
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                            Rp {formatNumber(totalSipilOe)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            Rp {formatNumber(totalSipilRekanan)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${totalSipilRekanan - totalSipilOe <= 0
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
                                }`}
                            >
                              {totalSipilRekanan - totalSipilOe >= 0
                                ? `+${formatNumber(totalSipilRekanan - totalSipilOe)}`
                                : formatNumber(totalSipilRekanan - totalSipilOe)}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* TABEL B: KOMPARASI PEKERJAAN ME */}
            {(lingkupFilter === "SEMUA" || lingkupFilter === "ME") && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-6 h-6 rounded-lg bg-[#E65F2B] text-white text-xs font-bold flex items-center justify-center shrink-0">
                      B
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">
                        Komparasi Pekerjaan ME ({itemsMe.length} Item)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Instalasi kelistrikan, panel, penerangan, AC, tata udara, plumbing, dan pemadam
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Subtotal ME:</span>
                    <div className="text-sm font-bold text-[#E65F2B] font-mono">
                      Rp {formatNumber(totalMeRekanan)}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200/70 text-slate-600 uppercase font-medium">
                        <th className="py-2.5 px-3 w-10 text-center">No</th>
                        <th className="py-2.5 px-3 min-w-[240px]">Item Pekerjaan</th>
                        <th className="py-2.5 px-3 w-28 text-center">Volume</th>
                        <th className="py-2.5 px-3 w-36 text-right bg-slate-100/70">Harga OE (Rp)</th>
                        <th className="py-2.5 px-3 w-36 text-right">Harga Rekanan (Rp)</th>
                        <th className="py-2.5 px-3 w-28 text-center">Selisih</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemsMe.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                            Tidak ada item pekerjaan ME yang diajukan
                          </td>
                        </tr>
                      ) : (
                        meCategories.map((catGroup) => (
                          <React.Fragment key={`me-${catGroup.kategori}`}>
                            <tr className="bg-slate-50/90 border-y border-slate-200/60">
                              <td colSpan={6} className="py-1.5 px-3">
                                <div className="flex items-center space-x-1.5 text-slate-700 font-bold text-[11px]">
                                  <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                  <span>{catGroup.kategori} ({catGroup.list.length} Item)</span>
                                </div>
                              </td>
                            </tr>

                            {catGroup.list.map((it: any) => {
                              const itemIndex = itemsMe.findIndex((x: any) => x.id === it.id) + 1;
                              const oeItem = (penawaran.klarifikasi?.items || []).find(
                                (ki: any) => ki.id === it.klarifikasi_item_id
                              );
                              const oeTotal = oeItem?.total_biaya_akhir || 0;
                              const rekananTotal = it.total_harga || 0;
                              const delta = rekananTotal - oeTotal;

                              return (
                                <tr key={it.id} className="hover:bg-slate-50/40">
                                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{itemIndex}</td>
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                                      <span className="font-semibold text-slate-800">{it.deskripsi}</span>
                                      {it.is_flagged_bbm && (
                                        <span className="inline-flex items-center text-[10px] bg-orange-100 text-[#E65F2B] border border-orange-200/80 px-1.5 py-0.2 rounded font-bold shrink-0">
                                          <AlertTriangle className="w-2.5 h-2.5 mr-1 text-[#E65F2B]" />
                                          Disorot BBM
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400">{it.kategori_pekerjaan}</div>
                                    {it.is_flagged_bbm && it.catatan_bbm && (
                                      <div className="mt-1.5 p-2 rounded-lg bg-orange-50/90 border border-orange-200 text-[11px] text-orange-950 flex items-start space-x-1.5">
                                        <span className="font-bold text-[#E65F2B] shrink-0 text-[10px] uppercase tracking-wider">
                                          Catatan Sorotan BBM:
                                        </span>
                                        <span className="italic leading-relaxed">{it.catatan_bbm}</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono">
                                    {it.volume} {it.satuan}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono bg-slate-50/60 font-medium text-slate-700">
                                    Rp {formatNumber(oeTotal)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                                    Rp {formatNumber(rekananTotal)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${delta <= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                                        }`}
                                    >
                                      {delta >= 0 ? `+${formatNumber(delta)}` : formatNumber(delta)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                    {itemsMe.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-50/80 border-t border-slate-200 font-semibold">
                          <td colSpan={3} className="py-2.5 px-3 text-right text-slate-600 uppercase text-[11px]">
                            Subtotal Pekerjaan ME :
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                            Rp {formatNumber(totalMeOe)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            Rp {formatNumber(totalMeRekanan)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${totalMeRekanan - totalMeOe <= 0
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
                                }`}
                            >
                              {totalMeRekanan - totalMeOe >= 0
                                ? `+${formatNumber(totalMeRekanan - totalMeOe)}`
                                : formatNumber(totalMeRekanan - totalMeOe)}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DOKUMEN RAB/OE RESMI PASCA-AANWIJZING (FULL ITEM HASIL KLARIFIKASI) */}
        {/* ========================================================================= */}
        {activeTab === "RAB_OE" && (
          <div className="space-y-4">
            {/* Header Banner Dokumen RAB/OE */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#E65F2B] shrink-0 shadow-2xs">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#E65F2B] bg-orange-100/80 px-2 py-0.5 rounded-md">
                      Dokumen Resmi Hasil Klarifikasi Aanwijzing
                    </span>
                    <span className="text-slate-300 text-xs">•</span>
                    <span className="text-xs text-slate-500 font-mono">
                      BA: {penawaran.klarifikasi?.nomor_klarifikasi || "-"}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mt-0.5">
                    Rincian Owner Estimate (OE) Lengkap ({fullClarifiedRabItems.length} Item)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Target Durasi Pelaksanaan:{" "}
                    <strong className="text-slate-700">
                      {penawaran.klarifikasi?.durasi_hari_akhir || "-"} Hari
                    </strong>{" "}
                    • Menampilkan seluruh item pekerjaan acuan lelang setelah proses klarifikasi aanwijzing
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                <div className="text-left sm:text-right bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Total Nilai OE Pasca-Aanwijzing:
                  </span>
                  <span className="text-lg font-bold font-mono text-[#E65F2B]">
                    Rp {formatNumber(totalOe)}
                  </span>
                </div>

                <a
                  href={rabOeDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center text-xs font-bold text-white bg-[#E65F2B] hover:bg-[#d04f1f] px-4 py-3 rounded-xl transition-all shadow-xs cursor-pointer h-full"
                  title="Buka Berkas PDF Dokumen RAB/OE Pasca-Aanwijzing langsung di Google Drive"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  <span>Buka Berkas PDF RAB/OE (Drive)</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-2" />
                </a>
              </div>
            </div>

            {/* Filter Lingkup untuk Dokumen RAB/OE */}
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setRabLingkupFilter("SEMUA")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${rabLingkupFilter === "SEMUA"
                  ? "bg-white text-slate-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                Semua Lingkup ({fullClarifiedRabItems.length})
              </button>
              <button
                type="button"
                onClick={() => setRabLingkupFilter("SIPIL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${rabLingkupFilter === "SIPIL"
                  ? "bg-[#E65F2B] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                Pekerjaan Sipil ({fullSipilItems.length})
              </button>
              <button
                type="button"
                onClick={() => setRabLingkupFilter("ME")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${rabLingkupFilter === "ME"
                  ? "bg-[#E65F2B] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                Pekerjaan ME ({fullMeItems.length})
              </button>
            </div>

            {/* TABEL DOKUMEN RAB/OE: SEKSI A SIPIL */}
            {(rabLingkupFilter === "SEMUA" || rabLingkupFilter === "SIPIL") && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-md bg-[#E65F2B] text-white text-[10px] font-bold flex items-center justify-center">
                      A
                    </span>
                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                      Pekerjaan Sipil OE ({fullSipilItems.length} Item)
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    Subtotal OE Sipil: Rp {formatNumber(fullOeTotalSipil)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/60 border-b border-slate-200/70 text-slate-600 uppercase font-medium">
                        <th className="py-2.5 px-3 w-10 text-center">No</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Item Pekerjaan</th>
                        <th className="py-2.5 px-3 w-28 text-center">Volume Akhir</th>
                        <th className="py-2.5 px-3 w-32 text-right">Harga Material (Rp)</th>
                        <th className="py-2.5 px-3 w-32 text-right">Harga Upah (Rp)</th>
                        <th className="py-2.5 px-3 w-32 text-right">Harga Satuan (Rp)</th>
                        <th className="py-2.5 px-3 w-36 text-right bg-slate-100/70">Total Biaya OE (Rp)</th>
                        <th className="py-2.5 px-3 w-36 text-center">Status Aanwijzing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fullSipilCategories.map((catGroup) => (
                        <React.Fragment key={`full-sipil-${catGroup.kategori}`}>
                          <tr className="bg-slate-50/90 border-y border-slate-200/60">
                            <td colSpan={8} className="py-1.5 px-3">
                              <div className="flex items-center space-x-1.5 text-slate-700 font-bold text-[11px]">
                                <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                <span>{catGroup.kategori} ({catGroup.list.length} Item)</span>
                              </div>
                            </td>
                          </tr>

                          {catGroup.list.map((it: any) => {
                            const itemIndex = fullSipilItems.findIndex((x: any) => x.id === it.id) + 1;
                            const hargaSatuan = (it.harga_material || 0) + (it.harga_upah || 0);

                            return (
                              <tr key={it.id} className="hover:bg-slate-50/40">
                                <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{itemIndex}</td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-slate-800">{it.deskripsi}</div>
                                  <div className="text-[10px] text-slate-400">{it.kategori_pekerjaan}</div>
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono">
                                  {it.volume_akhir} {it.satuan}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                  Rp {formatNumber(it.harga_material || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                  Rp {formatNumber(it.harga_upah || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700">
                                  Rp {formatNumber(hargaSatuan)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50/60">
                                  Rp {formatNumber(it.total_biaya_akhir || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {it.tipe_perubahan === "ITEM_BARU" ? (
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                                      + Item Baru
                                    </span>
                                  ) : it.tipe_perubahan === "UBAH_VOLUME" ? (
                                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full">
                                      Volume Berubah ({it.volume_awal} &rarr; {it.volume_akhir})
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                      Sesuai RAB Awal
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50/90 border-t-2 border-slate-200 font-bold text-slate-900">
                        <td colSpan={6} className="py-2.5 px-3 text-right uppercase text-[11px] text-slate-600">
                          Subtotal Pekerjaan Sipil OE :
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 bg-slate-100">
                          Rp {formatNumber(fullOeTotalSipil)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* TABEL DOKUMEN RAB/OE: SEKSI B ME */}
            {(rabLingkupFilter === "SEMUA" || rabLingkupFilter === "ME") && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-md bg-[#E65F2B] text-white text-[10px] font-bold flex items-center justify-center">
                      B
                    </span>
                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                      Pekerjaan ME OE ({fullMeItems.length} Item)
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    Subtotal OE ME: Rp {formatNumber(fullOeTotalMe)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/60 border-b border-slate-200/70 text-slate-600 uppercase font-medium">
                        <th className="py-2.5 px-3 w-10 text-center">No</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Item Pekerjaan</th>
                        <th className="py-2.5 px-3 w-28 text-center">Volume Akhir</th>
                        <th className="py-2.5 px-3 w-32 text-right">Harga Material (Rp)</th>
                        <th className="py-2.5 px-3 w-32 text-right">Harga Upah (Rp)</th>
                        <th className="py-2.5 px-3 w-32 text-right">Harga Satuan (Rp)</th>
                        <th className="py-2.5 px-3 w-36 text-right bg-slate-100/70">Total Biaya OE (Rp)</th>
                        <th className="py-2.5 px-3 w-36 text-center">Status Aanwijzing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fullMeCategories.map((catGroup) => (
                        <React.Fragment key={`full-me-${catGroup.kategori}`}>
                          <tr className="bg-slate-50/90 border-y border-slate-200/60">
                            <td colSpan={8} className="py-1.5 px-3">
                              <div className="flex items-center space-x-1.5 text-slate-700 font-bold text-[11px]">
                                <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                <span>{catGroup.kategori} ({catGroup.list.length} Item)</span>
                              </div>
                            </td>
                          </tr>

                          {catGroup.list.map((it: any) => {
                            const itemIndex = fullMeItems.findIndex((x: any) => x.id === it.id) + 1;
                            const hargaSatuan = (it.harga_material || 0) + (it.harga_upah || 0);

                            return (
                              <tr key={it.id} className="hover:bg-slate-50/40">
                                <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{itemIndex}</td>
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-slate-800">{it.deskripsi}</div>
                                  <div className="text-[10px] text-slate-400">{it.kategori_pekerjaan}</div>
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono">
                                  {it.volume_akhir} {it.satuan}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                  Rp {formatNumber(it.harga_material || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                  Rp {formatNumber(it.harga_upah || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700">
                                  Rp {formatNumber(hargaSatuan)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50/60">
                                  Rp {formatNumber(it.total_biaya_akhir || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {it.tipe_perubahan === "ITEM_BARU" ? (
                                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                                      + Item Baru
                                    </span>
                                  ) : it.tipe_perubahan === "UBAH_VOLUME" ? (
                                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full">
                                      Volume Berubah ({it.volume_awal} &rarr; {it.volume_akhir})
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                      Sesuai RAB Awal
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50/90 border-t-2 border-slate-200 font-bold text-slate-900">
                        <td colSpan={6} className="py-2.5 px-3 text-right uppercase text-[11px] text-slate-600">
                          Subtotal Pekerjaan ME OE :
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 bg-slate-100">
                          Rp {formatNumber(fullOeTotalMe)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: JADWAL GANTT CHART INTERAKTIF (READ-ONLY VISUALISASI JADWAL REKANAN) */}
        {/* ========================================================================= */}
        {activeTab === "GANTT" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#E65F2B] bg-orange-100/80 px-2 py-0.5 rounded-md">
                    Visualisasi Jadwal Pelaksanaan Rekanan
                  </span>
                  <span className="text-slate-300 text-xs">•</span>
                  <span className="text-xs text-slate-600 font-semibold">{penawaran.vendor_nama}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-base mt-0.5">
                  Gantt Chart Proyek ({penawaran.durasi_pekerjaan_hari} Hari)
                </h3>
                <p className="text-xs text-slate-500">
                  Target Aanwijzing:{" "}
                  <strong className="text-slate-700">
                    {penawaran.klarifikasi?.durasi_hari_akhir || "-"} Hari
                  </strong>{" "}
                  • Visual hierarkis per lingkup Sipil &amp; ME, kategori pekerjaan, dan relasi keterikatan
                </p>
              </div>

              <div className="text-xs font-mono bg-slate-50 border border-slate-200/80 p-3 rounded-xl text-right shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Durasi Diajukan:</span>
                <span className="text-base font-bold text-slate-900">{penawaran.durasi_pekerjaan_hari} Hari</span>
              </div>
            </div>

            <GanttChartInteractive
              penawaran={penawaran}
              totalDays={penawaran.klarifikasi?.durasi_hari_akhir || penawaran.durasi_pekerjaan_hari}
              readOnly={true}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: FOTO LINGKUNGAN */}
        {/* ========================================================================= */}
        {activeTab === "FOTO" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">Foto Lingkungan &amp; Kondisi Lapangan DC</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dokumentasi foto eksisting lapangan dari tahap klarifikasi aanwijzing
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-orange-50 text-[#E65F2B] border border-orange-200/60 shrink-0 self-start sm:self-auto">
                Total {fotoLingkungan.length} Foto
              </span>
            </div>

            {fotoLingkungan.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Camera className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
                Tidak ada arsip foto lingkungan yang dilampirkan pada klarifikasi aanwijzing ini
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {fotoLingkungan.map((foto, idx) => {
                  const targetUrl = getDocumentUrl(foto);
                  return (
                    <div
                      key={foto.id || idx}
                      className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:border-orange-300 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#E65F2B] shrink-0 mt-0.5">
                          <Camera className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-slate-800 text-xs truncate" title={foto.nama_label || foto.nama_file}>
                            {foto.nama_label || foto.nama_file}
                          </h4>
                          <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5" title={foto.nama_file}>
                            {foto.nama_file}
                          </p>
                          {foto.lokasi_wilayah && (
                            <div className="flex items-center space-x-1 text-[11px] text-slate-500 mt-1.5">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{foto.lokasi_wilayah}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                          {foto.sumber || "FOTO"}
                        </span>
                        <a
                          href={targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs font-semibold text-[#E65F2B] hover:text-[#d04f1f] bg-orange-50 hover:bg-orange-100/70 border border-orange-200/80 px-3 py-1.5 rounded-lg transition-colors shadow-2xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          Lihat Foto
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: GAMBAR TEKNIS */}
        {/* ========================================================================= */}
        {activeTab === "GAMBAR" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">Gambar Teknis Arsitektur, Sipil &amp; ME (PDF &amp; DWG)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daftar berkas gambar teknis dan dokumen pendukung resmi dari panitia tender
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-orange-50 text-[#E65F2B] border border-orange-200/60 shrink-0 self-start sm:self-auto">
                Total {gambarTeknis.length} Berkas
              </span>
            </div>

            {gambarTeknis.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
                Tidak ada lampiran gambar teknis yang tercatat pada klarifikasi aanwijzing ini
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                {gambarTeknis.map((gbr, idx) => {
                  const targetUrl = getDocumentUrl(gbr);
                  const isDwg = gbr.nama_file?.toLowerCase().endsWith(".dwg");

                  return (
                    <div
                      key={gbr.id || idx}
                      className="p-4 bg-white hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center space-x-3.5">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDwg
                            ? "bg-purple-50 border border-purple-200 text-purple-700"
                            : "bg-blue-50 border border-blue-200 text-blue-700"
                            }`}
                        >
                          {isDwg ? <FileCode className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-xs md:text-sm">
                            {gbr.nama_label || gbr.nama_file}
                          </h4>
                          <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5 font-mono">
                            <span>{gbr.nama_file}</span>
                            {gbr.ukuran_kb && <span>• {gbr.ukuran_kb} KB</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                          {isDwg ? "AutoCAD DWG" : "PDF Dokumen"}
                        </span>
                        <a
                          href={targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-xl transition-colors shadow-2xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                          Buka Berkas
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Single Docked Fixed Bottom Action Bar */}
      <div className="shrink-0 bg-white border-t border-slate-200/80 px-4 md:px-6 py-3 flex items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] z-20">
        <div className="flex items-center">
          <Link href="/dc-development/approval/penawaran-rekanan">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-9 px-3.5 rounded-xl font-medium cursor-pointer shadow-2xs inline-flex items-center"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Kembali
            </Button>
          </Link>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span className="font-mono font-bold text-[#E65F2B] text-sm">
            Rp {formatNumber(penawaran.grand_total)}
          </span>

          {/* Status Badge Pemenang Final & Terkunci */}
          {penawaran.status === "MENANG" && (
            <div className="flex items-center space-x-2 bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs select-none">
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
              <span>Pemenang Tender (Final)</span>
            </div>
          )}

          {/* Status Badge Tidak Menang */}
          {penawaran.status === "TIDAK_MENANG" && (
            <div className="flex items-center space-x-2 bg-slate-100 border border-slate-200 text-slate-500 px-3 py-1.5 rounded-xl text-xs font-semibold select-none">
              <span>Tidak Menang Lelang</span>
            </div>
          )}

          {/* Status Badge Siap Komparasi / Masuk Wadah Pemilihan Pemenang */}
          {penawaran.status === "SIAP_KOMPARASI" && (
            <Link href={`/dc-development/penawaran-rekanan/komparasi/${penawaran.project_id}`}>
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 rounded-xl shadow-xs shrink-0 cursor-pointer ml-1 inline-flex items-center whitespace-nowrap shadow-emerald-600/20"
              >
                <Trophy className="w-3.5 h-3.5 mr-1.5" />
                <span>Buka Wadah Pemilihan Pemenang</span>
              </Button>
            </Link>
          )}

          {/* Jalur < 1M: Evaluasi BBM Manager (saat status DIAJUKAN atau DIAJUKAN_ULANG) */}
          {(isBbm || isAdmin) &&
            penawaran.grand_total < 1_000_000_000 &&
            (penawaran.status === "DIAJUKAN" || penawaran.status === "DIAJUKAN_ULANG") && (
              <Button
                type="button"
                onClick={() => setShowBbmModal(true)}
                className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-semibold text-xs h-9 px-4 rounded-xl shadow-xs shrink-0 cursor-pointer ml-1 inline-flex items-center whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                <span>
                  {penawaran.status === "DIAJUKAN_ULANG"
                    ? "Review Pengajuan Ulang (< 1M)"
                    : "Evaluasi BBM Manager (< 1M)"}
                </span>
              </Button>
            )}

          {/* Jalur >= 1M: Evaluasi DC Specialist (saat status DIAJUKAN atau DIAJUKAN_ULANG) */}
          {(isSpecialist || isAdmin) &&
            penawaran.grand_total >= 1_000_000_000 &&
            (penawaran.status === "DIAJUKAN" || penawaran.status === "DIAJUKAN_ULANG") && (
              <Button
                type="button"
                onClick={() => setShowSpecialistModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs h-9 px-4 rounded-xl shadow-xs shrink-0 cursor-pointer ml-1 inline-flex items-center whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                <span>
                  {penawaran.status === "DIAJUKAN_ULANG"
                    ? "Review Pengajuan Ulang (≥ 1M)"
                    : "Evaluasi DC Specialist (≥ 1M)"}
                </span>
              </Button>
            )}
        </div>
      </div>

      {/* Modal Dialog Lembar Evaluasi Awal BBM Manager */}
      <EvaluasiBbmModal
        isOpen={showBbmModal}
        onClose={() => setShowBbmModal(false)}
        penawaran={penawaran}
        klarifikasi={penawaran.klarifikasi}
      />

      {/* Modal Dialog Lembar Keputusan Negosiasi DC Specialist */}
      <EvaluasiSpecialistModal
        isOpen={showSpecialistModal}
        onClose={() => setShowSpecialistModal(false)}
        penawaran={penawaran}
        klarifikasi={penawaran.klarifikasi}
      />
    </div>
  );
}