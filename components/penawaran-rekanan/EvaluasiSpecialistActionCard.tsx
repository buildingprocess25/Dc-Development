"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, AlertTriangle, Lock, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import Link from "next/link";

interface EvaluasiSpecialistProps {
  penawaran: any;
  klarifikasi: any;
}

export default function EvaluasiSpecialistActionCard({
  penawaran,
  klarifikasi,
}: EvaluasiSpecialistProps) {
  const router = useRouter();
  const [instruksi, setInstruksi] = useState(penawaran.catatan_negosiasi_specialist || "");
  const [flaggedItems, setFlaggedItems] = useState<Record<number, { flagged: boolean; catatan: string }>>(() => {
    const map: Record<number, { flagged: boolean; catatan: string }> = {};
    (penawaran.items || []).forEach((it: any) => {
      map[it.id] = {
        flagged: it.is_flagged_specialist || false,
        catatan: it.catatan_specialist || "",
      };
    });
    return map;
  });

  const [submitting, setSubmitting] = useState(false);
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

  const toggleItemFlag = (id: number) => {
    setFlaggedItems((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        flagged: !prev[id]?.flagged,
      },
    }));
  };

  const handleItemNoteChange = (id: number, val: string) => {
    setFlaggedItems((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        catatan: val,
      },
    }));
  };

  const handleReturnForNegotiation = async () => {
    if (!instruksi.trim()) {
      alert("Harap masukkan instruksi negosiasi resmi untuk rekanan.");
      return;
    }

    const flaggedPayload = Object.entries(flaggedItems)
      .filter(([_, v]) => v.flagged)
      .map(([k, v]) => ({
        id: parseInt(k),
        catatan: v.catatan || "Wajib dinegosiasikan kembali nilainya",
      }));

    if (flaggedPayload.length === 0) {
      alert("Harap tandai minimal satu item pekerjaan yang wajib dinegosiasikan harganya.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/dc-development/penawaran-rekanan/${penawaran.id}/negosiasi-specialist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruksi_negosiasi: instruksi.trim(),
          flagged_items: flaggedPayload,
        }),
      });

      const json = await res.json();
      if (json.status === "success") {
        setFeedback({
          isOpen: true,
          type: "success",
          title: "Pengembalian Negosiasi Terkirim",
          message: "Berkas berhasil dikembalikan ke rekanan dengan status NEGOSIASI_REKANAN.",
        });
      } else {
        setFeedback({
          isOpen: true,
          type: "error",
          title: "Gagal Mengembalikan",
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
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Lembar Keputusan Negosiasi DC Specialist</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Tandai item pekerjaan yang perlu dinegosiasikan dan kirimkan instruksi resmi ke rekanan.
          </p>
        </div>
      </div>

      {/* Banner Catatan Internal BBM (Hanya Terlihat oleh Internal) */}
      {(penawaran.catatan_internal_bbm || (penawaran.items || []).some((it: any) => it.is_flagged_bbm)) && (
        <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-3.5 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-orange-950 font-bold text-[11px]">
              <Lock className="w-3.5 h-3.5 text-[#E65F2B]" />
              <span>Catatan Evaluasi Awal dari BBM Manager (Rahasia Internal):</span>
            </div>
            <span className="text-[10px] bg-white border border-orange-200 text-[#E65F2B] px-2 py-0.5 rounded font-mono font-bold">
              {(penawaran.items || []).filter((it: any) => it.is_flagged_bbm).length} item Disoroti BBM
            </span>
          </div>
          {penawaran.catatan_internal_bbm && (
            <p className="text-slate-700 italic pl-5 bg-white/70 p-2.5 rounded-lg border border-orange-200/60 leading-relaxed">
              &ldquo;{penawaran.catatan_internal_bbm}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Checklist item Pekerjaan yang Wajib Direvisi Rekanan */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-slate-700">
            Tandai Item yang Wajib Dinegosiasikan oleh Rekanan ({totalFlagged} item ditandai):
          </label>
          {(penawaran.items || []).some((it: any) => it.is_flagged_bbm) && (
            <button
              type="button"
              onClick={() => {
                setFlaggedItems((prev) => {
                  const updated = { ...prev };
                  (penawaran.items || []).forEach((it: any) => {
                    if (it.is_flagged_bbm) {
                      updated[it.id] = {
                        flagged: true,
                        catatan: updated[it.id]?.catatan || it.catatan_bbm || "Sesuai rekomendasi evaluasi BBM",
                      };
                    }
                  });
                  return updated;
                });
              }}
              className="text-[11px] font-semibold text-[#E65F2B] hover:underline cursor-pointer flex items-center"
            >
              + Tandai Semua Item Sorotan BBM
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200/80 rounded-xl bg-slate-50/50">
          {(penawaran.items || []).map((it: any) => {
            const isFlagged = flaggedItems[it.id]?.flagged || false;
            const itemNote = flaggedItems[it.id]?.catatan || "";

            return (
              <div key={it.id} className="p-3 text-xs hover:bg-slate-100/50 transition-colors space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFlagged}
                      onChange={() => toggleItemFlag(it.id)}
                      className="w-4 h-4 rounded text-[#E65F2B] focus:ring-[#E65F2B] border-slate-300"
                    />
                    <div>
                      <span className="font-semibold text-slate-800">{it.deskripsi}</span>
                      <span className="text-[10px] text-slate-400 ml-2 font-mono">
                        ({it.volume} {it.satuan}) • {it.kategori_pekerjaan}
                      </span>
                    </div>
                  </label>
                  <div className="text-right font-mono">
                    <span className="text-slate-900 font-bold">
                      Rp {new Intl.NumberFormat("id-ID").format(it.total_harga || 0)}
                    </span>
                    {it.is_flagged_bbm && (
                      <span className="ml-2 text-[10px] text-[#E65F2B] bg-orange-100 border border-orange-200/80 px-1.5 py-0.5 rounded font-bold">
                        Disorot BBM
                      </span>
                    )}
                  </div>
                </div>

                {/* Catatan Sorotan BBM (Tersampaikan Jelas ke DC Specialist) */}
                {it.is_flagged_bbm && it.catatan_bbm && (
                  <div className="ml-6 p-2 rounded-lg bg-orange-50 border border-orange-200/70 text-[11px] text-orange-950 flex items-start justify-between gap-2">
                    <div className="space-x-1">
                      <span className="font-bold text-[#E65F2B] text-[10px] uppercase">
                        Catatan Sorotan BBM:
                      </span>
                      <span className="italic">{it.catatan_bbm}</span>
                    </div>
                    {isFlagged && !itemNote && (
                      <button
                        type="button"
                        onClick={() => handleItemNoteChange(it.id, it.catatan_bbm)}
                        className="text-[10px] font-bold text-[#E65F2B] hover:underline shrink-0 cursor-pointer"
                        title="Salin catatan BBM ke instruksi negosiasi"
                      >
                        Salin ke Instruksi
                      </button>
                    )}
                  </div>
                )}

                {isFlagged && (
                  <div className="pl-6 space-y-1">
                    <input
                      type="text"
                      value={itemNote}
                      placeholder="Instruksi spesifik negosiasi item ini (misal: Turunkan harga upah maks Rp 45.000)..."
                      onChange={(e) => handleItemNoteChange(it.id, e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-amber-300 rounded-lg outline-none focus:ring-1 focus:ring-amber-500 text-amber-900"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Instruksi Negosiasi Resmi (Akan Dilihat oleh Kontraktor) */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-700">
          Instruksi Negosiasi Resmi untuk Rekanan:
        </label>
        <textarea
          rows={3}
          value={instruksi}
          onChange={(e) => setInstruksi(e.target.value)}
          placeholder="Tuliskan arahan umum perbaikan harga atau efisiensi jadwal yang wajib disesuaikan rekanan..."
          className="w-full text-xs p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-1 focus:ring-[#E65F2B] focus:border-[#E65F2B]"
        />
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-2">
        <Link href={`/dc-development/penawaran-rekanan/komparasi/${penawaran.project_id}?from=approval`}>
          <Button variant="outline" className="border-slate-300 text-slate-700 text-xs rounded-xl h-9 hover:bg-slate-50 font-medium cursor-pointer">
            Buka Komparasi Multi-Rekanan <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </Link>

        <Button
          disabled={submitting || totalFlagged === 0}
          onClick={handleReturnForNegotiation}
          className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs h-9 px-5 shadow-xs font-semibold disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Mengembalikan...
            </>
          ) : (
            <>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Kembalikan untuk Negosiasi Rekanan
            </>
          )}
        </Button>
      </div>

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
    </div>
  );
}
