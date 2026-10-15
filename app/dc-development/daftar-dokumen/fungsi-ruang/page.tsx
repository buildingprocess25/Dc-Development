"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { LayoutGrid } from "lucide-react";
import DetailFungsiRuangModal from "@/components/fungsi-ruang/DetailFungsiRuangModal";
import DokumenFungsiRuangTable, { DokumenFungsiRuangItem } from "@/components/dokumen/DokumenFungsiRuangTable";
import DokumenHeaderCard from "@/components/dokumen/DokumenHeaderCard";
import DokumenFilterToolbar from "@/components/dokumen/DokumenFilterToolbar";
import { useSession } from "@/context/SessionContext";
import { canManageFungsiRuang, isApprovalAdmin, getFungsiRuangVisibleStatuses } from "@/lib/permissions";

const ALL_FUNGSI_RUANG_STAGES = [
  { value: "MENUNGGU APPROVAL BM/DBM", label: "Menunggu BM/DBM" },
  { value: "MENUNGGU APPROVAL REGIONAL B&M MANAGER", label: "Menunggu Reg B&M Mgr" },
  { value: "MENUNGGU APPROVAL DC SPECIALIST", label: "Menunggu DC Specialist" },
  { value: "MENUNGGU APPROVAL B&M GM", label: "Menunggu B&M GM" },
  { value: "MENUNGGU APPROVAL OPERATION DIRECTOR", label: "Menunggu Op Director" },
  { value: "MENUNGGU APPROVAL PROPERTY DEV MANAGER", label: "Menunggu Prop Dev Mgr" },
  { value: "APPROVED", label: "APPROVED (Final)" },
];

export default function DaftarDokumenFungsiRuangPage() {
  const { user } = useSession();
  const [data, setData] = useState<DokumenFungsiRuangItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cabang, setCabang] = useState("all");
  const [status, setStatus] = useState("all");

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Status options dinamis sesuai role & visibilitas bertingkat
  const statusOptions = useMemo(() => {
    const isMakerOrAdmin = canManageFungsiRuang(user?.role) || isApprovalAdmin(user?.role);
    const visibleStatuses = getFungsiRuangVisibleStatuses(user?.role);

    const baseOptions: { value: string; label: string }[] = [
      { value: "all", label: "Semua Status" },
    ];

    if (isMakerOrAdmin) {
      baseOptions.push({ value: "REVISI", label: "Perlu Revisi" });
    }

    for (const stage of ALL_FUNGSI_RUANG_STAGES) {
      if (visibleStatuses === "ALL" || visibleStatuses.includes(stage.value)) {
        baseOptions.push(stage);
      }
    }

    return baseOptions;
  }, [user?.role]);

  // Reset status filter jika status saat ini tidak ada dalam opsi role
  useEffect(() => {
    if (status !== "all" && !statusOptions.some((opt) => opt.value === status)) {
      setStatus("all");
    }
  }, [statusOptions, status]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      if (cabang !== "all") query.set("cabang", cabang);
      if (status !== "all") query.set("status", status);

      const res = await fetch(`/api/dokumen/fungsi-ruang?${query.toString()}`);
      const json = await res.json();
      if (res.ok && json.status === "success") {
        setData(json.data || []);
      }
    } catch (err) {
      console.error("Gagal memuat dokumen fungsi ruang:", err);
    } finally {
      setLoading(false);
    }
  }, [search, cabang, status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownload = async (item: DokumenFungsiRuangItem) => {
    setDownloadingId(item.id);
    try {
      const res = await fetch(`/api/dc-development/fungsi-ruang/${item.id}/download-pdf`);
      const json = await res.json();
      if (json.status === "success" && json.data?.file_url) {
        window.open(json.data.file_url, "_blank", "noopener,noreferrer");
      } else {
        window.open(`/api/dc-development/fungsi-ruang/${item.id}/pdf`, "_blank");
      }
    } catch {
      window.open(`/api/dc-development/fungsi-ruang/${item.id}/pdf`, "_blank");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleViewDetail = async (item: DokumenFungsiRuangItem) => {
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

  return (
    <Dashboard title="Daftar Dokumen > Perubahan Fungsi Ruang">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)] space-y-4">
        {/* Header Bar */}
        <DokumenHeaderCard
          title="Dokumen Pengajuan Perubahan Fungsi Ruang (PFR)"
          icon={LayoutGrid}
          badgeLabel="SOP SAT/FRM/DCB/010"
        />

        {/* Toolbar Filter & Pencarian */}
        <DokumenFilterToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari nomor pengajuan, nama proyek, cabang, pemohon..."
          cabang={cabang}
          onCabangChange={setCabang}
          status={status}
          onStatusChange={setStatus}
          statusOptions={statusOptions}
          onRefresh={fetchData}
          loading={loading}
        />

        {/* Tabel Dokumen */}
        <DokumenFungsiRuangTable
          data={data}
          loading={loading}
          onViewDetail={handleViewDetail}
          onDownload={handleDownload}
          downloadingId={downloadingId}
        />

        {/* Modal Detail */}
        <DetailFungsiRuangModal
          open={!!selectedItem}
          onOpenChange={(open) => !open && setSelectedItem(null)}
          submission={selectedItem}
        />
      </div>
    </Dashboard>
  );
}
