"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { useSession } from "@/context/SessionContext";
import {
  FileText,
  Eye,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApprovalFilterToolbar, ApprovalPageTitle } from "@/components/approval";
import { DetailKlarifikasiModal } from "@/components/klarifikasi-aanwijzing/DetailKlarifikasiModal";
import { getUserCoverageBranches, isBranchAccessible } from "@/lib/branches";
import { isApprovalAdmin, canUserApproveKlarifikasiAanwijzing } from "@/lib/permissions";

export default function ApprovalKlarifikasiAanwijzingPage() {
  const { user } = useSession();
  const isAdmin = useMemo(() => isApprovalAdmin(user?.role), [user?.role]);
  const userCoverage = useMemo(() => getUserCoverageBranches(user), [user]);

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter Toolbar States
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"MY_QUEUE" | "ALL">("MY_QUEUE");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal Review & Decision
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dc-development/klarifikasi-aanwijzing");
      const json = await res.json();
      if (json.status === "success" && Array.isArray(json.data)) {
        setItems(json.data);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error("Gagal memuat antrean klarifikasi aanwijzing:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter antrean khusus wewenang user saat ini ("Perlu Tindakan Saya")
  const myQueueItems = useMemo(() => {
    return items.filter((it) => {
      if (it.status === "DRAFT" || it.status === "REVISI" || it.status === "APPROVED") {
        return false;
      }
      return canUserApproveKlarifikasiAanwijzing(user, it);
    });
  }, [items, user]);

  // Filtered Items berdasarkan tab dan toolbar
  const displayedItems = useMemo(() => {
    const baseList = activeTab === "MY_QUEUE" ? myQueueItems : items;

    return baseList.filter((it) => {
      // 1. Cabang
      if (branchFilter && branchFilter.toLowerCase() !== "all") {
        const itemBranch = (it.cabang || it.project?.cabang || "").trim().toUpperCase();
        if (itemBranch !== branchFilter.trim().toUpperCase()) return false;
      }
      // 2. Status (khusus tab ALL)
      if (activeTab === "ALL" && statusFilter && statusFilter.toLowerCase() !== "all") {
        if (it.status !== statusFilter) return false;
      }
      // 3. Search
      if (search) {
        const q = search.toLowerCase();
        const matchNo = it.nomor_klarifikasi.toLowerCase().includes(q);
        const matchProyek = (it.project?.nama_proyek || "").toLowerCase().includes(q);
        const matchKode = (it.project?.kode || "").toLowerCase().includes(q);
        const matchAanwijzing = (it.aanwijzing?.nomor_undangan || "").toLowerCase().includes(q);
        if (!matchNo && !matchProyek && !matchKode && !matchAanwijzing) return false;
      }
      return true;
    });
  }, [items, myQueueItems, activeTab, branchFilter, statusFilter, search]);

  const statusBadges: Record<string, { label: string; cls: string }> = {
    DRAFT: {
      label: "Draft",
      cls: "bg-slate-100 text-slate-700 border-slate-200",
    },
    MENUNGGU_APPROVAL_BBM_MANAGER: {
      label: "Menunggu B&M Mgr",
      cls: "bg-amber-50 text-amber-800 border-amber-200/80",
    },
    MENUNGGU_APPROVAL_DC_SPECIALIST: {
      label: "Menunggu DC Specialist",
      cls: "bg-purple-50 text-purple-800 border-purple-200/80",
    },
    REVISI: {
      label: "Revisi",
      cls: "bg-rose-50 text-rose-800 border-rose-200/80",
    },
    APPROVED: {
      label: "Disetujui (Approved)",
      cls: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    },
  };

  return (
    <Dashboard
      title={
        <ApprovalPageTitle
          breadcrumb="PUSAT APPROVAL DC / KLARIFIKASI AANWIJZING"
          title="Antrean Approval Klarifikasi Aanwijzing"
          backHref="/dc-development/approval"
          extraBadge={
            <span className="text-[10px] font-bold text-[#E65F2B] bg-orange-50 border border-orange-200/80 px-2 py-0.5 rounded">
              SOP SAT/SOP/DCB/003
            </span>
          }
        />
      }
    >
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)] space-y-4">
        {/* Toolbar Filter Reusable */}
        <ApprovalFilterToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          branchFilter={branchFilter}
          onBranchChange={setBranchFilter}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingCount={myQueueItems.length}
          totalCount={items.length}
          adminStatusFilter={statusFilter}
          onAdminStatusChange={setStatusFilter}
          isAdmin={isAdmin}
          adminStatusOptions={[
            { value: "all", label: "Semua Status" },
            { value: "MENUNGGU_APPROVAL_BBM_MANAGER", label: "Menunggu B&M Manager" },
            { value: "MENUNGGU_APPROVAL_DC_SPECIALIST", label: "Menunggu DC Specialist" },
            { value: "APPROVED", label: "Disetujui (Approved)" },
          ]}
        />

        {/* Tabel Antrean */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">No. Berita Acara</th>
                  <th className="py-3.5 px-4">Proyek &amp; Cabang</th>
                  <th className="py-3.5 px-4">Ref. Aanwijzing</th>
                  <th className="py-3.5 px-4 text-center">Rekap Perubahan</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#E65F2B] mb-2" />
                      Memuat antrean persetujuan...
                    </td>
                  </tr>
                ) : displayedItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <div className="max-w-sm mx-auto flex flex-col items-center">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        </div>
                        <p className="font-semibold text-slate-700 text-sm">
                          {activeTab === "MY_QUEUE"
                            ? "Semua Antrean Sudah Diproses"
                            : "Tidak Ada Data Berita Acara"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 text-center">
                          {activeTab === "MY_QUEUE"
                            ? "Tidak ada berkas klarifikasi aanwijzing yang menunggu keputusan persetujuan Anda saat ini."
                            : "Tidak ditemukan dokumen klarifikasi sesuai kriteria filter yang dipilih."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedItems.map((item) => {
                    const badge = statusBadges[item.status] || {
                      label: item.status,
                      cls: "bg-slate-100 text-slate-700 border-slate-200",
                    };
                    const isMyTurn = canUserApproveKlarifikasiAanwijzing(user, item);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-[#E65F2B] shrink-0" />
                            <span>{item.nomor_klarifikasi}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Maker: {item.created_by}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">
                            {item.project?.nama_proyek || "-"}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3" />
                            <span>{item.cabang || item.project?.cabang || "-"}</span>
                            <span>•</span>
                            <span>{item.project?.kode || "-"}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800">
                            {item.aanwijzing?.nomor_undangan || "-"}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Kategori: {item.aanwijzing?.kategori_nilai === "DI_ATAS_1M" ? "> Rp 1M" : "< Rp 1M"}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              +{item.total_item_baru || 0} Baru
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {item.total_item_ubah_vol || 0} Ubah Vol
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setSelectedItem(item);
                              setDetailModalOpen(true);
                            }}
                            className={`rounded-xl h-8 px-3 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-xs ${
                              isMyTurn
                                ? "bg-[#E65F2B] hover:bg-[#d04f1f] text-white"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isMyTurn ? "Tinjau Berkas" : "Detail"}</span>
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

        {/* Modal Tinjau & Approval */}
        <DetailKlarifikasiModal
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          klarifikasi={selectedItem}
          currentUser={user}
          showApprovalActions={true}
          onApprovalSuccess={() => {
            fetchData();
          }}
        />
      </div>
    </Dashboard>
  );
}
