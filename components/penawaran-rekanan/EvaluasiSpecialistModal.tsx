"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  RotateCcw,
  AlertTriangle,
  Lock,
  Loader2,
  ShieldCheck,
  X,
  Folder,
  Layers,
  CheckCircle2,
  CheckSquare,
  Square,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "@/components/ui/feedback-modal";

interface EvaluasiSpecialistModalProps {
  isOpen: boolean;
  onClose: () => void;
  penawaran: any;
  klarifikasi?: any;
}

export default function EvaluasiSpecialistModal({
  isOpen,
  onClose,
  penawaran,
  klarifikasi: _,
}: EvaluasiSpecialistModalProps) {
  const router = useRouter();
  const isResubmission = penawaran?.status === "DIAJUKAN_ULANG";

  const [modalTab, setModalTab] = useState<"SEMUA" | "SIPIL" | "ME" | "FLAGGED">("SEMUA");
  const [instruksi, setInstruksi] = useState(
    penawaran?.catatan_negosiasi_specialist || ""
  );

  // State item pekerjaan yang wajib dinegosiasikan
  const [flaggedItems, setFlaggedItems] = useState<
    Record<number, { flagged: boolean; catatan: string }>
  >(() => {
    const map: Record<number, { flagged: boolean; catatan: string }> = {};
    (penawaran?.items || []).forEach((it: any) => {
      map[it.id] = {
        flagged: Boolean(it.is_flagged_specialist),
        catatan: it.catatan_specialist || "",
      };
    });
    return map;
  });

  // State jadwal durasi yang disoroti
  const [flaggedGantt, setFlaggedGantt] = useState<
    Record<number, { flagged: boolean; catatan: string }>
  >(() => {
    const map: Record<number, { flagged: boolean; catatan: string }> = {};
    (penawaran?.gantt_items || []).forEach((g: any) => {
      map[g.item_id] = {
        flagged: Boolean(g.is_flagged_durasi),
        catatan: g.catatan_durasi_specialist || "",
      };
    });
    return map;
  });

  const [submittingAction, setSubmittingAction] = useState<"SETUJU" | "NEGOSIASI" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const groupByCategory = (items: any[]) => {
    const map = new Map<string, any[]>();
    items.forEach((it) => {
      const cat = (it.kategori_pekerjaan || "Pekerjaan Lain-lain").trim();
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(it);
    });
    return Array.from(map.entries()).map(([kategori, list]) => ({
      kategori,
      list,
    }));
  };

  const allItems = useMemo(() => penawaran?.items || [], [penawaran?.items]);

  const itemsSipil = useMemo(
    () => allItems.filter((it: any) => (it.lingkup || "SIPIL").toUpperCase() === "SIPIL"),
    [allItems]
  );
  const itemsMe = useMemo(
    () => allItems.filter((it: any) => (it.lingkup || "").toUpperCase() === "ME"),
    [allItems]
  );

  const totalSipil = useMemo(
    () => itemsSipil.reduce((sum: number, it: any) => sum + (it.total_harga || 0), 0),
    [itemsSipil]
  );
  const totalMe = useMemo(
    () => itemsMe.reduce((sum: number, it: any) => sum + (it.total_harga || 0), 0),
    [itemsMe]
  );

  const sipilCategories = useMemo(() => groupByCategory(itemsSipil), [itemsSipil]);
  const meCategories = useMemo(() => groupByCategory(itemsMe), [itemsMe]);

  const toggleFlagItem = (id: number) => {
    if (isResubmission) return;
    setErrorMessage(null);
    setFlaggedItems((prev) => ({
      ...prev,
      [id]: {
        flagged: !prev[id]?.flagged,
        catatan: prev[id]?.catatan || "",
      },
    }));
  };

  const handleNoteChange = (id: number, val: string) => {
    setErrorMessage(null);
    setFlaggedItems((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        catatan: val,
      },
    }));
  };

  const totalFlagged = Object.values(flaggedItems).filter((v) => v.flagged).length;
  const checkedEntries = Object.entries(flaggedItems).filter(([_, v]) => v.flagged);
  const emptyNotesCount = checkedEntries.filter(([_, v]) => !v.catatan.trim()).length;

  // 1. Aksi Langsung Setujui (Masuk Wadah Pemilihan Pemenang)
  const handleDirectApprove = async () => {
    setErrorMessage(null);
    try {
      setSubmittingAction("SETUJU");
      const res = await fetch(
        `/api/dc-development/penawaran-rekanan/${penawaran.id}/negosiasi-specialist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "SETUJU",
            instruksi_negosiasi: instruksi.trim() || "Penawaran disetujui DC Specialist untuk masuk ke wadah pemilihan pemenang.",
          }),
        }
      );

      const json = await res.json();
      if (json.status === "success") {
        onClose();
        setFeedback({
          isOpen: true,
          type: "success",
          title: "Penawaran Berhasil Disetujui",
          message:
            "Penawaran rekanan (≥ Rp 1 Miliar) resmi disetujui oleh DC Specialist dan langsung dimasukkan ke wadah pemilihan pemenang lelang.",
        });
      } else {
        setFeedback({
          isOpen: true,
          type: "error",
          title: "Gagal Menyetujui Penawaran",
          message: json.message || "Terjadi kesalahan pada server.",
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
      setSubmittingAction(null);
    }
  };

  // 2. Aksi Kembalikan untuk Negosiasi
  const handleReturnForNegotiation = async () => {
    setErrorMessage(null);

    if (totalFlagged === 0) {
      setErrorMessage("Silakan pilih minimal 1 item pekerjaan yang wajib dinegosiasikan harganya.");
      return;
    }

    if (emptyNotesCount > 0) {
      setErrorMessage(
        `Terdapat ${emptyNotesCount} item pekerjaan yang ditandai namun belum memiliki catatan negosiasi. Setiap item yang disorot wajib diisi alasannya.`
      );
      return;
    }

    if (!instruksi.trim()) {
      setErrorMessage("Instruksi negosiasi resmi wajib diisi agar kontraktor memahami konteks perbaikan yang diminta.");
      return;
    }

    try {
      setSubmittingAction("NEGOSIASI");

      const payloadFlaggedItems = checkedEntries.map(([idStr, v]) => ({
        id: parseInt(idStr),
        catatan: v.catatan.trim(),
      }));

      const payloadGantt = Object.entries(flaggedGantt)
        .filter(([_, v]) => v.flagged)
        .map(([itemIdStr, v]) => ({
          item_id: parseInt(itemIdStr),
          catatan: v.catatan.trim(),
        }));

      const res = await fetch(
        `/api/dc-development/penawaran-rekanan/${penawaran.id}/negosiasi-specialist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "NEGOSIASI",
            instruksi_negosiasi: instruksi.trim(),
            flagged_items: payloadFlaggedItems,
            flagged_gantt_items: payloadGantt,
          }),
        }
      );

      const json = await res.json();
      if (json.status === "success") {
        onClose();
        setFeedback({
          isOpen: true,
          type: "success",
          title: "Negosiasi Berhasil Dikirim",
          message:
            "Instruksi negosiasi resmi dan rincian item yang disorot berhasil dikirimkan ke kontraktor untuk dilakukan penyesuaian penawaran.",
        });
      } else {
        setFeedback({
          isOpen: true,
          type: "error",
          title: "Gagal Mengembalikan Penawaran",
          message: json.message || "Terjadi kesalahan pada server.",
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
      setSubmittingAction(null);
    }
  };

  if (!isOpen && !feedback.isOpen) return null;

  const renderItemRow = (it: any, itemIndex: number) => {
    const isChecked = Boolean(flaggedItems[it.id]?.flagged);
    const itemCatatan = flaggedItems[it.id]?.catatan || "";
    const isNoteEmpty = isChecked && !itemCatatan.trim();

    if (modalTab === "FLAGGED" && !isChecked) return null;

    return (
      <div
        key={it.id}
        className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${isChecked
          ? "bg-amber-50/60 border-amber-300 ring-1 ring-amber-300/40 shadow-2xs"
          : "bg-white border-slate-200/80 hover:bg-slate-50/80"
          }`}
      >
        <div
          onClick={() => toggleFlagItem(it.id)}
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 select-none ${
            isResubmission ? "cursor-default" : "cursor-pointer"
          }`}
        >
          <div className="flex items-start sm:items-center space-x-3">
            {!isResubmission && (
              <div className="mt-0.5 sm:mt-0 shrink-0">
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 text-amber-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </div>
            )}
            <span className="w-5 text-center font-mono text-[11px] text-slate-400 shrink-0">
              {itemIndex}
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-800 text-xs md:text-sm">
                  {it.deskripsi}
                </span>
                {isChecked && (
                  <span className="inline-flex items-center text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded font-bold">
                    Wajib Negosiasi
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono mt-0.5">
                <span>Volume: <strong className="text-slate-700">{it.volume} {it.satuan}</strong></span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-400">{it.kategori_pekerjaan}</span>
              </div>
            </div>
          </div>

          <div className="text-right sm:shrink-0 pl-10 sm:pl-0">
            <div className="font-mono font-bold text-slate-900 text-xs md:text-sm">
              Rp {formatNumber(it.total_harga || 0)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Total Penawaran Rekanan
            </div>
          </div>
        </div>

        {isChecked && !isResubmission && (
          <div className="pt-2 pl-4 sm:pl-10 border-t border-amber-200/60 animate-in fade-in duration-150 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-amber-950 flex items-center">
                <span>Catatan Negosiasi untuk Rekanan (Wajib Diisi)*:</span>
              </label>
              {isNoteEmpty ? (
                <span className="text-[10px] text-rose-600 font-semibold flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" /> Wajib diisi alasan negosiasi
                </span>
              ) : (
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Catatan terisi
                </span>
              )}
            </div>
            <textarea
              rows={2}
              value={itemCatatan}
              onChange={(e) => handleNoteChange(it.id, e.target.value)}
              placeholder="Contoh: 'Harga satuan material terlalu tinggi dibanding OE, target negosiasi maks Rp 85.000/m2'..."
              className="w-full text-xs p-2.5 border border-amber-300 rounded-lg bg-white outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-slate-900"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 md:px-6 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100/80 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0 shadow-2xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                      Paket &ge; Rp 1 Miliar
                    </span>
                    <span className="text-slate-300 text-xs">•</span>
                    <span className="text-xs text-slate-600 font-semibold">
                      {penawaran.vendor_nama}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base md:text-lg mt-0.5">
                    Lembar Evaluasi Penawaran DC Development Specialist
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isResubmission
                      ? "Penelaahan pengajuan ulang pasca-negosiasi. Satu-satunya opsi adalah menyetujui penawaran untuk masuk ke wadah pemilihan pemenang."
                      : "Periksa rincian BoQ penawaran, tentukan apakah langsung disetujui atau dikembalikan ke kontraktor untuk negosiasi."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 md:p-6 overflow-y-auto space-y-4 flex-1 bg-[#FAFAFA]/60">
              {/* Banner Info / Status SOP */}
              {isResubmission ? (
                <div className="flex items-start space-x-2.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 p-3.5 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="block text-emerald-950">Tahap Akhir (Pasca-Negosiasi):</strong>
                    Dokumen ini merupakan hasil revisi yang telah diajukan ulang oleh rekanan kontraktor. Berdasarkan SOP pengadaan lelang DC, penawaran ini tidak dapat dikembalikan lagi dan <strong>hanya memiliki opsi untuk disetujui</strong> agar masuk ke wadah pemilihan pemenang lelang.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-white border border-slate-200/80 p-3.5 rounded-xl shadow-2xs">
                  <div className="flex items-center space-x-2 text-slate-700">
                    <Layers className="w-4 h-4 text-purple-600" />
                    <span>
                      Pilih <strong>Langsung Setujui</strong> jika harga wajar, atau centang item di bawah untuk <strong>Kembalikan Negosiasi</strong> ke rekanan.
                    </span>
                  </div>
                  <span className="inline-flex items-center text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg font-mono font-bold shrink-0 self-start sm:self-auto">
                    <Lock className="w-3 h-3 mr-1 text-slate-500" /> Wewenang DC Specialist
                  </span>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              )}

              {/* Toolbar Filter Tab */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setModalTab("SEMUA")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      modalTab === "SEMUA" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Semua ({allItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab("SIPIL")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      modalTab === "SIPIL" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Sipil ({itemsSipil.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab("ME")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      modalTab === "ME" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    ME ({itemsMe.length})
                  </button>
                  {!isResubmission && (
                    <button
                      type="button"
                      onClick={() => setModalTab("FLAGGED")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        modalTab === "FLAGGED" ? "bg-amber-50 text-amber-800 font-bold shadow-2xs border border-amber-200" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <span>Disorot</span>
                      {totalFlagged > 0 && (
                        <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                          {totalFlagged}
                        </span>
                      )}
                    </button>
                  )}
                </div>

                <div className="text-right text-xs">
                  <span className="text-slate-500">Grand Total Penawaran: </span>
                  <span className="font-mono font-bold text-purple-700 text-sm">
                    Rp {formatNumber(penawaran.grand_total || 0)}
                  </span>
                </div>
              </div>

              {/* Daftar Item Pekerjaan per Seksi */}
              <div className="space-y-4">
                {/* SEKSI SIPIL */}
                {(modalTab === "SEMUA" || modalTab === "SIPIL" || modalTab === "FLAGGED") && itemsSipil.length > 0 && (
                  <div className="space-y-3">
                    <div className="bg-orange-50/90 border border-orange-200/80 px-3.5 py-2 rounded-xl flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-md bg-[#E65F2B] text-white text-[11px] font-bold flex items-center justify-center">
                          A
                        </span>
                        <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                          PEKERJAAN SIPIL ({itemsSipil.length} Item)
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#E65F2B]">
                        Subtotal: Rp {formatNumber(totalSipil)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {sipilCategories.map((catGroup) => {
                        const visibleList = modalTab === "FLAGGED"
                          ? catGroup.list.filter((it: any) => flaggedItems[it.id]?.flagged)
                          : catGroup.list;

                        if (visibleList.length === 0) return null;

                        return (
                          <div key={`sipil-${catGroup.kategori}`} className="space-y-2">
                            <div className="flex items-center space-x-1.5 text-slate-700 font-bold text-xs px-1">
                              <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                              <span>{catGroup.kategori} ({visibleList.length} Item)</span>
                            </div>
                            <div className="space-y-2 pl-1 sm:pl-2">
                              {catGroup.list.map((it: any) => {
                                const itemIndex = itemsSipil.findIndex((x: any) => x.id === it.id) + 1;
                                return renderItemRow(it, itemIndex);
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* SEKSI ME */}
                {(modalTab === "SEMUA" || modalTab === "ME" || modalTab === "FLAGGED") && itemsMe.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="bg-orange-50/90 border border-orange-200/80 px-3.5 py-2 rounded-xl flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-md bg-[#E65F2B] text-white text-[11px] font-bold flex items-center justify-center">
                          B
                        </span>
                        <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                          PEKERJAAN MEKANIKAL &amp; ELEKTRIKAL (ME) ({itemsMe.length} Item)
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#E65F2B]">
                        Subtotal: Rp {formatNumber(totalMe)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {meCategories.map((catGroup) => {
                        const visibleList = modalTab === "FLAGGED"
                          ? catGroup.list.filter((it: any) => flaggedItems[it.id]?.flagged)
                          : catGroup.list;

                        if (visibleList.length === 0) return null;

                        return (
                          <div key={`me-${catGroup.kategori}`} className="space-y-2">
                            <div className="flex items-center space-x-1.5 text-slate-700 font-bold text-xs px-1">
                              <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                              <span>{catGroup.kategori} ({visibleList.length} Item)</span>
                            </div>
                            <div className="space-y-2 pl-1 sm:pl-2">
                              {catGroup.list.map((it: any) => {
                                const itemIndex = itemsMe.findIndex((x: any) => x.id === it.id) + 1;
                                return renderItemRow(it, itemIndex);
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* INSTRUKSI NEGOSIASI RESMI (AKAN DILIHAT OLEH KONTRAKTOR) */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 md:p-5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Instruksi Negosiasi Resmi untuk Rekanan {!isResubmission && "(Wajib jika Mengembalikan)*"}:
                  </label>
                  <span className="text-[11px] text-purple-800 font-bold bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                    Akan dikirim &amp; terlihat oleh Kontraktor
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={instruksi}
                  onChange={(e) => setInstruksi(e.target.value)}
                  placeholder="Tuliskan arahan resmi evaluasi DC Specialist..."
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl bg-slate-50/50 outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-900 leading-relaxed"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 md:px-6 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 shrink-0">
              <div className="flex items-center space-x-3 text-xs">
                {!isResubmission && (
                  <>
                    <span className="text-slate-600 font-medium">
                      Item Negosiasi: <strong className="text-slate-900 font-mono">{totalFlagged}</strong> Item
                    </span>
                    <span className="text-slate-300">•</span>
                    {totalFlagged === 0 ? (
                      <span className="text-slate-400 text-[11px]">
                        Tidak ada item yang disoroti
                      </span>
                    ) : emptyNotesCount > 0 ? (
                      <span className="inline-flex items-center text-[11px] font-bold text-rose-600">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                        {emptyNotesCount} item belum diisi catatan
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[11px] font-bold text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Catatan item lengkap
                      </span>
                    )}
                  </>
                )}
                {isResubmission && (
                  <span className="text-emerald-700 font-semibold text-[11px] flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Penawaran siap disetujui masuk ke wadah pemilihan pemenang lelang
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={submittingAction !== null}
                  className="text-xs h-9 px-4 rounded-xl border-slate-300 text-slate-700 cursor-pointer"
                >
                  Batal
                </Button>

                {/* Opsi 1: Kembalikan untuk Negosiasi (Hanya saat DIAJUKAN pertama kali) */}
                {!isResubmission && (
                  <Button
                    type="button"
                    disabled={submittingAction !== null || totalFlagged === 0 || emptyNotesCount > 0}
                    onClick={handleReturnForNegotiation}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-9 px-4 rounded-xl font-semibold shadow-xs cursor-pointer inline-flex items-center disabled:opacity-50"
                  >
                    {submittingAction === "NEGOSIASI" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        Mengembalikan...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        Kembalikan Negosiasi
                      </>
                    )}
                  </Button>
                )}

                {/* Opsi 2 / Opsi Tunggal Pasca Negosiasi: Langsung Setujui (Masuk Wadah Pemilihan Pemenang) */}
                <Button
                  type="button"
                  disabled={submittingAction !== null}
                  onClick={handleDirectApprove}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-5 rounded-xl font-semibold shadow-xs cursor-pointer inline-flex items-center shadow-emerald-600/20"
                >
                  {submittingAction === "SETUJU" ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Menyetujui...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      {isResubmission
                        ? "Setujui & Masukkan ke Wadah Pemenang"
                        : "Langsung Setujui (Siap Pilih Pemenang)"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FeedbackModal
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => {
          setFeedback((prev) => ({ ...prev, isOpen: false }));
          if (feedback.type === "success") {
            router.push("/dc-development/approval/penawaran-rekanan");
          }
        }}
      />
    </>
  );
}
