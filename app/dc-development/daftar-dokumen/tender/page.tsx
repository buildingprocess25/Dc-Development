"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { FileSignature } from "lucide-react";
import { DetailTenderModal } from "@/components/tender/DetailTenderModal";
import DokumenTenderTable, { DokumenTenderItem } from "@/components/dokumen/DokumenTenderTable";
import DokumenHeaderCard from "@/components/dokumen/DokumenHeaderCard";
import DokumenFilterToolbar from "@/components/dokumen/DokumenFilterToolbar";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { useSession } from "@/context/SessionContext";
import {
  isApprovalAdmin,
  getTenderVisibleStatuses,
} from "@/lib/permissions";

const ALL_TENDER_STAGES = [
  { value: "PRAKUALIFIKASI", label: "Pra-kualifikasi" },
  { value: "MENUNGGU APPROVAL DC SPECIALIST", label: "Menunggu DC Specialist" },
  { value: "MENUNGGU APPROVAL B&M GM", label: "Menunggu B&M GM" },
  { value: "MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR", label: "Menunggu Prop & Dev Director" },
  { value: "APPROVED", label: "APPROVED (Siap Tender)" },
];

export default function DaftarDokumenTenderPage() {
  const { user } = useSession();
  const [data, setData] = useState<DokumenTenderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cabang, setCabang] = useState("all");
  const [status, setStatus] = useState("all");

  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // State Feedback Modal
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

  // Status options dinamis sesuai role & visibilitas bertingkat
  const statusOptions = useMemo(() => {
    const isAdmin = isApprovalAdmin(user?.role);
    const visibleStatuses = getTenderVisibleStatuses(user?.role);

    const baseOptions: { value: string; label: string }[] = [
      { value: "all", label: "Semua Status" },
    ];

    if (isAdmin) {
      baseOptions.push({ value: "REVISI", label: "Perlu Revisi" });
      baseOptions.push({ value: "DITOLAK", label: "Ditolak" });
    }

    for (const stage of ALL_TENDER_STAGES) {
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

      const res = await fetch(`/api/dokumen/tender?${query.toString()}`);
      const json = await res.json();
      if (res.ok && json.status === "success") {
        setData(json.data || []);
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Memuat Data",
          message: json.message || "Gagal memuat arsip dokumen usulan tender.",
        });
      }
    } catch (err: any) {
      console.error("Gagal memuat dokumen tender:", err);
      setFeedback({
        open: true,
        type: "error",
        title: "Kesalahan Jaringan",
        message: err.message || "Terjadi kesalahan saat memuat arsip dokumen tender.",
      });
    } finally {
      setLoading(false);
    }
  }, [search, cabang, status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownload = async (item: DokumenTenderItem) => {
    setDownloadingId(item.id);
    try {
      const res = await fetch(`/api/dc-development/tender/${item.id}/download-pdf`);
      const json = await res.json();
      if (json.status === "success" && json.data?.file_url) {
        window.open(json.data.file_url, "_blank", "noopener,noreferrer");
      } else {
        window.open(`/api/dc-development/tender/${item.id}/pdf`, "_blank");
      }
    } catch {
      window.open(`/api/dc-development/tender/${item.id}/pdf`, "_blank");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleViewDetail = async (item: DokumenTenderItem) => {
    setSelectedItem(item);
    try {
      const res = await fetch(`/api/dc-development/tender/${item.id}`);
      const json = await res.json();
      if (res.ok && json.status === "success") {
        setSelectedItem(json.data);
      }
    } catch (err) {
      console.error("Gagal mengambil detail dokumen tender:", err);
    }
  };

  return (
    <Dashboard title="Daftar Dokumen > Usulan Peserta Tender">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)] space-y-4">
        {/* Header Bar */}
        <DokumenHeaderCard
          title="Dokumen Usulan Peserta Tender Kontraktor & Konsultan"
          icon={FileSignature}
          badgeLabel="SOP SAT/SOP/DCB/009"
        />

        {/* Toolbar Filter & Pencarian */}
        <DokumenFilterToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari no tender, proyek, cabang, rekanan..."
          cabang={cabang}
          onCabangChange={setCabang}
          status={status}
          onStatusChange={setStatus}
          statusOptions={statusOptions}
          onRefresh={fetchData}
          loading={loading}
        />

        {/* Tabel Dokumen */}
        <DokumenTenderTable
          data={data}
          loading={loading}
          onViewDetail={handleViewDetail}
          onDownload={handleDownload}
          downloadingId={downloadingId}
        />

        {/* Modal Detail Rekanan & Schedule */}
        <DetailTenderModal
          open={!!selectedItem}
          onOpenChange={(isOpen) => !isOpen && setSelectedItem(null)}
          tender={selectedItem}
        />

        {/* Feedback Modal */}
        <FeedbackModal
          open={feedback.open}
          onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
        />
      </div>
    </Dashboard>
  );
}
