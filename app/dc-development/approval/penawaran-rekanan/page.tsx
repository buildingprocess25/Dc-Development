"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import Dashboard from "@/components/dashboard/dashboard";
import { useSession } from "@/context/SessionContext";
import { cn } from "@/lib/utils";
import {
  canAccessPenawaranRekananApproval,
  canUserActionPenawaranQueue,
  isApprovalAdmin,
} from "@/lib/permissions";
import {
  getUserCoverageBranches,
  isBranchAccessible,
  getBranchesUnderInduk,
  getIndukFromCabang,
} from "@/lib/branches";
import {
  Scale,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Inbox,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Trophy,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterOption } from "@/components/ui/filter-select";
import { ApprovalFilterToolbar, ApprovalPageTitle } from "@/components/approval";

export default function ApprovalPenawaranRekananPage() {
  const { user } = useSession();
  const canAccess = useMemo(() => canAccessPenawaranRekananApproval(user?.role), [user?.role]);
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

  const adminStatusOptions: FilterOption[] = [
    { value: "all", label: "Semua Status" },
    { value: "DIAJUKAN", label: "Diajukan (Review Awal)" },
    { value: "NEGOSIASI_REKANAN", label: "Proses Negosiasi Rekanan" },
    { value: "DIAJUKAN_ULANG", label: "Diajukan Ulang (Review Akhir)" },
    { value: "SIAP_KOMPARASI", label: "Siap Pemilihan Pemenang" },
    { value: "MENANG", label: "Pemenang Tender" },
    { value: "TIDAK_MENANG", label: "Tidak Menang" },
  ];

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/dc-development/penawaran-rekanan/approval?tab=all`);
      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Gagal memuat antrean approval penawaran rekanan");
      }
      setItems(json.data || []);
      if (json.summary) setSummary(json.summary);
    } catch (err: any) {
      console.error("Gagal memuat antrean approval penawaran:", err);
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

  // Client-side filtering
  const filteredItems = useMemo(() => {
    let result = items;

    // 1. Tab filtering (sesuai threshold 1M: < 1M BBM Manager, >= 1M DC Specialist)
    if (activeTab === "MY_QUEUE") {
      result = result.filter((item) => canUserActionPenawaranQueue(user?.role, item.status, item.grand_total));
    }

    // 2. Coverage branch filtering
    if (userCoverageBranches !== null) {
      result = result.filter((item) => {
        const itemCabang = (item.cabang || "").toUpperCase();
        return isBranchAccessible(itemCabang, userCoverageBranches);
      });
    }

    // 3. Toolbar branch filter
    if (branchFilter !== "all") {
      const childBranches = getBranchesUnderInduk(branchFilter);
      result = result.filter((item) => {
        const itemCabang = (item.cabang || "").toUpperCase();
        const itemInduk = getIndukFromCabang(itemCabang);
        return itemInduk === branchFilter || childBranches.includes(itemCabang);
      });
    }

    // 4. Admin status filter
    if (isAdmin && adminStatusFilter !== "all") {
      result = result.filter((item) => item.status === adminStatusFilter);
    }

    // 5. Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.nomor_penawaran?.toLowerCase().includes(q) ||
          item.project?.nama_proyek?.toLowerCase().includes(q) ||
          item.project?.kode?.toLowerCase().includes(q) ||
          item.cabang?.toLowerCase().includes(q) ||
          item.vendor_nama?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [items, activeTab, user?.role, userCoverageBranches, branchFilter, isAdmin, adminStatusFilter, search]);

  const formatNumber = (n: number) => {
    if (!n && n !== 0) return "0";
    return new Intl.NumberFormat("id-ID").format(n);
  };

  const getStatusBadge = (status: string, grandTotal?: number) => {
    const isUnder1M = typeof grandTotal === "number" ? grandTotal < 1_000_000_000 : false;

    switch (status) {
      case "DIAJUKAN":
        return isUnder1M ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 mr-1 text-blue-600" />
            MENUNGGU BBM (&lt; 1M)
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Scale className="w-3 h-3 mr-1 text-purple-600" />
            MENUNGGU SPECIALIST (&ge; 1M)
          </span>
        );
      case "EVALUASI_DC_SPECIALIST":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Scale className="w-3 h-3 mr-1 text-purple-600" />
            MENUNGGU SPECIALIST
          </span>
        );
      case "NEGOSIASI_REKANAN":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
            <AlertCircle className="w-3 h-3 mr-1 text-amber-600" />
            NEGOSIASI REKANAN
          </span>
        );
      case "DIAJUKAN_ULANG":
        return isUnder1M ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <RefreshCw className="w-3 h-3 mr-1 text-blue-600" />
            REVIEW ULANG BBM (&lt; 1M)
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
            <RefreshCw className="w-3 h-3 mr-1 text-purple-600" />
            REVIEW ULANG SPECIALIST (&ge; 1M)
          </span>
        );
      case "SIAP_KOMPARASI":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            SIAP PEMILIHAN
          </span>
        );
      case "MENANG":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-400">
            <Trophy className="w-3 h-3 mr-1 text-emerald-600" />
            PEMENANG TENDER
          </span>
        );
      case "TIDAK_MENANG":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            TIDAK MENANG
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  if (!canAccess) {
    return (
      <Dashboard title="Approval Evaluasi Penawaran Rekanan">
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Akses Modul Approval Dibatasi</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
            Antrean Evaluasi Penawaran Rekanan khusus untuk <strong>Branch Building & Maintenance Manager</strong>,{" "}
            <strong>DC Building & Development Specialist</strong>, atau <strong>Administrator</strong>.
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

  const myPendingCount = summary?.my_pending_count ?? 0;
  const totalCount = summary?.total_all ?? items.length;

  return (
    <Dashboard
      title={
        <ApprovalPageTitle
          breadcrumb="Pusat Approval / Evaluasi Penawaran"
          title="Antrean Approval Evaluasi Penawaran"
          backHref="/dc-development/approval"
          extraBadge={
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-orange-100 text-[#E65F2B]">
              SOP SAT/SOP/DCB/003
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
      <div className="flex-1 overflow-y-auto space-y-5">
        {/* Filter Toolbar SPARTA Reusable */}
        <ApprovalFilterToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari nomor penawaran, proyek, rekanan, atau cabang..."
          branchFilter={branchFilter}
          onBranchChange={setBranchFilter}
          isAdmin={isAdmin}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingCount={myPendingCount}
          totalCount={totalCount}
          tabPendingLabel="Perlu Tindakan Saya"
          tabAllLabel="Semua Berkas Terkait"
          adminStatusFilter={adminStatusFilter}
          onAdminStatusChange={setAdminStatusFilter}
          adminStatusOptions={adminStatusOptions}
        />

        {/* Tabel Antrean Penawaran Rekanan */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 text-center min-h-[300px]">
              <div className="w-9 h-9 border-3 border-[#E65F2B] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-semibold text-slate-500 animate-pulse">
                Memuat antrean evaluasi penawaran...
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
          ) : filteredItems.length === 0 ? (
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
                    ? "Semua berkas penawaran pada antrean peran Anda telah diproses. Antrean bersih!"
                    : "Belum ada riwayat penawaran rekanan."}
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="text-[10px] text-slate-500 bg-slate-50/80 uppercase tracking-wider font-bold sticky top-0 z-10 border-b border-slate-200/80">
                  <tr>
                    <th scope="col" className="px-4 py-3.5 w-12 text-center">No</th>
                    <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Nomor Penawaran</th>
                    <th scope="col" className="px-4 py-3.5 min-w-[200px]">Paket Proyek &amp; Cabang</th>
                    <th scope="col" className="px-4 py-3.5 min-w-[160px]">Rekanan Kontraktor</th>
                    <th scope="col" className="px-4 py-3.5 text-right whitespace-nowrap">Nilai Penawaran</th>
                    <th scope="col" className="px-4 py-3.5 text-center whitespace-nowrap">Durasi</th>
                    <th scope="col" className="px-4 py-3.5 text-center whitespace-nowrap">Status Evaluasi</th>
                    <th scope="col" className="px-4 py-3.5 text-center whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredItems.map((item, idx) => {
                    const isActionable = canUserActionPenawaranQueue(user?.role, item.status);

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isActionable ? "bg-orange-50/20" : ""
                        }`}
                      >
                        <td className="px-4 py-3.5 text-center text-slate-400 font-mono">
                          {idx + 1}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-mono font-bold text-slate-900">
                            {item.nomor_penawaran}
                          </div>
                          <div className="text-slate-400 text-[10px] mt-0.5">
                            {item.created_at ? new Date(item.created_at).toLocaleDateString("id-ID") : "-"}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-800">
                            {item.project?.nama_proyek || "Paket Proyek"}
                          </div>
                          <div className="text-slate-400 text-[11px] mt-0.5 flex items-center space-x-1.5">
                            <span className="font-medium text-slate-600">{item.cabang}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-500">
                              {item.project?.kode || "-"}
                            </span>
                            {item.klarifikasi?.nomor_klarifikasi && (
                              <>
                                <span>•</span>
                                <span className="text-slate-400 font-mono">
                                  BA: {item.klarifikasi.nomor_klarifikasi}
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-800 text-xs">
                            {item.vendor_nama || item.vendor?.nama_perusahaan || "-"}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.vendor_email || item.vendor?.email || "-"}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {item.grand_total > 0 ? (
                            <span className="text-[#E65F2B]">
                              Rp {formatNumber(item.grand_total)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal italic text-[11px]">-</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-center font-mono text-slate-700 whitespace-nowrap">
                          {item.durasi_pekerjaan_hari > 0 ? (
                            <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-800">
                              {item.durasi_pekerjaan_hari} Hari
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {getStatusBadge(item.status, item.grand_total)}
                        </td>

                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-2">
                            {isActionable ? (
                              <Link href={`/dc-development/penawaran-rekanan/${item.id}/evaluasi`}>
                                <Button
                                  size="sm"
                                  className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs h-8 px-3.5 rounded-xl shadow-xs font-semibold"
                                >
                                  Review &amp; Evaluasi
                                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                                </Button>
                              </Link>
                            ) : (
                              <Link href={`/dc-development/penawaran-rekanan/${item.id}/evaluasi`}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-300 text-slate-700 hover:bg-slate-50 text-xs h-8 px-3 rounded-xl font-medium"
                                >
                                  <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />
                                  Detail Evaluasi
                                </Button>
                              </Link>
                            )}

                            {item.project_id && (
                              <Link href={`/dc-development/penawaran-rekanan/komparasi/${item.project_id}?from=approval`}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-200 text-slate-600 hover:bg-slate-50 text-xs h-8 px-2.5 rounded-xl font-medium cursor-pointer"
                                  title="Lihat Komparasi Seluruh Rekanan"
                                >
                                  Komparasi
                                </Button>
                              </Link>
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
    </Dashboard>
  );
}
