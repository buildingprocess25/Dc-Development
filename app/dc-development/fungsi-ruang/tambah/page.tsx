"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Dashboard from "@/components/dashboard/dashboard";
import {
  Building2,
  User,
  Mail,
  Briefcase,
  Layers,
  MapPin,
  Tag,
  FileText,
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  HardHat,
  ShieldAlert,
  Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/context/SessionContext";
import { canManageFungsiRuang } from "@/lib/permissions";
import { toTitleCase } from "@/lib/utils";
import { getUserCoverageBranches, isBranchAccessible } from "@/lib/branches";
import { SearchableSelectInput } from "@/components/ui/searchable-select";
import { FeedbackModal } from "@/components/ui/feedback-modal";

export default function TambahFungsiRuangPage() {
  const router = useRouter();
  const { user } = useSession();
  const canEdit = useMemo(() => canManageFungsiRuang(user?.role), [user?.role]);

  const [approvedProjects, setApprovedProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Form State
  const [selectedRenovasiId, setSelectedRenovasiId] = useState<string>("");
  const [namaPemohon, setNamaPemohon] = useState("");
  const [emailPemohon, setEmailPemohon] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [divisi, setDivisi] = useState("");
  const [departemen, setDepartemen] = useState("");
  const [jenisPengajuan, setJenisPengajuan] = useState("");
  const [alasanPengajuan, setAlasanPengajuan] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<{
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

  // User Coverage Branch
  const userCoverageBranches = useMemo(() => getUserCoverageBranches(user), [user]);

  // Load Approved Projects
  useEffect(() => {
    const fetchApprovedProjects = async () => {
      try {
        setLoadingProjects(true);
        const res = await fetch("/api/dc-development/fungsi-ruang/approved-projects");
        const json = await res.json();
        if (res.ok && json.status === "success") {
          setApprovedProjects(json.data || []);
        }
      } catch (err) {
        console.error("Gagal mengambil proyek renovasi approved:", err);
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchApprovedProjects();
  }, []);

  // Filter projects based on user's branch coverage
  const accessibleProjects = useMemo(() => {
    if (userCoverageBranches === null) return approvedProjects;
    return approvedProjects.filter((p) => {
      const itemCabang = (p.cabang || p.project?.cabang || "").toUpperCase();
      return isBranchAccessible(itemCabang, userCoverageBranches);
    });
  }, [approvedProjects, userCoverageBranches]);

  // ID proyek renovasi yang terkunci karena memiliki pengajuan fungsi ruang aktif (proses approval atau revisi)
  const lockedRenovasiIds = useMemo(() => {
    return accessibleProjects
      .filter((p) => Boolean(p.active_fungsi_ruang))
      .map((p) => String(p.id));
  }, [accessibleProjects]);

  // Selected Renovasi Detail
  const selectedRenovasi = useMemo(() => {
    if (!selectedRenovasiId) return null;
    return accessibleProjects.find((p) => String(p.id) === String(selectedRenovasiId)) || null;
  }, [selectedRenovasiId, accessibleProjects]);

  // Cek apakah proyek terpilih terkunci
  const isProjectLocked = useMemo(() => {
    return Boolean(selectedRenovasi?.active_fungsi_ruang);
  }, [selectedRenovasi]);

  // Options for ComboBox Proyek Renovasi (dilengkapi indikator lock gembok)
  const projectOptions = useMemo(() => {
    return accessibleProjects.map((p) => {
      const isLocked = Boolean(p.active_fungsi_ruang);
      const statusTag = isLocked
        ? ` — [🔒 TERKUNCI: ${p.active_fungsi_ruang?.status}]`
        : "";

      return {
        value: String(p.id),
        label: `[${p.nomor_pengajuan}] ${p.project?.nama_proyek} (${p.project?.tipe || "DC"}) - Cabang: ${p.cabang}${statusTag}`,
      };
    });
  }, [accessibleProjects]);

  // Options for ComboBox Jenis Pengajuan
  const jenisPengajuanOptions = useMemo(
    () => [
      { value: "Perubahan Fungsi Ruang", label: "Perubahan Fungsi Ruang" },
      { value: "Pengurangan Fungsi Ruang", label: "Pengurangan Fungsi Ruang" },
      { value: "Penambahan Fungsi Ruang", label: "Penambahan Fungsi Ruang" },
      { value: "Perubahan & Penambahan Fungsi Ruang", label: "Perubahan & Penambahan Fungsi Ruang" },
    ],
    []
  );

  // Handler Auto-format Title Case & Email Lowercase on Blur
  const handleNamaBlur = () => {
    if (namaPemohon) setNamaPemohon(toTitleCase(namaPemohon));
  };

  const handleEmailBlur = () => {
    if (emailPemohon) setEmailPemohon(emailPemohon.trim().toLowerCase());
  };

  const handleJabatanBlur = () => {
    if (jabatan) setJabatan(toTitleCase(jabatan));
  };

  const handleDivisiBlur = () => {
    if (divisi) setDivisi(toTitleCase(divisi));
  };

  const handleDepartemenBlur = () => {
    if (departemen) setDepartemen(toTitleCase(departemen));
  };

  const handleAlasanBlur = () => {
    if (alasanPengajuan) setAlasanPengajuan(toTitleCase(alasanPengajuan));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedRenovasiId) {
      setErrorMsg("Silakan pilih proyek renovasi yang sudah disetujui (Approved).");
      return;
    }

    if (isProjectLocked && selectedRenovasi?.active_fungsi_ruang) {
      setErrorMsg(
        `Proyek ini sedang terkunci karena memiliki pengajuan fungsi ruang aktif (${selectedRenovasi.active_fungsi_ruang.nomor_pengajuan}) dengan status "${selectedRenovasi.active_fungsi_ruang.status}". Pengajuan baru tidak dapat dibuat hingga proses sebelumnya selesai.`
      );
      return;
    }

    if (!namaPemohon.trim() || !emailPemohon.trim() || !jabatan.trim() || !divisi.trim() || !departemen.trim()) {
      setErrorMsg("Seluruh data identitas pemohon wajib diisi.");
      return;
    }

    if (!jenisPengajuan) {
      setErrorMsg("Jenis pengajuan fungsi ruang wajib dipilih.");
      return;
    }

    if (!alasanPengajuan.trim()) {
      setErrorMsg("Alasan pengajuan perubahan fungsi ruang wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        renovasi_id: parseInt(selectedRenovasiId, 10),
        nama_pemohon: toTitleCase(namaPemohon),
        email_pemohon: emailPemohon.trim().toLowerCase(),
        jabatan: toTitleCase(jabatan),
        divisi: toTitleCase(divisi),
        departemen: toTitleCase(departemen),
        jenis_pengajuan: jenisPengajuan,
        alasan_pengajuan: toTitleCase(alasanPengajuan),
      };

      const res = await fetch("/api/dc-development/fungsi-ruang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Gagal menyimpan pengajuan");
      }

      const noPengajuan = json.data?.nomor_pengajuan || "";
      setFeedbackModal({
        open: true,
        type: "success",
        title: "Pengajuan Berhasil Dikirim",
        message: `Pengajuan ${noPengajuan} berhasil disimpan dan masuk ke alur persetujuan Branch Manager / DBM.`,
      });
    } catch (err: any) {
      setErrorMsg(err.message);
      setFeedbackModal({
        open: true,
        type: "error",
        title: "Gagal Mengirim Pengajuan",
        message: err.message || "Terjadi kesalahan saat memproses pengajuan.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canEdit) {
    return (
      <Dashboard title="Perubahan Fungsi Ruang">
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Akses Pembuatan Pengajuan Dibatasi</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
            Formulir ini hanya dapat diisi oleh <strong>Branch Building & Maintenance Manager</strong> atau <strong>Administrator</strong>.
          </p>
          <Link href="/dc-development/fungsi-ruang" className="mt-5">
            <Button variant="outline" className="rounded-xl text-xs h-9">
              Kembali ke Daftar Pengajuan
            </Button>
          </Link>
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard title="Perubahan Fungsi Ruang">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)]">
        {/* Navigation & SOP Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <Link
            href="/dc-development/fungsi-ruang"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#E65F2B] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Daftar Pengajuan</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-orange-100 text-[#E65F2B]">
              SAT/FRM/DCB/010_Rev_000_200323
            </span>
            <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
              Reff NRA: SAT/SOP/DCB/008
            </span>
          </div>
        </div>

        {/* Main Form Container */}
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto w-full space-y-6">
          {/* Header Title Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#E65F2B] flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-tight">
                  Form Pengajuan Perubahan, Pengurangan, dan/atau Penambahan Fungsi Ruang
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Depo / Bulky / Warehouse / Office Branch Existing &bull; PT Sumber Alfaria Trijaya Tbk
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Section 1: Pemilihan Proyek Renovasi (Approved Only) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building2 className="w-4 h-4 text-[#E65F2B]" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                1. Proyek Renovasi Terkait (Approved)
              </h2>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                Pilih Proyek Renovasi Penawaran RAB/OE <span className="text-rose-500">*</span>
              </label>
              <SearchableSelectInput
                value={selectedRenovasiId}
                onChange={(val) => setSelectedRenovasiId(val)}
                options={projectOptions}
                disabledIds={lockedRenovasiIds}
                placeholder="Cari nomor pengajuan, nama DC, cabang, tipe..."
              />
              {accessibleProjects.length === 0 && !loadingProjects && (
                <p className="text-[11px] text-amber-600 mt-1.5 font-medium">
                  Belum ada pengajuan Penawaran RAB/OE yang berstatus APPROVED pada coverage cabang Anda.
                </p>
              )}
            </div>

            {/* Banner Peringatan: Proyek Sedang Memiliki Pengajuan Fungsi Ruang Berjalan */}
            {isProjectLocked && selectedRenovasi?.active_fungsi_ruang && (
              <div className="bg-amber-50/80 border border-amber-300 rounded-2xl p-4.5 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300 shadow-xs">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                        Pengajuan Fungsi Ruang Terkunci
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300/80 uppercase">
                        {selectedRenovasi.active_fungsi_ruang.status}
                      </span>
                      <span className="text-[11px] font-mono font-medium text-slate-600 bg-white/80 px-2 py-0.5 rounded border border-amber-200">
                        {selectedRenovasi.active_fungsi_ruang.nomor_pengajuan}
                      </span>
                    </div>
                    <p className="text-xs text-amber-900/90 leading-relaxed">
                      Proyek DC ini saat ini sedang memiliki pengajuan fungsi ruang aktif yang sedang dalam proses approval atau revisi. Pengajuan fungsi ruang baru tidak dapat dibuat untuk proyek ini hingga proses pengajuan sebelumnya selesai.
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-amber-800/80">
                      <span>Pemohon: <b>{selectedRenovasi.active_fungsi_ruang.nama_pemohon || selectedRenovasi.active_fungsi_ruang.created_by}</b></span>
                      <span>&bull;</span>
                      <span>
                        Diajukan: {new Date(selectedRenovasi.active_fungsi_ruang.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3 Field Terisi Otomatis dari Proyek yang Dipilih */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
              {/* 1. Projek (Terisi Otomatis) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Projek
                  </label>
                  {selectedRenovasi?.project?.nama_proyek ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Terisi Otomatis
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium italic">
                      Otomatis
                    </span>
                  )}
                </div>
                <Input
                  readOnly
                  value={selectedRenovasi?.project?.nama_proyek || ""}
                  placeholder="Terisi otomatis saat proyek dipilih..."
                  className={`border-slate-200 text-xs font-bold h-10 rounded-xl cursor-default focus-visible:ring-0 ${
                    selectedRenovasi?.project?.nama_proyek
                      ? "bg-emerald-50/40 text-slate-800 border-emerald-200"
                      : "bg-slate-50 text-slate-400"
                  }`}
                />
              </div>

              {/* 2. Tipe (Terisi Otomatis) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Tipe Bangunan
                  </label>
                  {selectedRenovasi?.project?.tipe ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Terisi Otomatis
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium italic">
                      Otomatis
                    </span>
                  )}
                </div>
                <Input
                  readOnly
                  value={selectedRenovasi?.project?.tipe || ""}
                  placeholder="Terisi otomatis saat proyek dipilih..."
                  className={`border-slate-200 text-xs font-bold h-10 rounded-xl cursor-default focus-visible:ring-0 ${
                    selectedRenovasi?.project?.tipe
                      ? "bg-emerald-50/40 text-slate-800 border-emerald-200"
                      : "bg-slate-50 text-slate-400"
                  }`}
                />
              </div>

              {/* 3. Lokasi (Terisi Otomatis) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Lokasi Cabang
                  </label>
                  {selectedRenovasi?.cabang ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Terisi Otomatis
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium italic">
                      Otomatis
                    </span>
                  )}
                </div>
                <Input
                  readOnly
                  value={selectedRenovasi?.cabang || ""}
                  placeholder="Terisi otomatis saat proyek dipilih..."
                  className={`border-slate-200 text-xs font-bold h-10 rounded-xl cursor-default focus-visible:ring-0 ${
                    selectedRenovasi?.cabang
                      ? "bg-emerald-50/40 text-slate-800 border-emerald-200"
                      : "bg-slate-50 text-slate-400"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Identitas Pemohon */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#E65F2B]" />
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  2. Identitas Pemohon
                </h2>
              </div>
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    if (user.namaLengkap) setNamaPemohon(toTitleCase(user.namaLengkap));
                    if (user.email) setEmailPemohon(user.email.toLowerCase());
                    if (user.role) setJabatan(toTitleCase(user.role));
                  }}
                  className="text-[11px] font-semibold text-[#E65F2B] hover:text-[#d04f1f] hover:underline cursor-pointer"
                >
                  Gunakan Data Profil Saya
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nama Pemohon */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                  Nama Pemohon <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="Contoh: Budi Santoso"
                  value={namaPemohon}
                  onChange={(e) => setNamaPemohon(e.target.value)}
                  onBlur={handleNamaBlur}
                  disabled={isSubmitting}
                  className="h-10 text-xs rounded-xl border-slate-200 focus-visible:ring-[#E65F2B]"
                />
              </div>

              {/* Email Pemohon */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                  Email Pemohon <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="email"
                  placeholder="Contoh: budi.santoso@sat.co.id"
                  value={emailPemohon}
                  onChange={(e) => setEmailPemohon(e.target.value.toLowerCase())}
                  onBlur={handleEmailBlur}
                  disabled={isSubmitting}
                  className="h-10 text-xs rounded-xl border-slate-200 focus-visible:ring-[#E65F2B] font-mono lowercase"
                />
              </div>

              {/* Jabatan */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                  Jabatan <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="Contoh: Warehouse Coordinator"
                  value={jabatan}
                  onChange={(e) => setJabatan(e.target.value)}
                  onBlur={handleJabatanBlur}
                  disabled={isSubmitting}
                  className="h-10 text-xs rounded-xl border-slate-200 focus-visible:ring-[#E65F2B]"
                />
              </div>

              {/* Divisi */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                  Divisi <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="Contoh: Operation Division"
                  value={divisi}
                  onChange={(e) => setDivisi(e.target.value)}
                  onBlur={handleDivisiBlur}
                  disabled={isSubmitting}
                  className="h-10 text-xs rounded-xl border-slate-200 focus-visible:ring-[#E65F2B]"
                />
              </div>

              {/* Departemen */}
              <div className="md:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                  Departemen <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="Contoh: Distribution Center Department"
                  value={departemen}
                  onChange={(e) => setDepartemen(e.target.value)}
                  onBlur={handleDepartemenBlur}
                  disabled={isSubmitting}
                  className="h-10 text-xs rounded-xl border-slate-200 focus-visible:ring-[#E65F2B]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Jenis & Alasan Pengajuan */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Tag className="w-4 h-4 text-[#E65F2B]" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                3. Rincian Pengajuan Fungsi Ruang
              </h2>
            </div>

            <div className="space-y-4">
              {/* Jenis Pengajuan (ComboBox) */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                  Jenis Pengajuan <span className="text-rose-500">*</span>
                </label>
                <SearchableSelectInput
                  value={jenisPengajuan}
                  onChange={(val) => setJenisPengajuan(val)}
                  options={jenisPengajuanOptions}
                  placeholder="Pilih jenis pengajuan fungsi ruang..."
                />
              </div>

              {/* Alasan Pengajuan */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                  Alasan Pengajuan <span className="text-rose-500">*</span>
                </label>
                <Textarea
                  placeholder="Jelaskan kebutuhan perubahan, pengurangan, atau penambahan fungsi ruang secara detail..."
                  rows={4}
                  value={alasanPengajuan}
                  onChange={(e) => setAlasanPengajuan(e.target.value)}
                  onBlur={handleAlasanBlur}
                  disabled={isSubmitting}
                  className="text-xs rounded-xl border-slate-200 focus-visible:ring-[#E65F2B] leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/dc-development/fungsi-ruang">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-xs h-10 px-5 font-semibold"
                disabled={isSubmitting}
              >
                Batal
              </Button>
            </Link>

            <Button
              type="submit"
              className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs h-10 px-6 rounded-xl shadow-md shadow-[#E65F2B]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || isProjectLocked}
            >
              {isProjectLocked ? (
                <Lock className="w-4 h-4 mr-1.5" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              {isSubmitting ? "Menyimpan..." : isProjectLocked ? "Proyek Terkunci" : "Kirim Pengajuan"}
            </Button>
          </div>
        </form>
      </div>

      <FeedbackModal
        open={feedbackModal.open}
        type={feedbackModal.type}
        title={feedbackModal.title}
        message={feedbackModal.message}
        onClose={() => {
          if (feedbackModal.type === "success") {
            router.push("/dc-development/fungsi-ruang");
          } else {
            setFeedbackModal((prev) => ({ ...prev, open: false }));
          }
        }}
      />
    </Dashboard>
  );
}
