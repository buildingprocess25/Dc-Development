"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { useSession } from "@/context/SessionContext";
import { Search, Plus, Eye, RefreshCw, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { BranchFilterSelect } from "@/components/ui/branch-filter-select";
import { DaftarAanwijzingTable } from "@/components/aanwijzing/DaftarAanwijzingTable";
import { FormUndanganAanwijzingModal } from "@/components/aanwijzing/FormUndanganAanwijzingModal";
import { DetailAanwijzingModal } from "@/components/aanwijzing/DetailAanwijzingModal";
import { KonfirmasiKehadiranModal } from "@/components/aanwijzing/KonfirmasiKehadiranModal";
import { getUserCoverageBranches, isBranchAccessible, getBranchesUnderInduk } from "@/lib/branches";

export default function UndanganAanwijzingPage() {
  const { user } = useSession();
  const userCoverageBranches = useMemo(() => getUserCoverageBranches(user), [user]);

  // Data States
  const [aanwijzingList, setAanwijzingList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter Toolbar States
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedAanwijzing, setSelectedAanwijzing] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [konfirmasiData, setKonfirmasiData] = useState<{
    open: boolean;
    aanwijzingId: number | null;
    nomorUndangan?: string;
    namaProyek?: string;
  }>({
    open: false,
    aanwijzingId: null,
  });

  const roleUpper = (user?.role || "").toUpperCase();
  const isContractor =
    roleUpper.includes("KONTRAKTOR") ||
    roleUpper.includes("KONSULTAN") ||
    roleUpper.includes("VENDOR") ||
    roleUpper.includes("REKANAN");

  const statusOptions = useMemo(() => [
    { value: "all", label: "Semua Status" },
    { value: "MENUNGGU_KONFIRMASI", label: "Menunggu Konfirmasi" },
    { value: "AANWIJZING_LANJUT", label: "Aanwijzing Lanjut" },
    { value: "MENUNGGU_APPROVAL_DC_MANAGER", label: "Approval DC Manager" },
    { value: "ON_HOLD", label: "ON HOLD (Ditahan)" },
  ], []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const resSent = await fetch("/api/dc-development/aanwijzing");
      const jsonSent = await resSent.json();
      if (jsonSent.status === "success") {
        setAanwijzingList(jsonSent.data || []);
      }
    } catch (err) {
      console.error("Gagal memuat data aanwijzing:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Jalur 1: Deteksi direct link dari email (?id=[id]) dan otomatis buka modal
  useEffect(() => {
    if (typeof window !== "undefined" && aanwijzingList.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlId = urlParams.get("id");
      if (urlId) {
        const found = aanwijzingList.find((a) => String(a.id) === urlId);
        if (found) {
          setSelectedAanwijzing(found);
          setIsDetailModalOpen(true);
        }
      }
    }
  }, [aanwijzingList]);

  // Filtered List
  const filteredAanwijzings = useMemo(() => {
    let result = aanwijzingList;

    // 1. Wewenang cakupan cabang user
    if (userCoverageBranches !== null) {
      result = result.filter((item) => {
        const itemCabang = (item.cabang || item.project?.cabang || "").toUpperCase();
        return isBranchAccessible(itemCabang, userCoverageBranches);
      });
    }

    // 2. Toolbar filter cabang
    if (branchFilter !== "all") {
      const childBranches = getBranchesUnderInduk(branchFilter);
      result = result.filter((item) => {
        const itemCabang = (item.cabang || item.project?.cabang || "").toUpperCase();
        return (
          itemCabang === branchFilter.toUpperCase() ||
          childBranches.some((cb) => cb.toUpperCase() === itemCabang)
        );
      });
    }

    // 3. Toolbar filter status
    if (statusFilter !== "all") {
      result = result.filter((item) => item.status === statusFilter);
    }

    // 4. Toolbar search query
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((item) => {
        const matchNo = (item.nomor_undangan || "").toLowerCase().includes(q);
        const matchName = (item.project?.nama_proyek || "").toLowerCase().includes(q);
        const matchKode = (item.project?.kode || "").toLowerCase().includes(q);
        const matchRef = (item.nomor_referensi || "").toLowerCase().includes(q);
        const matchCabang = (item.cabang || "").toLowerCase().includes(q);
        return matchNo || matchName || matchKode || matchRef || matchCabang;
      });
    }

    return result;
  }, [aanwijzingList, branchFilter, statusFilter, search, userCoverageBranches]);

  // Undangan menunggu konfirmasi khusus untuk kontraktor login
  const pendingForContractor = useMemo(() => {
    if (!isContractor) return [];
    const uEmail = (user?.email || "").toLowerCase();
    const uPt = ((user?.namaPt || (user as any)?.nama_pt || "") as string).toLowerCase();

    return aanwijzingList.filter((a) => {
      if (a.status !== "MENUNGGU_KONFIRMASI") return false;
      return (a.peserta || []).some((p: any) => {
        const pEmail = (p.email || p.vendor?.email || "").toLowerCase();
        const pName = (p.vendor?.nama_perusahaan || "").toLowerCase();
        const isMe = (uEmail && pEmail === uEmail) || (uPt && pName.includes(uPt));
        return isMe && p.status_konfirmasi === "MENUNGGU_RESPON";
      });
    });
  }, [aanwijzingList, isContractor, user]);

  const handleOpenDetail = (aanwijzing: any) => {
    setSelectedAanwijzing(aanwijzing);
    setIsDetailModalOpen(true);
  };

  const handleOpenKonfirmasi = (aanwijzing: any) => {
    setKonfirmasiData({
      open: true,
      aanwijzingId: aanwijzing.id,
      nomorUndangan: aanwijzing.nomor_undangan,
      namaProyek: aanwijzing.project?.nama_proyek,
    });
  };

  return (
    <Dashboard title="Undangan Aanwijzing DC">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)]">
        {/* BANNER NOTIFIKASI KONTRAKTOR JIKA ADA UNDANGAN MENUNGGU RESPON */}
        {isContractor && pendingForContractor.length > 0 && (
          <div className="mb-4 bg-gradient-to-r from-orange-500 to-[#E65F2B] text-white rounded-2xl p-4.5 shadow-sm shadow-orange-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold">
                  Perhatian: Terdapat {pendingForContractor.length} Undangan Aanwijzing Menunggu Konfirmasi Anda!
                </p>
                <p className="text-xs text-white/90 mt-0.5 font-medium">
                  Batas waktu konfirmasi adalah 2x24 JAM sejak surat diterbitkan. Mohon berikan kesediaan hadir Anda sebelum batas waktu berakhir.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => {
                setStatusFilter("MENUNGGU_KONFIRMASI");
              }}
              className="bg-white text-[#E65F2B] hover:bg-white/90 text-xs font-bold rounded-xl h-9 px-4 cursor-pointer shadow-sm flex-shrink-0"
            >
              Lihat Undangan Saya
            </Button>
          </div>
        )}

        {/* TOOLBAR SECTION (Sticky top-0 z-20 dengan solid bg-white agar tidak tembus saat scroll) */}
        <div className="bg-white p-3 lg:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row gap-3 mb-4 items-stretch lg:items-center justify-between sticky top-0 z-20">
          {/* Kolom Pencarian */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Cari no. undangan, proyek, kode, ref, cabang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full rounded-xl border-slate-200 focus-visible:ring-[#E65F2B] h-10 text-xs bg-slate-50/50"
            />
          </div>

          {/* Kolom Filter & Tombol Tambah */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Semua Status"
              className="w-full sm:w-[180px]"
              options={statusOptions}
            />

            <BranchFilterSelect
              value={branchFilter}
              onChange={setBranchFilter}
              placeholder="Semua Cabang"
              className="w-full sm:w-[160px]"
            />

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={fetchData}
              disabled={loading}
              title="Segarkan Data"
              className="h-10 w-10 rounded-xl border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>

            {!isContractor ? (
              <Button
                type="button"
                onClick={() => setIsFormModalOpen(true)}
                className="w-full sm:w-auto bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs h-10 px-4 rounded-xl shadow-md shadow-[#E65F2B]/20 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Tambah Undangan
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100/90 border border-slate-200 text-slate-600 text-xs font-semibold shrink-0">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Portal Rekanan</span>
              </div>
            )}
          </div>
        </div>

        {/* TABEL DATA SECTION (Komponen Reusable DaftarAanwijzingTable) */}
        <DaftarAanwijzingTable
          aanwijzings={filteredAanwijzings}
          loading={loading}
          currentUser={user}
          onViewDetail={handleOpenDetail}
          onOpenKonfirmasi={handleOpenKonfirmasi}
          onNewUndangan={() => setIsFormModalOpen(true)}
        />
      </div>

      {/* MODAL FORMULIR TERPADU */}
      <FormUndanganAanwijzingModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={fetchData}
      />

      {/* MODAL DETAIL AANWIJZING */}
      <DetailAanwijzingModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        aanwijzing={selectedAanwijzing}
        currentUser={user}
        onOpenKonfirmasi={() => {
          if (selectedAanwijzing) {
            handleOpenKonfirmasi(selectedAanwijzing);
          }
        }}
      />

      {/* MODAL KONFIRMASI KEHADIRAN KONTRAKTOR */}
      <KonfirmasiKehadiranModal
        isOpen={konfirmasiData.open}
        onClose={() => setKonfirmasiData((prev) => ({ ...prev, open: false }))}
        aanwijzingId={konfirmasiData.aanwijzingId}
        nomorUndangan={konfirmasiData.nomorUndangan}
        namaProyek={konfirmasiData.namaProyek}
        onSuccess={() => {
          setKonfirmasiData((prev) => ({ ...prev, open: false }));
          setIsDetailModalOpen(false);
          fetchData();
        }}
      />
    </Dashboard>
  );
}
