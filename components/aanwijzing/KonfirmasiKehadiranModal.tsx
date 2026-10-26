"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "@/components/ui/feedback-modal";

interface KonfirmasiKehadiranModalProps {
  isOpen: boolean;
  onClose: () => void;
  aanwijzingId: number | null;
  nomorUndangan?: string;
  namaProyek?: string;
  onSuccess: () => void;
}

export function KonfirmasiKehadiranModal({
  isOpen,
  onClose,
  aanwijzingId,
  nomorUndangan,
  namaProyek,
  onSuccess,
}: KonfirmasiKehadiranModalProps) {
  const [status, setStatus] = useState<"HADIR" | "TIDAK_HADIR">("HADIR");
  const [alasan, setAlasan] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset state setiap kali modal dibuka
  useEffect(() => {
    if (isOpen) {
      setStatus("HADIR");
      setAlasan("");
    }
  }, [isOpen]);

  const [feedback, setFeedback] = useState<{
    open: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aanwijzingId) return;

    if (status === "TIDAK_HADIR" && !alasan.trim()) {
      setFeedback({
        open: true,
        type: "error",
        title: "Alasan Wajib Diisi",
        message: "Silakan tuliskan alasan ketidakhadiran perusahaan Anda pada rapat aanwijzing ini.",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/dc-development/aanwijzing/${aanwijzingId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          alasan: status === "TIDAK_HADIR" ? alasan : undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        setFeedback({
          open: true,
          type: "success",
          title: "Konfirmasi Berhasil",
          message: `Konfirmasi kehadiran Anda (${status}) telah berhasil dicatat dalam sistem.`,
        });
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Menyimpan Konfirmasi",
          message: json.message || "Terjadi kesalahan saat menyimpan respon Anda.",
        });
      }
    } catch (err: any) {
      setFeedback({
        open: true,
        type: "error",
        title: "Gagal Menyimpan Konfirmasi",
        message: err.message || "Koneksi ke server terganggu.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFeedbackClose = () => {
    setFeedback((prev) => ({ ...prev, open: false }));
    if (feedback.type === "success") {
      onClose();
      onSuccess();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md p-0 rounded-2xl border-slate-200/80 shadow-2xl bg-white overflow-hidden z-[60]">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-slate-50/50">
            <DialogTitle className="text-lg font-bold text-slate-900">
              Konfirmasi Kehadiran Aanwijzing
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              {nomorUndangan} &bull; {namaProyek}
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Pernyataan Kesediaan Hadir <span className="text-rose-500">*</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("HADIR")}
                  className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    status === "HADIR"
                      ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <CheckCircle2
                    className={`w-4 h-4 ${status === "HADIR" ? "text-emerald-600" : "text-slate-400"}`}
                  />
                  Hadir
                </button>

                <button
                  type="button"
                  onClick={() => setStatus("TIDAK_HADIR")}
                  className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    status === "TIDAK_HADIR"
                      ? "bg-rose-50 border-rose-500 text-rose-700 shadow-sm"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <XCircle
                    className={`w-4 h-4 ${status === "TIDAK_HADIR" ? "text-rose-600" : "text-slate-400"}`}
                  />
                  Tidak Hadir
                </button>
              </div>
            </div>

            {status === "TIDAK_HADIR" && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <label className="block text-xs font-bold text-rose-700">
                  Alasan Tidak Hadir <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Jelaskan alasan ketidakhadiran perusahaan Anda secara jelas..."
                  className="w-full p-3 text-xs rounded-xl border border-rose-200 bg-rose-50/20 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                />
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                Respon kehadiran Anda akan tercatat dalam sistem dan mempengaruhi evaluasi quorum rapat aanwijzing.
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border-slate-200 text-xs font-semibold h-10 px-4"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className={`text-white rounded-xl text-xs font-bold h-10 px-5 cursor-pointer shadow-sm ${
                  status === "HADIR"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20"
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Menyimpan...
                  </>
                ) : (
                  `Simpan Konfirmasi ${status === "HADIR" ? "Hadir" : "Tidak Hadir"}`
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <FeedbackModal
        open={feedback.open}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={handleFeedbackClose}
        className="z-[70]"
      />
    </>
  );
}
