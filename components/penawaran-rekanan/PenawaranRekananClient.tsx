"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { BranchFilterSelect } from "@/components/ui/branch-filter-select";
import { isExternalPartnerRole } from "@/lib/permissions";
import DaftarPenawaranRekananTable from "./DaftarPenawaranRekananTable";
import ModalPilihProyekTender from "./ModalPilihProyekTender";

const STATUS_OPTIONS = [
  { value: "all", label: "Semua Status" },
  { value: "DRAFT", label: "DRAFT" },
  { value: "DIAJUKAN", label: "DIAJUKAN" },
  { value: "EVALUASI_DC_SPECIALIST", label: "EVALUASI SPECIALIST" },
  { value: "NEGOSIASI_REKANAN", label: "PERLU NEGOSIASI" },
  { value: "DIAJUKAN_ULANG", label: "DIAJUKAN ULANG" },
  { value: "MENANG", label: "PEMENANG" },
  { value: "TIDAK_MENANG", label: "TIDAK MENANG" },
];

interface ClientProps {
  initialData: any[];
  user: {
    email: string;
    role: string;
    nama_pt?: string | null;
  };
}

export default function PenawaranRekananClient({ initialData = [], user }: ClientProps) {
  const [penawaranList, setPenawaranList] = useState<any[]>(() =>
    Array.isArray(initialData) ? initialData : []
  );
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [openTambahModal, setOpenTambahModal] = useState(false);

  // Hak akses: HANYA Rekanan/Kontraktor yang boleh menambahkan penawaran baru
  const isRekananUser = isExternalPartnerRole(user?.role);
  const canCreatePenawaran = isRekananUser;

  const fetchPenawaran = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (branchFilter && branchFilter !== "all") params.append("cabang", branchFilter);
      if (search.trim()) params.append("search", search.trim());

      const res = await fetch(`/api/dc-development/penawaran-rekanan?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      if (json.status === "success" && Array.isArray(json.data)) {
        setPenawaranList(json.data);
      } else {
        setPenawaranList([]);
      }
    } catch (e) {
      console.error("Gagal memuat daftar penawaran:", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, branchFilter, search]);

  useEffect(() => {
    fetchPenawaran();
  }, [fetchPenawaran]);

  // Client-side search filtering untuk respon instan
  const filteredList = useMemo(() => {
    const list = Array.isArray(penawaranList) ? penawaranList : [];
    return list.filter((item) => {
      if (!item) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (branchFilter !== "all" && item.cabang?.toUpperCase() !== branchFilter.toUpperCase()) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNo = (item.nomor_penawaran || "").toLowerCase().includes(q);
        const matchProyek = (item.project?.nama_proyek || "").toLowerCase().includes(q);
        const matchCabang = (item.cabang || "").toLowerCase().includes(q);
        const matchVendor = (item.vendor_nama || "").toLowerCase().includes(q);
        const matchKode = (item.project?.kode || "").toLowerCase().includes(q);
        if (!matchNo && !matchProyek && !matchCabang && !matchVendor && !matchKode) return false;
      }
      return true;
    });
  }, [penawaranList, statusFilter, branchFilter, search]);

  return (
    <div className="space-y-4">
      {/* Toolbar Pencarian, Filter & Tombol Tambah */}
      <div className="bg-white p-3 lg:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between sticky top-0 z-20">
        {/* Kolom Pencarian */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Cari nomor penawaran, proyek, rekanan, cabang..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full rounded-xl border-slate-200 focus-visible:ring-[#E65F2B] h-10 text-xs bg-slate-50/50"
          />
        </div>

        {/* Kolom Filter & Tombol Tambah Penawaran */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Semua Status"
            className="w-full sm:w-[170px]"
            options={STATUS_OPTIONS}
          />

          <BranchFilterSelect
            value={branchFilter}
            onChange={setBranchFilter}
            placeholder="Semua Cabang"
            className="w-full sm:w-[160px]"
          />

          {canCreatePenawaran && (
            <Button
              onClick={() => setOpenTambahModal(true)}
              className="w-full sm:w-auto bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs h-10 px-4 rounded-xl shadow-md shadow-[#E65F2B]/20 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Tambah Penawaran
            </Button>
          )}
        </div>
      </div>

      {/* Tabel Utama Daftar Penawaran */}
      <DaftarPenawaranRekananTable
        penawaranList={filteredList}
        userRole={user.role}
        userEmail={user.email}
        namaPt={user.nama_pt}
        onOpenTambah={() => setOpenTambahModal(true)}
        onRefresh={fetchPenawaran}
      />

      {/* Modal Dialog Pemilihan Paket Proyek Tender */}
      <ModalPilihProyekTender
        isOpen={openTambahModal}
        onClose={() => {
          setOpenTambahModal(false);
          fetchPenawaran();
        }}
      />
    </div>
  );
}
