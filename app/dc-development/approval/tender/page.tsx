"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Dashboard from "@/components/dashboard/dashboard";
import { useSession } from "@/context/SessionContext";
import {
  canAccessTenderApproval,
  canUserApproveTender,
  isApprovalAdmin,
  getTenderNextStepLabel,
} from "@/lib/permissions";
import {
  getUserCoverageBranches,
  isBranchAccessible,
  getBranchesUnderInduk,
  getIndukFromCabang,
} from "@/lib/branches";
import {
  Building2,
  FileSignature,
  Eye,
  RefreshCw,
  AlertCircle,
  Inbox,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterOption } from "@/components/ui/filter-select";
import { ApprovalFilterToolbar, ApprovalPageTitle } from "@/components/approval";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { DetailTenderModal } from "@/components/tender/DetailTenderModal";
import ApprovalActionDialog, { ApprovalActionType } from "@/components/approval/ApprovalActionDialog";

export default function ApprovalTenderPage() {
  const { user } = useSession();
  const canAccess = useMemo(() => canAccessTenderApproval(user?.role), [user?.role]);
  const isAdmin = useMemo(() => isApprovalAdmin(user?.role), [user?.role]);
  const userCoverageBranches = useMemo(() => getUserCoverageBranches(user), [user]);

  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"MY_QUEUE" | "ALL">("MY_QUEUE");
  const [adminStatusFilter, setAdminStatusFilter] = useState("all");

  // Detail Modal & Action Dialog State
  const [selectedTender, setSelectedTender] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<ApprovalActionType | null>(null);
  const [actionTarget, setActionTarget] = useState<any | null>(null);

  const handleOpenAction = (action: ApprovalActionType, item: any) => {
    setActionType(action);
    setActionTarget(item);
    setActionDialogOpen(true);
  };

  // Feedback Modal
  const [feedbackModal, setFeedbackModal] = useState<{
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

  // Admin Filter Options
  const adminStatusOptions: FilterOption[] = [
    { value: "all", label: "Semua Status" },
    { value: "PRAKUALIFIKASI", label: "Prakualifikasi" },
    { value: "MENUNGGU APPROVAL DC SPECIALIST", label: "Menunggu DC Specialist" },
    { value: "MENUNGGU APPROVAL B&M GM", label: "Menunggu B&M GM" },
    { value: "MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR", label: "Menunggu Property & Dev Director" },
    { value: "APPROVED", label: "Approved (Disetujui)" },
    { value: "REVISI", label: "Perlu Revisi" },
  ];

  // Load Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/dc-development/tender/approval?tab=all`);
      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Gagal memuat antrean approval tender");
      }
      setItems(json.data || []);
      if (json.summary) setSummary(json.summary);
    } catch (err: any) {
      console.error("Gagal memuat antrean approval tender:", err);
      setError(err.message || "Terjadi kesalahan saat memuat data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canAccess) {
      loadData();
    }
  }, [canAccess, loadData]);

  // Filter Data di Sisi Klien Sesuai Tab & Toolbar
  const filteredItems = useMemo(() => {
    let result = items;

    // 1. Tab "Perlu Tindakan Saya" vs "Semua Berkas Terkait"
    if (activeTab === "MY_QUEUE") {
      result = result.filter(
        (item) =>
          item.status !== "REVISI" &&
          item.status !== "APPROVED" &&
          item.status !== "DITOLAK" &&
          item.status !== "DRAFT" &&
          canUserApproveTender(user?.role, item.status, item.kategori_nilai)
      );
    }

    // 2. Filter Cabang Wewenang Akun Login
    if (userCoverageBranches !== null) {
      result = result.filter((item) => {
        const itemCabang = (item.cabang || "").toUpperCase();
        return isBranchAccessible(itemCabang, userCoverageBranches);
      });
    }

    // 3. Filter Cabang Pilihan Pengguna di Toolbar
    if (branchFilter !== "all") {
      const childBranches = getBranchesUnderInduk(branchFilter);
      result = result.filter((item) => {
        const itemCabang = (item.cabang || "").toUpperCase();
        const itemInduk = getIndukFromCabang(itemCabang);
        return itemInduk === branchFilter || childBranches.includes(itemCabang);
      });
    }

    // 4. Filter Status untuk Admin
    if (isAdmin && adminStatusFilter !== "all") {
      result = result.filter((item) => item.status === adminStatusFilter);
    }

    // 5. Pencarian Search Bar
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.nomor_tender.toLowerCase().includes(q) ||
          (item.project?.nama_proyek || "").toLowerCase().includes(q) ||
          item.cabang.toLowerCase().includes(q) ||
          (item.created_by || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [items, activeTab, user?.role, userCoverageBranches, branchFilter, isAdmin, adminStatusFilter, search]);

  const handleOpenReview = (tender: any) => {
    setSelectedTender(tender);
    setModalOpen(true);
  };

  const handleActionSuccess = (updatedTender: any) => {
    setFeedbackModal({
      open: true,
      type: "success",
      title: "Persetujuan Berhasil Diproses",
      message: `Berkas tender ${updatedTender.nomor_tender} telah berhasil diperbarui (Status: ${updatedTender.status}).`,
    });
    loadData();
  };

  const handleActionError = (msg: string) => {
    setFeedbackModal({
      open: true,
      type: "error",
      title: "Gagal Memproses Aksi",
      message: msg,
    });
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            APPROVED
          </span>
        );
      case "REVISI":
        return (
          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 mr-1" />
            REVISI
          </span>
        );
      case "DITOLAK":
        return (
          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 mr-1" />
            DITOLAK
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-[#E65F2B] border border-orange-200">
            <Clock className="w-3 h-3 mr-1" />
            {status}
          </span>
        );
    }
  };

  // Guard Akses
  if (!canAccess) {
    return (
      <Dashboard title="Approval Pengajuan Proposal Tender">
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Akses Approval Tender Dibatasi</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
            Halaman ini khusus diperuntukkan bagi pejabat peninjau tender (DC Specialist, B&amp;M GM, Direktur Property Development) atau <strong>Administrator</strong>.
          </p>
          <Link href="/dc-development/approval" className="mt-5">
            <Button variant="outline" className="rounded-xl text-xs h-9">
              Kembali ke Hub Approval
            </Button>
          </Link>
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard title="Approval Pengajuan Proposal Tender">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)] space-y-4">
        {/* Header Breadcrumb & Title */}
        <ApprovalPageTitle
          title="Antrean Approval Rekanan Tender DC"
          breadcrumb="SPARTA / APPROVAL / Pengajuan Proposal Tender"
          backHref="/dc-development/approval"
        />

        {/* Toolbar Tabs & Filters Reusable SPARTA */}
        <ApprovalFilterToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          branchFilter={branchFilter}
          onBranchChange={setBranchFilter}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingCount={summary?.my_pending_count ?? 0}
          totalCount={summary?.total_all ?? 0}
          isAdmin={isAdmin}
          adminStatusFilter={adminStatusFilter}
          onAdminStatusChange={setAdminStatusFilter}
          adminStatusOptions={adminStatusOptions}
        />

        {/* Tabel Antrean Dokumen Approval */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">Nomor Tender &amp; Tgl</th>
                  <th className="py-3.5 px-4">Proyek &amp; Cabang DC</th>
                  <th className="py-3.5 px-4 text-right">Nilai Anggaran</th>
                  <th className="py-3.5 px-4 text-center">Kategori Ambang Batas</th>
                  <th className="py-3.5 px-4">Calon Rekanan</th>
                  <th className="py-3.5 px-4 text-center">Status Berkas</th>
                  <th className="py-3.5 px-4 text-center w-36">Aksi Persetujuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-[#E65F2B]" />
                        <p className="text-xs">Memuat antrean persetujuan tender...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Inbox className="w-8 h-8 text-slate-300" />
                        <p className="text-xs font-medium text-slate-500">
                          {activeTab === "MY_QUEUE"
                            ? "Tidak ada berkas yang memerlukan persetujuan Anda saat ini."
                            : "Tidak ada berkas tender yang ditemukan."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((tender, index) => {
                    const isAbove1M = tender.kategori_nilai === "DI_ATAS_1M";
                    const isMyTurn =
                      tender.status !== "REVISI" &&
                      tender.status !== "APPROVED" &&
                      tender.status !== "DITOLAK" &&
                      tender.status !== "DRAFT" &&
                      canUserApproveTender(user?.role, tender.status, tender.kategori_nilai);

                    const kontraktorList = (tender.peserta || []).filter((p: any) => p.peran === "MAIN_KONTRAKTOR");
                    const konsultanList = (tender.peserta || []).filter((p: any) => p.peran.includes("KONSULTAN"));

                    return (
                      <tr
                        key={tender.id}
                        className={`hover:bg-slate-50/80 transition-colors ${isMyTurn ? "bg-orange-50/30" : ""
                          }`}
                      >
                        {/* No */}
                        <td className="py-3.5 px-4 text-center font-medium text-slate-400">
                          {index + 1}
                        </td>

                        {/* Nomor Tender */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 text-xs">
                            {tender.nomor_tender}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(tender.created_at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </td>

                        {/* Proyek & Cabang DC */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-start space-x-2">
                            <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 mt-0.5">
                              <Building2 className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 leading-snug">
                                {tender.project?.nama_proyek || "-"}
                              </p>
                              <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 mt-0.5">
                                <span className="font-medium text-slate-700">{tender.cabang}</span>
                                {tender.project?.kode && <span>• Kode: {tender.project.kode}</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Nilai Anggaran */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-bold text-slate-900 text-xs tracking-tight">
                            {formatRupiah(tender.nilai_proyek)}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Maker: {tender.created_by?.split("@")[0]}
                          </p>
                        </td>

                        {/* Kategori Ambang Batas */}
                        <td className="py-3.5 px-4 text-center">
                          {isAbove1M ? (
                            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-100 text-[#E65F2B] border border-orange-200">
                              &gt; Rp 1 Miliar
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                              &le; Rp 1 Miliar
                            </span>
                          )}
                        </td>

                        {/* Calon Rekanan */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col space-y-0.5">
                            <span className="font-medium text-slate-800">
                              {kontraktorList.length} Kontraktor
                            </span>
                            {konsultanList.length > 0 && (
                              <span className="text-[10px] text-blue-600 font-medium">
                                {konsultanList.length} Konsultan
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          {getStatusBadge(tender.status)}
                        </td>

                        {/* Aksi */}
                        <td className="py-3.5 px-4 text-center">
                          <Button
                            onClick={() => handleOpenReview(tender)}
                            size="sm"
                            className={`h-8 px-3 rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 w-full justify-center transition-all ${isMyTurn
                                ? "bg-[#E65F2B] hover:bg-[#d04f1f] text-white"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                              }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isMyTurn ? "Tinjau & Setujui" : "Detail Berkas"}</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Detail & Persetujuan (Sama persis dengan Detail Menu Transaksi) */}
        {selectedTender && (
          <DetailTenderModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            tender={selectedTender}
            showApprovalActions={
              selectedTender?.status !== "REVISI" &&
              selectedTender?.status !== "APPROVED" &&
              selectedTender?.status !== "DITOLAK" &&
              canUserApproveTender(user?.role, selectedTender?.status, selectedTender?.kategori_nilai)
            }
            onApprovalAction={(action, item) => handleOpenAction(action, item)}
            userRole={user?.role}
          />
        )}

        {/* Action Dialog for Approve, Revisi, Tolak */}
        {actionTarget && actionType && (
          <ApprovalActionDialog
            open={actionDialogOpen}
            onOpenChange={setActionDialogOpen}
            action={actionType}
            target={actionTarget}
            moduleType="tender"
            roleName={user?.role}
            nextStepLabel={getTenderNextStepLabel(actionTarget.status, actionTarget.kategori_nilai)}
            onSuccess={(updatedItem) => {
              loadData();
              // Langsung tutup modal detail & dialog aksi agar tidak menumpuk saat feedback muncul
              setModalOpen(false);
              setSelectedTender(null);
              setActionDialogOpen(false);
              setActionTarget(null);

              const currentAction = actionType;
              const target = updatedItem || actionTarget;
              const noTender = target?.nomor_tender || "";
              const creator = target?.created_by || "Maker";
              const namaProyek = target?.project?.nama_proyek || "";

              setFeedbackModal({
                open: true,
                type: "success",
                title:
                  currentAction === "APPROVE"
                    ? "Pengajuan Tender Berhasil Disetujui"
                    : currentAction === "REVISI"
                    ? "Permintaan Revisi Tender Berhasil Dikirim"
                    : "Pengajuan Tender Ditolak",
                message:
                  currentAction === "APPROVE"
                    ? `Proposal Tender ${noTender} (${namaProyek}) berhasil disetujui dan dialihkan ke tahap proses selanjutnya.`
                    : currentAction === "REVISI"
                    ? `Proposal Tender ${noTender} (${namaProyek}) berhasil dikembalikan kepada maker (${creator}) untuk dilakukan revisi.`
                    : `Proposal Tender ${noTender} (${namaProyek}) telah ditolak.`
              });
            }}
          />
        )}

        {/* Feedback Modal Reusable SPARTA */}
        <FeedbackModal
          open={feedbackModal.open}
          onClose={() => {
            setFeedbackModal((prev) => ({ ...prev, open: false }));
            setModalOpen(false);
            setSelectedTender(null);
          }}
          type={feedbackModal.type}
          title={feedbackModal.title}
          message={feedbackModal.message}
          className="z-[70]"
        />
      </div>
    </Dashboard>
  );
}
