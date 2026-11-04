"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckSquare,
  Square,
  Lock,
  AlertCircle,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "@/components/ui/feedback-modal";

interface EvaluasiBbmProps {
  penawaran: any;
  klarifikasi?: any;
}

export default function EvaluasiBbmActionCard({ penawaran, klarifikasi: _ }: EvaluasiBbmProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [catatanInternal, setCatatanInternal] = useState(penawaran.catatan_internal_bbm || "");

  // State untuk item yang diceklis beserta catatan wajib per item
  const [flaggedItems, setFlaggedItems] = useState<Record<number, { flagged: boolean; catatan: string }>>(() => {
    const map: Record<number, { flagged: boolean; catatan: string }> = {};
    (penawaran.items || []).forEach((it: any) => {
      map[it.id] = {
        flagged: Boolean(it.is_flagged_bbm),
        catatan: it.catatan_bbm || "",
      };
    });
    return map;
  });

  const [submitting, setSubmitting] = useState(false);
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

  const toggleFlag = (id: number) => {
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

  const handleConfirmLanjutkan = async () => {
    setErrorMessage(null);

    // Validasi: Setiap item pekerjaan yang diceklis WAJIB memiliki catatan
    const checkedEntries = Object.entries(flaggedItems).filter(([_, v]) => v.flagged);
    const emptyNotes = checkedEntries.filter(([_, v]) => !v.catatan.trim());

    if (emptyNotes.length > 0) {
      setErrorMessage(
        `Terdapat ${emptyNotes.length} item pekerjaan yang diceklis namun belum diberi catatan. Setiap item yang diceklis wajib diisi alasannya.`
      );
      return;
    }

    try {
      setSubmitting(true);
      const payloadFlagged = checkedEntries.map(([idStr, v]) => ({
        id: parseInt(idStr),
        catatan: v.catatan.trim(),
      }));

      const res = await fetch(`/api/dc-development/penawaran-rekanan/${penawaran.id}/review-bbm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catatan_internal: catatanInternal.trim(),
          flagged_items: payloadFlagged,
          flagged_item_ids: payloadFlagged.map((x) => x.id),
        }),
      });

      const json = await res.json();
      if (json.status === "success") {
        setShowModal(false);
        setFeedback({
          isOpen: true,
          type: "success",
          title: "Evaluasi BBM Selesai",
          message: "Catatan evaluasi berhasil disimpan dan berkas resmi diteruskan ke DC Specialist.",
        });
      } else {
        setFeedback({
          isOpen: true,
          type: "error",
          title: "Gagal Menyimpan Evaluasi",
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
      setSubmitting(false);
    }
  };

  const totalFlagged = Object.values(flaggedItems).filter((v) => v.flagged).length;

  return (
    <>
      {/* Banner Tindakan BBM Manager (Ringkas & Bersih di Halaman Awal) */}
      <div className="bg-orange-50/70 border border-orange-200/80 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white border border-orange-200 flex items-center justify-center text-[#E65F2B] shrink-0 shadow-2xs">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#E65F2B] bg-white border border-orange-200 px-2 py-0.5 rounded-md">
                Wewenang BBM Manager
              </span>
              <span className="text-slate-300 text-xs">•</span>
              <span className="text-xs text-slate-500 font-mono">Pemeriksaan Awal</span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm md:text-base mt-0.5">
              Tinjau Penawaran &amp; Lanjutkan ke DC Specialist
            </h4>
            <p className="text-xs text-slate-500">
              Periksa rincian BoQ di atas. Klik tombol di kanan untuk menandai catatan evaluasi dan meneruskan berkas.
            </p>
          </div>
        </div>

        <Button
          onClick={() => setShowModal(true)}
          className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-semibold text-xs h-10 px-6 rounded-xl shadow-xs shrink-0 cursor-pointer"
        >
          Lanjutkan ke DC Specialist
          <ArrowRight className="w-4 h-4 ml-1.5" />
        </Button>
      </div>

      {/* MODAL DIALOG EVALUASI AWAL BBM MANAGER (MUNCUL SAAT KLIK LANJUTKAN KE DC SPECIALIST) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/70 flex items-center justify-center text-[#E65F2B] shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Lembar Evaluasi Awal BBM Manager</h3>
                  <p className="text-xs text-slate-500">
                    Pemeriksaan independen sebelum negosiasi DC Specialist
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
                <span className="text-slate-600 font-medium">
                  Tandai item pekerjaan yang perlu disoroti (opsional):
                </span>
                <span className="inline-flex items-center text-[10px] bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                  <Lock className="w-3 h-3 mr-1 text-slate-500" /> Catatan Internal Rahasia
                </span>
              </div>

              {/* Error Message jika ada item diceklis tanpa catatan */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Checklist item Pekerjaan */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Daftar Pekerjaan ({totalFlagged} item ditandai):
                </label>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200/80 rounded-xl bg-slate-50/40 p-2 space-y-2">
                  {(penawaran.items || []).map((it: any) => {
                    const isChecked = Boolean(flaggedItems[it.id]?.flagged);
                    const itemCatatan = flaggedItems[it.id]?.catatan || "";

                    return (
                      <div
                        key={it.id}
                        className={`p-3 rounded-xl border transition-all space-y-2 ${isChecked
                            ? "bg-orange-50/50 border-orange-300 ring-1 ring-orange-300/40"
                            : "bg-white border-slate-200/80 hover:bg-slate-50"
                          }`}
                      >
                        <div
                          onClick={() => toggleFlag(it.id)}
                          className="flex items-center justify-between cursor-pointer select-none"
                        >
                          <div className="flex items-center space-x-2.5">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-[#E65F2B] shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <div>
                              <span className="font-semibold text-slate-800 text-xs">{it.deskripsi}</span>
                              <span className="text-[10px] text-slate-400 ml-2 font-mono">
                                ({it.volume} {it.satuan}) • {it.kategori_pekerjaan}
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            Rp {new Intl.NumberFormat("id-ID").format(it.total_harga || 0)}
                          </span>
                        </div>

                        {/* Input Catatan Wajib jika Item Diceklis */}
                        {isChecked && (
                          <div className="pt-1.5 pl-6 animate-in fade-in duration-150 space-y-1">
                            <label className="block text-[11px] font-bold text-orange-900">
                              Catatan Sorotan BBM (Wajib Diisi)*:
                            </label>
                            <input
                              type="text"
                              value={itemCatatan}
                              onChange={(e) => handleNoteChange(it.id, e.target.value)}
                              placeholder="Misal: Harga material terlalu tinggi vs pagu cabang..."
                              className={`w-full text-xs p-2.5 rounded-lg border outline-none transition-all ${!itemCatatan.trim()
                                  ? "border-rose-400 bg-rose-50/40 focus:ring-1 focus:ring-rose-500"
                                  : "border-slate-300 bg-white focus:ring-1 focus:ring-[#E65F2B]"
                                }`}
                            />
                            {!itemCatatan.trim() && (
                              <span className="text-[10px] text-rose-600 font-semibold block">
                                * Catatan wajib diisi untuk item pekerjaan yang ditandai
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Catatan Internal Tambahan BBM */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Catatan Evaluasi Internal BBM Manager (Umum/Opsional):
                </label>
                <textarea
                  rows={3}
                  value={catatanInternal}
                  onChange={(e) => setCatatanInternal(e.target.value)}
                  placeholder="Tuliskan catatan internal mengenai deviasi harga atau penjadwalan umum (catatan ini tidak terlihat oleh rekanan)..."
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-1 focus:ring-[#E65F2B] focus:border-[#E65F2B]"
                />
                <span className="text-[10px] text-slate-400 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1 text-slate-400" />
                  Kerahasiaan terjamin: Catatan ini hanya dapat dibaca oleh BBM Manager, DC Specialist, dan Admin.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end space-x-2 bg-slate-50/70">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
                className="text-xs h-9 px-4 rounded-xl border-slate-300 text-slate-700 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={submitting}
                onClick={handleConfirmLanjutkan}
                className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs h-9 px-5 rounded-xl font-semibold shadow-xs cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Menyimpan...
                  </>
                ) : (
                  <>
                    Konfirmasi &amp; Teruskan ke DC Specialist
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </>
                )}
              </Button>
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