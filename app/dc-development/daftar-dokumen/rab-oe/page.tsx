"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { FileSpreadsheet } from "lucide-react";
import DetailRenovasiModal from "@/components/renovasi/DetailRenovasiModal";
import DokumenRabOeTable, { DokumenRabOeItem } from "@/components/dokumen/DokumenRabOeTable";
import DokumenHeaderCard from "@/components/dokumen/DokumenHeaderCard";
import DokumenFilterToolbar from "@/components/dokumen/DokumenFilterToolbar";
import { useSession } from "@/context/SessionContext";
import { isApprovalAdmin, isBranchBuildingKoordinator, getRabOeVisibleStatuses } from "@/lib/permissions";

const ALL_RAB_OE_STATUS_OPTIONS = [
  { value: "DRAFT", label: "DRAFT" },
  { value: "MENUNGGU APPROVAL B&M MANAGER", label: "MENUNGGU B&M MANAGER" },
  { value: "MENUNGGU APPROVAL DC SPECIALIST", label: "MENUNGGU DC SPECIALIST" },
  { value: "MENUNGGU APPROVAL DC MANAGER", label: "MENUNGGU DC MANAGER" },
  { value: "APPROVED", label: "APPROVED" },
  { value: "REVISI", label: "REVISI" },
  { value: "DITOLAK", label: "DITOLAK" }
];

export default function DaftarDokumenRabOePage() {
  const { user } = useSession();
  const [data, setData] = useState<DokumenRabOeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cabang, setCabang] = useState("all");
  const [status, setStatus] = useState("all");
  // DetailRenovasiModal expects the full renovasi object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedRenovasi, setSelectedRenovasi] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Status options dinamis sesuai role & visibilitas bertingkat
  const statusOptions = useMemo(() => {
    const isAdmin = isApprovalAdmin(user?.role);
    const isMaker = isBranchBuildingKoordinator(user?.role);
    const visibleStatuses = getRabOeVisibleStatuses(user?.role);

    const baseOptions: { value: string; label: string }[] = [
      { value: "all", label: "Semua Status" },
    ];

    if (isAdmin || isMaker) {
      return [{ value: "all", label: "Semua Status" }, ...ALL_RAB_OE_STATUS_OPTIONS];
    }

    for (const opt of ALL_RAB_OE_STATUS_OPTIONS) {
      if (Array.isArray(visibleStatuses) && visibleStatuses.includes(opt.value)) {
        baseOptions.push(opt);
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

      const res = await fetch(`/api/dokumen/rab-oe?${query.toString()}`);
      const json = await res.json();
      if (json.status === "success") {
        setData(json.data || []);
      }
    } catch (err) {
      console.error("Gagal memuat dokumen RAB/OE:", err);
    } finally {
      setLoading(false);
    }
  }, [search, cabang, status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownload = async (item: DokumenRabOeItem) => {
    const existingDoc = item.dokumen?.find((d) => d.kategori_file === "DOKUMEN_RAB_OE_PDF");
    if (existingDoc?.file_url) {
      window.open(existingDoc.file_url, "_blank", "noopener,noreferrer");
      return;
    }

    setDownloadingId(item.id);
    try {
      const res = await fetch(`/api/dc-development/renovasi/${item.id}/download-pdf`);
      const json = await res.json();
      if (json.status === "success" && json.data?.file_url) {
        window.open(json.data.file_url, "_blank", "noopener,noreferrer");
        fetchData();
      } else {
        alert(json.message || "Gagal mengunduh dokumen PDF.");
      }
    } catch (err: unknown) {
      alert(`Terjadi kesalahan: ${(err as Error)?.message || "Gagal unduh"}`);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Dashboard title="Daftar Dokumen > RAB/OE">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)] space-y-4">
        {/* Header Bar */}
        <DokumenHeaderCard
          title="Dokumen Rencana Anggaran Biaya (RAB / OE)"
          icon={FileSpreadsheet}
          badgeLabel="RAB & OE"
        />

        {/* Toolbar Filter Section */}
        <DokumenFilterToolbar
          search={search}
          onSearchChange={setSearch}
          onSearchEnter={fetchData}
          searchPlaceholder="Cari nomor pengajuan atau nama proyek DC..."
          cabang={cabang}
          onCabangChange={setCabang}
          status={status}
          onStatusChange={setStatus}
          statusOptions={statusOptions}
          onRefresh={fetchData}
          loading={loading}
        />

        {/* Reusable Dokumen Table */}
        <DokumenRabOeTable
          data={data}
          loading={loading}
          downloadingId={downloadingId}
          onViewDetail={(item) => {
            setSelectedRenovasi(item);
            setModalOpen(true);
          }}
          onDownload={handleDownload}
        />

        {/* Menggunakan Komponen Reusable DetailRenovasiModal */}
        {selectedRenovasi && (
          <DetailRenovasiModal
            open={modalOpen}
            onOpenChange={(v) => {
              setModalOpen(v);
              if (!v) setSelectedRenovasi(null);
            }}
            renovasi={selectedRenovasi}
            canEdit={false}
            showApprovalActions={false}
          />
        )}
      </div>
    </Dashboard>
  );
}
