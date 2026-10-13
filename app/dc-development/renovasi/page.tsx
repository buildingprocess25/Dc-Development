"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Dashboard from "@/components/dashboard/dashboard";
import { Search, Plus, HardHat, Filter, Trash2, Eye, ShieldAlert, ClipboardCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { BranchFilterSelect } from "@/components/ui/branch-filter-select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import RenovasiTable from "@/components/renovasi/RenovasiTable";
import DetailRenovasiModal from "@/components/renovasi/DetailRenovasiModal";
import ApprovalNotesHistoryModal from "@/components/approval/ApprovalNotesHistoryModal";
import { useSession } from "@/context/SessionContext";
import {
  canManageRenovasi,
  canAccessRabOeApproval,
  filterRenovasiByCreator,
} from "@/lib/permissions";
import {
  getBranchesUnderInduk,
  getIndukFromCabang,
  getUserCoverageBranches,
  isBranchAccessible,
} from "@/lib/branches";

export default function RenovasiPage() {
  const router = useRouter();
  const { user } = useSession();
  const canEdit = useMemo(() => canManageRenovasi(user?.role), [user?.role]);
  const canAccessRabOe = useMemo(() => canAccessRabOeApproval(user?.role), [user?.role]);
  const [renovasiList, setRenovasiList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  const [selectedRenovasi, setSelectedRenovasi] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedRevisionTarget, setSelectedRevisionTarget] = useState<any | null>(null);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);


  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/dc-development/renovasi");
      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Gagal memuat data renovasi");
      }
      setRenovasiList(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Daftar cabang coverage dalam bentuk array uppercase (HANYA role DC ADMIN yang bernilai null / akses bebas)
  const userCoverageBranches = useMemo(() => getUserCoverageBranches(user), [user]);

  const filteredList = useMemo(() => {
    let result = renovasiList;

    // 1. Batasi akses data berdasarkan creator (Branch Building Koordinator hanya melihat yang diajukan sendiri)
    result = filterRenovasiByCreator(result, user);

    // 2. Batasi akses data berdasarkan coverage cabang akun (Hanya DC Admin yang bernilai null)
    if (userCoverageBranches !== null) {
      result = result.filter((r) => {
        const itemCabang = (r.cabang || r.project?.cabang || "").toUpperCase();
        return isBranchAccessible(itemCabang, userCoverageBranches);
      });
    }

    // 3. Filter Pencarian Text
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (r) =>
          r.nomor_pengajuan?.toLowerCase().includes(q) ||
          r.jenis_renovasi?.toLowerCase().includes(q) ||
          r.project?.nama_proyek?.toLowerCase().includes(q) ||
          r.project?.kode?.toLowerCase().includes(q) ||
          r.cabang?.toLowerCase().includes(q)
      );
    }

    // 4. Filter Status
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }

    // 5. Filter Cabang (Berdasarkan Induk Cabang)
    if (branchFilter !== "all") {
      const childBranches = getBranchesUnderInduk(branchFilter);
      result = result.filter((r) => {
        const itemCabang = (r.cabang || r.project?.cabang || "").toUpperCase();
        const itemInduk = getIndukFromCabang(itemCabang);

        return (
          itemInduk === branchFilter ||
          childBranches.some((cb) => cb.toUpperCase() === itemCabang)
        );
      });
    }

    return result;
  }, [renovasiList, query, statusFilter, branchFilter, userCoverageBranches, user]);

  return (
    <Dashboard title="Penawaran RAB/OE">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)]">
        {/* Toolbar Section */}
        <div className="bg-white p-3 lg:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row gap-3 mb-4 items-stretch lg:items-center justify-between sticky top-0 z-20">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Cari nomor pengajuan, nama proyek, kode, cabang..."
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
              options={[
                { value: "all", label: "Semua Status" },
                { value: "DRAFT", label: "DRAFT" },
                { value: "MENUNGGU APPROVAL B&M MANAGER", label: "MENUNGGU B&M MANAGER" },
                { value: "APPROVED", label: "APPROVED" },
                { value: "REVISI", label: "REVISI" },
                { value: "DITOLAK", label: "DITOLAK" },
              ]}
            />

            <BranchFilterSelect
              value={branchFilter}
              onChange={setBranchFilter}
              placeholder="Semua Cabang"
              className="w-full sm:w-[160px]"
            />

            {canEdit ? (
              <Link href="/dc-development/renovasi/tambah" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs h-10 px-4 rounded-xl shadow-md shadow-[#E65F2B]/20 transition-colors cursor-pointer">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Ajukan Renovasi Baru
                </Button>
              </Link>
            ) : canAccessRabOe ? (
              <Link href="/dc-development/approval/rab-oe" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs h-10 px-4 rounded-xl shadow-md shadow-[#E65F2B]/20 transition-colors cursor-pointer">
                  <ClipboardCheck className="w-4 h-4 mr-1.5" />
                  Pusat Approval RAB/OE
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
          <RenovasiTable
            renovasiList={filteredList}
            loading={loading}
            error={error}
            canEdit={canEdit}
            onView={(r) => setSelectedRenovasi(r)}
            onRevisi={(r) => {
              setSelectedRevisionTarget(r);
              setRevisionModalOpen(true);
            }}
            onDelete={(r) => setDeleteTarget(r)}
          />
        </div>

        {/* Modal Detail Renovasi (Strictly Read Only di Menu Penawaran RAB/OE) */}
        <DetailRenovasiModal
          open={!!selectedRenovasi}
          onOpenChange={(open) => !open && setSelectedRenovasi(null)}
          renovasi={selectedRenovasi}
          canEdit={false}
          showApprovalActions={false}
        />

        {/* Modal Konfirmasi Hapus Pengajuan / Draft */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md p-6 rounded-2xl bg-white border border-slate-200 text-center flex flex-col items-center z-50">
            <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mb-4 shadow-sm">
              <Trash2 className="w-7 h-7" />
            </div>
            <DialogTitle className="text-lg font-extrabold text-slate-900 mb-2">
              Hapus Pengajuan Renovasi?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium leading-relaxed mb-6">
              Pengajuan <strong className="text-slate-800">{deleteTarget?.nomor_pengajuan}</strong> ({deleteTarget?.project?.nama_proyek}) beserta seluruh rincian item RAB, dokumen gambar sipil/ME, foto lingkungan, dan catatan akan dihapus permanen dari database.
            </DialogDescription>
            <div className="flex items-center gap-3 w-full">
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-10 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (!deleteTarget) return;
                  try {
                    setIsDeleting(true);
                    const res = await fetch(`/api/dc-development/renovasi?id=${deleteTarget.id}`, {
                      method: "DELETE"
                    });
                    const json = await res.json();
                    if (!res.ok || json.status !== "success") {
                      throw new Error(json.message || "Gagal menghapus pengajuan");
                    }
                    setDeleteTarget(null);
                    loadData();
                  } catch (err: any) {
                    alert(err.message || "Gagal menghapus pengajuan");
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="flex-1 h-10 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 cursor-pointer"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>


        {/* Modal Pop-up Riwayat Catatan Revisi sebelum masuk ke Formulir Revisi */}
        <ApprovalNotesHistoryModal
          open={revisionModalOpen}
          onOpenChange={setRevisionModalOpen}
          renovasi={selectedRevisionTarget}
          mode="revisi"
          onProceedRevisionForm={() => {
            if (selectedRevisionTarget) {
              router.push(`/dc-development/renovasi/tambah?draft_id=${selectedRevisionTarget.id}`);
            }
          }}
        />
      </div>
    </Dashboard>
  );
}
