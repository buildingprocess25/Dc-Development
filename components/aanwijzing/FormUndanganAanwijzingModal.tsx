"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Building2,
  Users,
  AlertCircle,
  FileText,
  Mail,
  CheckCircle2,
  Plus,
  Trash2,
  Loader2,
  Phone,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { SearchableSelectInput } from "@/components/ui/searchable-select";

export interface ReadyProject {
  source_type: "TENDER_ABOVE_1M" | "FUNGSI_RUANG_BELOW_1M";
  kategori_nilai: "DI_ATAS_1M" | "DI_BAWAH_1M";
  tender_id: number | null;
  fungsi_ruang_id: number | null;
  project_id: number;
  renovasi_id: number;
  nomor_referensi: string;
  nama_proyek: string;
  kode_proyek: string;
  cabang: string;
  alamat_lokasi: string;
  nilai_proyek: number;
  kontraktor_lolos: {
    vendor_id: number;
    nama_perusahaan: string;
    email: string;
    nomor_telepon?: string;
    alamat?: string;
  }[];
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const val = String(i).padStart(2, "0");
  return { value: val, label: val };
});
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => {
  const val = String(i).padStart(2, "0");
  return { value: val, label: val };
});

interface FormUndanganAanwijzingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialProject?: ReadyProject | null;
}

export function FormUndanganAanwijzingModal({
  isOpen,
  onClose,
  onSuccess,
  initialProject = null,
}: FormUndanganAanwijzingModalProps) {
  // Ready Projects List & Selection
  const [readyProjects, setReadyProjects] = useState<ReadyProject[]>([]);
  const [loadingReadyProjects, setLoadingReadyProjects] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ReadyProject | null>(initialProject);

  // Form Fields
  const [tanggal, setTanggal] = useState("");
  const [jam, setJam] = useState("09");
  const [menit, setMenit] = useState("00");
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);

  // Khusus proyek < 1M: Master vendor kontraktor & pilihan
  const [availableVendors, setAvailableVendors] = useState<any[]>([]);
  const [selectedVendorIds, setSelectedVendorIds] = useState<number[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Feedback Modal
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

  const isAbove1M = selectedProject?.kategori_nilai === "DI_ATAS_1M";

  // Fetch daftar proyek yang siap dibuatkan aanwijzing
  const fetchReadyProjects = async () => {
    setLoadingReadyProjects(true);
    try {
      const res = await fetch("/api/dc-development/aanwijzing/ready-projects");
      const json = await res.json();
      if (json.status === "success" && Array.isArray(json.data)) {
        setReadyProjects(json.data);
      } else {
        setReadyProjects([]);
      }
    } catch (err) {
      console.error("Gagal mengambil proyek siap aanwijzing:", err);
      setReadyProjects([]);
    } finally {
      setLoadingReadyProjects(false);
    }
  };

  const fetchContractorVendors = async (cabang: string) => {
    setLoadingVendors(true);
    try {
      const res = await fetch(
        `/api/dc-development/master-vendor?jenis=KONTRAKTOR&cabang=${encodeURIComponent(cabang)}`
      );
      const json = await res.json();
      if (json.status === "success" && Array.isArray(json.data)) {
        setAvailableVendors(json.data);
      } else {
        setAvailableVendors([]);
      }
    } catch (err) {
      console.error("Gagal mengambil master vendor kontraktor:", err);
      setAvailableVendors([]);
    } finally {
      setLoadingVendors(false);
    }
  };

  // Reset form saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setTanggal("");
      setJam("09");
      setMenit("00");
      setCatatan("");
      setSelectedVendorIds([]);

      fetchReadyProjects();

      if (initialProject) {
        setSelectedProject(initialProject);
        if (initialProject.kategori_nilai === "DI_BAWAH_1M") {
          fetchContractorVendors(initialProject.cabang);
        }
      } else {
        setSelectedProject(null);
      }
    }
  }, [isOpen, initialProject]);

  // Helper unik key untuk identifikasi proyek tanpa bentrok underscore
  const getProjectKey = (p: ReadyProject) =>
    `${p.source_type}::${p.project_id}::${p.renovasi_id}::${p.tender_id || 0}::${p.fungsi_ruang_id || 0}::${p.kategori_nilai}`;

  // Handle pemilihan proyek dari Dropdown SearchableSelectInput
  const handleProjectSelectChange = (val: string) => {
    if (!val) {
      setSelectedProject(null);
      setSelectedVendorIds([]);
      return;
    }

    const found = readyProjects.find((p) => getProjectKey(p) === val);
    if (found) {
      setSelectedProject(found);
      setSelectedVendorIds([]);
      if (found.kategori_nilai === "DI_BAWAH_1M") {
        fetchContractorVendors(found.cabang);
      }
    }
  };

  const handleAddVendor = (vendorIdStr: string) => {
    const id = Number(vendorIdStr);
    if (id && !selectedVendorIds.includes(id)) {
      setSelectedVendorIds([...selectedVendorIds, id]);
    }
  };

  const handleRemoveVendor = (id: number) => {
    setSelectedVendorIds(selectedVendorIds.filter((vId) => vId !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) {
      setFeedback({
        open: true,
        type: "error",
        title: "Pilih Proyek",
        message: "Silakan pilih proyek yang akan diterbitkan surat undangan aanwijzing.",
      });
      return;
    }

    if (!tanggal) {
      setFeedback({
        open: true,
        type: "error",
        title: "Validasi Gagal",
        message: "Silakan tentukan tanggal pelaksanaan aanwijzing.",
      });
      return;
    }

    if (!jam || !menit) {
      setFeedback({
        open: true,
        type: "error",
        title: "Validasi Gagal",
        message: "Silakan tentukan jam dan menit pelaksanaan aanwijzing.",
      });
      return;
    }

    if (!isAbove1M && selectedVendorIds.length < 3) {
      setFeedback({
        open: true,
        type: "error",
        title: "Rekanan Kurang",
        message: "Untuk proyek bernilai di bawah 1 Miliar, wajib memilih minimal 3 rekanan kontraktor.",
      });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        project_id: selectedProject.project_id,
        renovasi_id: selectedProject.renovasi_id,
        tender_id: selectedProject.tender_id,
        fungsi_ruang_id: selectedProject.fungsi_ruang_id,
        kategori_nilai: selectedProject.kategori_nilai,
        tanggal_pelaksanaan: tanggal,
        waktu_pelaksanaan: `${jam}:${menit} WIB`,
        catatan: catatan ? catatan.trim() : null,
        vendor_ids: isAbove1M ? undefined : selectedVendorIds,
      };

      const res = await fetch("/api/dc-development/aanwijzing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.status === "success") {
        setFeedback({
          open: true,
          type: "success",
          title: "Undangan Aanwijzing Diterbitkan",
          message: `Surat Undangan Aanwijzing ${json.data?.nomor_undangan} berhasil diterbitkan dan email resmi telah dikirimkan kepada seluruh rekanan kontraktor.`,
        });
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Menerbitkan Undangan",
          message: json.message || "Terjadi kesalahan saat memproses surat undangan.",
        });
      }
    } catch (err: any) {
      console.error("Gagal submit aanwijzing:", err);
      setFeedback({
        open: true,
        type: "error",
        title: "Kesalahan Sistem",
        message: err.message || "Terjadi gangguan jaringan atau kesalahan pada server.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFeedbackClose = () => {
    setFeedback((prev) => ({ ...prev, open: false }));
    if (feedback.type === "success") {
      onClose();
      onSuccess();
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  // Options untuk ComboBox Dropdown Pemilihan Proyek Siap
  const projectSelectOptions = readyProjects.map((p) => {
    const katLabel = p.kategori_nilai === "DI_ATAS_1M" ? "> 1M" : "< 1M";
    return {
      value: getProjectKey(p),
      label: `[${katLabel}] [${p.cabang}] ${p.nama_proyek} (${p.kode_proyek}) - Rp ${Number(p.nilai_proyek).toLocaleString("id-ID")}`,
    };
  });

  const selectedProjectVal = selectedProject ? getProjectKey(selectedProject) : "";

  const vendorSelectOptions = availableVendors
    .filter((v) => !selectedVendorIds.includes(v.id))
    .map((v) => ({
      value: String(v.id),
      label: `${v.nama_perusahaan} (${v.cabang || "HEAD OFFICE"}) - ${v.email}`,
    }));

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl sm:max-w-4xl lg:max-w-4xl w-[94vw] max-h-[92vh] overflow-hidden flex flex-col p-0 rounded-2xl border-slate-200/80 shadow-2xl bg-white">
          {/* HEADER (Solid bg-white, non-transparent agar tidak tembus saat scroll) */}
          <DialogHeader className="px-6 md:px-8 py-5 border-b border-slate-200/80 bg-white shrink-0 z-20">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#E65F2B] shadow-2xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight">
                    Terbitkan Undangan Aanwijzing
                  </DialogTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Rapat Penjelasan Pekerjaan &amp; Peninjauan Lapangan
                  </p>
                </div>
              </div>

              {selectedProject && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${isAbove1M
                    ? "bg-orange-50 text-orange-800 border-orange-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    }`}
                >
                  {isAbove1M ? "Proyek > 1M (Tender)" : "Proyek < 1M (PFR)"}
                </span>
              )}
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            {/* SCROLLABLE FORM BODY */}
            <div className="px-6 md:px-8 py-6 space-y-5 overflow-y-auto flex-1 bg-white">
              {/* COMBOBOX 1: CARI & PILIH PROYEK SIAP AANWIJZING */}
              <div className="space-y-2 bg-slate-50/80 p-4.5 rounded-2xl border border-slate-200/80">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#E65F2B]" />
                    Cari &amp; Pilih Proyek Siap Aanwijzing <span className="text-rose-500">*</span>
                  </span>
                  {loadingReadyProjects && (
                    <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1 normal-case tracking-normal">
                      <Loader2 className="w-3 h-3 animate-spin text-[#E65F2B]" />
                      Memuat daftar proyek...
                    </span>
                  )}
                </label>

                <SearchableSelectInput
                  value={selectedProjectVal}
                  onChange={handleProjectSelectChange}
                  options={projectSelectOptions}
                  placeholder={
                    loadingReadyProjects
                      ? "Sedang memuat data proyek siap aanwijzing..."
                      : readyProjects.length === 0
                        ? "Tidak ada proyek yang siap aanwijzing saat ini"
                        : "Ketik nama proyek, kode, no. ref, atau cabang..."
                  }
                />

                {!loadingReadyProjects && readyProjects.length === 0 && (
                  <p className="text-[11px] text-amber-600 font-medium">
                    Belum ada berkas proyek yang memenuhi syarat aanwijzing (Tender Approved untuk &gt;1M atau Fungsi Ruang Approved untuk &lt;1M).
                  </p>
                )}
              </div>

              {/* JIKA BELUM ADA PROYEK YANG DIPILIH */}
              {!selectedProject ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center flex flex-col items-center justify-center bg-white shadow-2xs">
                  <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#E65F2B] border border-orange-100 flex items-center justify-center mb-3.5 shadow-2xs">
                    <FileText className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Pilih Proyek Siap Aanwijzing Terlebih Dahulu
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md">
                    Pilih proyek pada dropdown di atas untuk memuat alamat DC lokasi pelaksanaan, jadwal, dan daftar rekanan kontraktor.
                  </p>
                </div>
              ) : (
                <>
                  {/* KARTU RINGKASAN PROYEK & ALAMAT STATIS */}
                  <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-5 space-y-3.5 shadow-2xs">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 font-medium">Nama Proyek:</span>
                        <p className="font-bold text-slate-900 text-sm mt-0.5">
                          {selectedProject.nama_proyek} ({selectedProject.kode_proyek})
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Cabang DC &amp; Ref:</span>
                        <p className="font-semibold text-slate-800 mt-0.5">
                          {selectedProject.cabang} &bull; <span className="text-slate-600 font-mono text-[11px]">{selectedProject.nomor_referensi}</span>
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Nilai Pekerjaan:</span>
                        <p className="font-extrabold text-[#E65F2B] text-sm mt-0.5">
                          Rp {Number(selectedProject.nilai_proyek).toLocaleString("id-ID")}
                        </p>
                      </div>
                    </div>

                    {/* Alamat Pelaksanaan (Statis dari dc_project.alamat) */}
                    <div className="pt-3 border-t border-slate-200/70">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#E65F2B]" />
                          Lokasi Pelaksanaan Aanwijzing
                        </span>
                        <span className="text-[10px] bg-slate-200/70 text-slate-600 font-medium px-2 py-0.5 rounded">
                          Terkunci dari Profil DC
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed font-medium shadow-2xs">
                        {selectedProject.alamat_lokasi}
                      </div>
                    </div>
                  </div>

                  {/* INPUT JADWAL PELAKSANAAN */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#E65F2B]" />
                        Tanggal Pelaksanaan <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        min={todayStr}
                        value={tanggal}
                        onChange={(e) => setTanggal(e.target.value)}
                        required
                        className="w-full h-11 px-3 text-xs rounded-lg border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E65F2B]/20 focus:border-[#E65F2B] transition-all cursor-pointer font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#E65F2B]" />
                        Waktu / Jam Pelaksanaan <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {/* ComboBox Jam */}
                        <div className="flex-1 min-w-[90px]">
                          <SearchableSelectInput
                            value={jam}
                            onChange={setJam}
                            options={HOUR_OPTIONS}
                            placeholder="Jam"
                          />
                        </div>

                        <span className="text-slate-400 font-bold text-base select-none">:</span>

                        {/* ComboBox Menit */}
                        <div className="flex-1 min-w-[90px]">
                          <SearchableSelectInput
                            value={menit}
                            onChange={setMenit}
                            options={MINUTE_OPTIONS}
                            placeholder="Menit"
                          />
                        </div>

                        {/* Satuan Tetap WIB */}
                        <div
                          className="h-11 px-3.5 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 font-bold text-xs select-none shrink-0 tracking-wider shadow-2xs"
                          title="Zona Waktu Indonesia Barat (WIB)"
                        >
                          WIB
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CATATAN TAMBAHAN */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                      Catatan Khusus Peserta / Instruksi APD
                    </label>
                    <textarea
                      rows={2}
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      placeholder="Contoh: Peserta wajib membawa APD lengkap dan hadir 15 menit sebelum rapat dimulai."
                      className="w-full p-3 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E65F2B]/20 focus:border-[#E65F2B] transition-all resize-none"
                    />
                  </div>

                  {/* BAGIAN REKANAN KONTRAKTOR */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-[#E65F2B]" />
                          Daftar Rekanan Kontraktor Yang Diundang
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {isAbove1M
                            ? "Otomatis diambil dari rekanan yang telah lolos pengajuan proposal tender."
                            : "Pilih minimal 3 rekanan kontraktor yang meng-cover cabang proyek ini."}
                        </p>
                      </div>

                      {!isAbove1M && (
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${selectedVendorIds.length >= 3
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                            }`}
                        >
                          {selectedVendorIds.length} / Min. 3 Rekanan
                        </span>
                      )}
                    </div>

                    {/* KONTRAKTOR PROYEK > 1M (READ-ONLY DARI PROPOSAL TENDER) */}
                    {isAbove1M ? (
                      <div className="space-y-2">
                        {(selectedProject.kontraktor_lolos || []).length === 0 ? (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
                            Tidak ditemukan rekanan kontraktor yang lolos pada tender ini.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {selectedProject.kontraktor_lolos.map((k) => (
                              <div
                                key={k.vendor_id}
                                className="p-3 rounded-xl border border-slate-200 bg-white flex flex-col justify-between shadow-2xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-bold text-slate-900 text-xs">{k.nama_perusahaan}</p>
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                                    Lolos Tender
                                  </span>
                                </div>
                                <div className="mt-2 text-[11px] text-slate-600 space-y-0.5 font-medium">
                                  <p className="flex items-center gap-1 text-slate-500">
                                    <Mail className="w-3 h-3 text-slate-400" />
                                    {k.email}
                                  </p>
                                  {k.nomor_telepon && (
                                    <p className="flex items-center gap-1 text-slate-500">
                                      <Phone className="w-3 h-3 text-slate-400" />
                                      {k.nomor_telepon}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* KONTRAKTOR PROYEK < 1M (PILIH MINIMAL 3 DARI MASTER VENDOR) */
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <SearchableSelectInput
                              value=""
                              onChange={handleAddVendor}
                              options={vendorSelectOptions}
                              placeholder={
                                loadingVendors
                                  ? "Memuat master rekanan..."
                                  : vendorSelectOptions.length === 0
                                    ? "Semua rekanan telah dipilih"
                                    : "Pilih rekanan kontraktor untuk ditambahkan..."
                              }
                            />
                          </div>
                        </div>

                        {selectedVendorIds.length === 0 ? (
                          <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 bg-slate-50/50">
                            Belum ada rekanan yang dipilih. Silakan pilih minimal 3 kontraktor pada dropdown di atas.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {selectedVendorIds.map((vId) => {
                              const vObj = availableVendors.find((v) => v.id === vId);
                              if (!vObj) return null;
                              return (
                                <div
                                  key={vId}
                                  className="p-3 rounded-xl border border-slate-200/90 bg-white flex items-center justify-between gap-3 text-xs shadow-2xs hover:border-slate-300 transition-all"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold text-slate-900 truncate">{vObj.nama_perusahaan}</p>
                                    <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                                      {vObj.email} {vObj.nomor_telepon ? `• ${vObj.nomor_telepon}` : ""}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveVendor(vId)}
                                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 h-8 w-8 p-0 rounded-lg cursor-pointer shrink-0"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* BANNER INFO OTOMATIS */}
                  <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-xl text-xs text-blue-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-blue-950">
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      Pengiriman Email & Batas Waktu Respon 2x24 JAM
                    </div>
                    <p className="text-slate-600 text-[11.5px] leading-relaxed">
                      Surat undangan resmi format PDF akan digenerate otomatis dan dikirimkan via email ke seluruh rekanan. Kontraktor memiliki batas waktu hingga hari ke-2 pukul 24:00 WIB untuk merespon kesediaan hadir melalui portal SPARTA.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* FOOTER ACTION BUTTONS (Solid bg-slate-50, non-transparent) */}
            <DialogFooter className="px-6 py-3.5 border-t border-slate-200/80 bg-slate-50/80 shrink-0 flex items-center justify-end gap-2 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border-slate-200 text-xs font-semibold h-10 px-4 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={
                  !selectedProject ||
                  loading ||
                  !tanggal ||
                  !jam ||
                  !menit ||
                  (!isAbove1M && selectedVendorIds.length < 3)
                }
                className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white rounded-xl text-xs font-bold h-10 px-5 shadow-sm shadow-orange-500/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menerbitkan...
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5" />
                    Terbitkan Undangan & Kirim Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <FeedbackModal
        open={feedback.open}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={handleFeedbackClose}
      />
    </>
  );
}
