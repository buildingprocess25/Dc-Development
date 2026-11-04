"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Award,
  Loader2,
  Folder,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Scale,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { SearchableSelectInput } from "@/components/ui/searchable-select";
import GanttChartInteractive from "@/components/penawaran-rekanan/GanttChartInteractive";

interface KomparasiProps {
  klarifikasi: any;
  penawaranList: any[];
  canSelectWinner?: boolean;
  backUrl?: string;
  backLabel?: string;
}

export default function KomparasiMultiRekananMatrix({
  klarifikasi,
  penawaranList = [],
  canSelectWinner = true,
  backUrl = "/dc-development/penawaran-rekanan",
  backLabel = "Kembali ke Daftar Penawaran",
}: KomparasiProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"BOQ" | "TIMELINE">("BOQ");

  // State Modal Pemilihan Pemenang
  const [isWinnerModalOpen, setIsWinnerModalOpen] = useState(false);
  const [selectedWinnerId, setSelectedWinnerId] = useState<number | null>(null);
  const [alasanPenetapan, setAlasanPenetapan] = useState("");
  const [catatanKeputusan, setCatatanKeputusan] = useState("");
  const [submittingWinner, setSubmittingWinner] = useState(false);

  // Navigasi Scroll Tabel
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const handleScrollTable = (direction: "left" | "right") => {
    if (tableScrollRef.current) {
      const scrollAmount = direction === "left" ? -350 : 350;
      tableScrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

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

  const formatNumber = (n: number) => {
    if (!n && n !== 0) return "0";
    return new Intl.NumberFormat("id-ID").format(n);
  };

  const totalOe = useMemo(() => {
    return (klarifikasi.items || []).reduce(
      (sum: number, it: any) => sum + (it.total_biaya_akhir || 0),
      0
    );
  }, [klarifikasi.items]);

  const currentWinner = useMemo(() => {
    return penawaranList.find((p) => p.status === "MENANG");
  }, [penawaranList]);

  // Inisialisasi pemenang yang sudah terpilih jika ada
  useEffect(() => {
    if (currentWinner && !selectedWinnerId) {
      setSelectedWinnerId(currentWinner.id);
    }
  }, [currentWinner, selectedWinnerId]);

  // 1. Ambil daftar peserta Aanwijzing yang berstatus HADIR_AKTUAL (yang berhak ikut tender)
  const eligiblePeserta = useMemo(() => {
    const list = klarifikasi.aanwijzing?.peserta || [];
    return list.filter((p: any) => p.status_kehadiran_aktual === "HADIR_AKTUAL");
  }, [klarifikasi.aanwijzing?.peserta]);

  // 2. Evaluasi apakah batas waktu tanggal tender telah lewat
  const isTenderPassed = useMemo(() => {
    const todayStr = new Date().toLocaleDateString("en-CA");
    const tenderDateObj = klarifikasi.tanggal_tender
      ? new Date(klarifikasi.tanggal_tender)
      : new Date("2026-11-03T00:00:00.000Z");
    const tenderDateStr = tenderDateObj.toLocaleDateString("en-CA");
    return todayStr > tenderDateStr;
  }, [klarifikasi.tanggal_tender]);

  // 3. Peserta yang belum mengajukan penawaran
  const unsubmittedPeserta = useMemo(() => {
    if (eligiblePeserta.length === 0) return [];
    const submittedVendorIds = new Set(
      penawaranList
        .filter((p: any) => p.status !== "DRAFT")
        .map((p: any) => p.vendor_id)
    );
    return eligiblePeserta.filter((ep: any) => !submittedVendorIds.has(ep.vendor_id));
  }, [eligiblePeserta, penawaranList]);

  // 4. Penawaran yang belum berstatus 'SIAP_KOMPARASI' / 'MENANG' / 'TIDAK_MENANG'
  const pendingReviewPenawaran = useMemo(() => {
    return penawaranList.filter((p: any) =>
      ["DIAJUKAN", "NEGOSIASI_REKANAN", "DIAJUKAN_ULANG", "DRAFT"].includes(p.status)
    );
  }, [penawaranList]);

  // 5. Penawaran yang siap dipilih sebagai pemenang (status SIAP_KOMPARASI)
  const readyToWinPenawaran = useMemo(() => {
    return penawaranList.filter((p: any) => p.status === "SIAP_KOMPARASI");
  }, [penawaranList]);

  // 6. Apakah ada peserta yang belum input dan tanggal tender belum lewat?
  // Jika tanggal tender sudah lewat (isTenderPassed), rekanan yang belum input otomatis TERELIMINASI (tidak memblokir).
  const isWaitingForUnsubmitted = !isTenderPassed && unsubmittedPeserta.length > 0;

  // 7. Evaluasi apakah penetapan pemenang lelang dapat dilakukan
  const canProceedWithWinner = useMemo(() => {
    if (pendingReviewPenawaran.length > 0) return false;
    if (isWaitingForUnsubmitted) return false;
    if (readyToWinPenawaran.length === 0) return false;
    return true;
  }, [pendingReviewPenawaran.length, isWaitingForUnsubmitted, readyToWinPenawaran.length]);

  // Pesan status / alasan mengapa tombol belum aktif
  const readinessMessage = useMemo(() => {
    if (pendingReviewPenawaran.length > 0) {
      return `${pendingReviewPenawaran.length} dari ${penawaranList.length} rekanan masih menunggu persetujuan (Status: ${pendingReviewPenawaran[0].status}). Seluruh berkas harus disetujui ke Wadah Komparasi.`;
    }
    if (isWaitingForUnsubmitted) {
      return `Batas waktu tender belum berakhir (${unsubmittedPeserta.length} rekanan belum memasukkan penawaran).`;
    }
    if (readyToWinPenawaran.length === 0) {
      return `Belum ada berkas rekanan yang disetujui (SIAP_KOMPARASI) untuk dipilih sebagai pemenang.`;
    }
    return null;
  }, [pendingReviewPenawaran, penawaranList.length, isWaitingForUnsubmitted, unsubmittedPeserta.length, readyToWinPenawaran.length]);

  // Options untuk ComboBox Pencarian Pemenang
  const winnerOptions = useMemo(() => {
    return readyToWinPenawaran.map((p) => {
      const deviasiPersen = totalOe > 0 ? ((p.grand_total - totalOe) / totalOe) * 100 : 0;
      const deviasiText = deviasiPersen <= 0 ? `${deviasiPersen.toFixed(1)}%` : `+${deviasiPersen.toFixed(1)}%`;
      return {
        value: String(p.id),
        label: `${p.vendor_nama} — Rp ${formatNumber(p.grand_total)} (${p.durasi_pekerjaan_hari} Hari) [${deviasiText}]`,
      };
    });
  }, [readyToWinPenawaran, totalOe]);

  // Rekanan terpilih dalam modal
  const selectedContractor = useMemo(() => {
    return readyToWinPenawaran.find((p) => p.id === selectedWinnerId) || null;
  }, [readyToWinPenawaran, selectedWinnerId]);

  // Pemisahan item klarifikasi ke Pekerjaan Sipil & Pekerjaan ME
  const sipilItems = useMemo(
    () => (klarifikasi.items || []).filter((it: any) => (it.lingkup || "SIPIL").toUpperCase() === "SIPIL"),
    [klarifikasi.items]
  );
  const meItems = useMemo(
    () => (klarifikasi.items || []).filter((it: any) => (it.lingkup || "").toUpperCase() === "ME"),
    [klarifikasi.items]
  );

  // Grouping item per kategori pekerjaan
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

  const sipilCategories = useMemo(() => groupByCategory(sipilItems), [sipilItems]);
  const meCategories = useMemo(() => groupByCategory(meItems), [meItems]);

  const subtotalOeSipil = useMemo(
    () => sipilItems.reduce((s: number, it: any) => s + (it.total_biaya_akhir || 0), 0),
    [sipilItems]
  );
  const subtotalOeMe = useMemo(
    () => meItems.reduce((s: number, it: any) => s + (it.total_biaya_akhir || 0), 0),
    [meItems]
  );

  // Helper hitung total penawaran kontraktor per lingkup (Sipil / ME)
  const getContractorScopeTotal = (penawaran: any, scopeItems: any[]) => {
    const scopeItemIds = new Set(scopeItems.map((it) => it.id));
    return (penawaran.items || []).reduce((sum: number, pi: any) => {
      if (scopeItemIds.has(pi.klarifikasi_item_id)) {
        return sum + (pi.total_harga || 0);
      }
      return sum;
    }, 0);
  };

  const totalColumns = 4 + penawaranList.length;

  const handleConfirmWinner = async () => {
    if (!selectedWinnerId || !alasanPenetapan.trim() || currentWinner) return;

    try {
      setSubmittingWinner(true);
      const res = await fetch(`/api/dc-development/penawaran-rekanan/${selectedWinnerId}/pilih-pemenang`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alasan: alasanPenetapan.trim(),
          catatan_keputusan: catatanKeputusan.trim(),
        }),
      });

      const json = await res.json();
      if (json.status === "success") {
        setIsWinnerModalOpen(false);
        setFeedback({
          isOpen: true,
          type: "success",
          title: "Pemenang Tender Berhasil Ditetapkan!",
          message: json.message || `Rekanan telah resmi ditetapkan sebagai pemenang lelang proyek ini.`,
        });
      } else {
        setFeedback({
          isOpen: true,
          type: "error",
          title: "Gagal Menetapkan Pemenang",
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
      setSubmittingWinner(false);
    }
  };

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden">
      {/* 1. SCROLLABLE CONTENT BODY */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4">
        {/* Banner Header Komparasi SPARTA */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#E65F2B] shadow-2xs">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E65F2B] bg-orange-100/80 px-2 py-0.5 rounded-md">
                  SOP SAT/SOP/DCB/003
                </span>
                <span className="text-slate-300 text-xs">•</span>
                <span className="text-xs text-slate-500 font-mono">No. Aanwijzing: {klarifikasi.nomor_klarifikasi}</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">{klarifikasi.project?.nama_proyek}</h1>
              <p className="text-xs text-slate-500">
                Cabang: <span className="font-semibold text-slate-700">{klarifikasi.cabang}</span> • Target Durasi:{" "}
                <span className="font-semibold text-slate-700">{klarifikasi.durasi_hari_akhir} Hari</span>
              </p>
            </div>
          </div>

          {backUrl && (
            <Link href={backUrl}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-9 px-4 rounded-xl font-medium cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                {backLabel}
              </Button>
            </Link>
          )}
        </div>

        {/* Kartu Ringkasan Atas: Owner Estimate (OE) & Rekanan Side-by-Side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Kolom OE SPARTA: Clean White Card Enterprise SPARTA */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  Owner Estimate (OE)
                </span>
                <span className="text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 px-2 py-0.5 rounded-md">
                  PAGU B&amp;M
                </span>
              </div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                Rp {formatNumber(totalOe)}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>Target Durasi:</span>
              <span className="font-bold text-slate-800 font-mono">{klarifikasi.durasi_hari_akhir} Hari</span>
            </div>
          </div>

          {/* Kolom Tiap Kontraktor */}
          {penawaranList.map((p, idx) => {
            const deviasiPersen = totalOe > 0 ? ((p.grand_total - totalOe) / totalOe) * 100 : 0;
            const isWinner = p.status === "MENANG";

            return (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  isWinner
                    ? "bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-500 shadow-sm"
                    : "bg-white border-slate-200/80 shadow-xs hover:border-slate-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                      Rekanan #{idx + 1}
                    </span>
                    {isWinner ? (
                      <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full flex items-center shadow-2xs">
                        <Trophy className="w-3 h-3 mr-1" /> PEMENANG
                      </span>
                    ) : (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        p.status === "SIAP_KOMPARASI"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {p.status === "SIAP_KOMPARASI" ? "SIAP KOMPARASI" : p.status}
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-slate-900 truncate mt-1 text-sm" title={p.vendor_nama}>
                    {p.vendor_nama}
                  </div>
                  <div className="text-lg font-bold font-mono text-[#E65F2B] mt-0.5">
                    Rp {formatNumber(p.grand_total)}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span
                    className={`font-bold font-mono flex items-center ${
                      deviasiPersen <= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {deviasiPersen >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                    {deviasiPersen >= 0 ? `+${deviasiPersen.toFixed(1)}%` : `${deviasiPersen.toFixed(1)}%`}
                  </span>
                  <span className="text-slate-500 font-medium font-mono">{p.durasi_pekerjaan_hari} Hari</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tab Kontrol Matriks BoQ vs Timeline */}
        <div className="flex space-x-2 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("BOQ")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "BOQ" ? "bg-[#E65F2B] text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Matriks Perbandingan RAB
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("TIMELINE")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "TIMELINE" ? "bg-[#E65F2B] text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Komparasi Gantchart ({penawaranList.length} Rekanan)
          </button>
        </div>

        {/* KONTEN TAB 1: MATRIKS BOQ FINANSIAL TERSTRUKTUR (SIPIL & ME + KATEGORI) */}
        {activeTab === "BOQ" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Header Card / Toolbar */}
            <div className="p-4 border-b border-slate-200/80 bg-white flex items-center justify-between flex-wrap gap-3 shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-sm md:text-base">
                  Matriks Rincian Penawaran
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Perbandingan harga per item pekerjaan vs Owner Estimate (OE), terkelompok per lingkup dan kategori pekerjaan
                </p>
              </div>

              {/* Kontrol Navigasi & Indikator */}
              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                <span className="text-xs text-slate-500 font-medium bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/60 hidden sm:inline-flex items-center">
                  Highlight <span className="text-emerald-700 font-bold mx-1">hijau</span>: paling kompetitif
                </span>

                {/* Tombol Geser Horizontal Cepat */}
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleScrollTable("left")}
                    className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg cursor-pointer"
                    title="Geser Tabel ke Kiri"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-[10px] text-slate-500 font-mono font-medium px-1">Geser</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleScrollTable("right")}
                    className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg cursor-pointer"
                    title="Geser Tabel ke Kanan"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Table Container dengan Freeze Panes & Scroll Mandiri */}
            <div
              ref={tableScrollRef}
              className="overflow-auto scrollbar-thin scrollbar-thumb-slate-300 max-h-[72vh] bg-white"
            >
              <table className="w-full min-w-max text-left border-separate border-spacing-0 text-xs">
                <thead>
                  <tr className="bg-slate-50/95 text-slate-600 uppercase font-semibold text-[11px] tracking-wider">
                    {/* Kolom 1 (No) - Sticky Left */}
                    <th className="py-3 px-2 w-12 min-w-[48px] text-center sticky left-0 top-0 z-40 bg-slate-50 border-b border-r border-slate-200/80 shadow-[1px_0_0_rgba(0,0,0,0.05)]">
                      No
                    </th>
                    {/* Kolom 2 (Uraian) - Sticky Left */}
                    <th className="py-3 px-3.5 min-w-[260px] max-w-[340px] text-left sticky left-[48px] top-0 z-40 bg-slate-50 border-b border-r border-slate-200/80 shadow-[3px_0_6px_rgba(0,0,0,0.04)]">
                      Uraian Item Pekerjaan
                    </th>
                    {/* Kolom 3 (Volume) */}
                    <th className="py-3 px-3 w-24 min-w-[96px] text-center sticky top-0 z-30 bg-slate-50 border-b border-r border-slate-200/80">
                      Volume
                    </th>
                    {/* Kolom 4 (Harga OE) */}
                    <th className="py-3 px-3.5 w-44 min-w-[170px] text-right sticky top-0 z-30 bg-slate-100/95 border-b border-r border-slate-200/80">
                      <div className="font-bold text-slate-800">Harga OE (Rp)</div>
                      <div className="text-[10px] text-slate-400 lowercase font-mono">
                        Owner Estimate
                      </div>
                    </th>
                    {/* Kolom Rekanan Kontraktor */}
                    {penawaranList.map((p) => (
                      <th
                        key={p.id}
                        className="py-3 px-3.5 min-w-[185px] w-52 text-right sticky top-0 z-30 bg-slate-50 border-b border-r border-slate-200/80"
                      >
                        <div className="truncate font-bold text-slate-900" title={p.vendor_nama}>
                          {p.vendor_nama}
                        </div>
                        <div className="text-[10px] text-slate-400 lowercase font-mono">
                          Total Biaya (Rp)
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* 1. SEKSI A: PEKERJAAN SIPIL */}
                  {sipilItems.length > 0 && (
                    <>
                      <tr className="bg-orange-50/90 border-y border-orange-200/90">
                        {/* Fixed Kolom 1 (No) */}
                        <td className="py-2.5 px-2 text-center sticky left-0 z-20 bg-orange-50 border-b border-r border-orange-200 w-12 min-w-[48px]">
                          <span className="w-5 h-5 rounded-md bg-[#E65F2B] text-white text-[11px] font-bold inline-flex items-center justify-center">
                            A
                          </span>
                        </td>
                        {/* Fixed Kolom 2 (Uraian) */}
                        <td className="py-2.5 px-3.5 sticky left-[48px] z-20 bg-orange-50 border-b border-r border-orange-200 min-w-[260px] max-w-[340px] shadow-[3px_0_6px_rgba(0,0,0,0.04)]">
                          <span className="font-bold text-slate-800 text-xs uppercase tracking-wider whitespace-nowrap">
                            PEKERJAAN SIPIL ({sipilItems.length} Item)
                          </span>
                        </td>
                        {/* Sisa Kolom dengan Subtotal OE di sebelah kanan */}
                        <td colSpan={totalColumns - 2} className="py-2.5 px-3.5 bg-orange-50/95 border-b border-orange-200 text-right">
                          <span className="text-[11px] font-mono font-bold text-[#E65F2B] whitespace-nowrap">
                            Subtotal OE: Rp {formatNumber(subtotalOeSipil)}
                          </span>
                        </td>
                      </tr>

                      {sipilCategories.map((catGroup) => (
                        <React.Fragment key={`sipil-${catGroup.kategori}`}>
                          <tr className="bg-slate-50 border-y border-slate-200/60">
                            {/* Fixed Kolom 1 (No) */}
                            <td className="py-1.5 px-2 text-center sticky left-0 z-20 bg-slate-50 border-b border-r border-slate-200/60 w-12 min-w-[48px]" />
                            {/* Fixed Kolom 2 (Uraian) */}
                            <td className="py-1.5 px-3.5 sticky left-[48px] z-20 bg-slate-50 border-b border-r border-slate-200/60 min-w-[260px] max-w-[340px] shadow-[3px_0_6px_rgba(0,0,0,0.04)]">
                              <div className="flex items-center space-x-1.5 text-slate-700 font-bold text-[11px]">
                                <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                <span className="truncate">{catGroup.kategori} ({catGroup.list.length} Item)</span>
                              </div>
                            </td>
                            {/* Sisa Kolom */}
                            <td colSpan={totalColumns - 2} className="py-1.5 px-3.5 bg-slate-50 border-b border-slate-200/60" />
                          </tr>

                          {catGroup.list.map((it: any) => {
                            const itemIndex = (klarifikasi.items || []).findIndex((x: any) => x.id === it.id) + 1;
                            const oeTotal = it.total_biaya_akhir || 0;

                            // Cari harga terendah dari seluruh rekanan untuk baris ini
                            const prices = penawaranList.map((p) => {
                              const match = p.items?.find((pi: any) => pi.klarifikasi_item_id === it.id);
                              return match ? match.total_harga || 0 : 0;
                            });
                            const validPrices = prices.filter((pr) => pr > 0);
                            const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;

                            return (
                              <tr key={it.id} className="hover:bg-slate-50/70 transition-colors group">
                                {/* Sticky No */}
                                <td className="py-2.5 px-2 text-center text-slate-400 font-mono sticky left-0 z-20 bg-white group-hover:bg-slate-50 border-b border-r border-slate-100 w-12 min-w-[48px]">
                                  {itemIndex}
                                </td>

                                {/* Sticky Uraian Item Pekerjaan */}
                                <td className="py-2.5 px-3.5 sticky left-[48px] z-20 bg-white group-hover:bg-slate-50 border-b border-r border-slate-200/80 min-w-[260px] max-w-[340px] shadow-[3px_0_6px_rgba(0,0,0,0.04)]">
                                  <div className="font-semibold text-slate-800 text-[12px]">{it.deskripsi}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">{it.kategori_pekerjaan}</div>
                                </td>

                                {/* Volume */}
                                <td className="py-2.5 px-3 text-center font-mono text-slate-600 border-b border-r border-slate-100 whitespace-nowrap min-w-[96px]">
                                  {it.volume_akhir} {it.satuan}
                                </td>

                                {/* Harga OE */}
                                <td className="py-2.5 px-3.5 text-right font-mono bg-slate-50/80 font-semibold text-slate-700 border-b border-r border-slate-100 whitespace-nowrap min-w-[170px]">
                                  Rp {formatNumber(oeTotal)}
                                </td>

                                {/* Rekanan Penawaran Columns */}
                                {penawaranList.map((p) => {
                                  const match = p.items?.find((pi: any) => pi.klarifikasi_item_id === it.id);
                                  const price = match ? match.total_harga || 0 : 0;
                                  const isCheapest = price > 0 && price === minPrice;

                                  return (
                                    <td
                                      key={p.id}
                                      className={`py-2.5 px-3.5 text-right font-mono border-b border-r border-slate-100 whitespace-nowrap min-w-[185px] ${
                                        isCheapest
                                          ? "bg-emerald-50/70 font-bold text-emerald-800"
                                          : "font-medium text-slate-800"
                                      }`}
                                    >
                                      {price > 0 ? (
                                        <span>Rp {formatNumber(price)}</span>
                                      ) : (
                                        <span className="text-slate-400 italic text-[11px]">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}

                      {/* Subtotal Pekerjaan Sipil */}
                      <tr className="bg-slate-100/90 font-bold text-slate-900">
                        <td className="py-2.5 px-2 text-center sticky left-0 z-20 bg-slate-100 border-t-2 border-b border-slate-200 border-r w-12 min-w-[48px]" />
                        <td className="py-2.5 px-3.5 text-right uppercase text-[11px] tracking-wide text-slate-700 sticky left-[48px] z-20 bg-slate-100 border-t-2 border-b border-slate-200 border-r min-w-[260px] max-w-[340px] shadow-[3px_0_6px_rgba(0,0,0,0.04)]">
                          Subtotal Pekerjaan Sipil :
                        </td>
                        <td className="py-2.5 px-3 text-center bg-slate-100 border-t-2 border-b border-slate-200 border-r min-w-[96px]" />
                        <td className="py-2.5 px-3.5 text-right font-mono bg-slate-200/70 text-slate-900 border-t-2 border-b border-slate-200 border-r whitespace-nowrap min-w-[170px]">
                          Rp {formatNumber(subtotalOeSipil)}
                        </td>
                        {penawaranList.map((p) => {
                          const pSipilTotal = getContractorScopeTotal(p, sipilItems);
                          return (
                            <td key={p.id} className="py-2.5 px-3.5 text-right font-mono text-[#E65F2B] border-t-2 border-b border-slate-200 border-r whitespace-nowrap min-w-[185px]">
                              Rp {formatNumber(pSipilTotal)}
                            </td>
                          );
                        })}
                      </tr>
                    </>
                  )}

                  {/* 2. SEKSI B: PEKERJAAN MEKANIKAL & ELEKTRIKAL (ME) */}
                  {meItems.length > 0 && (
                    <>
                      <tr className="bg-orange-50/90 border-y border-orange-200/90">
                        {/* Fixed Kolom 1 (No) */}
                        <td className="py-2.5 px-2 text-center sticky left-0 z-20 bg-orange-50 border-b border-r border-orange-200 w-12 min-w-[48px]">
                          <span className="w-5 h-5 rounded-md bg-[#E65F2B] text-white text-[11px] font-bold inline-flex items-center justify-center">
                            B
                          </span>
                        </td>
                        {/* Fixed Kolom 2 (Uraian) */}
                        <td className="py-2.5 px-3.5 sticky left-[48px] z-20 bg-orange-50 border-b border-r border-orange-200 min-w-[260px] max-w-[340px] shadow-[3px_0_6px_rgba(0,0,0,0.04)]">
                          <span className="font-bold text-slate-800 text-xs uppercase tracking-wider whitespace-nowrap">
                            PEKERJAAN MEKANIKAL &amp; ELEKTRIKAL (ME) ({meItems.length} Item)
                          </span>
                        </td>
                        {/* Sisa Kolom dengan Subtotal OE di sebelah kanan */}
                        <td colSpan={totalColumns - 2} className="py-2.5 px-3.5 bg-orange-50/95 border-b border-orange-200 text-right">
                          <span className="text-[11px] font-mono font-bold text-[#E65F2B] whitespace-nowrap">
                            Subtotal OE: Rp {formatNumber(subtotalOeMe)}
                          </span>
                        </td>
                      </tr>

                      {meCategories.map((catGroup) => (
                        <React.Fragment key={`me-${catGroup.kategori}`}>
                          <tr className="bg-slate-50 border-y border-slate-200/60">
                            {/* Fixed Kolom 1 (No) */}
                            <td className="py-1.5 px-2 text-center sticky left-0 z-20 bg-slate-50 border-b border-r border-slate-200/60 w-12 min-w-[48px]" />
                            {/* Fixed Kolom 2 (Uraian) */}
                            <td className="py-1.5 px-3.5 sticky left-[48px] z-20 bg-slate-50 border-b border-r border-slate-200/60 min-w-[260px] max-w-[340px] shadow-[3px_0_6px_rgba(0,0,0,0.04)]">
                              <div className="flex items-center space-x-1.5 text-slate-700 font-bold text-[11px]">
                                <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                <span className="truncate">{catGroup.kategori} ({catGroup.list.length} Item)</span>
                              </div>
                            </td>
                            {/* Sisa Kolom */}
                            <td colSpan={totalColumns - 2} className="py-1.5 px-3.5 bg-slate-50 border-b border-slate-200/60" />
                          </tr>

                          {catGroup.list.map((it: any) => {
                            const itemIndex = (klarifikasi.items || []).findIndex((x: any) => x.id === it.id) + 1;
                            const oeTotal = it.total_biaya_akhir || 0;

                            const prices = penawaranList.map((p) => {
                              const match = p.items?.find((pi: any) => pi.klarifikasi_item_id === it.id);
                              return match ? match.total_harga || 0 : 0;
                            });
                            const validPrices = prices.filter((pr) => pr > 0);
                            const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;

                            return (
                              <tr key={it.id} className="hover:bg-slate-50/70 transition-colors group">
                                {/* Sticky No */}
                                <td className="py-2.5 px-2 text-center text-slate-400 font-mono sticky left-0 z-20 bg-white group-hover:bg-slate-50 border-b border-r border-slate-100 w-12 min-w-[48px]">
                                  {itemIndex}
                                </td>

                                {/* Sticky Uraian Item Pekerjaan */}
                                <td className="py-2.5 px-3.5 sticky left-[48px] z-20 bg-white group-hover:bg-slate-50 border-b border-r border-slate-200/80 min-w-[260px] max-w-[340px] shadow-[3px_0_6px_rgba(0,0,0,0.04)]">
                                  <div className="font-semibold text-slate-800 text-[12px]">{it.deskripsi}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">{it.kategori_pekerjaan}</div>
                                </td>

                                {/* Volume */}
                                <td className="py-2.5 px-3 text-center font-mono text-slate-600 border-b border-r border-slate-100 whitespace-nowrap min-w-[96px]">
                                  {it.volume_akhir} {it.satuan}
                                </td>

                                {/* Harga OE */}
                                <td className="py-2.5 px-3.5 text-right font-mono bg-slate-50/80 font-semibold text-slate-700 border-b border-r border-slate-100 whitespace-nowrap min-w-[170px]">
                                  Rp {formatNumber(oeTotal)}
                                </td>

                                {/* Rekanan Penawaran Columns */}
                                {penawaranList.map((p) => {
                                  const match = p.items?.find((pi: any) => pi.klarifikasi_item_id === it.id);
                                  const price = match ? match.total_harga || 0 : 0;
                                  const isCheapest = price > 0 && price === minPrice;

                                  return (
                                    <td
                                      key={p.id}
                                      className={`py-2.5 px-3.5 text-right font-mono border-b border-r border-slate-100 whitespace-nowrap min-w-[185px] ${
                                        isCheapest
                                          ? "bg-emerald-50/70 font-bold text-emerald-800"
                                          : "font-medium text-slate-800"
                                      }`}
                                    >
                                      {price > 0 ? (
                                        <span>Rp {formatNumber(price)}</span>
                                      ) : (
                                        <span className="text-slate-400 italic text-[11px]">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))}

                      {/* Subtotal Pekerjaan ME */}
                      <tr className="bg-slate-100/90 font-bold text-slate-900">
                        <td className="py-2.5 px-2 text-center sticky left-0 z-20 bg-slate-100 border-t-2 border-b border-slate-200 border-r w-12 min-w-[48px]" />
                        <td className="py-2.5 px-3.5 text-right uppercase text-[11px] tracking-wide text-slate-700 sticky left-[48px] z-20 bg-slate-100 border-t-2 border-b border-slate-200 border-r min-w-[260px] max-w-[340px] shadow-[3px_0_6px_rgba(0,0,0,0.04)]">
                          Subtotal Pekerjaan ME :
                        </td>
                        <td className="py-2.5 px-3 text-center bg-slate-100 border-t-2 border-b border-slate-200 border-r min-w-[96px]" />
                        <td className="py-2.5 px-3.5 text-right font-mono bg-slate-200/70 text-slate-900 border-t-2 border-b border-slate-200 border-r whitespace-nowrap min-w-[170px]">
                          Rp {formatNumber(subtotalOeMe)}
                        </td>
                        {penawaranList.map((p) => {
                          const pMeTotal = getContractorScopeTotal(p, meItems);
                          return (
                            <td key={p.id} className="py-2.5 px-3.5 text-right font-mono text-[#E65F2B] border-t-2 border-b border-slate-200 border-r whitespace-nowrap min-w-[185px]">
                              Rp {formatNumber(pMeTotal)}
                            </td>
                          );
                        })}
                      </tr>
                    </>
                  )}
                </tbody>

                {/* TFOOT: Grand Total Rekapitulasi Penawaran vs OE */}
                <tfoot>
                  <tr className="bg-slate-50 font-bold text-slate-900 text-xs">
                    <td className="py-3.5 px-2 text-center sticky left-0 bottom-0 z-35 bg-slate-100 border-t-2 border-slate-300 border-r w-12 min-w-[48px]" />
                    <td className="py-3.5 px-3.5 text-right uppercase text-[11px] tracking-wider text-slate-800 sticky left-[48px] bottom-0 z-35 bg-slate-100 border-t-2 border-slate-300 border-r min-w-[260px] max-w-[340px] shadow-[3px_0_6px_rgba(0,0,0,0.04)]">
                      Grand Total Rekapitulasi :
                    </td>
                    <td className="py-3.5 px-3 text-center sticky bottom-0 z-30 bg-slate-100 border-t-2 border-slate-300 border-r min-w-[96px]" />
                    <td className="py-3.5 px-3.5 text-right font-mono bg-slate-200 text-slate-900 text-sm sticky bottom-0 z-30 border-t-2 border-slate-300 border-r whitespace-nowrap min-w-[170px]">
                      Rp {formatNumber(totalOe)}
                    </td>
                    {penawaranList.map((p) => {
                      const deviasiPersen = totalOe > 0 ? ((p.grand_total - totalOe) / totalOe) * 100 : 0;
                      return (
                        <td
                          key={p.id}
                          className="py-3.5 px-3.5 text-right sticky bottom-0 z-30 bg-slate-50 border-t-2 border-slate-300 border-r whitespace-nowrap min-w-[185px]"
                        >
                          <div className="font-mono text-sm text-[#E65F2B]">
                            Rp {formatNumber(p.grand_total)}
                          </div>
                          <div
                            className={`text-[10px] font-mono font-bold mt-0.5 ${
                              deviasiPersen <= 0 ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {deviasiPersen >= 0 ? `+${deviasiPersen.toFixed(1)}%` : `${deviasiPersen.toFixed(1)}%`}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* KONTEN TAB 2: VISUAL GANTT CHART BERURUTAN PER KONTRAKTOR */}
        {activeTab === "TIMELINE" && (
          <div className="space-y-6">
            {/* Header Info Komparasi Gantt */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-800 text-sm">
                  Komparasi Jadwal &amp; Gantt Chart Pelaksanaan Proyek
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visualisasi jadwal kerja hierarki (Sipil/ME, kategori pekerjaan, durasi, dan keterikatan) per masing-masing kontraktor
                </p>
              </div>
              <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
                <span className="bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700 font-bold">
                  Target Proyek: {klarifikasi.durasi_hari_akhir} Hari
                </span>
                <span className="bg-orange-50 text-[#E65F2B] border border-orange-200/60 px-2.5 py-1 rounded-lg font-bold">
                  {penawaranList.length} Rekanan
                </span>
              </div>
            </div>

            {/* Daftar Visual Gantt Chart per Kontraktor */}
            {penawaranList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400">
                Belum ada berkas penawaran rekanan yang dapat dikomparasikan jadwalnya.
              </div>
            ) : (
              penawaranList.map((p, idx) => {
                const isWinner = p.status === "MENANG";
                const deviasiHari = p.durasi_pekerjaan_hari - (klarifikasi.durasi_hari_akhir || 0);

                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border overflow-hidden shadow-xs space-y-3 bg-white ${
                      isWinner ? "border-emerald-300 ring-2 ring-emerald-500/30" : "border-slate-200/80"
                    }`}
                  >
                    {/* Header Tiap Rekanan Kontraktor */}
                    <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#E65F2B] font-bold text-sm shrink-0 shadow-2xs">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="font-bold text-slate-900 text-sm md:text-base">
                              {p.vendor_nama || p.vendor?.nama_perusahaan}
                            </h4>
                            {isWinner && (
                              <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full flex items-center shadow-2xs">
                                <Trophy className="w-3 h-3 mr-1" /> PEMENANG
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              p.status === "SIAP_KOMPARASI"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-200/80 text-slate-600"
                            }`}>
                              {p.status === "SIAP_KOMPARASI" ? "SIAP KOMPARASI" : p.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center space-x-2 mt-0.5">
                            <span className="font-mono">{p.nomor_penawaran}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-400">{p.vendor_email || p.vendor?.email}</span>
                          </div>
                        </div>
                      </div>

                      {/* Info Finansial & Durasi Kontraktor */}
                      <div className="flex items-center space-x-4 self-end md:self-auto text-xs">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 block">Total Penawaran:</span>
                          <span className="font-bold font-mono text-[#E65F2B] text-sm">
                            Rp {formatNumber(p.grand_total)}
                          </span>
                        </div>
                        <div className="h-7 w-[1px] bg-slate-200" />
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 block">Durasi Kerja:</span>
                          <div className="flex items-center space-x-1 font-mono">
                            <span className="font-bold text-slate-900 text-sm">{p.durasi_pekerjaan_hari} Hari</span>
                            {deviasiHari !== 0 && (
                              <span className={`text-[10px] font-bold ${deviasiHari < 0 ? "text-emerald-600" : "text-amber-600"}`}>
                                ({deviasiHari > 0 ? `+${deviasiHari}` : deviasiHari} hr)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Visual Gantt Chart Interaktif (Read Only) */}
                    <div className="p-4 pt-1">
                      <GanttChartInteractive
                        penawaran={p}
                        totalDays={klarifikasi.durasi_hari_akhir || p.durasi_pekerjaan_hari}
                        readOnly={true}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 2. FIXED BOTTOM DOCK BAR (Menu Penetapan Pemenang Fixed di Bawah) */}
      <div className="shrink-0 bg-white border-t border-slate-200/80 px-4 md:px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] z-40">
        {/* Sisi Kiri: Tombol Kembali & Info Proyek */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
          {backUrl && (
            <Link href={backUrl}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-9 px-4 rounded-xl font-medium cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                {backLabel}
              </Button>
            </Link>
          )}
          <div className="text-xs text-slate-500 font-medium hidden sm:flex items-center gap-2">
            <span>Paket: <strong className="text-slate-800">{klarifikasi.project?.nama_proyek}</strong></span>
            <span>•</span>
            <span>Cabang: <strong className="text-slate-800">{klarifikasi.cabang}</strong></span>
            <span>•</span>
            <span className="text-slate-600 font-semibold">{penawaranList.length} Rekanan Terdaftar</span>
          </div>
        </div>

        {/* Sisi Kanan: Status Wadah & Tombol Penetapan Pemenang */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
          {/* Status Wadah Pill */}
          {currentWinner ? (
            <div className="hidden lg:flex items-center space-x-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-xl">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tender Selesai • Masuk Proses Selanjutnya</span>
            </div>
          ) : canProceedWithWinner ? (
            <div className="hidden lg:flex items-center space-x-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-xl">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {readyToWinPenawaran.length} Rekanan Siap di Wadah
                {unsubmittedPeserta.length > 0 && isTenderPassed && ` (${unsubmittedPeserta.length} Tereliminasi)`}
              </span>
            </div>
          ) : (
            <div className="hidden lg:flex items-center space-x-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
              <span>
                {pendingReviewPenawaran.length > 0
                  ? `${pendingReviewPenawaran.length} Rekanan Menunggu Approval`
                  : isWaitingForUnsubmitted
                  ? "Menunggu Batas Waktu Tender"
                  : "Menunggu Rekanan Disetujui"}
              </span>
            </div>
          )}

          {/* Tombol Tetapkan Pemenang Lelang ATAU Tampilan Pemenang Final & Terkunci */}
          {currentWinner ? (
            <div
              className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs select-none"
              title="Pemenang lelang telah resmi ditetapkan dan bersifat final (tidak dapat diubah lagi)."
            >
              <Trophy className="w-4 h-4 text-amber-300" />
              <span>Pemenang: {currentWinner.vendor_nama}</span>
              <span className="text-[10px] bg-white/25 text-white font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ml-1">
                FINAL &amp; TERKUNCI
              </span>
            </div>
          ) : (
            <div className="relative group">
              <Button
                type="button"
                disabled={!canSelectWinner || !canProceedWithWinner}
                onClick={() => setIsWinnerModalOpen(true)}
                className="text-xs h-9 px-5 rounded-xl font-bold shadow-xs transition-all cursor-pointer flex items-center space-x-2 bg-[#E65F2B] hover:bg-[#d04f1f] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Award className="w-4 h-4 mr-1" />
                <span>Tetapkan Pemenang Tender</span>
              </Button>

              {/* Popover Peringatan Kesiapan / Hak Akses (Desain Enterprise SPARTA, Bebas Tumpukan) */}
              {(!canSelectWinner || !canProceedWithWinner) && (
                <div className="absolute bottom-full right-0 mb-3.5 hidden group-hover:block z-50 w-96 max-w-[calc(100vw-32px)] bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-900/10 pointer-events-none animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                  {/* Popover Header */}
                  <div className="bg-amber-50/80 border-b border-amber-100/90 px-3.5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-lg bg-amber-100 border border-amber-200/80 flex items-center justify-center text-amber-700 shrink-0">
                        <AlertCircle className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-slate-900">
                        {!canSelectWinner ? "Akses Belum Memenuhi Wewenang" : "Penetapan Pemenang Belum Siap"}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md bg-amber-200/70 text-amber-800">
                      {!canSelectWinner ? "Hak Akses" : "Perlu Tindakan"}
                    </span>
                  </div>

                  {/* Popover Body */}
                  <div className="p-3.5 space-y-2.5 text-xs">
                    {!canSelectWinner ? (
                      <div className="space-y-1.5">
                        <p className="text-slate-600 leading-relaxed">
                          Akun Anda saat ini tidak memiliki hak wewenang untuk menetapkan pemenang lelang pada paket tender ini.
                        </p>
                        <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-2.5 text-[11px] space-y-1">
                          <div className="font-semibold text-slate-800">Ketentuan Wewenang SOP SAT/SOP/DCB/003:</div>
                          <div className="text-slate-600 flex items-start space-x-1.5">
                            <span className="text-[#E65F2B] font-bold">•</span>
                            <span>
                              Paket lelang bernilai <strong>{totalOe < 1_000_000_000 ? "< Rp 1 Miliar" : "≥ Rp 1 Miliar"}</strong> (OE: Rp {formatNumber(totalOe)}) adalah wewenang eksklusif{" "}
                              <strong>{totalOe < 1_000_000_000 ? "Branch Building & Maintenance (BBM) Manager" : "DC Development Specialist"}</strong>.
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-slate-600 leading-relaxed">
                          {readinessMessage}
                        </p>
                        <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-2.5 text-[11px] space-y-1.5">
                          <div className="font-semibold text-slate-800 flex items-center justify-between">
                            <span>Langkah Penyelesaian:</span>
                            <span className="text-[10px] text-amber-600 font-bold">Wajib Lengkap</span>
                          </div>
                          {pendingReviewPenawaran.length > 0 && (
                            <div className="text-slate-600 flex items-start space-x-1.5">
                              <span className="text-amber-500 font-bold">1.</span>
                              <span>
                                Buka menu <strong>Approval Penawaran</strong> dan setujui seluruh berkas rekanan hingga berstatus <strong>SIAP KOMPARASI</strong>.
                              </span>
                            </div>
                          )}
                          {isWaitingForUnsubmitted && (
                            <div className="text-slate-600 flex items-start space-x-1.5">
                              <span className="text-amber-500 font-bold">2.</span>
                              <span>
                                Tunggu hingga batas waktu tanggal tender berakhir (rekanan yang tidak submit otomatis tereliminasi).
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Panah / Caret Bawah yang menghubungkan ke Tombol */}
                  <div className="w-3 h-3 bg-white border-r border-b border-slate-200/90 rotate-45 transform absolute -bottom-1.5 right-10 shadow-xs" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. POP-UP MODAL PENETAPAN REKANAN PEMENANG TENDER (Hanya aktif jika belum ada pemenang) */}
      {isWinnerModalOpen && !currentWinner && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 md:p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#E65F2B] shrink-0 shadow-2xs">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-slate-900 text-base">Penetapan Rekanan Pemenang Tender</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      totalOe < 1_000_000_000
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-purple-50 text-purple-700 border border-purple-200"
                    }`}>
                      {totalOe < 1_000_000_000 ? "Wewenang BBM Manager (< 1M)" : "Wewenang DC Specialist (≥ 1M)"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Paket: <strong className="text-slate-700">{klarifikasi.project?.nama_proyek}</strong> • Cabang: {klarifikasi.cabang}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWinnerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dropdown ComboBox: Pilih Kontraktor Pemenang */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Pilih Rekanan Kontraktor Pemenang <span className="text-rose-500">*</span>
              </label>
              <SearchableSelectInput
                value={selectedWinnerId ? String(selectedWinnerId) : ""}
                onChange={(val) => setSelectedWinnerId(val ? parseInt(val) : null)}
                options={winnerOptions}
                placeholder="-- Ketik atau Pilih Rekanan Pemenang --"
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              />
              <p className="text-[11px] text-slate-400">
                Hanya rekanan yang telah disetujui masuk Wadah Komparasi ({readyToWinPenawaran.length} Rekanan) yang tersedia pada pilihan.
              </p>
            </div>

            {/* Card Ringkasan Rekanan Terpilih */}
            {selectedContractor && (
              <div className="bg-orange-50/60 border border-orange-200/80 rounded-xl p-3 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{selectedContractor.vendor_nama}</span>
                  <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-orange-200 text-[#E65F2B]">
                    {selectedContractor.nomor_penawaran}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-orange-200/60 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Nilai Penawaran:</span>
                    <span className="font-bold font-mono text-[#E65F2B] text-xs">
                      Rp {formatNumber(selectedContractor.grand_total)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Deviasi vs OE:</span>
                    <span
                      className={`font-bold font-mono ${
                        selectedContractor.grand_total <= totalOe ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {totalOe > 0
                        ? `${(((selectedContractor.grand_total - totalOe) / totalOe) * 100).toFixed(1)}%`
                        : "0%"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Durasi Kerja:</span>
                    <span className="font-bold font-mono text-slate-800">
                      {selectedContractor.durasi_pekerjaan_hari} Hari
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Input Alasan Penetapan Pemenang */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Alasan Penetapan Pemenang <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={alasanPenetapan}
                onChange={(e) => setAlasanPenetapan(e.target.value)}
                placeholder="Contoh: Penawaran paling kompetitif di bawah OE dengan metode kerja optimal..."
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#E65F2B] text-slate-800 font-medium"
              />
            </div>

            {/* Input Catatan / Dasar Pertimbangan Keputusan */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Catatan Tambahan Keputusan (Opsional)
              </label>
              <textarea
                rows={2}
                value={catatanKeputusan}
                onChange={(e) => setCatatanKeputusan(e.target.value)}
                placeholder="Catatan mengenai evaluasi asuransi, metodologi pekerjaan, atau instruksi pra-kontrak..."
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-[#E65F2B] text-slate-800 resize-none"
              />
            </div>

            {/* Warning Alert */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Penetapan ini akan resmi mencatat rekanan terpilih sebagai <strong>MENANG</strong> dan rekanan lainnya sebagai <strong>TIDAK MENANG</strong> pada paket lelang proyek ini.
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsWinnerModalOpen(false)}
                className="text-xs h-9 px-4 rounded-xl border-slate-300 text-slate-700 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={!selectedWinnerId || !alasanPenetapan.trim() || submittingWinner}
                onClick={handleConfirmWinner}
                className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs h-9 px-5 rounded-xl font-bold shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingWinner ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Tetapkan Sebagai Pemenang
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK MODAL */}
      <FeedbackModal
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => {
          setFeedback((prev) => ({ ...prev, isOpen: false }));
          if (feedback.type === "success") {
            router.refresh();
          }
        }}
      />
    </div>
  );
}
