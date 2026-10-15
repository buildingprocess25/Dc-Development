"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Dashboard from "@/components/dashboard/dashboard";
import { useSession } from "@/context/SessionContext";
import { cn } from "@/lib/utils";
import {
  canAccessFungsiRuangApproval,
  canUserApproveFungsiRuang,
  canUserViewFungsiRuangSubmission,
  isApprovalAdmin,
} from "@/lib/permissions";
import {
  getBranchesUnderInduk,
  getUserCoverageBranches,
  isBranchAccessible,
} from "@/lib/branches";
import {
  ArrowLeft,
  Calendar,
  User,
  Tag,
  Building2,
  Eye,
  RefreshCw,
  AlertCircle,
  Inbox,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterOption } from "@/components/ui/filter-select";
import { ApprovalFilterToolbar, ApprovalPageTitle } from "@/components/approval";
import { ApprovalActionType } from "@/components/approval/ApprovalActionDialog";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import ReviewFungsiRuangModal from "@/components/fungsi-ruang/ReviewFungsiRuangModal";

export default function ApprovalFungsiRuangPage() {
  const { user } = useSession();
  const canAccess = useMemo(() => canAccessFungsiRuangApproval(user?.role), [user?.role]);
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

  // Review Modal State
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

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
    { value: "MENUNGGU APPROVAL BM/DBM", label: "Menunggu BM / DBM" },
    { value: "MENUNGGU APPROVAL REGIONAL B&M MANAGER", label: "Menunggu Regional B&M Manager" },
    { value: "MENUNGGU APPROVAL DC SPECIALIST", label: "Menunggu DC Specialist" },
    { value: "MENUNGGU APPROVAL B&M GM", label: "Menunggu B&M GM" },
    { value: "MENUNGGU APPROVAL OPERATION DIRECTOR", label: "Menunggu Operation Director" },
    { value: "MENUNGGU APPROVAL PROPERTY DEV MANAGER", label: "Menunggu Property Dev Manager" },
    { value: "APPROVED", label: "Approved (Disetujui)" },
    { value: "REVISI", label: "Perlu Revisi" },
  ];

  // Load Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/dc-development/fungsi-ruang/approval?tab=all`);
      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Gagal memuat antrean approval fungsi ruang");
      }
      setItems(json.data || []);
      if (json.summary) setSummary(json.summary);
    } catch (err: any) {
      console.error("Gagal memuat antrean approval fungsi ruang:", err);
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

  // Pending count for the current user
  const pendingCountForMe = useMemo(() => {
    return items.filter((item) => canUserApproveFungsiRuang(user, item)).length;
  }, [items, user]);

  // Total count yang berhak dilihat sesuai aturan bertingkat
  const totalCountForMe = useMemo(() => {
    if (isAdmin) return items.length;
    return items.filter((item) => canUserViewFungsiRuangSubmission(user, item)).length;
  }, [items, user, isAdmin]);

  // Filtered List
  const filteredList = useMemo(() => {
    return items.filter((item) => {
      // 1. Search Query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const noPengajuan = (item.nomor_pengajuan || "").toLowerCase();
        const namaPemohon = (item.nama_pemohon || "").toLowerCase();
        const jabatan = (item.jabatan || "").toLowerCase();
        const dept = (item.departemen || item.divisi || "").toLowerCase();
        const proyek = (item.project?.nama_proyek || "").toLowerCase();
        const kode = (item.project?.kode || "").toLowerCase();
        const cabang = (item.project?.cabang || item.renovasi?.cabang || "").toLowerCase();
        const jenis = (item.jenis_pengajuan || "").toLowerCase();

        const match =
          noPengajuan.includes(q) ||
          namaPemohon.includes(q) ||
          jabatan.includes(q) ||
          dept.includes(q) ||
          proyek.includes(q) ||
          kode.includes(q) ||
          cabang.includes(q) ||
          jenis.includes(q);

        if (!match) return false;
      }

      const itemBranch = item.project?.cabang || item.renovasi?.cabang || "";

      // 2. Coverage Filter (Batasi akses sesuai coverage akun)
      if (itemBranch && !isBranchAccessible(itemBranch, userCoverageBranches)) {
        return false;
      }

      // 3. Branch Filter Dropdown
      if (branchFilter && branchFilter !== "all") {
        const childBranches = getBranchesUnderInduk(branchFilter);
        if (!childBranches.some((b) => b.toUpperCase() === itemBranch.toUpperCase())) {
          return false;
        }
      }

      // 4. Status Scoping (Aturan Bertingkat)
      if (isAdmin) {
        if (adminStatusFilter !== "all") {
          return item.status === adminStatusFilter;
        }
        return true;
      } else {
        if (activeTab === "MY_QUEUE") {
          return canUserApproveFungsiRuang(user, item);
        } else {
          // Tab "Semua Berkas Terkait": Terapkan aturan bertingkat
          return canUserViewFungsiRuangSubmission(user, item);
        }
      }
    });
  }, [items, search, branchFilter, activeTab, adminStatusFilter, isAdmin, user, userCoverageBranches]);

  // Open Review / Detail Modal
  const handleOpenReview = async (item: any) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/dc-development/fungsi-ruang/${item.id}`);
      const json = await res.json();
      if (res.ok && json.status === "success") {
        setSelectedSubmission(json.data);
      } else {
        setSelectedSubmission(item);
      }
      setModalOpen(true);
    } catch {
      setSelectedSubmission(item);
      setModalOpen(true);
    } finally {
      setLoadingDetail(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-emerald-50 text-emerald-800 border-emerald-200/80";
      case "REVISI":
        return "bg-amber-50 text-amber-800 border-amber-200/80";
      case "DITOLAK":
        return "bg-rose-50 text-rose-800 border-rose-200/80";
      case "DRAFT":
        return "bg-slate-100 text-slate-700 border-slate-200/80";
      default:
        return "bg-blue-50 text-blue-800 border-blue-200/80";
    }
  };

  if (!canAccess) {
    return (
      <Dashboard title="Akses Ditolak">
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Akses Approval Dibatasi</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
            Halaman persetujuan ini hanya dapat diakses oleh pejabat penandatangan berwenang (Branch Manager, Regional Manager, DC Specialist, GM, Direksi) atau Administrator.
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
          breadcrumb="Pusat Approval / Perubahan Fungsi Ruang"
          title="Antrean Approval Perubahan Fungsi Ruang"
          extraBadge={
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-orange-100 text-[#E65F2B]">
              SAT/FRM/DCB/010_Rev_000_200323
            </span>
          }
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
        {/* Filter & Search Bar Toolbar */}
        <ApprovalFilterToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari no. pengajuan, nama DC, pemohon..."
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
                {search || branchFilter !== "all" || adminStatusFilter !== "all"
                  ? "Tidak ada pengajuan yang cocok dengan kriteria pencarian atau filter yang dipilih."
                  : activeTab === "MY_QUEUE"
                    ? "Semua pengajuan pada antrean peran Anda telah diproses. Antrean bersih!"
                    : "Belum ada riwayat pengajuan Perubahan Fungsi Ruang."}
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/75 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">NO. PENGAJUAN & TANGGAL</th>
                    <th className="py-3 px-4">PEMOHON</th>
                    <th className="py-3 px-4">PROYEK & CABANG</th>
                    <th className="py-3 px-4">JENIS PENGAJUAN</th>
                    <th className="py-3 px-4 text-center">STATUS</th>
                    <th className="py-3 px-4 text-right">TINDAKAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map((item) => {
                    const approvable = canUserApproveFungsiRuang(user, item);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                        {/* No. Pengajuan & Tanggal */}
                        <td className="py-3 px-4">
                          <div className="font-extrabold text-slate-900 group-hover:text-[#E65F2B] transition-colors">
                            {item.nomor_pengajuan}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 font-medium">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{formatDate(item.created_at)}</span>
                          </div>
                        </td>

                        {/* Pemohon */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{item.nama_pemohon}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {item.jabatan} &bull; <span className="text-slate-400">{item.departemen || item.divisi}</span>
                          </div>
                        </td>

                        {/* Proyek & Cabang */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <Building2 className="w-3.5 h-3.5 text-[#E65F2B] shrink-0" />
                            <span>{item.project?.nama_proyek || "Proyek DC"}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Cabang: <strong className="text-slate-700">{item.project?.cabang || item.renovasi?.cabang || "-"}</strong> &bull; Tipe: <span className="font-semibold text-slate-700">{item.project?.tipe || "-"}</span>
                          </div>
                        </td>

                        {/* Jenis Pengajuan */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-orange-50 text-[#E65F2B] border-orange-200">
                            <Tag className="w-3 h-3" />
                            <span>{item.jenis_pengajuan}</span>
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${getStatusBadge(item.status)}`}>
                            {item.status}
                          </span>
                        </td>

                        {/* Aksi Button */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {approvable ? (
                              <Button
                                size="sm"
                                onClick={() => handleOpenReview(item)}
                                disabled={loadingDetail}
                                className="h-8 px-3 rounded-xl bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Tinjau & Setujui</span>
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenReview(item)}
                                disabled={loadingDetail}
                                className="h-8 px-3 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-400" />
                                <span>Detail</span>
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

        {/* Modal Review & Persetujuan */}
        <ReviewFungsiRuangModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          submission={selectedSubmission}
          onSuccess={(action, updatedItem) => {
            loadData();
            setModalOpen(false);

            const currentAction = action;
            const target = updatedItem || selectedSubmission;
            const noPengajuan = target?.nomor_pengajuan || "";
            const creator = target?.created_by || "Branch Building Koordinator";
            const namaProyek = target?.project?.nama_proyek || target?.nama_proyek || "";

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
                  ? `Pengajuan ${noPengajuan} (${namaProyek}) berhasil disetujui dan dialihkan ke tahap proses selanjutnya.`
                  : currentAction === "REVISI"
                  ? `Pengajuan ${noPengajuan} (${namaProyek}) berhasil dikembalikan kepada pemohon (${creator}) untuk dilakukan revisi.`
                  : `Pengajuan ${noPengajuan} (${namaProyek}) telah ditolak.`
            });
          }}
        />

        {/* Pop-up Pemberitahuan Konfirmasi Aksi Selesai */}
        <FeedbackModal
          open={feedbackModal.open}
          type={feedbackModal.type}
          title={feedbackModal.title}
          message={feedbackModal.message}
          onClose={() => setFeedbackModal((prev) => ({ ...prev, open: false }))}
        />
      </div>
    </Dashboard>
  );
}
