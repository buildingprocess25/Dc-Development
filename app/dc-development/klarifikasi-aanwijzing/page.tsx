"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import Dashboard from "@/components/dashboard/dashboard";
import { useSession } from "@/context/SessionContext";
import { Search, Plus, RefreshCw, FileCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { BranchFilterSelect } from "@/components/ui/branch-filter-select";
import { DaftarKlarifikasiTable } from "@/components/klarifikasi-aanwijzing/DaftarKlarifikasiTable";
import { DetailKlarifikasiModal } from "@/components/klarifikasi-aanwijzing/DetailKlarifikasiModal";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { getUserCoverageBranches, isBranchAccessible } from "@/lib/branches";
import { canManageKlarifikasiAanwijzing } from "@/lib/permissions";

export default function KlarifikasiAanwijzingPage() {
  const { user } = useSession();
  const userCoverage = useMemo(() => getUserCoverageBranches(user), [user]);
  const canCreate = useMemo(() => canManageKlarifikasiAanwijzing(user?.role), [user?.role]);

  // Data States
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal States
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Feedback State
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

  const statusOptions = useMemo(
    () => [
      { value: "all", label: "Semua Status" },
      { value: "DRAFT", label: "Draft" },
      { value: "MENUNGGU_APPROVAL_BBM_MANAGER", label: "Menunggu B&M Manager" },
      { value: "MENUNGGU_APPROVAL_DC_SPECIALIST", label: "Menunggu DC Specialist" },
      { value: "REVISI", label: "Revisi" },
      { value: "APPROVED", label: "Disetujui (Approved)" },
    ],
    []
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dc-development/klarifikasi-aanwijzing");
      const json = await res.json();
      if (json.status === "success") {
        setItems(json.data || []);
      }
    } catch (err) {
      console.error("Gagal memuat data klarifikasi aanwijzing:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter Data di sisi client untuk responsiveness instan
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Cabang
      if (branchFilter && branchFilter.toLowerCase() !== "all") {
        const itemBranch = (item.cabang || item.project?.cabang || "").trim().toUpperCase();
        if (itemBranch !== branchFilter.trim().toUpperCase()) return false;
      }
      // 2. Status
      if (statusFilter && statusFilter.toLowerCase() !== "all") {
        if (item.status !== statusFilter) return false;
      }
      // 3. Search
      if (search) {
        const q = search.toLowerCase();
        const matchNo = item.nomor_klarifikasi.toLowerCase().includes(q);
        const matchProyek = (item.project?.nama_proyek || "").toLowerCase().includes(q);
        const matchKode = (item.project?.kode || "").toLowerCase().includes(q);
        const matchAanwijzing = (item.aanwijzing?.nomor_undangan || "").toLowerCase().includes(q);
        if (!matchNo && !matchProyek && !matchKode && !matchAanwijzing) return false;
      }
      return true;
    });
  }, [items, branchFilter, statusFilter, search]);

  // Handle Delete
  const handleDelete = async (item: any) => {
    if (!window.confirm(`Apakah Anda yakin ingin membatalkan/menghapus ${item.nomor_klarifikasi}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/dc-development/klarifikasi-aanwijzing/${item.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.status === "success") {
        setFeedback({
          open: true,
          type: "success",
          title: "Berhasil Dihapus",
          message: json.message || "Berita Acara berhasil dihapus.",
        });
        fetchData();
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Menghapus",
          message: json.message || "Terjadi kesalahan saat menghapus berkas.",
        });
      }
    } catch (err: any) {
      setFeedback({
        open: true,
        type: "error",
        title: "Kesalahan Sistem",
        message: err.message || "Gagal menghubungi server.",
      });
    }
  };

  return (
    <Dashboard title="Klarifikasi Hasil Aanwijzing">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)] space-y-4">
        {/* Banner Header SPARTA */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#E65F2B] shrink-0 shadow-2xs">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#E65F2B] uppercase tracking-wider bg-orange-50 px-2 py-0.5 rounded border border-orange-200/70">
                  SOP SAT/SOP/DCB/003
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Proyek &amp; Transaksi
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1">
                Klarifikasi Hasil Aanwijzing &amp; Berita Acara
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengesahan penyesuaian volume dan penambahan item pekerjaan sipil &amp; ME pasca rapat aanwijzing fisik lapangan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="rounded-xl border-slate-200/80 hover:bg-slate-50 text-slate-700 h-9 font-bold text-xs inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#E65F2B]" : ""}`} />
              <span>Refresh</span>
            </Button>

            {canCreate && (
              <Link href="/dc-development/klarifikasi-aanwijzing/tambah">
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold rounded-xl h-9 px-4 text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Klarifikasi Baru</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Cari nomor BA, proyek, kode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-[#E65F2B]"
            />
          </div>

          {/* Branch & Status Filter */}
          <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
            <BranchFilterSelect
              value={branchFilter}
              onChange={setBranchFilter}
              className="w-full sm:w-44 h-9 text-xs"
            />

            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              className="w-full sm:w-48 h-9 text-xs"
            />
          </div>
        </div>

        {/* Tabel Riwayat Klarifikasi */}
        <DaftarKlarifikasiTable
          items={filteredItems}
          loading={loading}
          currentUser={user}
          onViewDetail={(item) => {
            setSelectedItem(item);
            setIsDetailModalOpen(true);
          }}
          onDelete={handleDelete}
          onNewKlarifikasi={() => {
            window.location.href = "/dc-development/klarifikasi-aanwijzing/tambah";
          }}
        />

        {/* Modal Detail Berita Acara */}
        <DetailKlarifikasiModal
          open={isDetailModalOpen}
          onOpenChange={setIsDetailModalOpen}
          klarifikasi={selectedItem}
          currentUser={user}
          showApprovalActions={false}
          onApprovalSuccess={fetchData}
        />

        {/* Feedback Modal Pop-up */}
        <FeedbackModal
          isOpen={feedback.open}
          onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
        />
      </div>
    </Dashboard>
  );
}
