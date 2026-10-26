"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FileSignature,
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Award,
  ShieldAlert,
  Loader2,
  Lock,
  Layers,
  User,
  Calculator,
  RefreshCw,
  Tag,
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  ShieldCheck,
  Save,
  Send,
  Info,
  HardHat,
  Users,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelectInput } from "@/components/ui/searchable-select";
import { useSession } from "@/context/SessionContext";
import { formatRupiah, toTitleCase } from "@/lib/utils";
import { isApprovalAdmin } from "@/lib/permissions";
import { isVendorCoveringBranch } from "@/lib/branches";

interface FormPengajuanTenderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pfrData?: any | null;
  onSuccess: (tender: any, customFeedback?: { title: string; message: string }) => void;
  onError: (errorMessage: string) => void;
}

export const TIPE_KONSULTAN_OPTIONS = [
  { value: "PENGAWAS", label: "Konsultan Pengawas (MK)" },
  { value: "PERENCANA", label: "Konsultan Perencana" },
  { value: "PENGAWAS_DAN_PERENCANA", label: "Konsultan Pengawas & Perencana" },
];

// Helper safely parse array/JSON data
function parseArrayData(data: any): string[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data
      .map((it) => (typeof it === "string" ? it : it?.nama || it?.nomor || it?.judul || JSON.stringify(it)))
      .filter(Boolean);
  }
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed
          .map((it) => (typeof it === "string" ? it : it?.nama || it?.nomor || it?.judul || JSON.stringify(it)))
          .filter(Boolean);
      }
      return [data];
    } catch {
      return [data];
    }
  }
  return [];
}

export function FormPengajuanTenderModal({
  open,
  onOpenChange,
  pfrData: initialPfrData,
  onSuccess,
  onError,
}: FormPengajuanTenderModalProps) {
  const { user } = useSession();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Lazy query daftar PFR Approved on modal open
  const [pfrList, setPfrList] = useState<any[]>([]);
  const [loadingPfr, setLoadingPfr] = useState(false);
  const [selectedPfrId, setSelectedPfrId] = useState<string>("");
  const [selectedPfr, setSelectedPfr] = useState<any | null>(null);

  // Master vendor list from database
  const [availableVendors, setAvailableVendors] = useState<any[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  // Step 1: Kebutuhan Konsultan & Catatan Maker
  const [catatanMaker, setCatatanMaker] = useState("");
  const [butuhKonsultan, setButuhKonsultan] = useState(false);
  const [tipeKonsultan, setTipeKonsultan] = useState("PENGAWAS");

  // Step 2: Mode pencarian aktif vs tombol tambah
  const [showSearchKontraktor, setShowSearchKontraktor] = useState(true);
  const [showSearchKonsultan, setShowSearchKonsultan] = useState(false);

  // Step 2: Peserta Tender (Kontraktor & Konsultan)
  const [pesertaList, setPesertaList] = useState<any[]>([]);

  // Inisialisasi saat modal dibuka
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setCatatanMaker("");
      setPesertaList([]);
      setShowSearchKontraktor(true);
      setShowSearchKonsultan(false);
      setButuhKonsultan(false);
      setTipeKonsultan("PENGAWAS");

      if (initialPfrData) {
        setSelectedPfr(initialPfrData);
        setSelectedPfrId(String(initialPfrData.id));
      } else {
        setSelectedPfr(null);
        setSelectedPfrId("");
      }

      // 1. Lazy Fetch PFR Approved on demand
      const fetchPfrApproved = async () => {
        try {
          setLoadingPfr(true);
          const res = await fetch("/api/dc-development/tender/pfr-approved");
          const json = await res.json();
          if (res.ok && json.status === "success") {
            const items = json.data || [];
            setPfrList(items);

            if (initialPfrData) {
              const matched = items.find((it: any) => String(it.id) === String(initialPfrData.id));
              if (matched) {
                setSelectedPfr(matched);
                setSelectedPfrId(String(matched.id));
              }
            }
          }
        } catch (e) {
          console.error("Gagal mengambil PFR approved:", e);
        } finally {
          setLoadingPfr(false);
        }
      };

      // 2. Fetch Master Vendor aktif
      const fetchVendors = async () => {
        try {
          setLoadingVendors(true);
          const res = await fetch("/api/dc-development/master-vendor");
          const json = await res.json();
          if (json.status === "success") {
            setAvailableVendors(json.data || []);
          }
        } catch (e) {
          console.error("Gagal mengambil master vendor:", e);
        } finally {
          setLoadingVendors(false);
        }
      };

      fetchPfrApproved();
      fetchVendors();
    }
  }, [open, initialPfrData]);

  // Options Combobox PFR Approved
  const pfrOptions = useMemo(() => {
    return pfrList.map((item) => {
      const isLocked = item.has_active_tender;
      const statusTag = isLocked
        ? ` — [🔒 TENDER AKTIF: ${item.active_tender_status}]`
        : "";

      return {
        value: String(item.id),
        label: `[${item.nomor_pengajuan}] ${item.project_nama} (${item.cabang}) — ${item.pemohon_nama} • ${item.tipe_threshold}${statusTag}`,
      };
    });
  }, [pfrList]);

  // ID yang terkunci karena sudah ada tender aktif
  const lockedPfrIds = useMemo(() => {
    return pfrList
      .filter((item) => item.has_active_tender)
      .map((item) => String(item.id));
  }, [pfrList]);

  // Handler Ganti PFR dari Combobox
  const handlePfrChange = (id: string) => {
    setSelectedPfrId(id);
    const matched = pfrList.find((it) => String(it.id) === String(id)) || null;
    setSelectedPfr(matched);
    setPesertaList([]);
    setShowSearchKontraktor(true);
    setShowSearchKonsultan(false);
  };

  const isAbove1M = selectedPfr?.kategori_nilai === "DI_ATAS_1M";

  // Role permissions checks
  const userRole = (user?.role || "").toUpperCase();
  const isBranchBM =
    userRole.includes("BRANCH") ||
    userRole.includes("CABANG") ||
    (userRole.includes("B&M MANAGER") && !userRole.includes("GENERAL") && !userRole.includes("REGIONAL"));
  const isSpecialistOrAdmin =
    userRole.includes("SPECIALIST") || isApprovalAdmin(user?.role);

  // Filter vendor list kontraktor berdasarkan cakupan cabang proyek (coverage_cabang)
  const targetProjectCabang = selectedPfr?.cabang || "";

  const availableKontraktors = useMemo(() => {
    return availableVendors.filter((v) => {
      const isKontraktor = (v.jenis || "").toUpperCase() === "KONTRAKTOR";
      if (!isKontraktor) return false;
      if (targetProjectCabang && !isVendorCoveringBranch(v.cabang, v.coverage_cabang, targetProjectCabang)) {
        return false;
      }
      return true;
    });
  }, [availableVendors, targetProjectCabang]);

  // Filter vendor list konsultan berdasarkan peran dan cakupan cabang proyek
  const availableKonsultans = useMemo(() => {
    return availableVendors.filter((v) => {
      const j = (v.jenis || "").toUpperCase();
      let matchJenis = false;
      if (tipeKonsultan === "PENGAWAS") {
        matchJenis = j.includes("PENGAWAS");
      } else if (tipeKonsultan === "PERENCANA") {
        matchJenis = j.includes("PERENCANA");
      } else if (tipeKonsultan === "PENGAWAS_DAN_PERENCANA") {
        matchJenis = j.includes("PENGAWAS") || j.includes("PERENCANA");
      } else {
        matchJenis = j.includes("KONSULTAN");
      }
      if (!matchJenis) return false;

      if (targetProjectCabang && !isVendorCoveringBranch(v.cabang, v.coverage_cabang, targetProjectCabang)) {
        return false;
      }
      return true;
    });
  }, [availableVendors, tipeKonsultan, targetProjectCabang]);

  // Combobox Options untuk Kontraktor (hanya yang belum ditambahkan dan mencakup cabang proyek)
  const availableKontraktorOptions = useMemo(() => {
    return availableKontraktors
      .filter((v) => !pesertaList.some((p) => p.vendor_id === v.id))
      .map((v) => ({
        value: String(v.id),
        label: `[GOLONGAN ${v.golongan}] ${v.nama_perusahaan} — Domisili: ${v.cabang} | Coverage: ${v.coverage_cabang || v.cabang || "-"} (${v.nomor_telepon || v.email || "Tanpa Kontak"})`,
      }));
  }, [availableKontraktors, pesertaList]);

  // Combobox Options untuk Konsultan (hanya yang belum ditambahkan dan mencakup cabang proyek)
  const availableKonsultanOptions = useMemo(() => {
    return availableKonsultans
      .filter((v) => !pesertaList.some((p) => p.vendor_id === v.id))
      .map((v) => ({
        value: String(v.id),
        label: `[${v.jenis}] ${v.nama_perusahaan} — Domisili: ${v.cabang} | Coverage: ${v.coverage_cabang || v.cabang || "-"} (${v.nomor_telepon || v.email || "Tanpa Kontak"})`,
      }));
  }, [availableKonsultans, pesertaList]);

  // Selected participants
  const selectedKontraktors = useMemo(
    () => pesertaList.filter((p) => p.peran === "MAIN_KONTRAKTOR"),
    [pesertaList]
  );
  const selectedKonsultans = useMemo(
    () => pesertaList.filter((p) => p.peran.includes("KONSULTAN")),
    [pesertaList]
  );

  // Handler pilih rekanan kontraktor (langsung masuk ke atas daftar usulan, search berubah jadi tombol tambah)
  const handleSelectAndAddKontraktor = (vendorId: string) => {
    if (!vendorId) return;
    const vendor = availableVendors.find((v) => String(v.id) === vendorId);
    if (!vendor) return;
    if (pesertaList.some((p) => p.vendor_id === vendor.id)) return;

    // Masuk ke posisi paling bawah daftar rekanan
    setPesertaList((prev) => [
      ...prev,
      {
        vendor_id: vendor.id,
        vendor,
        peran: "MAIN_KONTRAKTOR",
        status_tahap: "PRAKUALIFIKASI",
        alasan_tidak_lolos: "",
        score: "",
      },
    ]);
    // Search box berubah menjadi tombol "+ Tambah Rekanan"
    setShowSearchKontraktor(false);
  };

  // Handler pilih rekanan konsultan (masuk ke posisi bawah daftar)
  const handleSelectAndAddKonsultan = (vendorId: string) => {
    if (!vendorId) return;
    const vendor = availableVendors.find((v) => String(v.id) === vendorId);
    if (!vendor) return;
    if (pesertaList.some((p) => p.vendor_id === vendor.id)) return;

    // Masuk ke posisi paling bawah daftar rekanan
    setPesertaList((prev) => [
      ...prev,
      {
        vendor_id: vendor.id,
        vendor,
        peran: `KONSULTAN_${tipeKonsultan}`,
        status_tahap: "PRAKUALIFIKASI",
        alasan_tidak_lolos: "",
        score: "",
      },
    ]);
    setShowSearchKonsultan(false);
  };

  // Handler hapus rekanan dari daftar terpilih
  const handleRemoveVendor = (vendorId: number) => {
    setPesertaList((prev) => {
      const updated = prev.filter((p) => p.vendor_id !== vendorId);
      const remainingKontraktor = updated.filter((p) => p.peran === "MAIN_KONTRAKTOR");
      if (remainingKontraktor.length === 0) {
        setShowSearchKontraktor(true);
      }
      const remainingKonsultan = updated.filter((p) => p.peran.includes("KONSULTAN"));
      if (remainingKonsultan.length === 0) {
        setShowSearchKonsultan(false);
      }
      return updated;
    });
  };

  // Step Navigations & Validation
  const handleNextStep = () => {
    // TAHAP 1: Validasi PFR
    if (currentStep === 1) {
      if (!selectedPfr) {
        onError("Silakan pilih dokumen PFR yang telah disetujui terlebih dahulu.");
        return;
      }
      if (selectedPfr.has_active_tender) {
        onError(`Proyek ini sudah memiliki Pengajuan Proposal Tender aktif (${selectedPfr.active_tender_status}). Tidak dapat mengajukan tender ganda.`);
        return;
      }
      setCurrentStep(2);
      return;
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Unified Save / Submit Tender
  const handleSaveTender = async (isDraftPraKualifikasi: boolean = true) => {
    if (!selectedPfr) return;
    if (selectedKontraktors.length < 3) {
      onError(`Wajib memilih minimal 3 Rekanan Kontraktor (saat ini: ${selectedKontraktors.length} terpilih).`);
      return;
    }
    if (butuhKonsultan && selectedKonsultans.length < 1) {
      onError("Anda mencentang kebutuhan konsultan, silakan pilih minimal 1 rekanan konsultan.");
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        project_id: selectedPfr.project_id,
        renovasi_id: selectedPfr.renovasi_id,
        fungsi_ruang_id: selectedPfr.id,
        kategori_nilai: "DI_ATAS_1M",
        nilai_proyek: selectedPfr.nilai_rab,
        cabang: selectedPfr.cabang,
        created_by: user?.email || "maker@alfamart.co.id",
        user_name: (user as any)?.name || user?.email?.split("@")[0] || "Maker",
        user_role: user?.role || "DC Building & Development Specialist",
        butuh_konsultan: butuhKonsultan,
        tipe_konsultan: butuhKonsultan ? tipeKonsultan : null,
        catatan_maker: catatanMaker ? toTitleCase(catatanMaker.trim()) : null,
        peserta: pesertaList.map((p) => ({
          vendor_id: p.vendor_id,
          peran: p.peran,
          status_tahap: p.status_tahap || "PRAKUALIFIKASI",
          alasan_tidak_lolos: p.alasan_tidak_lolos,
          score: p.score ? Number(p.score) : null,
        })),
        schedule: [],
      };

      const res = await fetch("/api/dc-development/tender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.status === "success") {
        const tender = json.data;
        const customFeedback = {
          title: "Draf Pra-kualifikasi Disimpan",
          message: `Draf Pengajuan Proposal Tender ${tender.nomor_tender} berhasil disimpan dengan status PRAKUALIFIKASI. Anda dapat melanjutkan tahapan kualifikasi dan penjadwalan kapan saja.`,
        };

        onSuccess(tender, customFeedback);
        onOpenChange(false);
      } else {
        onError(json.message || "Gagal menyimpan Pengajuan Proposal Tender.");
      }
    } catch (e: any) {
      console.error(e);
      onError(e.message || "Terjadi kesalahan saat memproses Pengajuan Proposal Tender.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-5xl lg:max-w-5xl w-[96vw] max-h-[92vh] overflow-hidden p-0 rounded-2xl border border-slate-200/80 shadow-2xl bg-white flex flex-col [&>button:last-child]:hidden">
        {/* Header Modal Sticky */}
        <div className="flex items-center justify-between px-6 md:px-8 py-4.5 border-b border-slate-100 bg-white sticky top-0 z-20">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#E65F2B] to-[#cf4d1a] flex items-center justify-center text-white shadow-xs">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">
                  Formulir Pengajuan Proposal Tender Proyek DC
                </h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-orange-50 text-[#E65F2B] border border-orange-200 uppercase tracking-wide">
                  Tahap {currentStep} / 2
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedPfr ? (
                  <>
                    PFR Ref: <span className="font-semibold text-slate-800">{selectedPfr.nomor_pengajuan}</span> &bull; {selectedPfr.project_nama} ({selectedPfr.cabang})
                  </>
                ) : (
                  "Pilih dokumen PFR yang disetujui dan usulkan rekanan peserta tender"
                )}
              </p>
            </div>
          </div>

          {/* Single Clean Close Button (Radix's auto close button is hidden via [&>button:last-child]:hidden) */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tutup Formulir"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar (Segmented Executive Bar) */}
        <div className="px-6 md:px-8 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-3 shrink-0">
          {[
            {
              step: 1,
              title: "1. Data Proyek & Konsultan",
              desc: "Dokumen PFR Approved, Opsi MK & Catatan",
            },
            {
              step: 2,
              title: "2. Pilih Calon Rekanan",
              desc: "Wajib Min. 3 Kontraktor Rekanan",
            },
          ].map((s, idx) => {
            const isActive = currentStep === s.step;
            const isDone = currentStep > s.step;

            return (
              <React.Fragment key={s.step}>
                <div
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all flex-1 border ${isActive
                      ? "bg-white border-orange-200 shadow-2xs"
                      : isDone
                        ? "bg-emerald-50/40 border-emerald-100/80"
                        : "bg-transparent border-transparent opacity-60"
                    }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all shrink-0 ${isActive
                        ? "bg-[#E65F2B] text-white shadow-xs"
                        : isDone
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                  >
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : s.step}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-xs font-bold truncate ${isActive
                            ? "text-slate-900"
                            : isDone
                              ? "text-emerald-800"
                              : "text-slate-500"
                          }`}
                      >
                        {s.title}
                      </p>
                      {isActive && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-100 text-[#E65F2B] uppercase">
                          Aktif
                        </span>
                      )}
                      {isDone && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700 uppercase">
                          Selesai
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{s.desc}</p>
                  </div>
                </div>
                {idx === 0 && (
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 hidden sm:block" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Modal Form Content Body (Single Body Scroll) */}
        <div className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto bg-[#FAFAFA]/60">
          {/* STEP 1: PEMILIHAN PROYEK, INFORMASI DETAIL, KEBUTUHAN KONSULTAN & CATATAN */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Dropdown Combobox Pemilihan PFR Approved */}
              <div className="space-y-2.5 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#E65F2B]" />
                    Cari &amp; Pilih Dokumen PFR Approved <span className="text-rose-500">*</span>
                  </span>
                  {loadingPfr && (
                    <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1 normal-case tracking-normal">
                      <RefreshCw className="w-3 h-3 animate-spin text-[#E65F2B]" />
                      Memuat daftar proyek...
                    </span>
                  )}
                </label>

                <SearchableSelectInput
                  value={selectedPfrId}
                  onChange={handlePfrChange}
                  options={pfrOptions}
                  disabledIds={lockedPfrIds}
                  placeholder={
                    loadingPfr
                      ? "Sedang memuat data proyek PFR..."
                      : pfrList.length === 0
                        ? "Tidak ada dokumen PFR approved yang siap ditenderkan"
                        : "Ketik nomor pengajuan, nama proyek DC, atau cabang..."
                  }
                />

                {!loadingPfr && pfrList.length === 0 && (
                  <p className="text-[11px] text-amber-600 font-medium">
                    Belum ada berkas PFR berstatus APPROVED yang memenuhi kriteria wewenang peran atau coverage cabang Anda.
                  </p>
                )}
              </div>

              {/* TAMPILAN JIKA BELUM MEMILIH PFR */}
              {!selectedPfr ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center flex flex-col items-center justify-center bg-white shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#E65F2B] border border-orange-100 flex items-center justify-center mb-3.5">
                    <Layers className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Pilih Dokumen PFR Terlebih Dahulu
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
                    Gunakan kolom pencarian di atas untuk memilih berkas Perubahan Fungsi Ruang (PFR). Rincian proyek, total anggaran, opsi konsultan, dan catatan maker akan otomatis tampil di sini.
                  </p>
                </div>
              ) : (
                /* TAMPILAN SETELAH PFR DIPILIH: UNIFIED ELEGANT CARD */
                <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Banner Peringatan Jika Tender Sudah Aktif */}
                  {selectedPfr.has_active_tender && (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start space-x-3">
                      <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-amber-950 uppercase tracking-wide">
                          Pengajuan Proposal Tender Terkunci
                        </h4>
                        <p className="mt-0.5 leading-relaxed text-amber-800">
                          Proyek ini sudah memiliki berkas Pengajuan Proposal Tender aktif dengan status{" "}
                          <strong>{selectedPfr.active_tender_status}</strong> (Nomor: {selectedPfr.active_tender_nomor || "-"}). Pengajuan Proposal Tender ganda tidak diperbolehkan.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* UNIFIED PROJECT HIGHLIGHT CARD */}
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-5 shadow-xs">
                    {/* Header Proyek dengan Badges Terintegrasi */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3.5 border-b border-slate-100 pb-4.5">
                      <div className="flex items-start space-x-3.5">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-[#E65F2B] flex items-center justify-center font-bold shrink-0 mt-0.5">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                            {selectedPfr.project_nama}
                          </h3>
                          <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1 flex-wrap gap-y-1">
                            <span className="font-semibold text-slate-700">Cabang {selectedPfr.cabang}</span>
                            {selectedPfr.project_kode && (
                              <span>&bull; Kode: <span className="font-semibold text-slate-700">{selectedPfr.project_kode}</span></span>
                            )}
                            {selectedPfr.dc_induk && (
                              <span>&bull; Induk: <span className="font-semibold text-slate-700">{selectedPfr.dc_induk}</span></span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {/* Status Badge */}
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          {selectedPfr.status}
                        </span>

                        {/* Threshold Category Badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-extrabold border uppercase tracking-wider ${isAbove1M
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                        >
                          {isAbove1M ? "Kategori BESAR (> 1M)" : "Kategori MENENGAH (≤ 1M)"}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Grid 4 Kolom */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                      {/* Dokumen PFR */}
                      <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100/90">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                          Dokumen PFR
                        </span>
                        <p className="font-bold text-slate-900 font-mono mt-1 text-xs">
                          {selectedPfr.nomor_pengajuan}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-slate-400" />
                          <span>{selectedPfr.jenis_pengajuan}</span>
                        </p>
                      </div>

                      {/* Departemen Pemohon */}
                      <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100/90">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                          Departemen Pemohon
                        </span>
                        <p className="font-bold text-slate-900 mt-1 flex items-center gap-1.5 text-xs">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{selectedPfr.pemohon_nama}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 leading-snug break-words line-clamp-2">
                          {selectedPfr.pemohon_dept}
                        </p>
                      </div>

                      {/* Estimasi RAB */}
                      <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100/90">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                          Total Anggaran (RAB)
                        </span>
                        <p className="font-black text-sm text-[#E65F2B] mt-1">
                          {formatRupiah(selectedPfr.nilai_rab)}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-1">
                          <Calculator className="w-3 h-3 text-slate-400" />
                          <span>Ref: {selectedPfr.nomor_rab || "-"}</span>
                        </p>
                      </div>

                      {/* Alur & Ketentuan Pengadaan */}
                      <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100/90">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                          Alur &amp; Wewenang
                        </span>
                        <p className="font-bold text-slate-900 mt-1 text-xs">
                          {isAbove1M ? "Bertingkat Hingga Direktur" : "Ringkas DC Specialist"}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Wajib min. 3 Kontraktor Rekanan
                        </p>
                      </div>
                    </div>

                    {/* SOP Guidance Callout */}
                    <div
                      className={`px-4 py-3 rounded-xl text-xs flex items-center space-x-2.5 font-medium ${isAbove1M
                          ? "bg-purple-50/70 border border-purple-200/80 text-purple-900"
                          : "bg-blue-50/70 border border-blue-200/80 text-blue-900"
                        }`}
                    >
                      <Info className="w-4 h-4 shrink-0 text-[#E65F2B]" />
                      <span className="leading-relaxed">
                        Proyek tender wajib memilih minimal 3 Kontraktor Rekanan (Golongan Menengah / Besar) yang mencakup cabang proyek. Pengajuan disimpan sebagai pra-kualifikasi resmi.
                      </span>
                    </div>
                  </div>

                  {/* KEBUTUHAN KONSULTAN */}
                  <div className="p-6 rounded-2xl border border-slate-200/90 bg-white space-y-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start space-x-3.5">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                          <HardHat className="w-5 h-5 text-slate-700" />
                        </div>
                        <div>
                          <h4 className="text-xs md:text-sm font-bold text-slate-800">
                            Kebutuhan Jasa Konsultan Pelaksana / MK
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Aktifkan opsi ini jika proyek renovasi memerlukan pendampingan Konsultan Pengawas (MK) atau Perencana.
                          </p>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={butuhKonsultan}
                          onChange={(e) => setButuhKonsultan(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E65F2B]"></div>
                      </label>
                    </div>

                    {butuhKonsultan && (
                      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3.5 animate-in fade-in duration-150">
                        <label className="text-xs font-bold text-slate-700 shrink-0">
                          Pilih Tipe Konsultan: <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex-1">
                          <SearchableSelectInput
                            value={tipeKonsultan}
                            onChange={(val) => setTipeKonsultan(val || "PENGAWAS")}
                            options={TIPE_KONSULTAN_OPTIONS}
                            placeholder="Pilih jenis konsultan pelaksana..."
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ISI CATATAN PENGANTAR MAKER */}
                  <div className="p-6 rounded-2xl border border-slate-200/90 bg-white space-y-2.5 shadow-xs">
                    <label className="text-xs md:text-sm font-bold text-slate-700 block">
                      Catatan Pengantar Pengadaan Tender (Opsional)
                    </label>
                    <textarea
                      value={catatanMaker}
                      onChange={(e) => setCatatanMaker(e.target.value)}
                      onBlur={(e) => setCatatanMaker(toTitleCase(e.target.value))}
                      rows={3}
                      placeholder="Tuliskan catatan khusus terkait lingkup pekerjaan fisik renovasi, kriteria khusus kontraktor, atau timeline lapangan..."
                      className="w-full p-3.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#E65F2B] bg-slate-50/40 focus:bg-white transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PEMILIHAN PESERTA REKANAN (EXECUTIVE UNIFIED INTERACTION) */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Executive Status & Guidance Card (Combined to eliminate stacked box clutter) */}
              <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm md:text-base font-bold text-slate-900">
                      Pemilihan Calon Rekanan Peserta Tender
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pilih rekanan dari dropdown di bawah. Data otomatis masuk ke daftar calon peserta usulan.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span
                      className={`text-xs font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 ${selectedKontraktors.length >= 3
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                    >
                      {selectedKontraktors.length >= 3 ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      )}
                      <span>
                        {selectedKontraktors.length} / 3 Kontraktor Terpilih
                        {selectedKontraktors.length >= 3 ? " (Syarat Terpenuhi)" : ` (Kurang ${3 - selectedKontraktors.length})`}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Integrated SOP Guidance */}
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 font-medium ${!isAbove1M
                      ? "bg-blue-50/70 border-blue-200/80 text-blue-900"
                      : "bg-purple-50/70 border-purple-200/80 text-purple-900"
                    }`}
                >
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#E65F2B]" />
                  <div className="leading-relaxed">
                    <p>
                      <strong>Ketentuan Rekanan Tender:</strong> Wajib memilih minimal 3 Rekanan Kontraktor (Golongan <strong>MENENGAH</strong> maupun <strong>BESAR</strong>) yang mencakup cabang proyek. Setelah rekanan dipilih, klik <strong>"Simpan Draf Pra-kualifikasi"</strong> untuk menyimpan berkas resmi.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION: DAFTAR KARTU INFORMASI LENGKAP PESERTA TERPILIH */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span>Daftar Calon Rekanan Terpilih ({pesertaList.length} Perusahaan)</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Informasi profil lengkap rekanan
                  </span>
                </div>

                {pesertaList.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center flex flex-col items-center justify-center bg-white shadow-xs">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3.5">
                      <Users className="w-7 h-7" />
                    </div>
                    <h5 className="text-sm font-bold text-slate-700">
                      Belum Ada Calon Rekanan yang Ditambahkan
                    </h5>
                    <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
                      Pilih kontraktor dari form pencarian di bawah. Minimal 3 kontraktor wajib ditambahkan untuk memenuhi syarat tender.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pesertaList.map((p, index) => {
                      const vendor = p.vendor;
                      const isKontraktor = p.peran === "MAIN_KONTRAKTOR";
                      const isBesar = vendor.golongan === "BESAR";
                      const sbuList = parseArrayData(vendor.sertifikat);
                      const isoList = parseArrayData(vendor.sertifikasi_iso);
                      const expList = parseArrayData(vendor.pengalaman);
                      const pic = vendor.pic_user || (vendor.pic_users && vendor.pic_users[0]);

                      return (
                        <div
                          key={vendor.id}
                          className="p-5 md:p-6 rounded-2xl border border-slate-200/90 bg-white space-y-4 shadow-xs hover:border-slate-300 transition-all animate-in fade-in duration-150"
                        >
                          {/* Header Kartu Peserta */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                            <div className="flex items-start space-x-3.5">
                              <div
                                className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 mt-0.5 ${isKontraktor
                                    ? "bg-orange-50 text-[#E65F2B] border border-orange-100"
                                    : "bg-blue-50 text-blue-600 border border-blue-100"
                                  }`}
                              >
                                {isKontraktor ? (
                                  <Building2 className="w-5 h-5" />
                                ) : (
                                  <HardHat className="w-5 h-5" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                                    #{index + 1}
                                  </span>
                                  <h4 className="text-sm md:text-base font-extrabold text-slate-900 leading-tight">
                                    {vendor.nama_perusahaan}
                                  </h4>
                                  <span
                                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${isBesar
                                        ? "bg-purple-100 text-purple-700 border border-purple-200"
                                        : "bg-blue-100 text-blue-700 border border-blue-200"
                                      }`}
                                  >
                                    GOLONGAN {vendor.golongan}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                                    {p.peran}
                                  </span>
                                </div>

                                <p className="text-xs text-slate-500 mt-1 flex items-center space-x-2 flex-wrap">
                                  <span>Cabang Domisili: <strong className="text-slate-700">{vendor.cabang}</strong></span>
                                  {vendor.coverage_cabang && (
                                    <span>&bull; Coverage: <strong className="text-slate-700">{vendor.coverage_cabang}</strong></span>
                                  )}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveVendor(vendor.id)}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0 border border-transparent hover:border-rose-100 self-end sm:self-auto"
                              title="Hapus dari daftar usulan"
                            >
                              <Trash2 className="w-4 h-4 text-rose-500" />
                              <span>Hapus</span>
                            </button>
                          </div>

                          {/* Grid Informasi Lengkap Peserta */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                            {/* Kontak Perusahaan */}
                            <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-1.5">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-slate-400" /> Kontak Perusahaan
                              </span>
                              <p className="font-semibold text-slate-800 text-xs">{vendor.nomor_telepon || "-"}</p>
                              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{vendor.email || "-"}</span>
                              </p>
                            </div>

                            {/* Alamat Kantor */}
                            <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-1.5">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 text-slate-400" /> Alamat Kantor
                              </span>
                              <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">
                                {vendor.alamat || "Alamat kantor belum tercatat di master vendor"}
                              </p>
                            </div>

                            {/* PIC Akun SPARTA */}
                            <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-1.5">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <User className="w-3 h-3 text-slate-400" /> Akun PIC Kontraktor
                                </span>
                                {pic && (
                                  <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                                    Aktif
                                  </span>
                                )}
                              </span>
                              {pic ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-slate-900 text-xs">{pic.nama}</p>
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 uppercase">
                                      {pic.role}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{pic.email}</span>
                                  </p>
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400 italic">Belum ada akun PIC terhubung di dc_users</p>
                              )}
                            </div>
                          </div>

                          {/* Baris Kualifikasi: SBU, ISO & Pengalaman Kerja */}
                          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2.5 items-center text-xs">
                            {/* SBU Badges */}
                            {sbuList.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">SBU:</span>
                                {sbuList.map((s, i) => (
                                  <span key={i} className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                                    <Award className="w-3 h-3 text-amber-600" />
                                    {s}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* ISO Badges */}
                            {isoList.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">ISO:</span>
                                {isoList.map((iso, i) => (
                                  <span key={i} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                    {iso}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Pengalaman */}
                            {expList.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Pengalaman:</span>
                                {expList.slice(0, 3).map((exp, i) => (
                                  <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-medium flex items-center gap-1">
                                    <Briefcase className="w-3 h-3 text-slate-400" />
                                    {exp}
                                  </span>
                                ))}
                              </div>
                            )}

                            {sbuList.length === 0 && isoList.length === 0 && expList.length === 0 && (
                              <span className="text-[11px] text-slate-400 italic">
                                Profil dasar terverifikasi. Tidak ada lampiran sertifikat tambahan.
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION: PENCARIAN ATAU TOMBOL TAMBAH KONTRAKTOR (DI LIST PALING BAWAH) */}
              {showSearchKontraktor || selectedKontraktors.length === 0 ? (
                <div className="p-5 md:p-6 rounded-2xl border border-orange-200/90 bg-orange-50/20 space-y-3 shadow-2xs animate-in fade-in duration-150">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-[#E65F2B]" />
                      <span>Cari &amp; Tambah Rekanan Kontraktor <span className="text-rose-500">*</span></span>
                    </label>
                    <div className="flex items-center gap-2">
                      {targetProjectCabang && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-orange-100 text-[#E65F2B] border border-orange-200">
                          Coverage: {targetProjectCabang} ({availableKontraktors.length} Rekanan)
                        </span>
                      )}
                      {selectedKontraktors.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowSearchKontraktor(false)}
                          className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2.5 py-1 rounded hover:bg-white transition-colors cursor-pointer"
                        >
                          Tutup Pencarian
                        </button>
                      )}
                    </div>
                  </div>

                  {targetProjectCabang && availableKontraktors.length === 0 ? (
                    <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/80 text-rose-800 text-xs flex items-start gap-2.5 font-medium">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>
                        Tidak ditemukan rekanan Kontraktor yang memiliki cakupan (coverage) di <strong>Cabang {targetProjectCabang}</strong>. Silakan periksa atau daftarkan cakupan cabang rekanan di Master Vendor terlebih dahulu.
                      </span>
                    </div>
                  ) : (
                    <SearchableSelectInput
                      value=""
                      onChange={handleSelectAndAddKontraktor}
                      options={availableKontraktorOptions}
                      placeholder={
                        availableKontraktorOptions.length === 0
                          ? "Semua kontraktor yang memenuhi syarat telah ditambahkan"
                          : `Ketik nama rekanan kontraktor untuk Cabang ${targetProjectCabang}, lalu klik atau tekan Enter...`
                      }
                    />
                  )}
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E65F2B]"></span>
                    Ketik nama rekanan lalu klik pilihan atau tekan <strong>Enter</strong>: data otomatis ditambahkan ke daftar calon rekanan di atas.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSearchKontraktor(true)}
                  className="w-full py-4 px-5 rounded-2xl border-2 border-dashed border-orange-200/80 hover:border-[#E65F2B] bg-orange-50/20 hover:bg-orange-50/40 text-[#E65F2B] text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer group shadow-2xs"
                >
                  <div className="w-6 h-6 rounded-lg bg-white border border-orange-200 group-hover:border-[#E65F2B] group-hover:bg-[#E65F2B] group-hover:text-white flex items-center justify-center transition-colors shadow-2xs">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                  <span>+ Tambah Calon Rekanan Kontraktor Lainnya</span>
                </button>
              )}

              {/* SECTION: PENCARIAN ATAU TOMBOL TAMBAH KONSULTAN (JIKA DIBUTUHKAN) */}
              {butuhKonsultan && (
                <>
                  {showSearchKonsultan || selectedKonsultans.length === 0 ? (
                    <div className="p-5 md:p-6 rounded-2xl border border-blue-200/90 bg-blue-50/20 space-y-3 shadow-2xs animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                          <HardHat className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>
                            Cari &amp; Tambah {TIPE_KONSULTAN_OPTIONS.find((opt) => opt.value === tipeKonsultan)?.label || "Rekanan Konsultan"} <span className="text-rose-500">*</span>
                          </span>
                        </label>
                        {selectedKonsultans.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowSearchKonsultan(false)}
                            className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2.5 py-1 rounded hover:bg-white transition-colors cursor-pointer"
                          >
                            Tutup Pencarian
                          </button>
                        )}
                      </div>

                      <SearchableSelectInput
                        value=""
                        onChange={handleSelectAndAddKonsultan}
                        options={availableKonsultanOptions}
                        placeholder={
                          availableKonsultanOptions.length === 0
                            ? "Semua konsultan telah ditambahkan"
                            : "Ketik nama konsultan pelaksana, lalu klik atau tekan Enter..."
                        }
                      />
                      <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                        Ketik nama konsultan lalu klik atau tekan <strong>Enter</strong> untuk memasukkan konsultan ke daftar usulan di atas.
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowSearchKonsultan(true)}
                      className="w-full py-4 px-5 rounded-2xl border-2 border-dashed border-blue-200/80 hover:border-blue-500 bg-blue-50/20 hover:bg-blue-50/40 text-blue-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer group shadow-2xs"
                    >
                      <div className="w-6 h-6 rounded-lg bg-white border border-blue-200 group-hover:border-blue-500 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-colors shadow-2xs">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                      <span>+ Tambah Calon Rekanan Konsultan Lainnya</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions Sticky */}
        <div className="flex items-center justify-between px-6 md:px-8 py-4 border-t border-slate-100 bg-white sticky bottom-0 z-20 shrink-0">
          <div>
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevStep}
                disabled={submitting}
                className="h-10 px-4 rounded-xl text-xs font-semibold cursor-pointer border-slate-200 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span>Sebelumnya</span>
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="h-10 px-4 rounded-xl text-xs font-semibold cursor-pointer border-slate-200 hover:bg-slate-50"
            >
              Batal
            </Button>

            {/* TAHAP 1: Tombol Lanjut ke Tahap 2 */}
            {currentStep === 1 && (
              <Button
                type="button"
                disabled={!selectedPfr || Boolean(selectedPfr?.has_active_tender)}
                onClick={handleNextStep}
                className="h-10 px-6 rounded-xl bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs font-bold shadow-md shadow-[#E65F2B]/20 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Lanjut: Pilih Peserta</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}

            {/* TAHAP 2: HANYA ADA TOMBOL SIMPAN (TIDAK ADA TOMBOL LANJUT KE KUALIFIKASI) */}
            {currentStep === 2 && (
              <Button
                type="button"
                onClick={() => handleSaveTender(true)}
                disabled={selectedKontraktors.length < 3 || submitting}
                className="h-10 px-6 rounded-xl bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs font-bold shadow-md shadow-[#E65F2B]/20 flex items-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    <span>Menyimpan Pengajuan...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" />
                    <span>Simpan Draf Pra-kualifikasi</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

