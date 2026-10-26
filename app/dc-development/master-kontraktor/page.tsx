"use client";

import React, { useState, useEffect, useMemo } from "react";
import Dashboard from "@/components/dashboard/dashboard";
import {
  Building2,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit3,
  Trash2,
  Eye,
  Briefcase,
  Award,
  ShieldCheck,
  UserCheck,
  Phone,
  Mail,
  Loader2,
  Users,
  AlertTriangle,
  MapPin,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { VendorModal } from "@/components/master-vendor/VendorModal";
import { DetailVendorModal } from "@/components/master-vendor/DetailVendorModal";
import { useSession } from "@/context/SessionContext";
import {
  getUserCoverageBranches,
  isBranchAccessible,
  getBranchesUnderInduk,
  getIndukFromCabang,
} from "@/lib/branches";
import { BranchFilterSelect } from "@/components/ui/branch-filter-select";

export default function MasterKontraktorPage() {
  const { user } = useSession();
  const userCoverageBranches = useMemo(() => getUserCoverageBranches(user), [user]);

  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterJenis, setFilterJenis] = useState("ALL");
  const [filterGolongan, setFilterGolongan] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("all");

  // Modal States
  const [openFormModal, setOpenFormModal] = useState(false);
  const [selectedVendorForEdit, setSelectedVendorForEdit] = useState<any | null>(null);

  const [openDetailModal, setOpenDetailModal] = useState(false);
  const [selectedVendorForDetail, setSelectedVendorForDetail] = useState<any | null>(null);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Feedback State
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

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filterJenis !== "ALL") params.append("jenis", filterJenis);
      if (filterGolongan !== "ALL") params.append("golongan", filterGolongan);

      const res = await fetch(`/api/dc-development/master-vendor?${params.toString()}`);
      const json = await res.json();
      if (json.status === "success") {
        setVendors(json.data || []);
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Memuat Data",
          message: json.message || "Terjadi kesalahan saat memuat master rekanan vendor.",
        });
      }
    } catch (err: any) {
      console.error(err);
      setFeedback({
        open: true,
        type: "error",
        title: "Kesalahan Jaringan",
        message: err.message || "Gagal menghubungi server database.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [filterJenis, filterGolongan]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVendors();
  };

  const handleOpenAdd = () => {
    setSelectedVendorForEdit(null);
    setOpenFormModal(true);
  };

  const handleOpenEdit = (vendor: any) => {
    setSelectedVendorForEdit(vendor);
    setOpenFormModal(true);
  };

  const handleOpenDetail = (vendor: any) => {
    setSelectedVendorForDetail(vendor);
    setOpenDetailModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/dc-development/master-vendor/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.status === "success") {
        setFeedback({
          open: true,
          type: "success",
          title: "Berhasil Dihapus",
          message: `Rekanan vendor "${deleteTarget.nama_perusahaan}" telah berhasil dihapus.`,
        });
        setDeleteTarget(null);
        fetchVendors();
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Menghapus",
          message: json.message || "Gagal menghapus rekanan vendor.",
        });
      }
    } catch (err: any) {
      setFeedback({
        open: true,
        type: "error",
        title: "Kesalahan Sistem",
        message: err.message || "Gagal menghapus rekanan vendor.",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Filter vendors berdasarkan hak akses coverage_cabang user dan filter toolbar cabang
  const filteredVendors = useMemo(() => {
    let result = vendors;

    // 1. Filter hak akses wewenang coverage cabang user login
    if (userCoverageBranches !== null) {
      result = result.filter((v) => {
        const itemCabang = (v.cabang || "").toUpperCase();
        if (itemCabang === "HEAD OFFICE") return true;
        if (isBranchAccessible(itemCabang, userCoverageBranches)) return true;
        if (v.coverage_cabang) {
          const vendorCoverages = v.coverage_cabang
            .split(",")
            .map((c: string) => c.trim().toUpperCase())
            .filter(Boolean);
          if (vendorCoverages.some((c: string) => isBranchAccessible(c, userCoverageBranches))) {
            return true;
          }
        }
        return false;
      });
    }

    // 2. Filter toolbar cabang pilihan pengguna
    if (branchFilter !== "all") {
      const childBranches = getBranchesUnderInduk(branchFilter);
      result = result.filter((v) => {
        const itemCabang = (v.cabang || "").toUpperCase();
        const itemInduk = getIndukFromCabang(itemCabang);
        const matchesInduk = itemInduk === branchFilter || childBranches.includes(itemCabang);
        if (matchesInduk) return true;
        if (v.coverage_cabang) {
          const vendorCoverages = v.coverage_cabang
            .split(",")
            .map((c: string) => c.trim().toUpperCase())
            .filter(Boolean);
          return vendorCoverages.some(
            (c: string) => getIndukFromCabang(c) === branchFilter || childBranches.includes(c)
          );
        }
        return false;
      });
    }

    return result;
  }, [vendors, userCoverageBranches, branchFilter]);

  // Metrics summary berdasarkan hasil filter wewenang cabang
  const metrics = useMemo(() => {
    const total = filteredVendors.length;
    const kontraktorCount = filteredVendors.filter((v) => v.jenis === "KONTRAKTOR").length;
    const konsultanCount = filteredVendors.filter((v) => (v.jenis || "").includes("KONSULTAN")).length;
    const besarCount = filteredVendors.filter((v) => v.golongan === "BESAR").length;
    const menengahCount = filteredVendors.filter((v) => v.golongan === "MENENGAH").length;
    return { total, kontraktorCount, konsultanCount, besarCount, menengahCount };
  }, [filteredVendors]);

  return (
    <Dashboard title="Master Kontraktor &amp; Konsultan">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)] space-y-4">
        {/* Banner Header Info */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E65F2B] to-[#cf4d1a] flex items-center justify-center text-white shadow-xs shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                    Master Rekanan Kontraktor &amp; Konsultan
                  </h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-[#E65F2B] border border-orange-200 uppercase tracking-wider">
                    Modul Pengadaan DC
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Database resmi rekanan vendor tender pembangunan, renovasi gudang, konsultan perencana, dan pengawas. Terfilter sesuai wewenang cabang Anda.
                </p>
              </div>
            </div>

            <Button
              onClick={handleOpenAdd}
              className="h-10 px-4.5 rounded-xl bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs font-semibold shadow-xs transition-all flex items-center space-x-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Rekanan Vendor</span>
            </Button>
          </div>

          {/* Cards Metrik Ringkasan */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Total Rekanan Sesuai Wilayah
              </p>
              <p className="text-xl font-bold text-slate-800 mt-0.5">{metrics.total}</p>
            </div>
            <div className="p-3 bg-orange-50/60 rounded-xl border border-orange-200/60">
              <p className="text-[11px] font-semibold text-orange-700 uppercase tracking-wide">
                Kontraktor Utama
              </p>
              <p className="text-xl font-bold text-orange-900 mt-0.5">{metrics.kontraktorCount}</p>
            </div>
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/60">
              <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">
                Konsultan (MK/Perencana)
              </p>
              <p className="text-xl font-bold text-blue-900 mt-0.5">{metrics.konsultanCount}</p>
            </div>
            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/60">
              <p className="text-[11px] font-semibold text-purple-700 uppercase tracking-wide">
                Kualifikasi Besar
              </p>
              <p className="text-xl font-bold text-purple-900 mt-0.5">{metrics.besarCount}</p>
            </div>
          </div>
        </div>

        {/* Toolbar Filter & Pencarian */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <form onSubmit={handleSearchSubmit} className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama PT, cabang, coverage, email, atau kontak rekanan..."
              className="h-10 pl-9.5 pr-20 text-xs rounded-xl border-slate-200 focus:border-[#E65F2B] focus:ring-[#E65F2B]/20 w-full"
            />
            <button
              type="submit"
              className="absolute right-2 top-2 h-6 px-2 text-[10px] font-semibold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
            >
              Cari
            </button>
          </form>

          <div className="flex items-center flex-wrap gap-2">
            {/* Filter Cabang Otomatis Berdasarkan Coverage Akun */}
            <div className="w-44">
              <BranchFilterSelect
                value={branchFilter}
                onChange={setBranchFilter}
                allLabel="Semua Cabang Wewenang"
                className="w-full"
              />
            </div>

            {/* Filter Jenis */}
            <select
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value)}
              className="h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#E65F2B]"
            >
              <option value="ALL">Semua Rekanan</option>
              <option value="KONTRAKTOR">Hanya Kontraktor</option>
              <option value="KONSULTAN">Semua Konsultan</option>
              <option value="KONSULTAN PENGAWAS">Konsultan Pengawas (MK)</option>
              <option value="KONSULTAN PERENCANA">Konsultan Perencana</option>
              <option value="KONSULTAN PERENCANA & PENGAWAS">Konsultan Perencana &amp; Pengawas</option>
            </select>

            {/* Filter Golongan */}
            <select
              value={filterGolongan}
              onChange={(e) => setFilterGolongan(e.target.value)}
              className="h-10 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#E65F2B]"
            >
              <option value="ALL">Semua Golongan</option>
              <option value="BESAR">Golongan BESAR</option>
              <option value="MENENGAH">Golongan MENENGAH</option>
            </select>

            <Button
              variant="outline"
              onClick={fetchVendors}
              disabled={loading}
              className="h-10 px-3 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Tabel Data Rekanan Vendor */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4 min-w-[200px]">Rekanan Vendor</th>
                  <th className="py-3 px-4 min-w-[130px]">Cabang &amp; Wilayah</th>
                  <th className="py-3 px-4 min-w-[130px]">Jenis &amp; Peran</th>
                  <th className="py-3 px-4 min-w-[100px]">Golongan</th>
                  <th className="py-3 px-4 min-w-[170px]">Kontak &amp; Alamat</th>
                  <th className="py-3 px-4 min-w-[140px]">PIC Akun Login</th>
                  <th className="py-3 px-4 min-w-[120px]">Legalitas &amp; Portofolio</th>
                  <th className="py-3 px-4 w-28 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Loader2 className="w-6 h-6 animate-spin text-[#E65F2B]" />
                        <span className="text-xs">Memuat database rekanan vendor...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Building2 className="w-8 h-8 opacity-40" />
                        <p className="text-xs font-medium text-slate-600">Belum ada rekanan vendor yang sesuai</p>
                        <p className="text-[11px] text-slate-400">
                          {branchFilter !== "all"
                            ? `Tidak ada vendor terdaftar untuk cabang ${branchFilter}.`
                            : "Klik tombol \"Tambah Rekanan Vendor\" untuk mendaftarkan kontraktor/konsultan baru."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((vendor, idx) => {
                    const pengalamanCount = Array.isArray(vendor.pengalaman) ? vendor.pengalaman.length : 0;
                    const sertifikatCount = Array.isArray(vendor.sertifikat) ? vendor.sertifikat.length : 0;
                    const isoCount = Array.isArray(vendor.sertifikasi_iso) ? vendor.sertifikasi_iso.length : 0;

                    return (
                      <tr key={vendor.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4 text-center font-medium text-slate-400 text-xs">
                          {idx + 1}
                        </td>

                        {/* Nama & Alamat */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                            <span>{vendor.nama_perusahaan}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {vendor.alamat}
                          </p>
                        </td>

                        {/* Cabang & Coverage */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-800 text-[11px]">
                              {vendor.cabang || "HEAD OFFICE"}
                            </span>
                          </div>
                          {vendor.coverage_cabang ? (
                            <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5" title={`Coverage: ${vendor.coverage_cabang}`}>
                              Area: {vendor.coverage_cabang}
                            </p>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-medium">
                              Nasional
                            </span>
                          )}
                        </td>

                        {/* Jenis & Peran */}
                        <td className="py-3.5 px-4">
                          {vendor.jenis === "KONTRAKTOR" ? (
                            <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-md bg-orange-50 text-orange-800 border border-orange-200">
                              KONTRAKTOR
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                              {vendor.jenis}
                            </span>
                          )}
                        </td>

                        {/* Golongan */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                              vendor.golongan === "BESAR"
                                ? "bg-purple-100 text-purple-800 border border-purple-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {vendor.golongan}
                          </span>
                        </td>

                        {/* Kontak */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5 text-slate-600 text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{vendor.nomor_telepon}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[140px]">{vendor.email}</span>
                          </div>
                        </td>

                        {/* PIC Akun */}
                        <td className="py-3.5 px-4">
                          {vendor.pic_user ? (
                            <div className="flex items-center space-x-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-800 text-[11px]">
                                  {vendor.pic_user.nama}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {vendor.pic_user.role} ({vendor.pic_user.cabang})
                                </span>
                                {vendor.pic_users && vendor.pic_users.length > 1 && (
                                  <span className="text-[9px] text-emerald-700 font-bold">
                                    +{vendor.pic_users.length - 1} personil PIC
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              Belum terhubung
                            </span>
                          )}
                        </td>

                        {/* Portofolio & Legalitas */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded border border-orange-100"
                              title={`${pengalamanCount} riwayat pengalaman proyek`}
                            >
                              {pengalamanCount} Proyek
                            </span>
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100"
                              title={`${sertifikatCount} sertifikat badan usaha/keahlian`}
                            >
                              {sertifikatCount} SBU
                            </span>
                            {isoCount > 0 && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100"
                                title={`${isoCount} sertifikasi ISO`}
                              >
                                {isoCount} ISO
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Aksi */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDetail(vendor)}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                              title="Lihat Detail Profil"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(vendor)}
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                              title="Edit Rekanan"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(vendor)}
                              className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                              title="Hapus Rekanan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

        {/* Modal Form Tambah / Edit */}
        <VendorModal
          open={openFormModal}
          onOpenChange={setOpenFormModal}
          vendorData={selectedVendorForEdit}
          onSuccess={(savedVendor, isEdit) => {
            fetchVendors();
            setFeedback({
              open: true,
              type: "success",
              title: isEdit ? "Perubahan Tersimpan" : "Rekanan Baru Ditambahkan",
              message: `Profil "${savedVendor.nama_perusahaan}" telah berhasil disimpan ke database master rekanan.`,
            });
          }}
          onError={(errorMessage) => {
            setFeedback({
              open: true,
              type: "error",
              title: "Gagal Menyimpan",
              message: errorMessage,
            });
          }}
        />

        {/* Modal Detail Profil */}
        <DetailVendorModal
          open={openDetailModal}
          onOpenChange={setOpenDetailModal}
          vendor={selectedVendorForDetail}
          onEdit={(vendor) => {
            handleOpenEdit(vendor);
          }}
        />

        {/* Dialog Konfirmasi Hapus */}
        <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md p-6 rounded-2xl border border-slate-200/80 shadow-xl bg-white">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Konfirmasi Hapus Rekanan Vendor
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus{" "}
                  <strong className="text-slate-700">{deleteTarget?.nama_perusahaan}</strong> dari
                  database master? Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-4 mt-2 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="h-9 px-4 text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="h-9 px-4 text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all flex items-center space-x-1.5"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Ya, Hapus Vendor</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Feedback Modal Pop-up Visual */}
        <FeedbackModal
          open={feedback.open}
          onClose={() => setFeedback({ ...feedback, open: false })}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
        />
      </div>
    </Dashboard>
  );
}
