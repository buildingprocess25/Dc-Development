"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Dashboard from "@/components/dashboard/dashboard";
import { useSession } from "@/context/SessionContext";
import { isApprovalAdmin, isDcBuildingManager } from "@/lib/permissions";
import { getUserCoverageBranches, isBranchAccessible } from "@/lib/branches";
import {
  FileText,
  Eye,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  MapPin,
  Users,
  Timer,
  FileDown,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApprovalFilterToolbar, ApprovalPageTitle } from "@/components/approval";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function ApprovalAanwijzingPage() {
  const { user } = useSession();
  const isAdmin = useMemo(() => isApprovalAdmin(user?.role), [user?.role]);
  const isManager = useMemo(() => isDcBuildingManager(user?.role), [user?.role]);
  const canAccess = isAdmin || isManager;
  const userCoverage = useMemo(() => getUserCoverageBranches(user), [user]);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"MY_QUEUE" | "ALL">("MY_QUEUE");
  const [statusFilter, setStatusFilter] = useState("all");

  // Review & Decision Modal
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [decisionAction, setDecisionAction] = useState<"LANJUT" | "ON_HOLD" | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Feedback Modal
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dc-development/aanwijzing");
      const json = await res.json();
      if (json.status === "success" && Array.isArray(json.data)) {
        setItems(json.data);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error("Gagal memuat antrean approval aanwijzing:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Antrean saya: Khusus status MENUNGGU_APPROVAL_DC_MANAGER (< 1M yang hadir < 3)
  const myQueueItems = useMemo(() => {
    return items.filter((item) => {
      if (item.status !== "MENUNGGU_APPROVAL_DC_MANAGER") return false;
      const branch = (item.cabang || item.project?.cabang || "").toUpperCase();
      return isBranchAccessible(branch, userCoverage);
    });
  }, [items, userCoverage]);

  // Tab All: Seluruh berkas yang ter-cover
  const allItems = useMemo(() => {
    return items.filter((item) => {
      const branch = (item.cabang || item.project?.cabang || "").toUpperCase();
      return isBranchAccessible(branch, userCoverage);
    });
  }, [items, userCoverage]);

  // Items terfilter
  const displayedItems = useMemo(() => {
    const source = activeTab === "MY_QUEUE" ? myQueueItems : allItems;

    return source.filter((item) => {
      // Filter Cabang
      if (branchFilter && branchFilter !== "all") {
        const itemBranch = (item.cabang || item.project?.cabang || "").toUpperCase();
        if (itemBranch !== branchFilter.toUpperCase()) return false;
      }

      // Filter Status (jika di tab ALL)
      if (activeTab === "ALL" && statusFilter && statusFilter !== "all") {
        if (item.status !== statusFilter) return false;
      }

      // Filter Search
      if (search) {
        const q = search.toLowerCase();
        const matchNo = item.nomor_undangan.toLowerCase().includes(q);
        const matchName = item.project?.nama_proyek?.toLowerCase().includes(q);
        const matchKode = item.project?.kode?.toLowerCase().includes(q);
        if (!matchNo && !matchName && !matchKode) return false;
      }

      return true;
    });
  }, [activeTab, myQueueItems, allItems, branchFilter, statusFilter, search]);

  const handleOpenReview = (item: any) => {
    setSelectedItem(item);
    setDecisionAction(null);
    setDecisionNotes("");
    setReviewModalOpen(true);
  };

  const handleSubmitDecision = async () => {
    if (!selectedItem || !decisionAction) return;

    if (decisionAction === "ON_HOLD" && !decisionNotes.trim()) {
      setFeedback({
        open: true,
        type: "error",
        title: "Catatan Wajib Diisi",
        message: "Silakan isi catatan alasan penolakan / penahanan (ON HOLD) pelaksanaan aanwijzing.",
      });
      return;
    }

    setSubmittingDecision(true);
    try {
      const res = await fetch(`/api/dc-development/aanwijzing/${selectedItem.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: decisionAction,
          notes: decisionNotes,
        }),
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        setReviewModalOpen(false);
        setFeedback({
          open: true,
          type: "success",
          title: decisionAction === "LANJUT" ? "Aanwijzing Disetujui Lanjut" : "Aanwijzing Di-set ON HOLD",
          message: json.message || "Keputusan approval berhasil disimpan ke sistem.",
        });
        fetchData();
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Menyimpan Keputusan",
          message: json.message || "Terjadi kesalahan saat menyimpan keputusan approval.",
        });
      }
    } catch (err: any) {
      setFeedback({
        open: true,
        type: "error",
        title: "Gagal Menyimpan Keputusan",
        message: err.message || "Koneksi ke server terganggu.",
      });
    } finally {
      setSubmittingDecision(false);
    }
  };

  if (!canAccess) {
    return (
      <Dashboard title="Approval Undangan Aanwijzing">
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Akses Modul Approval Dibatasi</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
            Halaman ini khusus untuk <strong>DC Building & Development Manager</strong> atau <strong>Administrator</strong> untuk memberikan persetujuan kelanjutan aanwijzing proyek bernilai &lt; 1M dengan rekanan hadir &lt; 3 orang.
          </p>
          <Link href="/dc-development/approval" className="mt-5">
            <Button variant="outline" className="rounded-xl text-xs h-9">
              Kembali ke Approval Hub
            </Button>
          </Link>
        </div>
      </Dashboard>
    );
  }

  const statusBadges: Record<string, { label: string; cls: string }> = {
    MENUNGGU_KONFIRMASI: {
      label: "Menunggu Konfirmasi",
      cls: "bg-amber-100 text-amber-800 border-amber-200",
    },
    AANWIJZING_LANJUT: {
      label: "Aanwijzing Lanjut",
      cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
    MENUNGGU_APPROVAL_DC_MANAGER: {
      label: "Approval DC Manager",
      cls: "bg-blue-100 text-blue-800 border-blue-200",
    },
    ON_HOLD: {
      label: "ON HOLD (Ditahan)",
      cls: "bg-rose-100 text-rose-800 border-rose-200",
    },
  };

  return (
    <Dashboard title="Approval Undangan Aanwijzing">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)] space-y-5">
        {/* PAGE TITLE */}
        <ApprovalPageTitle
          breadcrumb="Approval Undangan Aanwijzing"
          title="Antrean Persetujuan Undangan Aanwijzing"
          backHref="/dc-development/approval"
          extraBadge={
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-[#E65F2B] border border-orange-200">
              SOP SAT/SOP/BM/004
            </span>
          }
        />

        {/* TOOLBAR FILTER */}
        <ApprovalFilterToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          branchFilter={branchFilter}
          onBranchChange={setBranchFilter}
          isAdmin={isAdmin}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingCount={myQueueItems.length}
          totalCount={allItems.length}
          adminStatusFilter={statusFilter}
          onAdminStatusChange={setStatusFilter}
          adminStatusOptions={[
            { label: "Semua Status", value: "all" },
            { label: "Menunggu Approval DC Manager", value: "MENUNGGU_APPROVAL_DC_MANAGER" },
            { label: "Aanwijzing Lanjut", value: "AANWIJZING_LANJUT" },
            { label: "ON HOLD (Ditahan)", value: "ON_HOLD" },
          ]}
        />

        {/* TABEL ANTREAN */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">No. Undangan</th>
                  <th className="py-3 px-4">Proyek & Cabang</th>
                  <th className="py-3 px-4">Jadwal Rapat</th>
                  <th className="py-3 px-4 text-center">Rekanan Hadir</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Memuat antrean approval...
                    </td>
                  </tr>
                ) : displayedItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      {activeTab === "MY_QUEUE"
                        ? "Tidak ada pengajuan yang memerlukan tindakan persetujuan Anda saat ini."
                        : "Tidak ada riwayat berkas approval ditemukan."}
                    </td>
                  </tr>
                ) : (
                  displayedItems.map((item) => {
                    const hadir = (item.peserta || []).filter(
                      (p: any) => p.status_konfirmasi === "HADIR"
                    ).length;
                    const total = (item.peserta || []).length;
                    const isMyQueue = item.status === "MENUNGGU_APPROVAL_DC_MANAGER";
                    const badge = statusBadges[item.status] || {
                      label: item.status,
                      cls: "bg-slate-100 text-slate-800",
                    };

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {item.nomor_undangan}
                          <div className="text-[10px] text-slate-400 font-sans font-normal mt-0.5">
                            Proyek &lt; 1M
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{item.project?.nama_proyek}</p>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {item.cabang} &bull; {item.project?.kode}
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-800">
                            {new Date(item.tanggal_pelaksanaan).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                          <p className="text-[11px] text-slate-500 font-medium">{item.waktu_pelaksanaan}</p>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 font-bold text-xs bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200">
                            <Users className="w-3.5 h-3.5 text-amber-600" />
                            {hadir} dari {total} Hadir (&lt; 3)
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isMyQueue && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleOpenReview(item)}
                                className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs font-bold rounded-xl h-8 px-3.5 cursor-pointer shadow-sm shadow-orange-500/20"
                              >
                                Tinjau & Putuskan
                              </Button>
                            )}

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                window.open(
                                  `/api/dc-development/aanwijzing/${item.id}/pdf?download=1`,
                                  "_blank"
                                )
                              }
                              title="Unduh PDF Resmi"
                              className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              <FileDown className="w-4 h-4 text-[#E65F2B]" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL REVIEW & KEPUTUSAN DC MANAGER */}
      <Dialog open={reviewModalOpen} onOpenChange={(open) => !open && setReviewModalOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border-slate-200/80 shadow-2xl bg-white">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-slate-50/50">
            <DialogTitle className="text-lg font-bold text-slate-900">
              Otorisasi Kelanjutan Undangan Aanwijzing
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedItem?.nomor_undangan} &bull; {selectedItem?.project?.nama_proyek} ({selectedItem?.cabang})
            </p>
          </DialogHeader>

          {selectedItem && (
            <div className="px-6 py-5 space-y-4 text-xs">
              {/* Alert Peringatan Quorum */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Quorum Kehadiran Kurang dari 3 Rekanan Kontraktor</p>
                  <p className="text-[11.5px] text-amber-800 mt-0.5">
                    Hanya terdapat{" "}
                    <strong>
                      {selectedItem.peserta.filter((p: any) => p.status_konfirmasi === "HADIR").length} rekanan
                    </strong>{" "}
                    yang mengonfirmasi hadir dari total {selectedItem.peserta.length} rekanan yang diundang. Sebagai DC Building & Development Manager, Anda dapat memutuskan apakah rapat aanwijzing tetap dilanjutkan atau ditahan (ON HOLD).
                  </p>
                </div>
              </div>

              {/* Rincian Respon Kontraktor */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Rincian Respon Kontraktor:
                </h4>
                <div className="space-y-1.5">
                  {selectedItem.peserta.map((p: any, idx: number) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/60 shadow-2xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{p.vendor.nama_perusahaan}</p>
                        {p.alasan_tidak_hadir && (
                          <p className="text-[10px] text-rose-600 mt-0.5 italic">
                            Alasan: {p.alasan_tidak_hadir}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          p.status_konfirmasi === "HADIR"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : p.status_konfirmasi === "TIDAK_HADIR"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {p.status_konfirmasi}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pilihan Keputusan Manager */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block font-bold text-slate-800">
                  Keputusan Persetujuan DC Manager <span className="text-rose-500">*</span>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDecisionAction("LANJUT")}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      decisionAction === "LANJUT"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      Setujui Tetap Lanjut
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Aanwijzing dilanjutkan dengan rekanan yang hadir (status: AANWIJZING_LANJUT).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecisionAction("ON_HOLD")}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      decisionAction === "ON_HOLD"
                        ? "bg-rose-50 border-rose-500 text-rose-900 shadow-sm"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-rose-700">
                      <XCircle className="w-4 h-4" />
                      Tolak / On Hold
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Pelaksanaan ditunda / ditahan terlebih dahulu (status: ON_HOLD).
                    </p>
                  </button>
                </div>
              </div>

              {/* Catatan Keputusan */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800">
                  Catatan Keputusan {decisionAction === "ON_HOLD" && <span className="text-rose-500">*</span>}
                </label>
                <textarea
                  rows={2}
                  required={decisionAction === "ON_HOLD"}
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder={
                    decisionAction === "ON_HOLD"
                      ? "Wajib mencantumkan alasan penahanan (ON HOLD) pelaksanaan aanwijzing..."
                      : "Catatan atau instruksi tambahan dari DC Manager (opsional)..."
                  }
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E65F2B]/20 focus:border-[#E65F2B] transition-all"
                />
              </div>
            </div>
          )}

          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReviewModalOpen(false)}
              disabled={submittingDecision}
              className="rounded-xl border-slate-200 text-xs font-semibold h-10 px-4"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSubmitDecision}
              disabled={submittingDecision || !decisionAction}
              className={`text-white rounded-xl text-xs font-bold h-10 px-5 cursor-pointer shadow-sm ${
                decisionAction === "LANJUT"
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                  : decisionAction === "ON_HOLD"
                  ? "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20"
                  : "bg-slate-300"
              }`}
            >
              {submittingDecision ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Menyimpan...
                </>
              ) : decisionAction === "LANJUT" ? (
                "Simpan & Setujui Lanjut"
              ) : decisionAction === "ON_HOLD" ? (
                "Simpan & Set ON HOLD"
              ) : (
                "Pilih Keputusan di Atas"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeedbackModal
        open={feedback.open}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => {
          setFeedback((prev) => ({ ...prev, open: false }));
          setReviewModalOpen(false);
          setSelectedItem(null);
        }}
        className="z-[70]"
      />
    </Dashboard>
  );
}
