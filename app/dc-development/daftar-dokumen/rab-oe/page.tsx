"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Dashboard from "@/components/dashboard/dashboard";
import { ChevronLeft, Search, RefreshCw, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BranchFilterSelect } from "@/components/ui/branch-filter-select";
import { FilterSelect } from "@/components/ui/filter-select";
import DetailRenovasiModal from "@/components/renovasi/DetailRenovasiModal";
import DokumenRabOeTable, { DokumenRabOeItem } from "@/components/dokumen/DokumenRabOeTable";

export default function DaftarDokumenRabOePage() {
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.set("search", search);
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
    let ignore = false;
    async function initFetch() {
      try {
        const query = new URLSearchParams();
        if (cabang !== "all") query.set("cabang", cabang);
        if (status !== "all") query.set("status", status);

        const res = await fetch(`/api/dokumen/rab-oe?${query.toString()}`);
        const json = await res.json();
        if (!ignore && json.status === "success") {
          setData(json.data || []);
        }
      } catch (err) {
        console.error("Gagal memuat dokumen RAB/OE:", err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    initFetch();
    return () => {
      ignore = true;
    };
  }, [cabang, status]);

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
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Link
                href="/dc-development/daftar-dokumen"
                className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-[#E65F2B] transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-0.5" />
                Daftar Dokumen
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-xs font-bold text-[#E65F2B]">RAB & OE</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
              <FileSpreadsheet className="w-6 h-6 text-[#E65F2B]" />
              Dokumen Rencana Anggaran Biaya (RAB / OE)
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5">
              Daftar seluruh berkas PDF pengajuan dan persetujuan resmi RAB/OE proyek renovasi DC.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 self-start md:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Muat Ulang
          </Button>
        </div>

        {/* Toolbar Filter Section */}
        <div className="bg-white p-3 lg:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Cari nomor pengajuan atau nama proyek DC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchData()}
              className="pl-9 w-full rounded-xl border-slate-200 focus-visible:ring-[#E65F2B] h-10 text-xs bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Menggunakan Komponen Reusable BranchFilterSelect */}
            <BranchFilterSelect
              value={cabang}
              onChange={setCabang}
              placeholder="Semua Cabang"
              className="w-full sm:w-[170px]"
            />

            {/* Menggunakan Komponen Reusable FilterSelect */}
            <FilterSelect
              value={status}
              onChange={setStatus}
              placeholder="Semua Status"
              className="w-full sm:w-[180px]"
              options={[
                { value: "all", label: "Semua Status" },
                { value: "DRAFT", label: "DRAFT" },
                { value: "MENUNGGU APPROVAL B&M MANAGER", label: "MENUNGGU B&M MANAGER" },
                { value: "MENUNGGU APPROVAL DC SPECIALIST", label: "MENUNGGU DC SPECIALIST" },
                { value: "MENUNGGU APPROVAL DC MANAGER", label: "MENUNGGU DC MANAGER" },
                { value: "APPROVED", label: "APPROVED" },
                { value: "REVISI", label: "REVISI" },
                { value: "DITOLAK", label: "DITOLAK" }
              ]}
            />
          </div>
        </div>

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
