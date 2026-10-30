"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { FileCheck, Eye, FileDown, Building2, Calendar, RefreshCw, Loader2 } from "lucide-react";
import DokumenHeaderCard from "@/components/dokumen/DokumenHeaderCard";
import DokumenFilterToolbar from "@/components/dokumen/DokumenFilterToolbar";
import { DetailKlarifikasiModal } from "@/components/klarifikasi-aanwijzing/DetailKlarifikasiModal";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";

export default function DaftarDokumenKlarifikasiAanwijzingPage() {
  const { user } = useSession();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cabang, setCabang] = useState("all");
  const [status, setStatus] = useState("all");

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [loadingPdfId, setLoadingPdfId] = useState<number | null>(null);

  const handleOpenPdf = async (item: any) => {
    if (!item?.id) return;
    const directUrl = item.file_url;
    if (directUrl && (directUrl.startsWith("http://") || directUrl.startsWith("https://"))) {
      window.open(directUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setLoadingPdfId(item.id);
    try {
      const res = await fetch(`/api/dc-development/klarifikasi-aanwijzing/${item.id}/download-pdf`);
      const json = await res.json();
      if (json.status === "success" && json.data?.file_url) {
        window.open(json.data.file_url, "_blank", "noopener,noreferrer");
      } else {
        window.open(`/api/dc-development/klarifikasi-aanwijzing/${item.id}/pdf`, "_blank");
      }
    } catch {
      window.open(`/api/dc-development/klarifikasi-aanwijzing/${item.id}/pdf`, "_blank");
    } finally {
      setLoadingPdfId(null);
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dc-development/klarifikasi-aanwijzing");
      const json = await res.json();
      if (json.status === "success" && Array.isArray(json.data)) {
        setData(json.data);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error("Gagal memuat katalog berita acara aanwijzing:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // 1. Cabang
      if (cabang && cabang !== "all") {
        const itemBranch = (item.cabang || item.project?.cabang || "").trim().toUpperCase();
        if (itemBranch !== cabang.trim().toUpperCase()) return false;
      }
      // 2. Status
      if (status && status !== "all") {
        if (item.status !== status) return false;
      }
      // 3. Search
      if (search) {
        const q = search.toLowerCase();
        const matchNo = item.nomor_klarifikasi.toLowerCase().includes(q);
        const matchName = item.project?.nama_proyek?.toLowerCase().includes(q);
        const matchKode = item.project?.kode?.toLowerCase().includes(q);
        const matchAanwijzing = item.aanwijzing?.nomor_undangan?.toLowerCase().includes(q);
        if (!matchNo && !matchName && !matchKode && !matchAanwijzing) return false;
      }
      return true;
    });
  }, [data, cabang, status, search]);

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
    <Dashboard title="Katalog Berita Acara Aanwijzing">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)] space-y-4">
        {/* Banner Header Reusable */}
        <DokumenHeaderCard
          title="Berita Acara Aanwijzing"
          badgeLabel="SOP SAT/SOP/DCB/003"
          icon={FileCheck}
          categoryLabel="Katalog Dokumen Resmi"
          backHref="/dc-development/daftar-dokumen"
        />

        {/* Toolbar Filter Reusable */}
        <DokumenFilterToolbar
          search={search}
          onSearchChange={setSearch}
          cabang={cabang}
          onCabangChange={setCabang}
          status={status}
          onStatusChange={setStatus}
          onRefresh={fetchData}
          loading={loading}
          statusOptions={[
            { value: "all", label: "Semua Status" },
            { value: "MENUNGGU_APPROVAL_BBM_MANAGER", label: "Menunggu B&M Manager" },
            { value: "MENUNGGU_APPROVAL_DC_SPECIALIST", label: "Menunggu DC Specialist" },
            { value: "APPROVED", label: "Disetujui (Approved)" },
          ]}
        />

        {/* Tabel Katalog */}
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
                      Memuat katalog arsip berita acara aanwijzing...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      Tidak ada dokumen Berita Acara Klarifikasi yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => {
                    const badge = statusBadges[item.status] || {
                      label: item.status,
                      cls: "bg-slate-100 text-slate-700 border-slate-200",
                    };

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <FileCheck className="w-3.5 h-3.5 text-[#E65F2B] shrink-0" />
                            <span>{item.nomor_klarifikasi}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Dibuat: {new Date(item.created_at).toLocaleDateString("id-ID")}
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
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedItem(item);
                                setIsDetailModalOpen(true);
                              }}
                              title="Lihat Detail Berita Acara"
                              className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={loadingPdfId === item.id}
                              onClick={() => handleOpenPdf(item)}
                              title="Lihat Berita Acara Resmi (PDF)"
                              className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 text-[#E65F2B] cursor-pointer"
                            >
                              {loadingPdfId === item.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <FileDown className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Detail Berita Acara */}
        <DetailKlarifikasiModal
          open={isDetailModalOpen}
          onOpenChange={setIsDetailModalOpen}
          klarifikasi={selectedItem}
          currentUser={user}
          showApprovalActions={false}
          onApprovalSuccess={fetchData}
        />
      </div>
    </Dashboard>
  );
}
