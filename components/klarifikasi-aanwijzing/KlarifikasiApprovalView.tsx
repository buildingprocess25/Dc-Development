"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  RotateCcw,
  Check,
  Loader2,
  Layers,
  MessageSquare,
  Search,
  ArrowLeft,
  X,
  Eye,
  ShieldCheck,
  AlertTriangle,
  Info,
  Clock,
  Image as ImageIcon,
  FileText,
  FileCode,
} from "lucide-react";
import { formatRupiah, cn } from "@/lib/utils";

export interface KlarifikasiApprovalViewProps {
  actionType: "APPROVE" | "REVISI";
  klarifikasi: any | null;
  isSubmitting?: boolean;
  onBack: () => void;
  onCloseModal?: () => void;
  onConfirm: (data: {
    action: "APPROVE" | "REVISI";
    notes: string;
    detail_revisi?: any[];
  }) => Promise<void>;
  onErrorFeedback?: (title: string, message: string) => void;
  onViewPdf?: () => void;
}

/**
 * KlarifikasiApprovalView
 *
 * Tampilan terintegrasi di dalam satu kontainer modal (tanpa pop-up bertumpuk).
 * Mengubah konten modal detail menjadi lembar kerja keputusan approval atau instruksi revisi
 * granular yang ter-highlight, bersih, dan berfokus penuh.
 */
export function KlarifikasiApprovalView({
  actionType,
  klarifikasi,
  isSubmitting = false,
  onBack,
  onCloseModal,
  onConfirm,
  onErrorFeedback,
  onViewPdf,
}: KlarifikasiApprovalViewProps) {
  const [actionNotes, setActionNotes] = useState("");
  const [revTabFilter, setRevTabFilter] = useState<"ALL" | "SIPIL" | "ME" | "BARU">("ALL");
  const [revSearchQuery, setRevSearchQuery] = useState("");
  const [revSelectedItems, setRevSelectedItems] = useState<
    Record<string, { selected: boolean; note: string }>
  >({});
  const [revCatatanMaker, setRevCatatanMaker] = useState<{ selected: boolean; note: string }>({
    selected: false,
    note: "",
  });
  const [revDurasi, setRevDurasi] = useState<{ selected: boolean; note: string }>({
    selected: false,
    note: "",
  });
  const [revGambarTeknis, setRevGambarTeknis] = useState<{ selected: boolean; note: string }>({
    selected: false,
    note: "",
  });
  const [revFotoLingkungan, setRevFotoLingkungan] = useState<{ selected: boolean; note: string }>({
    selected: false,
    note: "",
  });

  const durasiAwal = klarifikasi?.durasi_hari_awal ?? klarifikasi?.renovasi?.durasi_hari ?? 0;
  const durasiAkhir = klarifikasi?.durasi_hari_akhir ?? durasiAwal;
  const statusDurasi = klarifikasi?.status_durasi || (durasiAkhir !== durasiAwal ? "BERUBAH" : "TETAP");

  const rawDokumen = useMemo(() => {
    return (klarifikasi?.dokumen && Array.isArray(klarifikasi.dokumen) && klarifikasi.dokumen.length > 0)
      ? klarifikasi.dokumen
      : (klarifikasi?.renovasi?.dokumen || []);
  }, [klarifikasi]);

  const drawingsList = useMemo(() => {
    return rawDokumen.filter((d: any) => (d.kategori_file || "").startsWith("GAMBAR_"));
  }, [rawDokumen]);

  const fotoList = useMemo(() => {
    return rawDokumen.filter((d: any) => d.kategori_file === "FOTO_LINGKUNGAN");
  }, [rawDokumen]);

  const items = useMemo(() => klarifikasi?.items || [], [klarifikasi]);

  const itemsSipil = useMemo(
    () => items.filter((it: any) => (it.lingkup || "SIPIL").toUpperCase() === "SIPIL"),
    [items]
  );
  const itemsMe = useMemo(
    () => items.filter((it: any) => (it.lingkup || "").toUpperCase() === "ME"),
    [items]
  );
  const itemsBaru = useMemo(
    () => items.filter((it: any) => it.tipe_perubahan === "ITEM_BARU"),
    [items]
  );

  const totalSipil = useMemo(
    () => itemsSipil.reduce((acc: number, it: any) => acc + (Number(it.total_biaya_akhir) || 0), 0),
    [itemsSipil]
  );
  const totalMe = useMemo(
    () => itemsMe.reduce((acc: number, it: any) => acc + (Number(it.total_biaya_akhir) || 0), 0),
    [itemsMe]
  );
  const grandTotal = totalSipil + totalMe;

  const selectedCount =
    Object.values(revSelectedItems).filter((v) => v.selected).length +
    (revCatatanMaker.selected ? 1 : 0) +
    (revDurasi.selected ? 1 : 0) +
    (revGambarTeknis.selected ? 1 : 0) +
    (revFotoLingkungan.selected ? 1 : 0);

  const filteredRevItems = useMemo(() => {
    return items.filter((it: any) => {
      if (revTabFilter === "SIPIL" && (it.lingkup || "SIPIL").toUpperCase() !== "SIPIL") return false;
      if (revTabFilter === "ME" && (it.lingkup || "").toUpperCase() !== "ME") return false;
      if (revTabFilter === "BARU" && it.tipe_perubahan !== "ITEM_BARU") return false;

      if (revSearchQuery.trim()) {
        const q = revSearchQuery.toLowerCase();
        const matchDesc = (it.deskripsi || "").toLowerCase().includes(q);
        const matchKat = (it.kategori_pekerjaan || "").toLowerCase().includes(q);
        if (!matchDesc && !matchKat) return false;
      }
      return true;
    });
  }, [items, revTabFilter, revSearchQuery]);

  const getNextStepLabel = () => {
    if (klarifikasi?.status === "MENUNGGU_APPROVAL_BBM_MANAGER") {
      return "DC Building & Development Specialist";
    }
    if (klarifikasi?.status === "MENUNGGU_APPROVAL_DC_SPECIALIST") {
      return "Persetujuan Selesai (Final Approved)";
    }
    return undefined;
  };

  const handleSubmit = async () => {
    let detailRevisiPayload: any[] = [];
    if (actionType === "REVISI") {
      detailRevisiPayload = Object.entries(revSelectedItems)
        .filter(([_, val]) => val.selected)
        .map(([idStr, val]) => {
          const itemObj = items.find((it: any) => String(it.id) === idStr);
          return {
            id: `item_${idStr}`,
            category: "ITEM_KLARIFIKASI",
            fieldOrId: idStr,
            item_id: itemObj?.id,
            subCategory: itemObj?.lingkup || "SIPIL",
            label: `${itemObj?.kategori_pekerjaan || "PEKERJAAN"} — ${itemObj?.deskripsi} (${itemObj?.lingkup || "SIPIL"})`,
            catatan: val.note.trim(),
            initialValue: {
              volume_akhir: itemObj?.volume_akhir,
              harga_material: itemObj?.harga_material,
              harga_upah: itemObj?.harga_upah,
              total_biaya_akhir: itemObj?.total_biaya_akhir,
              satuan: itemObj?.satuan,
              tipe_perubahan: itemObj?.tipe_perubahan,
              deskripsi: itemObj?.deskripsi,
            },
          };
        });

      if (revCatatanMaker.selected) {
        detailRevisiPayload.push({
          id: "catatan_maker",
          category: "CATATAN_MAKER",
          fieldOrId: "catatan_maker",
          subCategory: "BERITA_ACARA",
          label: "Catatan Kesepakatan Berita Acara",
          catatan: revCatatanMaker.note.trim(),
          initialValue: klarifikasi?.catatan_maker || "",
        });
      }

      if (revDurasi.selected) {
        detailRevisiPayload.push({
          id: "durasi_pekerjaan",
          category: "DURASI_PEKERJAAN",
          fieldOrId: "durasi_pekerjaan",
          subCategory: "DURASI",
          label: `Durasi Pekerjaan Proyek (${durasiAkhir} Hari)`,
          catatan: revDurasi.note.trim(),
          initialValue: {
            durasi_hari_awal: durasiAwal,
            durasi_hari_akhir: durasiAkhir,
            catatan_durasi: klarifikasi?.catatan_durasi || "",
          },
        });
      }

      if (revGambarTeknis.selected) {
        detailRevisiPayload.push({
          id: "gambar_teknis",
          category: "GAMBAR_TEKNIS",
          fieldOrId: "gambar_teknis",
          subCategory: "DOKUMEN",
          label: "Gambar Teknis (Sipil & ME)",
          catatan: revGambarTeknis.note.trim(),
          initialValue: drawingsList,
        });
      }

      if (revFotoLingkungan.selected) {
        detailRevisiPayload.push({
          id: "foto_lingkungan",
          category: "FOTO_LINGKUNGAN",
          fieldOrId: "foto_lingkungan",
          subCategory: "FOTO",
          label: "Foto Lingkungan & Eksisting Proyek",
          catatan: revFotoLingkungan.note.trim(),
          initialValue: fotoList,
        });
      }

      // Validasi 1: Jika tidak ada item yang diceklis, catatan umum wajib diisi
      if (detailRevisiPayload.length === 0 && !actionNotes.trim()) {
        onErrorFeedback?.(
          "Catatan Revisi Wajib Diisi",
          "Harap berikan catatan alasan revisi secara jelas atau pilih minimal satu item pekerjaan yang wajib diperbaiki oleh pembuat."
        );
        return;
      }

      // Validasi 2: Setiap item yang diceklis wajib memiliki catatan instruksi perbaikan
      for (const revItem of detailRevisiPayload) {
        if (!revItem.catatan) {
          onErrorFeedback?.(
            "Catatan item Revisi Wajib Diisi",
            `Harap berikan catatan instruksi perbaikan untuk item yang diceklis: "${revItem.label}".`
          );
          return;
        }
      }
    }

    await onConfirm({
      action: actionType,
      notes: actionNotes,
      detail_revisi: detailRevisiPayload.length > 0 ? detailRevisiPayload : undefined,
    });
  };

  return (
    <div className="flex flex-col h-full max-h-[92vh] bg-white overflow-hidden animate-in fade-in duration-200">
      {/* HEADER BANNER KHUSUS MODE AKSI (Ter-highlight & Bersih) */}
      <div
        className={cn(
          "border-b p-5 shrink-0 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap",
          actionType === "REVISI"
            ? "bg-amber-50/70 border-amber-200/90"
            : "bg-emerald-50/70 border-emerald-200/90"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-bold text-[#E65F2B] uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-orange-200 inline-block shadow-2xs">
                SOP SAT/SOP/DCB/003
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border inline-block",
                  actionType === "REVISI"
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-emerald-100 text-emerald-800 border-emerald-300"
                )}
              >
                {actionType === "REVISI" ? "Lembar Keputusan Revisi" : "Konfirmasi Persetujuan"}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 truncate">
              {actionType === "REVISI" ? (
                <>
                  <RotateCcw className="w-5 h-5 text-amber-600 shrink-0" />
                  <span className="truncate">
                    Instruksi Pengembalian Revisi — {klarifikasi?.nomor_klarifikasi || "Berita Acara"}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="truncate">
                    Konfirmasi Persetujuan Berita Acara — {klarifikasi?.nomor_klarifikasi || "Berita Acara"}
                  </span>
                </>
              )}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 truncate">
              {actionType === "REVISI"
                ? "Tandai item pekerjaan yang wajib diperbaiki atau berikan instruksi perbaikan umum untuk pembuat."
                : "Pastikan seluruh item penyesuaian volume dan penambahan item pekerjaan sudah sesuai sebelum menyetujui."}
            </p>
          </div>
        </div>

        {/* Action Header: Lihat PDF & Close X */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {onViewPdf && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onViewPdf}
              className="rounded-xl h-9 text-xs border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <span>Lihat PDF</span>
            </Button>
          )}

          {onCloseModal && (
            <button
              type="button"
              onClick={onCloseModal}
              className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-200/70 transition-colors cursor-pointer"
              title="Tutup Modal"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* BODY KONTEN (Penuh, Scrollable, Ter-highlight) */}
      <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5 bg-slate-50/50">
        {actionType === "REVISI" ? (
          <>
            {/* Bagian 1: Catatan Umum Instruksi Revisi */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#E65F2B]" />
                  Catatan Umum Instruksi Revisi
                </span>
                {selectedCount === 0 ? (
                  <span className="text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                    * Wajib Diisi jika tidak ada item yang diceklis
                  </span>
                ) : (
                  <span className="text-slate-400 font-normal text-[11px]">
                    (Opsional / Ringkasan Instruksi Keseluruhan)
                  </span>
                )}
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={3}
                placeholder="Tuliskan arahan atau instruksi umum yang harus dipatuhi pembuat dalam pengajuan revisi ini..."
                className="w-full text-xs p-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#E65F2B] bg-white text-slate-800 placeholder:text-slate-400 transition-all"
              />
            </div>

            {/* Bagian 2: Granular Item Checklist Section */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#E65F2B]" />
                    Pilih item / Item Pekerjaan yang Wajib Direvisi
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Tandai item pekerjaan spesifik yang wajib diperbaiki oleh pembuat. item yang diceklis wajib diberikan catatan instruksi perbaikan.
                  </p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                  {selectedCount} item Ditandai
                </span>
              </div>

              {/* Filter Tabs & Search Bar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="inline-flex rounded-xl bg-slate-200/70 p-1 border border-slate-300 text-xs">
                  <button
                    type="button"
                    onClick={() => setRevTabFilter("ALL")}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer",
                      revTabFilter === "ALL"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Semua ({items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevTabFilter("SIPIL")}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer",
                      revTabFilter === "SIPIL"
                        ? "bg-white text-blue-700 shadow-2xs"
                        : "text-slate-600 hover:text-blue-700"
                    )}
                  >
                    Sipil ({itemsSipil.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevTabFilter("ME")}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer",
                      revTabFilter === "ME"
                        ? "bg-white text-amber-700 shadow-2xs"
                        : "text-slate-600 hover:text-amber-700"
                    )}
                  >
                    ME ({itemsMe.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevTabFilter("BARU")}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer",
                      revTabFilter === "BARU"
                        ? "bg-white text-emerald-700 shadow-2xs"
                        : "text-slate-600 hover:text-emerald-700"
                    )}
                  >
                    Item Baru ({itemsBaru.length})
                  </button>
                </div>

                <div className="relative min-w-[220px] flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={revSearchQuery}
                    onChange={(e) => setRevSearchQuery(e.target.value)}
                    placeholder="Cari item pekerjaan atau kategori..."
                    className="w-full text-xs pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#E65F2B] shadow-2xs"
                  />
                </div>
              </div>

              {/* Checklist Cards Container */}
              <div className="space-y-2.5">
                {/* Checkbox Card Khusus: Catatan Kesepakatan Maker */}
                <div
                  className={cn(
                    "p-4 rounded-xl border transition-all",
                    revCatatanMaker.selected
                      ? "bg-amber-50 border-amber-300 shadow-xs"
                      : "bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs"
                  )}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={revCatatanMaker.selected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRevCatatanMaker((prev) => ({
                          selected: checked,
                          note: checked ? prev.note : "",
                        }));
                      }}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">
                          Catatan Kesepakatan / Keterangan Berita Acara
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          Keterangan Umum Maker
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 italic leading-relaxed">
                        &quot;{klarifikasi?.catatan_maker || "Tidak ada catatan kesepakatan pembuat"}&quot;
                      </p>
                    </div>
                  </label>

                  {revCatatanMaker.selected && (
                    <div className="mt-3 pt-3 border-t border-amber-200/80 space-y-1.5 animate-in fade-in duration-150">
                      <label className="block text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center justify-between">
                        <span>Instruksi Revisi untuk Catatan Kesepakatan:</span>
                        <span className="text-rose-600 font-bold text-[11px]">* Wajib Diisi</span>
                      </label>
                      <textarea
                        value={revCatatanMaker.note}
                        onChange={(e) =>
                          setRevCatatanMaker((prev) => ({
                            ...prev,
                            note: e.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="Jelaskan perbaikan apa yang harus dilakukan pada catatan kesepakatan ini..."
                        className="w-full text-xs p-3 rounded-xl border border-amber-300 focus:outline-none focus:ring-2 focus:ring-[#E65F2B] bg-white text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                  )}
                </div>

                {/* Checkbox Card Khusus: Durasi Pekerjaan Proyek */}
                <div
                  className={cn(
                    "p-4 rounded-xl border transition-all",
                    revDurasi.selected
                      ? "bg-amber-50 border-amber-300 shadow-xs"
                      : "bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs"
                  )}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={revDurasi.selected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRevDurasi((prev) => ({
                          selected: checked,
                          note: checked ? prev.note : "",
                        }));
                      }}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#E65F2B]" />
                          Durasi Pekerjaan Proyek
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                            statusDurasi === "BERUBAH"
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          )}
                        >
                          {statusDurasi === "BERUBAH"
                            ? `Berubah (${durasiAkhir - durasiAwal > 0 ? `+${durasiAkhir - durasiAwal}` : durasiAkhir - durasiAwal} Hari)`
                            : "Tetap Sesuai RAB"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                        <span>Awal: <strong>{durasiAwal} Hari</strong></span>
                        <span>&rarr;</span>
                        <span>Klarifikasi: <strong>{durasiAkhir} Hari</strong></span>
                      </div>
                      {klarifikasi?.catatan_durasi && (
                        <p className="text-[11px] text-slate-500 mt-1 italic">
                          Catatan Maker: &quot;{klarifikasi.catatan_durasi}&quot;
                        </p>
                      )}
                    </div>
                  </label>

                  {revDurasi.selected && (
                    <div className="mt-3 pt-3 border-t border-amber-200/80 space-y-1.5 animate-in fade-in duration-150">
                      <label className="block text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center justify-between">
                        <span>Instruksi Revisi untuk Durasi Pekerjaan:</span>
                        <span className="text-rose-600 font-bold text-[11px]">* Wajib Diisi</span>
                      </label>
                      <textarea
                        value={revDurasi.note}
                        onChange={(e) =>
                          setRevDurasi((prev) => ({
                            ...prev,
                            note: e.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="Tuliskan arahan durasi yang harus disesuaikan pembuat..."
                        className="w-full text-xs p-3 rounded-xl border border-amber-300 focus:outline-none focus:ring-2 focus:ring-[#E65F2B] bg-white text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                  )}
                </div>

                {/* Checkbox Card Khusus: Gambar Teknis (Sipil & ME) */}
                <div
                  className={cn(
                    "p-4 rounded-xl border transition-all",
                    revGambarTeknis.selected
                      ? "bg-amber-50 border-amber-300 shadow-xs"
                      : "bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs"
                  )}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={revGambarTeknis.selected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRevGambarTeknis((prev) => ({
                          selected: checked,
                          note: checked ? prev.note : "",
                        }));
                      }}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <FileCode className="w-3.5 h-3.5 text-[#E65F2B]" />
                          Gambar Teknis (Sipil &amp; ME)
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {drawingsList.length} Dokumen Terlampir
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Lampiran gambar kerja format PDF dan DWG untuk pekerjaan Sipil &amp; ME.
                      </p>
                    </div>
                  </label>

                  {revGambarTeknis.selected && (
                    <div className="mt-3 pt-3 border-t border-amber-200/80 space-y-1.5 animate-in fade-in duration-150">
                      <label className="block text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center justify-between">
                        <span>Instruksi Revisi untuk Gambar Teknis:</span>
                        <span className="text-rose-600 font-bold text-[11px]">* Wajib Diisi</span>
                      </label>
                      <textarea
                        value={revGambarTeknis.note}
                        onChange={(e) =>
                          setRevGambarTeknis((prev) => ({
                            ...prev,
                            note: e.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="Jelaskan perbaikan gambar teknis (arsitektur/struktur/ME) yang wajib diunggah ulang..."
                        className="w-full text-xs p-3 rounded-xl border border-amber-300 focus:outline-none focus:ring-2 focus:ring-[#E65F2B] bg-white text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                  )}
                </div>

                {/* Checkbox Card Khusus: Foto Lingkungan & Eksisting */}
                <div
                  className={cn(
                    "p-4 rounded-xl border transition-all",
                    revFotoLingkungan.selected
                      ? "bg-amber-50 border-amber-300 shadow-xs"
                      : "bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs"
                  )}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={revFotoLingkungan.selected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRevFotoLingkungan((prev) => ({
                          selected: checked,
                          note: checked ? prev.note : "",
                        }));
                      }}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-[#E65F2B]" />
                          Foto Lingkungan &amp; Eksisting Proyek
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {fotoList.length} Foto Terlampir
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Foto fisik lapangan ber-watermark timestamp &amp; koordinat GPS lokasi.
                      </p>
                    </div>
                  </label>

                  {revFotoLingkungan.selected && (
                    <div className="mt-3 pt-3 border-t border-amber-200/80 space-y-1.5 animate-in fade-in duration-150">
                      <label className="block text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center justify-between">
                        <span>Instruksi Revisi untuk Foto Lingkungan:</span>
                        <span className="text-rose-600 font-bold text-[11px]">* Wajib Diisi</span>
                      </label>
                      <textarea
                        value={revFotoLingkungan.note}
                        onChange={(e) =>
                          setRevFotoLingkungan((prev) => ({
                            ...prev,
                            note: e.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="Jelaskan bagian fisik atau foto lingkungan mana yang perlu diambil ulang atau ditambahkan..."
                        className="w-full text-xs p-3 rounded-xl border border-amber-300 focus:outline-none focus:ring-2 focus:ring-[#E65F2B] bg-white text-slate-800 placeholder:text-slate-400"
                      />
                    </div>
                  )}
                </div>

                {/* Rows Item Pekerjaan */}
                {filteredRevItems.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs bg-white border border-slate-200 rounded-2xl">
                    Tidak ditemukan item pekerjaan yang cocok dengan filter pencarian.
                  </div>
                ) : (
                  filteredRevItems.map((it: any) => {
                    const idStr = String(it.id);
                    const isChecked = revSelectedItems[idStr]?.selected || false;
                    const isSipil = (it.lingkup || "SIPIL").toUpperCase() === "SIPIL";
                    const isBaru = it.tipe_perubahan === "ITEM_BARU";
                    const mat = Number(it.harga_material) || 0;
                    const upah = Number(it.harga_upah) || 0;
                    const hrgSatuan = mat + upah;

                    return (
                      <div
                        key={idStr}
                        className={cn(
                          "p-4 rounded-xl border transition-all",
                          isChecked
                            ? "bg-amber-50/80 border-amber-300 shadow-xs ring-1 ring-amber-300"
                            : "bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs"
                        )}
                      >
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setRevSelectedItems((prev) => ({
                                ...prev,
                                [idStr]: {
                                  selected: checked,
                                  note: checked ? prev[idStr]?.note || "" : "",
                                },
                              }));
                            }}
                            className="mt-1 w-4 h-4 rounded border-slate-300 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer"
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold border",
                                  isSipil
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                )}
                              >
                                {isSipil ? "SIPIL" : "ME"}
                              </span>

                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold border",
                                  isBaru
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : it.tipe_perubahan === "SAMA_DENGAN_RAB" || it.status_perubahan === "Sama dengan RAB/OE"
                                      ? "bg-slate-100 text-slate-700 border-slate-200"
                                      : "bg-sky-50 text-sky-700 border-sky-200"
                                )}
                              >
                                {isBaru
                                  ? "ITEM BARU"
                                  : it.tipe_perubahan === "SAMA_DENGAN_RAB" || it.status_perubahan === "Sama dengan RAB/OE"
                                    ? "SAMA DGN RAB"
                                    : "PENYESUAIAN"}
                              </span>

                              <span className="text-xs font-bold text-slate-900">
                                {it.deskripsi}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs text-slate-600 mt-2 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Kategori:</span>
                                <span className="font-semibold text-slate-800 truncate block">{it.kategori_pekerjaan}</span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Volume:</span>
                                <div>
                                  {!isBaru && it.volume_awal !== it.volume_akhir && (
                                    <span className="text-slate-400 line-through text-[10px] mr-1">
                                      {it.volume_awal} {it.satuan}
                                    </span>
                                  )}
                                  <strong className={!isBaru && it.volume_awal !== it.volume_akhir ? "text-[#E65F2B]" : "text-slate-800"}>
                                    {it.volume_akhir} {it.satuan}
                                  </strong>
                                </div>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Harga Satuan:</span>
                                <span className="font-mono font-bold text-slate-800">{formatRupiah(hrgSatuan)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Biaya:</span>
                                <span className="font-mono font-extrabold text-[#E65F2B]">
                                  {formatRupiah(it.total_biaya_akhir)}
                                </span>
                              </div>
                            </div>

                            {(it.catatan || it.keterangan) && (
                              <div className="text-[11px] text-slate-500 mt-2 italic">
                                Catatan Maker: &quot;{it.catatan || it.keterangan}&quot;
                              </div>
                            )}
                          </div>
                        </label>

                        {/* Textarea Catatan Instruksi yang Wajib Diisi saat Checked */}
                        {isChecked && (
                          <div className="mt-3 pt-3 border-t border-amber-200/90 space-y-1.5 animate-in fade-in duration-150">
                            <label className="block text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center justify-between">
                              <span>Instruksi Revisi Khusus Item Ini:</span>
                              <span className="text-rose-600 font-bold text-[11px]">* Wajib Diisi</span>
                            </label>
                            <textarea
                              value={revSelectedItems[idStr]?.note || ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRevSelectedItems((prev) => ({
                                  ...prev,
                                  [idStr]: { selected: true, note: val },
                                }));
                              }}
                              rows={2}
                              placeholder={`Tuliskan instruksi perbaikan khusus mengenai volume, harga, atau lingkup ${it.deskripsi}...`}
                              className="w-full text-xs p-3 rounded-xl border border-amber-300 focus:outline-none focus:ring-2 focus:ring-[#E65F2B] bg-white text-slate-800 placeholder:text-slate-400"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        ) : (
          /* FORM TAMPILAN APPROVE */
          <div className="space-y-4">
            <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2.5 text-emerald-800 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Ringkasan Persetujuan Berita Acara</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Menyetujui berita acara klarifikasi aanwijzing ini akan meneruskan proses ke tahap persetujuan berikutnya:
              </p>

              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-950">Langkah Selanjutnya:</span>
                  <strong className="text-emerald-800">{getNextStepLabel() || "Selesai (Final Approved)"}</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-950">Jumlah Item Penyesuaian:</span>
                  <span className="font-bold text-slate-800">{items.length} item</span>
                </div>
                <div className="flex items-center justify-between text-xs border-t border-emerald-200/80 pt-2">
                  <span className="font-bold text-emerald-950">Total Nilai Penyesuaian:</span>
                  <span className="font-mono font-extrabold text-emerald-800 text-sm">
                    {formatRupiah(grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-2.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center justify-between">
                <span>Catatan Persetujuan (Opsional)</span>
                <span className="text-slate-400 font-normal text-[11px]">(Opsional)</span>
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows={4}
                placeholder="Tuliskan catatan tambahan mengenai keputusan persetujuan ini jika diperlukan..."
                className="w-full text-xs p-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#E65F2B] bg-white text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* DOCKED SOLID FOOTER (Opaque, Fixed, Solid Actions) */}
      <div className="bg-white border-t border-slate-200 px-6 py-3.5 rounded-b-2xl flex items-center justify-between gap-4 shrink-0 shadow-[0_-4px_25px_rgba(0,0,0,0.06)] z-30">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          disabled={isSubmitting}
          className="rounded-xl h-10 px-4 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
          <span>Kembali ke Detail</span>
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={cn(
            "rounded-xl font-bold h-10 px-6 text-xs text-white cursor-pointer inline-flex items-center gap-2 shadow-md transition-all",
            actionType === "APPROVE"
              ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
              : "bg-[#E65F2B] hover:bg-[#d04f1f] shadow-orange-500/20"
          )}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : actionType === "APPROVE" ? (
            <Check className="w-4 h-4" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
          <span>
            {isSubmitting
              ? "Memproses Keputusan..."
              : actionType === "APPROVE"
                ? "Ya, Setujui Berita Acara (Approve)"
                : selectedCount > 0
                  ? `Kembalikan Revisi (${selectedCount} item Ditandai)`
                  : "Kembalikan untuk Revisi"}
          </span>
        </Button>
      </div>
    </div>
  );
}
