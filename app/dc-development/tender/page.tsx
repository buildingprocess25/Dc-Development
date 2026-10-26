"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Dashboard from "@/components/dashboard/dashboard";
import {
  Search,
  Plus,
  Eye,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { BranchFilterSelect } from "@/components/ui/branch-filter-select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { useSession } from "@/context/SessionContext";
import {
  getUserCoverageBranches,
  isBranchAccessible,
  getIndukFromCabang,
  getBranchesUnderInduk,
} from "@/lib/branches";
import {
  getTenderMakerAllowedKategori,
  getTenderVisibleStatuses,
  isApprovalAdmin,
} from "@/lib/permissions";

import { DaftarTenderTable } from "@/components/tender/DaftarTenderTable";
import { FormPengajuanTenderModal } from "@/components/tender/FormPengajuanTenderModal";
import { DetailTenderModal } from "@/components/tender/DetailTenderModal";
import { KualifikasiTenderModal } from "@/components/tender/KualifikasiTenderModal";

export default function PengajuanTenderPage() {
  const { user } = useSession();
  const userCoverageBranches = useMemo(() => getUserCoverageBranches(user), [user]);

  // Wewenang Kategori Pagu Pembuat Tender Berdasarkan Role
  // > 1M  -> DC BUILDING & DEVELOPMENT SPECIALIST
  // <= 1M -> BRANCH BUILDING & MAINTENANCE MANAGER
  const userAllowedKategori = useMemo(
    () => getTenderMakerAllowedKategori(user?.role),
    [user?.role]
  );
  const canCreateTender = userAllowedKategori !== "NONE";

  // Search & Filter States
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  // Data States (Tenders List Utama)
  const [tenders, setTenders] = useState<any[]>([]);
  const [loadingTenders, setLoadingTenders] = useState(false);
  const [errorTenders, setErrorTenders] = useState<string | null>(null);

  // Modal States: Satu wadah terpadu untuk Pengajuan Proposal Tender
  const [openFormModal, setOpenFormModal] = useState(false);
  const [openDetailModal, setOpenDetailModal] = useState(false);
  const [selectedTenderForDetail, setSelectedTenderForDetail] = useState<any | null>(null);

  // Kualifikasi & Penjadwalan Modal State (digunakan untuk Pra-kualifikasi dan Perbaikan Revisi)
  const [openKualifikasiModal, setOpenKualifikasiModal] = useState(false);
  const [selectedTenderForKualifikasi, setSelectedTenderForKualifikasi] = useState<any | null>(null);

  const handleOpenEditRevisi = (tender: any) => {
    setSelectedTenderForKualifikasi(tender);
    setOpenKualifikasiModal(true);
  };

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Feedback Modal State
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

  // Fetch Tenders List (Daftar Pengajuan Utama)
  const fetchTenders = useCallback(async () => {
    try {
      setLoadingTenders(true);
      setErrorTenders(null);
      const res = await fetch("/api/dc-development/tender");
      const json = await res.json();
      if (json.status === "success") {
        setTenders(json.data || []);
      } else {
        throw new Error(json.message || "Gagal memuat data tender.");
      }
    } catch (e: any) {
      console.error("Gagal mengambil data tender:", e);
      setErrorTenders(e.message || "Gagal mengambil data tender.");
    } finally {
      setLoadingTenders(false);
    }
  }, []);

  // Hanya fetch tender di awal page load (PFR approved tidak di-query di awal)
  useEffect(() => {
    fetchTenders();
  }, [fetchTenders]);

  // Options Status Filter Dinamis Sesuai Role
  const statusOptions = useMemo(() => {
    const isMakerOrAdmin = canCreateTender || isApprovalAdmin(user?.role);
    const visibleStatuses = getTenderVisibleStatuses(user?.role);

    const baseOptions: { value: string; label: string }[] = [
      { value: "all", label: "Semua Status" },
    ];

    if (isMakerOrAdmin) {
      baseOptions.push({ value: "REVISI", label: "Perlu Revisi" });
    }

    const allStages = [
      { value: "PRAKUALIFIKASI", label: "Pra-kualifikasi" },
      { value: "MENUNGGU APPROVAL DC SPECIALIST", label: "Menunggu DC Spec" },
      { value: "MENUNGGU APPROVAL B&M GM", label: "Menunggu B&M GM" },
      { value: "MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR", label: "Menunggu Prop Dev Dir" },
      { value: "APPROVED", label: "APPROVED" },
    ];

    for (const stage of allStages) {
      if (visibleStatuses === "ALL" || visibleStatuses.includes(stage.value)) {
        baseOptions.push(stage);
      }
    }

    return baseOptions;
  }, [user?.role, canCreateTender]);

  // Filtered Tenders (Tabel Utama)
  const filteredTenders = useMemo(() => {
    let result = tenders;

    // 1. Wewenang coverage cabang user login
    if (userCoverageBranches !== null) {
      result = result.filter((item) => {
        const itemCabang = (item.cabang || "").toUpperCase();
        return isBranchAccessible(itemCabang, userCoverageBranches);
      });
    }

    // 2. Toolbar branch filter pilihan pengguna
    if (branchFilter !== "all") {
      const childBranches = getBranchesUnderInduk(branchFilter);
      result = result.filter((item) => {
        const itemCabang = (item.cabang || "").toUpperCase();
        const itemInduk = getIndukFromCabang(itemCabang);
        return itemInduk === branchFilter || childBranches.includes(itemCabang);
      });
    }

    // 3. Status filter
    if (statusFilter !== "all") {
      result = result.filter((item) => item.status === statusFilter);
    }

    // 4. Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.nomor_tender?.toLowerCase().includes(q) ||
          (item.project?.nama_proyek || "").toLowerCase().includes(q) ||
          (item.cabang || "").toLowerCase().includes(q) ||
          (item.created_by || "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [tenders, userCoverageBranches, branchFilter, statusFilter, search]);

  const handleOpenFormModal = () => {
    setOpenFormModal(true);
  };

  const handleViewDetailTender = (tender: any) => {
    setSelectedTenderForDetail(tender);
    setOpenDetailModal(true);
  };

  const handleProcessKualifikasi = (tender: any) => {
    setSelectedTenderForKualifikasi(tender);
    setOpenKualifikasiModal(true);
  };

  const handleDeleteTarget = (tender: any) => {
    setDeleteTarget(tender);
  };

  const confirmDeleteTender = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/dc-development/tender/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.status === "success") {
        setDeleteTarget(null);
        fetchTenders();
        setFeedback({
          open: true,
          type: "success",
          title: "Pengajuan Dibatalkan",
          message: `Pengajuan Proposal Tender ${deleteTarget.nomor_tender} berhasil dihapus/dibatalkan.`,
        });
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Menghapus",
          message: json.message || "Gagal membatalkan Pengajuan Proposal Tender.",
        });
      }
    } catch (e: any) {
      setFeedback({
        open: true,
        type: "error",
        title: "Kesalahan Sistem",
        message: e.message || "Terjadi kesalahan saat membatalkan tender.",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dashboard title="Pengajuan Proposal Tender">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)]">
        {/* Toolbar Section (Pencarian, Filter Cabang, Filter Status, dan Tombol Tambah Pengajuan) */}
        <div className="bg-white p-3 lg:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row gap-3 mb-4 items-stretch lg:items-center justify-between sticky top-0 z-20">
          {/* Kolom Pencarian */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Cari nomor tender, nama pemohon, proyek, cabang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full rounded-xl border-slate-200 focus-visible:ring-[#E65F2B] h-10 text-xs bg-slate-50/50"
            />
          </div>

          {/* Kolom Filter & Tombol Aksi */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Semua Status"
              className="w-full sm:w-[170px]"
              options={statusOptions}
            />

            <BranchFilterSelect
              value={branchFilter}
              onChange={setBranchFilter}
              placeholder="Semua Cabang"
              className="w-full sm:w-[160px]"
            />

            {/* Tombol Utama: Tambah Pengajuan (Membuka Satu Wadah Wizard Lengkap) */}
            {canCreateTender ? (
              <Button
                onClick={handleOpenFormModal}
                className="w-full sm:w-auto bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs h-10 px-4 rounded-xl shadow-md shadow-[#E65F2B]/20 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Tambah Pengajuan
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100/90 border border-slate-200 text-slate-600 text-xs font-semibold shrink-0">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Mode Peninjau (Read Only)</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabel Data Section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <DaftarTenderTable
            tenders={filteredTenders}
            loading={loadingTenders}
            error={errorTenders}
            user={user}
            canCreate={canCreateTender}
            onNewPengajuan={handleOpenFormModal}
            onViewDetail={handleViewDetailTender}
            onEditRevisi={handleOpenEditRevisi}
            onProcessKualifikasi={handleProcessKualifikasi}
            onDelete={handleDeleteTarget}
            onRefresh={fetchTenders}
          />
        </div>

        {/* Modal Wizard Pengajuan Proposal Tender (SATU WADAH LENGKAP) */}
        <FormPengajuanTenderModal
          open={openFormModal}
          onOpenChange={setOpenFormModal}
          onSuccess={(newTender, customFeedback) => {
            setOpenFormModal(false);
            fetchTenders();
            setFeedback({
              open: true,
              type: "success",
              title: customFeedback?.title || "Pengajuan Berhasil",
              message:
                customFeedback?.message ||
                `Pengajuan Proposal Tender ${newTender.nomor_tender} berhasil diproses.`,
            });
          }}
          onError={(msg) => {
            setFeedback({
              open: true,
              type: "error",
              title: "Gagal Mengajukan",
              message: msg,
            });
          }}
        />

        {/* Modal Detail Berkas Tender */}
        <DetailTenderModal
          open={openDetailModal}
          onOpenChange={(open) => {
            setOpenDetailModal(open);
            if (!open) setSelectedTenderForDetail(null);
          }}
          tender={selectedTenderForDetail}
        />

        {/* Modal Evaluasi Kualifikasi & Penjadwalan Tender */}
        <KualifikasiTenderModal
          open={openKualifikasiModal}
          onOpenChange={(open) => {
            setOpenKualifikasiModal(open);
            if (!open) setSelectedTenderForKualifikasi(null);
          }}
          tender={selectedTenderForKualifikasi}
          onSuccess={(updatedTender, customFeedback) => {
            setOpenKualifikasiModal(false);
            setSelectedTenderForKualifikasi(null);
            fetchTenders();
            setFeedback({
              open: true,
              type: "success",
              title: customFeedback?.title || "Kualifikasi Berhasil Disimpan",
              message:
                customFeedback?.message ||
                `Evaluasi kualifikasi & jadwal tender ${updatedTender?.nomor_tender || ""} berhasil diperbarui.`,
            });
          }}
          onError={(msg) => {
            setFeedback({
              open: true,
              type: "error",
              title: "Gagal Menyimpan Kualifikasi",
              message: msg,
            });
          }}
        />



        {/* Modal Konfirmasi Hapus Pengajuan / Draft */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md p-6 rounded-2xl bg-white border border-slate-200 text-center flex flex-col items-center z-50">
            <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mb-4 shadow-sm">
              <Trash2 className="w-7 h-7" />
            </div>
            <DialogTitle className="text-lg font-extrabold text-slate-900 mb-2">
              Hapus Pengajuan Proposal Tender?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium leading-relaxed mb-6">
              Pengajuan <strong className="text-slate-800">{deleteTarget?.nomor_tender}</strong> ({deleteTarget?.project?.nama_proyek}) beserta usulan rekanan kontraktor, konsultan, dan jadwal pekerjaan akan dihapus permanen dari sistem.
            </DialogDescription>
            <div className="flex items-center gap-3 w-full">
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-10 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteTender}
                className="flex-1 h-10 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 cursor-pointer"
              >
                {deleting ? "Menghapus..." : "Ya, Hapus"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Feedback Modal */}
        <FeedbackModal
          open={feedback.open}
          onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
        />
      </div>
    </Dashboard>
  );
}
