"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { FileSpreadsheet, Eye, FileDown, MapPin, Users, Calendar, Clock } from "lucide-react";
import DokumenHeaderCard from "@/components/dokumen/DokumenHeaderCard";
import DokumenFilterToolbar from "@/components/dokumen/DokumenFilterToolbar";
import { DetailAanwijzingModal } from "@/components/aanwijzing/DetailAanwijzingModal";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";

export default function DaftarDokumenAanwijzingPage() {
  const { user } = useSession();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cabang, setCabang] = useState("all");
  const [status, setStatus] = useState("all");

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dc-development/aanwijzing");
      const json = await res.json();
      if (json.status === "success" && Array.isArray(json.data)) {
        setData(json.data);
      } else {
        setData([]);
      }
    } catch (err) {
      console.error("Gagal memuat katalog surat undangan aanwijzing:", err);
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
      if (cabang && cabang !== "all") {
        const itemBranch = (item.cabang || item.project?.cabang || "").toUpperCase();
        if (itemBranch !== cabang.toUpperCase()) return false;
      }
      if (status && status !== "all") {
        if (item.status !== status) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const matchNo = item.nomor_undangan.toLowerCase().includes(q);
        const matchName = item.project?.nama_proyek?.toLowerCase().includes(q);
        const matchKode = item.project?.kode?.toLowerCase().includes(q);
        if (!matchNo && !matchName && !matchKode) return false;
      }
      return true;
    });
  }, [data, cabang, status, search]);

  const handleOpenDetail = (item: any) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const statusBadges: Record<string, { label: string; cls: string }> = {
    MENUNGGU_KONFIRMASI: {
      label: "Menunggu Konfirmasi",
      cls: "bg-amber-100 text-amber-800 border-amber-200",
    },
    AANWIJZING_LANJUT: {
      label: "Aanwijzing Lanjut",
      cls: "bg-blue-100 text-blue-800 border-blue-200",
    },
    MENUNGGU_APPROVAL_DC_MANAGER: {
      label: "Approval DC Manager",
      cls: "bg-purple-100 text-purple-800 border-purple-200",
    },
    AANWIJZING_SELESAI: {
      label: "Aanwijzing Selesai",
      cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
    AANWIJZING_ULANG: {
      label: "Undangan Aanwijzing Ulang",
      cls: "bg-amber-100 text-amber-800 border-amber-200",
    },
    TENDER_ULANG: {
      label: "Proposal Tender Ulang",
      cls: "bg-rose-100 text-rose-800 border-rose-200",
    },
    ON_HOLD: {
      label: "ON HOLD (Ditahan)",
      cls: "bg-slate-100 text-slate-800 border-slate-200",
    },
  };

  return (
    <Dashboard title="Daftar Dokumen — Surat Undangan Aanwijzing">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)] space-y-5">
        {/* HEADER BANNER */}
        <DokumenHeaderCard
          categoryLabel="Katalog Arsip Berkas Resmi"
          title="Katalog Surat Undangan Aanwijzing"
          icon={FileSpreadsheet}
          badgeLabel="SOP SAT/SOP/BM/004"
        />

        {/* TOOLBAR FILTER */}
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
            { value: "MENUNGGU_KONFIRMASI", label: "Menunggu Konfirmasi" },
            { value: "AANWIJZING_LANJUT", label: "Aanwijzing Lanjut" },
            { value: "MENUNGGU_APPROVAL_DC_MANAGER", label: "Approval DC Manager" },
            { value: "AANWIJZING_SELESAI", label: "Aanwijzing Selesai" },
            { value: "AANWIJZING_ULANG", label: "Undangan Aanwijzing Ulang" },
            { value: "TENDER_ULANG", label: "Proposal Tender Ulang" },
            { value: "ON_HOLD", label: "ON HOLD (Ditahan)" },
          ]}
        />

        {/* KATALOG TABEL */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">No. Surat Undangan</th>
                  <th className="py-3 px-4">Proyek & Cabang</th>
                  <th className="py-3 px-4">Jadwal Rapat</th>
                  <th className="py-3 px-4">Lokasi Pelaksanaan</th>
                  <th className="py-3 px-4 text-center">Status Quorum</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Memuat katalog arsip dokumen...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Tidak ada arsip surat undangan aanwijzing yang cocok dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => {
                    const hadir = (item.peserta || []).filter(
                      (p: any) => p.status_konfirmasi === "HADIR"
                    ).length;
                    const total = (item.peserta || []).length;
                    const badge = statusBadges[item.status] || {
                      label: item.status,
                      cls: "bg-slate-100 text-slate-800",
                    };

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {item.nomor_undangan}
                          <div className="text-[10px] text-slate-400 font-sans font-normal mt-0.5">
                            {item.kategori_nilai === "DI_ATAS_1M" ? "Proyek > 1M" : "Proyek < 1M"}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{item.project?.nama_proyek}</p>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {item.cabang} &bull; {item.project?.kode}
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-800">
                            {new Date(item.tanggal_pelaksanaan).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                          <p className="text-[11px] text-slate-500 font-medium">{item.waktu_pelaksanaan}</p>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="text-slate-700 truncate font-medium" title={item.lokasi}>
                            {item.lokasi}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 font-bold text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            {hadir} / {total} Hadir
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDetail(item)}
                              title="Lihat Detail & Quorum"
                              className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                window.open(
                                  `/api/dc-development/aanwijzing/${item.id}/pdf?download=1`,
                                  "_blank"
                                )
                              }
                              title="Unduh PDF Resmi"
                              className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 text-[#E65F2B] cursor-pointer"
                            >
                              <FileDown className="w-4 h-4" />
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
      </div>

      <DetailAanwijzingModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        aanwijzing={selectedItem}
        currentUser={user}
      />
    </Dashboard>
  );
}
