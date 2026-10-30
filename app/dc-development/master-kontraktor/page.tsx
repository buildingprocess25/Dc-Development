"use client";

import React, { useState, useEffect, useMemo } from "react";
import Dashboard from "@/components/dashboard/dashboard";
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { VendorModal } from "@/components/master-vendor/VendorModal";
import { DetailVendorModal } from "@/components/master-vendor/DetailVendorModal";
import { MasterVendorTable } from "@/components/master-vendor/MasterVendorTable";
import { useSession } from "@/context/SessionContext";
import {
  getUserCoverageBranches,
  isBranchAccessible,
  getBranchesUnderInduk,
  getIndukFromCabang,
} from "@/lib/branches";
import { BranchFilterSelect } from "@/components/ui/branch-filter-select";
import { FilterSelect } from "@/components/ui/filter-select";

export default function MasterKontraktorPage() {
  const { user } = useSession();
  const userCoverageBranches = useMemo(() => getUserCoverageBranches(user), [user]);

  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterJenis, setFilterJenis] = useState("ALL");
  const [filterGolongan, setFilterGolongan] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("all");

  // Modal States
  const [openFormModal, setOpenFormModal] = useState(false);
  const [selectedVendorForEdit, setSelectedVendorForEdit] = useState<any | null>(null);

  const [openDetailModal, setOpenDetailModal] = useState(false);
  const [selectedVendorForDetail, setSelectedVendorForDetail] = useState<any | null>(null);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filterJenis !== "ALL") params.append("jenis", filterJenis);
      if (filterGolongan !== "ALL") params.append("golongan", filterGolongan);

      const res = await fetch(`/api/dc-development/master-vendor?${params.toString()}`);
      const json = await res.json();
      if (json.status === "success") {
        setVendors(json.data || []);
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Memuat Data",
          message: json.message || "Terjadi kesalahan saat memuat master rekanan vendor.",
        });
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({
        open: true,
        type: "error",
        title: "Kesalahan Jaringan",
        message: err.message || "Gagal menghubungi server database.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [filterJenis, filterGolongan]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVendors();
  };

  const handleOpenAdd = () => {
    setSelectedVendorForEdit(null);
    setOpenFormModal(true);
  };

  const handleOpenEdit = (vendor: any) => {
    setSelectedVendorForEdit(vendor);
    setOpenFormModal(true);
  };

  const handleOpenDetail = (vendor: any) => {
    setSelectedVendorForDetail(vendor);
    setOpenDetailModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/dc-development/master-vendor/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.status === "success") {
        setFeedback({
          open: true,
          type: "success",
          title: "Berhasil Dihapus",
          message: `Rekanan vendor "${deleteTarget.nama_perusahaan}" telah berhasil dihapus.`,
        });
        setDeleteTarget(null);
        fetchVendors();
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Menghapus",
          message: json.message || "Gagal menghapus rekanan vendor.",
        });
      }
    } catch (err: any) {
      setFeedback({
        open: true,
        type: "error",
        title: "Kesalahan Sistem",
        message: err.message || "Gagal menghapus rekanan vendor.",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Filter vendors berdasarkan hak akses coverage_cabang user dan filter toolbar cabang
  const filteredVendors = useMemo(() => {
    let result = vendors;

    // 1. Filter hak akses wewenang coverage cabang user login
    if (userCoverageBranches !== null) {
      result = result.filter((v) => {
        const itemCabang = (v.cabang || "").toUpperCase();
        if (itemCabang === "HEAD OFFICE") return true;
        if (isBranchAccessible(itemCabang, userCoverageBranches)) return true;
        if (v.coverage_cabang) {
          const vendorCoverages = v.coverage_cabang
            .split(",")
            .map((c: string) => c.trim().toUpperCase())
            .filter(Boolean);
          if (vendorCoverages.some((c: string) => isBranchAccessible(c, userCoverageBranches))) {
            return true;
          }
        }
        return false;
      });
    }

    // 2. Filter toolbar cabang pilihan pengguna
    if (branchFilter !== "all") {
      const childBranches = getBranchesUnderInduk(branchFilter);
      result = result.filter((v) => {
        const itemCabang = (v.cabang || "").toUpperCase();
        const itemInduk = getIndukFromCabang(itemCabang);
        const matchesInduk = itemInduk === branchFilter || childBranches.includes(itemCabang);
        if (matchesInduk) return true;
        if (v.coverage_cabang) {
          const vendorCoverages = v.coverage_cabang
            .split(",")
            .map((c: string) => c.trim().toUpperCase())
            .filter(Boolean);
          return vendorCoverages.some(
            (c: string) => getIndukFromCabang(c) === branchFilter || childBranches.includes(c)
          );
        }
        return false;
      });
    }

    return result;
  }, [vendors, userCoverageBranches, branchFilter]);

  return (
    <Dashboard title="Master Kontraktor &amp; Konsultan">
      <div className="flex-1 min-h-0 flex flex-col space-y-3.5 animate-in fade-in duration-300">
        {/* Toolbar Filter & Pencarian (Standar SPARTA modul Pengadaan DC) */}
        <div className="bg-white p-3.5 lg:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between shrink-0">
          {/* Kolom Pencarian */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama PT, cabang, coverage, email, atau kontak rekanan..."
              className="pl-9 w-full rounded-xl border-slate-200 focus-visible:ring-[#E65F2B] h-10 text-xs bg-slate-50/50"
            />
          </div>

          {/* Kolom Filter & Tombol Tambah Rekanan */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <BranchFilterSelect
              value={branchFilter}
              onChange={setBranchFilter}
              allLabel="Semua Cabang"
              className="w-full sm:w-44 h-10 text-xs"
            />

            <FilterSelect
              value={filterJenis}
              onChange={setFilterJenis}
              placeholder="Semua Rekanan"
              className="w-full sm:w-48 h-10 text-xs"
              options={[
                { value: "ALL", label: "Semua Rekanan" },
                { value: "KONTRAKTOR", label: "Hanya Kontraktor" },
                { value: "KONSULTAN", label: "Semua Konsultan" },
                { value: "KONSULTAN PENGAWAS", label: "Konsultan Pengawas (MK)" },
                { value: "KONSULTAN PERENCANA", label: "Konsultan Perencana" },
                { value: "KONSULTAN PERENCANA & PENGAWAS", label: "Konsultan Perencana & Pengawas" },
              ]}
            />

            <FilterSelect
              value={filterGolongan}
              onChange={setFilterGolongan}
              placeholder="Semua Golongan"
              className="w-full sm:w-40 h-10 text-xs"
              options={[
                { value: "ALL", label: "Semua Golongan" },
                { value: "BESAR", label: "Golongan BESAR" },
                { value: "MENENGAH", label: "Golongan MENENGAH" },
              ]}
            />

            <Button
              variant="outline"
              size="icon"
              onClick={fetchVendors}
              disabled={loading}
              className="h-10 w-10 shrink-0 rounded-xl border-slate-200 text-slate-600 hover:text-[#E65F2B] hover:bg-orange-50/50 cursor-pointer"
              title="Segarkan Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#E65F2B]" : ""}`} />
            </Button>

            <Button
              onClick={handleOpenAdd}
              className="w-full sm:w-auto bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs h-10 px-4.5 rounded-xl shadow-md shadow-[#E65F2B]/20 transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1" />
              <span>Tambah Rekanan</span>
            </Button>
          </div>
        </div>

        {/* Tabel Data Rekanan Vendor Komponen Modular */}
        <MasterVendorTable
          vendors={filteredVendors}
          loading={loading}
          branchFilter={branchFilter}
          onOpenDetail={handleOpenDetail}
          onOpenEdit={handleOpenEdit}
          onDeleteTarget={(vendor) => setDeleteTarget(vendor)}
          onOpenAdd={handleOpenAdd}
        />

        {/* Modal Form Tambah / Edit */}
        <VendorModal
          open={openFormModal}
          onOpenChange={setOpenFormModal}
          vendorData={selectedVendorForEdit}
          onSuccess={(savedVendor, isEdit) => {
            fetchVendors();
            setFeedback({
              open: true,
              type: "success",
              title: isEdit ? "Perubahan Tersimpan" : "Rekanan Baru Ditambahkan",
              message: `Profil "${savedVendor.nama_perusahaan}" telah berhasil disimpan ke database master rekanan.`,
            });
          }}
          onError={(errorMessage) => {
            setFeedback({
              open: true,
              type: "error",
              title: "Gagal Menyimpan",
              message: errorMessage,
            });
          }}
        />

        {/* Modal Detail Profil */}
        <DetailVendorModal
          open={openDetailModal}
          onOpenChange={setOpenDetailModal}
          vendor={selectedVendorForDetail}
          onEdit={(vendor) => {
            handleOpenEdit(vendor);
          }}
        />

        {/* Dialog Konfirmasi Hapus */}
        <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md p-6 rounded-2xl border border-slate-200/80 shadow-xl bg-white">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Konfirmasi Hapus Rekanan Vendor
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus{" "}
                  <strong className="text-slate-700">{deleteTarget?.nama_perusahaan}</strong> dari
                  database master? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 mt-2 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="h-9 px-4 text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="h-9 px-4 text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all flex items-center space-x-1.5"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Hapus Vendor</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Feedback Modal Pop-up Visual */}
        <FeedbackModal
          open={feedback.open}
          onClose={() => setFeedback({ ...feedback, open: false })}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
        />
      </div>
    </Dashboard>
  );
}
