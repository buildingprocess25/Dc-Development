"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Dashboard from "@/components/dashboard/dashboard";
import { useSession } from "@/context/SessionContext";
import { formatRupiah, cn, toTitleCase } from "@/lib/utils";
import {
  canAccessApproval,
  isApprovalAdmin,
  getApprovalQueueFilterForRole,
  canAccessRabOeApproval,
  canUserViewRabOeSubmission
} from "@/lib/permissions";
import {
  ArrowLeft,
  Search,
  Filter,
  AlertCircle,
  XCircle,
  Eye,
  RefreshCw,
  HardHat,
  Calculator,
  ShieldCheck,
  Building2,
  Clock,
  Layers,
  Sparkles,
  Inbox,
  MessageSquare
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterSelect, FilterOption } from "@/components/ui/filter-select";
import { BranchFilterSelect } from "@/components/ui/branch-filter-select";
import { getBranchesUnderInduk, getUserCoverageBranches, isBranchAccessible } from "@/lib/branches";
import { hasPreviousApprovalNotes } from "@/lib/approval-notes";
import DetailRenovasiModal from "@/components/renovasi/DetailRenovasiModal";
import ApprovalActionDialog, { ApprovalActionType } from "@/components/approval/ApprovalActionDialog";
import { ApprovalFilterToolbar, ApprovalPageTitle } from "@/components/approval";
import { FeedbackModal } from "@/components/ui/feedback-modal";

export default function ApprovalRabOePage() {
  const { user } = useSession();
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userCoverageBranches = useMemo(() => getUserCoverageBranches(user), [user]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"MY_QUEUE" | "ALL">("MY_QUEUE");
  const [adminStatusFilter, setAdminStatusFilter] = useState("all");

  // Modals state
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const [actionTarget, setActionTarget] = useState<any | null>(null);
  const [actionType, setActionType] = useState<ApprovalActionType | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);

  const [feedbackModal, setFeedbackModal] = useState<{
    open: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({
    open: false,
    type: "success",
    title: "",
    message: ""
  });

  const isAdmin = useMemo(() => isApprovalAdmin(user?.role), [user?.role]);
  const userQueueStatus = useMemo(() => getApprovalQueueFilterForRole(user?.role), [user?.role]);
  const canAccessRabOe = useMemo(() => canAccessRabOeApproval(user?.role), [user?.role]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/dc-development/renovasi/approval?tab=all");
      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Gagal memuat daftar approval");
      }
      setItems(json.data || []);
      setSummary(json.summary || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canAccessRabOe) {
      loadData();
    }
  }, [canAccessRabOe]);

  // Check if an item can be acted upon by the current logged-in user
  const canUserApproveItem = (item: any) => {
    if (!item) return false;
    const itemBranch = item.cabang || item.project?.cabang || "";

    // 1. Cek coverage cabang akun user
    if (!isBranchAccessible(itemBranch, userCoverageBranches)) {
      return false;
    }

    // 2. Administrator memiliki hak approve untuk semua tahapan
    if (isAdmin) {
      return (
        item.status === "MENUNGGU APPROVAL B&M MANAGER" ||
        item.status === "MENUNGGU APPROVAL DC SPECIALIST" ||
        item.status === "MENUNGGU APPROVAL DC MANAGER"
      );
    }

    // 3. Approver spesifik (B&M Manager, DC Specialist, DC Manager)
    if (Array.isArray(userQueueStatus)) {
      return userQueueStatus.includes(item.status);
    }

    return false;
  };

  // Trigger Action Dialog
  const handleOpenAction = (action: ApprovalActionType, item: any) => {
    setActionType(action);
    setActionTarget(item);
    setActionDialogOpen(true);
  };

  // View Detail
  const handleViewDetail = (item: any) => {
    setSelectedItem(item);
    setDetailModalOpen(true);
  };

  // Filtered List
  const filteredList = useMemo(() => {
    return items.filter((item) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const noPengajuan = (item.nomor_pengajuan || "").toLowerCase();
        const proyek = (item.project?.nama_proyek || "").toLowerCase();
        const kode = (item.project?.kode || "").toLowerCase();
        const cabang = (item.cabang || item.project?.cabang || "").toLowerCase();
        const jenis = (item.jenis_renovasi || "").toLowerCase();

        const match =
          noPengajuan.includes(q) ||
          proyek.includes(q) ||
          kode.includes(q) ||
          cabang.includes(q) ||
          jenis.includes(q);

        if (!match) return false;
      }

      const itemBranch = item.cabang || item.project?.cabang || "";

      // 2. Coverage Filter (Batasi akses sesuai coverage akun)
      if (!isBranchAccessible(itemBranch, userCoverageBranches)) {
        return false;
      }

      // 3. Branch Filter Dropdown
      if (branchFilter && branchFilter !== "all") {
        const childBranches = getBranchesUnderInduk(branchFilter);
        if (!childBranches.some((b) => b.toUpperCase() === itemBranch.toUpperCase())) {
          return false;
        }
      }

      // 4. Status scoping (Aturan Bertingkat)
      if (isAdmin) {
        if (adminStatusFilter !== "all") {
          return item.status === adminStatusFilter;
        }
        return true;
      } else {
        if (activeTab === "MY_QUEUE") {
          return canUserApproveItem(item);
        } else {
          // Tab "Semua Berkas Terkait": Wajib terapkan aturan bertingkat
          return canUserViewRabOeSubmission(user, item);
        }
      }
    });
  }, [items, searchQuery, branchFilter, activeTab, adminStatusFilter, isAdmin, user, userQueueStatus, userCoverageBranches]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-emerald-50 text-emerald-800 border-emerald-200/80";
      case "MENUNGGU APPROVAL B&M MANAGER":
      case "MENUNGGU APPROVAL DC SPECIALIST":
      case "MENUNGGU APPROVAL DC MANAGER":
        return "bg-blue-50 text-blue-800 border-blue-200/80";
      case "REVISI":
        return "bg-amber-50 text-amber-800 border-amber-200/80";
      case "DITOLAK":
        return "bg-rose-50 text-rose-800 border-rose-200/80";
      case "DRAFT":
      default:
        return "bg-slate-100 text-slate-700 border-slate-200/80";
    }
  };

  const adminStatusOptions: FilterOption[] = [
    { value: "all", label: "Semua Status" },
    { value: "MENUNGGU APPROVAL B&M MANAGER", label: "Menunggu B&M Manager" },
    { value: "MENUNGGU APPROVAL DC SPECIALIST", label: "Menunggu DC Specialist" },
    { value: "MENUNGGU APPROVAL DC MANAGER", label: "Menunggu DC Manager" },
    { value: "APPROVED", label: "Approved (Disetujui)" },
    { value: "REVISI", label: "Perlu Revisi" },
    { value: "DITOLAK", label: "Ditolak" }
  ];

  const pendingCountForMe = useMemo(() => {
    return items.filter((item) => canUserApproveItem(item)).length;
  }, [items, userCoverageBranches, isAdmin, userQueueStatus]);

  const totalCountForMe = useMemo(() => {
    if (isAdmin) return items.length;
    return items.filter((item) => canUserViewRabOeSubmission(user, item)).length;
  }, [items, user, isAdmin]);

  if (!canAccessRabOe) {
    return (
      <Dashboard title="Akses Ditolak">
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Akses Ditolak</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
            Halaman persetujuan RAB / OE hanya dapat diakses oleh <strong>Branch Building & Maintenance Manager</strong>, <strong>DC Building & Development Specialist</strong>, <strong>DC Building & Development Manager</strong>, atau <strong>Administrator</strong>.
          </p>
          <Link href="/dc-development/approval" className="mt-5">
            <Button variant="outline" className="rounded-xl text-xs h-9">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Kembali ke Pusat Approval
            </Button>
          </Link>
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard
      title={
        <ApprovalPageTitle
          breadcrumb="Pusat Approval / RAB & OE"
          title="Antrean Approval RAB / OE"
        />
      }
      headerActions={
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer text-xs h-9"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
          Segarkan
        </Button>
      }
    >
      <div className="flex-1 overflow-y-auto px-6 md:px-12 py-6 space-y-5">
        {/* Filter & Search Bar */}
        <ApprovalFilterToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Cari no. pengajuan / proyek..."
          branchFilter={branchFilter}
          onBranchChange={setBranchFilter}
          isAdmin={isAdmin}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingCount={pendingCountForMe}
          totalCount={totalCountForMe}
          adminStatusFilter={adminStatusFilter}
          onAdminStatusChange={setAdminStatusFilter}
          adminStatusOptions={adminStatusOptions}
        />

        {/* Content Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 text-center min-h-[300px]">
              <div className="w-9 h-9 border-3 border-[#E65F2B] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-semibold text-slate-500 animate-pulse">
                Memuat antrean pengajuan approval...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-12 text-center min-h-[300px]">
              <div className="bg-rose-50/80 p-6 rounded-2xl border border-rose-200/80 flex flex-col items-center max-w-sm text-center shadow-2xs">
                <AlertCircle className="w-6 h-6 text-rose-600 mb-2" />
                <p className="text-rose-900 font-bold mb-1 text-sm">Gagal Memuat Antrean</p>
                <p className="text-rose-600/90 text-xs leading-relaxed">{error}</p>
              </div>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center min-h-[360px]">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#E65F2B] flex items-center justify-center mb-3.5 shadow-2xs">
                <Inbox className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Tidak Ada Antrean Approval
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
                {searchQuery || branchFilter !== "all" || adminStatusFilter !== "all"
                  ? "Tidak ada pengajuan yang cocok dengan kriteria pencarian atau filter yang dipilih."
                  : activeTab === "MY_QUEUE"
                    ? "Semua pengajuan pada antrean peran Anda telah diproses. Antrean bersih!"
                    : "Belum ada riwayat pengajuan Penawaran RAB/OE."}
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="text-[10px] text-slate-500 bg-slate-50/80 uppercase tracking-wider font-bold sticky top-0 z-10 border-b border-slate-200/80">
                  <tr>
                    <th scope="col" className="px-4 py-3.5 w-12 text-center">No</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Nomor Pengajuan</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Tanggal</th>
                    <th scope="col" className="px-4 py-3.5 min-w-[200px]">Proyek Bangunan DC</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Cabang</th>
                    <th scope="col" className="px-4 py-3.5 min-w-[150px]">Jenis Renovasi</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Lingkup & Durasi</th>
                    <th scope="col" className="px-4 py-3.5 text-right whitespace-nowrap">Total RAB / OE</th>
                    <th scope="col" className="px-4 py-3.5 text-center whitespace-nowrap">Status</th>
                    <th scope="col" className="px-4 py-3.5 text-center w-28 whitespace-nowrap">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map((item, index) => {
                    const project = item.project || {};
                    const createdDate = new Date(item.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric"
                    });
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 text-center font-bold text-slate-400">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {item.nomor_pengajuan}
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-medium">
                          {createdDate}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 leading-snug">
                              {project.kode ? `${project.kode} - ` : ""}{project.nama_proyek}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              {project.tipe || "DC WAREHOUSE"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                          {item.cabang || project.cabang || "-"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {item.jenis_renovasi ? toTitleCase(item.jenis_renovasi) : "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 block">{item.lingkup_pekerjaan}</span>
                          <span className="text-[11px] text-slate-400 block font-mono">{item.durasi_hari} Hari</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap font-mono text-xs">
                          {formatRupiah(item.grand_total || 0)}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={cn(
                                "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                getStatusBadge(item.status)
                              )}
                            >
                              {item.status}
                            </span>
                            {hasPreviousApprovalNotes(item.catatan_pengajuan) && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 shadow-2xs">
                                <MessageSquare className="w-2.5 h-2.5 text-amber-600" />
                                Ada Catatan
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            {canUserApproveItem(item) ? (
                              <Button
                                size="sm"
                                onClick={() => handleViewDetail(item)}
                                className="h-7 px-2.5 rounded-lg bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                                title="Tinjau Berkas & Lakukan Persetujuan / Revisi"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Tinjau
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewDetail(item)}
                                className="h-7 px-2.5 rounded-lg border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 cursor-pointer font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                                title="Lihat Detail Berkas & RAB"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                                Detail
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal with Approval Actions enabled if approvable */}
      {selectedItem && (
        <DetailRenovasiModal
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          renovasi={selectedItem}
          canEdit={false}
          showApprovalActions={canUserApproveItem(selectedItem)}
          onApprovalAction={(action: ApprovalActionType, item: any) => {
            handleOpenAction(action, item);
          }}
        />
      )}

      {/* Action Dialog for Approve, Revisi, Tolak */}
      {actionTarget && actionType && (
        <ApprovalActionDialog
          open={actionDialogOpen}
          onOpenChange={setActionDialogOpen}
          action={actionType}
          target={actionTarget}
          onSuccess={(updatedItem) => {
            // Refresh table data
            loadData();
            // If the detail modal is currently showing the same item, update or close it
            if (selectedItem && selectedItem.id === actionTarget.id) {
              setDetailModalOpen(false);
              setSelectedItem(null);
            }

            const currentAction = actionType;
            const noPengajuan = actionTarget.nomor_pengajuan || "";
            const creator = actionTarget.created_by || "Branch Building Koordinator";
            const namaProyek = actionTarget.project?.nama_proyek || actionTarget.nama_proyek || "";

            setFeedbackModal({
              open: true,
              type: "success",
              title:
                currentAction === "APPROVE"
                  ? "Pengajuan Berhasil Disetujui"
                  : currentAction === "REVISI"
                  ? "Permintaan Revisi Berhasil Dikirim"
                  : "Pengajuan Ditolak",
              message:
                currentAction === "APPROVE"
                  ? `Pengajuan ${noPengajuan} (${namaProyek}) berhasil disetujui dan dialihkan ke tahap proses berikutnya.`
                  : currentAction === "REVISI"
                  ? `Pengajuan ${noPengajuan} (${namaProyek}) berhasil dikembalikan kepada akun pembuat (${creator}) untuk dilakukan revisi.`
                  : `Pengajuan ${noPengajuan} (${namaProyek}) telah ditolak.`
            });
          }}
        />
      )}

      {/* Pop-up Pemberitahuan Konfirmasi Aksi Selesai */}
      <FeedbackModal
        open={feedbackModal.open}
        type={feedbackModal.type}
        title={feedbackModal.title}
        message={feedbackModal.message}
        onClose={() => setFeedbackModal((prev) => ({ ...prev, open: false }))}
      />
    </Dashboard>
  );
}
