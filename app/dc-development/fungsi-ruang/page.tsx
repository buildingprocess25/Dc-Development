"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Dashboard from "@/components/dashboard/dashboard";
import { Search, Plus, Eye, Trash2, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { BranchFilterSelect } from "@/components/ui/branch-filter-select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import FungsiRuangTable from "@/components/fungsi-ruang/FungsiRuangTable";
import DetailFungsiRuangModal from "@/components/fungsi-ruang/DetailFungsiRuangModal";
import { useSession } from "@/context/SessionContext";
import { canManageFungsiRuang, isApprovalAdmin, getFungsiRuangVisibleStatuses } from "@/lib/permissions";
import { getBranchesUnderInduk, getIndukFromCabang, getUserCoverageBranches, isBranchAccessible } from "@/lib/branches";

export default function FungsiRuangListPage() {
  const { user } = useSession();
  const canEdit = useMemo(() => canManageFungsiRuang(user?.role), [user?.role]);

  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  const statusOptions = useMemo(() => {
    const isMakerOrAdmin = canManageFungsiRuang(user?.role) || isApprovalAdmin(user?.role);
    const visibleStatuses = getFungsiRuangVisibleStatuses(user?.role);

    const baseOptions: { value: string; label: string }[] = [
      { value: "all", label: "Semua Status" },
    ];

    if (isMakerOrAdmin) {
      baseOptions.push({ value: "REVISI", label: "Perlu Revisi" });
    }

    const allStages = [
      { value: "MENUNGGU APPROVAL BM/DBM", label: "Menunggu BM/DBM" },
      { value: "MENUNGGU APPROVAL REGIONAL B&M MANAGER", label: "Menunggu Reg B&M" },
      { value: "MENUNGGU APPROVAL DC SPECIALIST", label: "Menunggu DC Spec" },
      { value: "MENUNGGU APPROVAL B&M GM", label: "Menunggu B&M GM" },
      { value: "MENUNGGU APPROVAL OPERATION DIRECTOR", label: "Menunggu Op Dir" },
      { value: "MENUNGGU APPROVAL PROPERTY DEV MANAGER", label: "Menunggu Prop Dev" },
      { value: "APPROVED", label: "APPROVED" },
    ];

    for (const stage of allStages) {
      if (visibleStatuses === "ALL" || visibleStatuses.includes(stage.value)) {
        baseOptions.push(stage);
      }
    }

    return baseOptions;
  }, [user?.role]);

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/dc-development/fungsi-ruang");
      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Gagal memuat data pengajuan fungsi ruang");
      }
      setList(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const userCoverageBranches = useMemo(() => getUserCoverageBranches(user), [user]);

  const filteredList = useMemo(() => {
    let result = list;

    // Filter berdasarkan coverage cabang akun
    if (userCoverageBranches !== null) {
      result = result.filter((r) => {
        const itemCabang = (r.project?.cabang || r.renovasi?.cabang || "").toUpperCase();
        return isBranchAccessible(itemCabang, userCoverageBranches);
      });
    }

    // Filter pencarian teks
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (r) =>
          r.nomor_pengajuan?.toLowerCase().includes(q) ||
          r.nama_pemohon?.toLowerCase().includes(q) ||
          r.email_pemohon?.toLowerCase().includes(q) ||
          r.jabatan?.toLowerCase().includes(q) ||
          r.project?.nama_proyek?.toLowerCase().includes(q) ||
          r.project?.kode?.toLowerCase().includes(q) ||
          r.project?.cabang?.toLowerCase().includes(q) ||
          r.project?.tipe?.toLowerCase().includes(q) ||
          r.jenis_pengajuan?.toLowerCase().includes(q)
      );
    }

    // Filter status
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }

    // Filter cabang induk
    if (branchFilter !== "all") {
      const childBranches = getBranchesUnderInduk(branchFilter);
      result = result.filter((r) => {
        const itemCabang = (r.project?.cabang || r.renovasi?.cabang || "").toUpperCase();
        const itemInduk = getIndukFromCabang(itemCabang);
        return (
          itemInduk === branchFilter ||
          childBranches.some((cb) => cb.toUpperCase() === itemCabang)
        );
      });
    }

    return result;
  }, [list, query, statusFilter, branchFilter, userCoverageBranches]);

  const handleView = async (item: any) => {
    setSelectedItem(item);
    try {
      const res = await fetch(`/api/dc-development/fungsi-ruang/${item.id}`);
      const json = await res.json();
      if (res.ok && json.status === "success") {
        setSelectedItem(json.data);
      }
    } catch (err) {
      console.error("Gagal mengambil detail dengan audit logs:", err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/dc-development/fungsi-ruang/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Gagal menghapus pengajuan");
      }
      const deletedNo = deleteTarget.nomor_pengajuan;
      setDeleteTarget(null);
      await loadData();
      setFeedback({
        open: true,
        type: "success",
        title: "Pengajuan Dihapus",
        message: `Pengajuan ${deletedNo} berhasil dihapus permanen dari sistem.`,
      });
    } catch (err: any) {
      setFeedback({
        open: true,
        type: "error",
        title: "Gagal Menghapus",
        message: err.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dashboard title="Perubahan Fungsi Ruang">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)]">
        {/* Toolbar Section */}
        <div className="bg-white p-3 lg:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row gap-3 mb-4 items-stretch lg:items-center justify-between sticky top-0 z-20">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Cari nomor pengajuan, nama pemohon, proyek, cabang..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 w-full rounded-xl border-slate-200 focus-visible:ring-[#E65F2B] h-10 text-xs bg-slate-50/50"
            />
          </div>

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

            {canEdit ? (
              <Link href="/dc-development/fungsi-ruang/tambah" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs h-10 px-4 rounded-xl shadow-md shadow-[#E65F2B]/20 transition-colors cursor-pointer">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Tambah Pengajuan
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100/90 border border-slate-200 text-slate-600 text-xs font-semibold shrink-0">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Mode Peninjau (Read Only)</span>
              </div>
            )}
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <FungsiRuangTable
            list={filteredList}
            loading={loading}
            error={error}
            canEdit={canEdit}
            onView={(item) => handleView(item)}
            onDelete={(item) => {
              if (item.status !== "REVISI") {
                setFeedback({
                  open: true,
                  type: "error",
                  title: "Tidak Dapat Dihapus",
                  message: `Pengajuan ${item.nomor_pengajuan} sedang dalam proses approval atau sudah disetujui, sehingga tidak dapat dihapus. Dokumen hanya dapat dihapus saat berstatus REVISI.`,
                });
                return;
              }
              setDeleteTarget(item);
            }}
          />
        </div>

        {/* Modal Detail */}
        <DetailFungsiRuangModal
          open={!!selectedItem}
          onOpenChange={(open) => !open && setSelectedItem(null)}
          submission={selectedItem}
        />

        {/* Modal Konfirmasi Hapus */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md p-6 rounded-2xl bg-white border border-slate-200 text-center flex flex-col items-center z-50">
            <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mb-4 shadow-sm">
              <Trash2 className="w-7 h-7" />
            </div>
            <DialogTitle className="text-lg font-extrabold text-slate-900 mb-2">
              Hapus Pengajuan Fungsi Ruang?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium leading-relaxed mb-6">
              Pengajuan <strong className="text-slate-800">{deleteTarget?.nomor_pengajuan}</strong> ({deleteTarget?.nama_pemohon} - {deleteTarget?.project?.nama_proyek}) akan dihapus permanen dari sistem.
            </DialogDescription>
            <div className="flex items-center gap-3 w-full">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl text-xs h-9 font-semibold"
                disabled={isDeleting}
              >
                Batal
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                className="flex-1 rounded-xl text-xs h-9 font-bold bg-rose-600 hover:bg-rose-700 text-white"
                disabled={isDeleting}
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Feedback (Sukses / Error) */}
        <FeedbackModal
          open={feedback.open}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
          onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
        />
      </div>
    </Dashboard>
  );
}
