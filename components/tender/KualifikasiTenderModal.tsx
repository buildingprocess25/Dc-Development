"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ClipboardCheck,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Send,
  Save,
  HardHat,
  Users,
  Clock,
  Info,
  Award,
  ShieldCheck,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  User,
  Plus,
  Trash2,
  Layers,
  FileSignature,
  FileText,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { formatRupiah, toTitleCase, cn } from "@/lib/utils";
import { isApprovalAdmin } from "@/lib/permissions";
import { useSession } from "@/context/SessionContext";
import { SearchableSelectInput } from "@/components/ui/searchable-select";
import { isVendorCoveringBranch } from "@/lib/branches";

function formatIndoDateTime(dateStr: any): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatIndoDate(dateStr: any): string {
  if (!dateStr) return "-";
  try {
    const raw = String(dateStr).split("T")[0];
    const parts = raw.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

interface KualifikasiTenderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tender: any | null;
  onSuccess: (updatedTender: any, customFeedback?: { title: string; message: string }) => void;
  onError: (errorMessage: string) => void;
}

export interface ScheduleItem {
  id?: number;
  kategori_jadwal: string;
  nama_kegiatan: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  keterangan?: string;
  urutan?: number;
}

interface ScheduleSubCategory {
  key: string;
  parentStage: "TENDER" | "KONSTRUKSI";
  parentTitle: string;
  parentSubtitle: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  accentBorder: string;
  icon: any;
  isVisible: boolean;
}

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
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return data ? [data] : [];
    }
  }
  return [];
}

export default function KualifikasiTenderModal({
  open,
  onOpenChange,
  tender,
  onSuccess,
  onError,
}: KualifikasiTenderModalProps) {
  const { user } = useSession();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  // Detail data lengkap dari API & Master Vendor
  const [tenderDetail, setTenderDetail] = useState<any | null>(null);
  const [availableVendors, setAvailableVendors] = useState<any[]>([]);

  // State Step 1: Evaluasi Kualifikasi Peserta
  const [evaluasiPeserta, setEvaluasiPeserta] = useState<any[]>([]);

  // State Penambahan Rekanan Baru di Langkah 1
  const [newRekananType, setNewRekananType] = useState<"KONTRAKTOR" | "KONSULTAN">("KONTRAKTOR");
  const [newKontraktorId, setNewKontraktorId] = useState("");
  const [newKonsultanId, setNewKonsultanId] = useState("");
  const [newKonsultanPeran, setNewKonsultanPeran] = useState("KONSULTAN_PENGAWAS");

  // State Step 2: Jadwal Pelaksanaan (Schedule)
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [catatanEvaluasi, setCatatanEvaluasi] = useState("");

  // Feedback Modal Lokal untuk Validasi Interaktif (Bebas dari Error Update Parent)
  const [localFeedback, setLocalFeedback] = useState<{
    open: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({
    open: false,
    type: "error",
    title: "",
    message: "",
  });

  // Snapshot Data Awal untuk Validasi Wajib Minimal 1 Perubahan saat Revisi
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");

  const activeTender = tenderDetail || tender;
  const isRevisi = activeTender?.status === "REVISI";

  const latestRevisiLog = useMemo(() => {
    const logs = activeTender?.audit_logs || tender?.audit_logs || [];
    return logs.find((l: any) => l.action === "REVISI" || l.to_status === "REVISI") || null;
  }, [activeTender, tender]);

  const projectCabang =
    activeTender?.cabang ||
    activeTender?.project?.cabang ||
    tender?.cabang ||
    tender?.project?.cabang ||
    "";

  // Filter vendor yang belum dipilih dan mencakup cabang proyek
  const existingVendorIds = useMemo(() => {
    return new Set(
      evaluasiPeserta.map((p) => Number(p.vendor_id || p.vendor?.id)).filter(Boolean)
    );
  }, [evaluasiPeserta]);

  const kontraktorOptions = useMemo(() => {
    return availableVendors
      .filter((v) => (v.tipe_vendor || v.jenis || "KONTRAKTOR").toUpperCase() === "KONTRAKTOR")
      .filter((v) => isVendorCoveringBranch(v.cabang, v.coverage_cabang, projectCabang))
      .filter((v) => !existingVendorIds.has(v.id))
      .map((v) => ({
        value: String(v.id),
        label: `${v.nama_perusahaan} (Gol: ${v.golongan || "-"} • Coverage: ${v.coverage_cabang || v.cabang || "-"})`,
      }));
  }, [availableVendors, existingVendorIds, projectCabang]);

  const konsultanOptions = useMemo(() => {
    return availableVendors
      .filter((v) => (v.tipe_vendor || v.jenis || "").toUpperCase().includes("KONSULTAN"))
      .filter((v) => isVendorCoveringBranch(v.cabang, v.coverage_cabang, projectCabang))
      .filter((v) => !existingVendorIds.has(v.id))
      .map((v) => ({
        value: String(v.id),
        label: `${v.nama_perusahaan} (${v.spesialisasi || v.jenis || "Konsultan"} • Coverage: ${v.coverage_cabang || v.cabang || "-"})`,
      }));
  }, [availableVendors, existingVendorIds, projectCabang]);

  // Snapshot Generator & Dirty Checker
  const createDataSnapshot = (catatan: string, peserta: any[], sch: any[]) => {
    return JSON.stringify({
      catatan: (catatan || "").trim(),
      peserta: (peserta || []).map((p: any) => ({
        id: Number(p.vendor_id || p.vendor?.id),
        peran: p.peran,
        status: p.status_tahap === "TIDAK_LOLOS" ? "TIDAK_LOLOS" : "LOLOS_KUALIFIKASI",
        alasan: (p.alasan_tidak_lolos || "").trim(),
      })).sort((a: any, b: any) => a.id - b.id),
      schedule: (sch || []).map((s: any) => ({
        kategori: s.kategori_jadwal || "TENDER_MAIN_KONTRAKTOR",
        nama: (s.nama_kegiatan || "").trim().toLowerCase(),
        mulai: s.tanggal_mulai ? s.tanggal_mulai.split("T")[0] : "",
        selesai: s.tanggal_selesai ? s.tanggal_selesai.split("T")[0] : "",
        ket: (s.keterangan || "").trim().toLowerCase(),
      })).sort((a: any, b: any) => (a.nama + a.mulai).localeCompare(b.nama + b.mulai)),
    });
  };

  const isDataChanged = useMemo(() => {
    if (!isRevisi) return true;
    if (!initialSnapshot) return false;
    const current = createDataSnapshot(catatanEvaluasi, evaluasiPeserta, schedules);
    return current !== initialSnapshot;
  }, [isRevisi, initialSnapshot, catatanEvaluasi, evaluasiPeserta, schedules]);

  // Handlers Tambah & Hapus Rekanan Peserta
  const handleAddKontraktor = () => {
    if (!newKontraktorId) return;
    const vendorObj = availableVendors.find((v) => String(v.id) === String(newKontraktorId));
    if (!vendorObj) return;

    setEvaluasiPeserta((prev) => [
      ...prev,
      {
        vendor_id: vendorObj.id,
        vendor: vendorObj,
        peran: "MAIN_KONTRAKTOR",
        status_tahap: "LOLOS_KUALIFIKASI",
        alasan_tidak_lolos: "",
      },
    ]);
    setNewKontraktorId("");
  };

  const handleAddKonsultan = () => {
    if (!newKonsultanId) return;
    const vendorObj = availableVendors.find((v) => String(v.id) === String(newKonsultanId));
    if (!vendorObj) return;

    setEvaluasiPeserta((prev) => [
      ...prev,
      {
        vendor_id: vendorObj.id,
        vendor: vendorObj,
        peran: newKonsultanPeran || "KONSULTAN_PENGAWAS",
        status_tahap: "LOLOS_KUALIFIKASI",
        alasan_tidak_lolos: "",
      },
    ]);
    setNewKonsultanId("");
  };

  const handleRemovePeserta = (vendorId: number) => {
    setEvaluasiPeserta((prev) =>
      prev.filter((p) => Number(p.vendor_id || p.vendor?.id) !== vendorId)
    );
  };

  const isAbove1M = useMemo(() => {
    if (!activeTender) return false;
    return activeTender.kategori_nilai === "DI_ATAS_1M" || Number(activeTender.nilai_proyek) > 1_000_000_000;
  }, [activeTender]);

  // Deteksi dinamis kebutuhan konsultan (Pengawas & Perencana)
  const hasKonsultanPengawas = useMemo(() => {
    if (!activeTender) return false;
    const byType =
      activeTender.butuh_konsultan &&
      (activeTender.tipe_konsultan === "PENGAWAS" ||
        activeTender.tipe_konsultan === "PENGAWAS_DAN_PERENCANA" ||
        (activeTender.tipe_konsultan || "").includes("PENGAWAS"));
    const byPeserta = evaluasiPeserta.some((p: any) =>
      (p.peran || "").toUpperCase().includes("PENGAWAS")
    );
    return Boolean(byType || byPeserta);
  }, [activeTender, evaluasiPeserta]);

  const hasKonsultanPerencana = useMemo(() => {
    if (!activeTender) return false;
    const byType =
      activeTender.butuh_konsultan &&
      (activeTender.tipe_konsultan === "PERENCANA" ||
        activeTender.tipe_konsultan === "PENGAWAS_DAN_PERENCANA" ||
        (activeTender.tipe_konsultan || "").includes("PERENCANA"));
    const byPeserta = evaluasiPeserta.some((p: any) =>
      (p.peran || "").toUpperCase().includes("PERENCANA")
    );
    return Boolean(byType || byPeserta);
  }, [activeTender, evaluasiPeserta]);

  // Definisi Sub-kategori Terstruktur (Tahap Tender & Tahap Konstruksi)
  const scheduleSubCategories: ScheduleSubCategory[] = useMemo(() => {
    return [
      // Kategori 1: Tahap Tender
      {
        key: "TENDER_MAIN_KONTRAKTOR",
        parentStage: "TENDER",
        parentTitle: "Tahap 1: Pelaksanaan Tender",
        parentSubtitle: "Rangkaian Aanwijzing, Penawaran Harga, Negosiasi & Penerbitan SPK",
        title: "Tender Kontraktor",
        subtitle: "Pengadaan Kontraktor Pelaksana Fisik Proyek",
        badge: "Wajib",
        badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
        accentBorder: "border-blue-200",
        icon: Building2,
        isVisible: true,
      },
      {
        key: "TENDER_KONSULTAN_PENGAWAS",
        parentStage: "TENDER",
        parentTitle: "Tahap 1: Pelaksanaan Tender",
        parentSubtitle: "Rangkaian Aanwijzing, Penawaran Harga, Negosiasi & Penerbitan SPK",
        title: "Tender Konsultan Pengawas (MK)",
        subtitle: "Pengadaan Tim Manajemen Konstruksi / Konsultan Pengawas",
        badge: "Konsultan MK",
        badgeColor: "bg-purple-100 text-purple-700 border-purple-200",
        accentBorder: "border-purple-200",
        icon: Users,
        isVisible: hasKonsultanPengawas,
      },
      {
        key: "TENDER_KONSULTAN_PERENCANA",
        parentStage: "TENDER",
        parentTitle: "Tahap 1: Pelaksanaan Tender",
        parentSubtitle: "Rangkaian Aanwijzing, Penawaran Harga, Negosiasi & Penerbitan SPK",
        title: "Tender Konsultan Perencana",
        subtitle: "Pengadaan Tim Perencana Desain & Gambar Kerja",
        badge: "Konsultan Desain",
        badgeColor: "bg-cyan-100 text-cyan-700 border-cyan-200",
        accentBorder: "border-cyan-200",
        icon: Layers,
        isVisible: hasKonsultanPerencana,
      },

      // Kategori 2: Tahap Konstruksi
      {
        key: "KONSTRUKSI_MAIN_KONTRAKTOR",
        parentStage: "KONSTRUKSI",
        parentTitle: "Tahap 2: Pelaksanaan Konstruksi & Pengawasan",
        parentSubtitle: "Pelaksanaan Pekerjaan Lapangan, Pengawasan Mutu & Serah Terima PHO",
        title: "Pekerjaan Konstruksi Kontraktor",
        subtitle: "Pelaksanaan Konstruksi Fisik Bangunan DC di Lokasi",
        badge: "Konstruksi Fisik",
        badgeColor: "bg-orange-100 text-[#E65F2B] border-orange-200",
        accentBorder: "border-orange-200",
        icon: HardHat,
        isVisible: true,
      },
      {
        key: "KONSTRUKSI_KONSULTAN_PENGAWAS",
        parentStage: "KONSTRUKSI",
        parentTitle: "Tahap 2: Pelaksanaan Konstruksi & Pengawasan",
        parentSubtitle: "Pelaksanaan Pekerjaan Lapangan, Pengawasan Mutu & Serah Terima PHO",
        title: "Pengawasan Fisik Konsultan Pengawas (MK)",
        subtitle: "Supervisi Lapangan, Monitoring Mutu, Volume, dan K3 Berkala",
        badge: "Supervisi MK",
        badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
        accentBorder: "border-emerald-200",
        icon: ShieldCheck,
        isVisible: hasKonsultanPengawas,
      },
      {
        key: "KONSTRUKSI_KONSULTAN_PERENCANA",
        parentStage: "KONSTRUKSI",
        parentTitle: "Tahap 2: Pelaksanaan Konstruksi & Pengawasan",
        parentSubtitle: "Pelaksanaan Pekerjaan Lapangan, Pengawasan Mutu & Serah Terima PHO",
        title: "Supervisi Desain Konsultan Perencana",
        subtitle: "Supervisi Berkala Kesesuaian Desain & Review Gambar As-Built",
        badge: "Supervisi Desain",
        badgeColor: "bg-teal-100 text-teal-700 border-teal-200",
        accentBorder: "border-teal-200",
        icon: FileText,
        isVisible: hasKonsultanPerencana,
      },
    ];
  }, [hasKonsultanPengawas, hasKonsultanPerencana]);

  // Inisialisasi data saat modal dibuka
  useEffect(() => {
    if (open && tender) {
      setCurrentStep(1);
      const initCatatan = tender.catatan_kualifikasi || "";
      setCatatanEvaluasi(initCatatan);

      // Inisialisasi peserta dengan status_tahap (default LOLOS_KUALIFIKASI jika masih PRAKUALIFIKASI)
      const pesertaInit = (tender.peserta || []).map((p: any) => ({
        ...p,
        status_tahap:
          p.status_tahap === "TIDAK_LOLOS"
            ? "TIDAK_LOLOS"
            : "LOLOS_KUALIFIKASI",
        alasan_tidak_lolos: p.alasan_tidak_lolos || "",
      }));
      setEvaluasiPeserta(pesertaInit);

      // Inisialisasi jadwal
      let loadedSchedules: ScheduleItem[] = [];
      if (tender.schedule && tender.schedule.length > 0) {
        loadedSchedules = tender.schedule.map((s: any) => ({
          id: s.id,
          kategori_jadwal: s.kategori_jadwal || "TENDER_MAIN_KONTRAKTOR",
          nama_kegiatan: toTitleCase(s.nama_kegiatan || ""),
          tanggal_mulai: s.tanggal_mulai ? s.tanggal_mulai.split("T")[0] : "",
          tanggal_selesai: s.tanggal_selesai ? s.tanggal_selesai.split("T")[0] : "",
          keterangan: toTitleCase(s.keterangan || ""),
          urutan: s.urutan,
        }));
        setSchedules(loadedSchedules);
      } else {
        setSchedules([]);
      }

      // Snapshot awal dari data yang diberikan props
      setInitialSnapshot(createDataSnapshot(initCatatan, pesertaInit, loadedSchedules));

      // Ambil daftar master vendor aktif untuk opsi penambahan rekanan
      fetch("/api/dc-development/master-vendor")
        .then((res) => res.json())
        .then((json) => {
          if (json.status === "success" && Array.isArray(json.data)) {
            setAvailableVendors(json.data);
          }
        })
        .catch((err) => console.error("Gagal memuat master vendor:", err));

      // Ambil detail terbaru dari API untuk memastikan profil vendor & akun PIC terhubung 100% lengkap
      if (tender.id) {
        fetch(`/api/dc-development/tender/${tender.id}`)
          .then((res) => res.json())
          .then((json) => {
            if (json.status === "success" && json.data) {
              const freshTender = json.data;
              setTenderDetail(freshTender);

              let freshPeserta = pesertaInit;
              if (freshTender.peserta && freshTender.peserta.length > 0) {
                freshPeserta = freshTender.peserta.map((fp: any) => {
                  return {
                    ...fp,
                    status_tahap:
                      fp.status_tahap === "TIDAK_LOLOS" ? "TIDAK_LOLOS" : "LOLOS_KUALIFIKASI",
                    alasan_tidak_lolos: fp.alasan_tidak_lolos || "",
                  };
                });
                setEvaluasiPeserta(freshPeserta);
              }

              let freshSchedules = loadedSchedules;
              if (freshTender.schedule && freshTender.schedule.length > 0) {
                freshSchedules = freshTender.schedule.map((s: any) => ({
                  id: s.id,
                  kategori_jadwal: s.kategori_jadwal || "TENDER_MAIN_KONTRAKTOR",
                  nama_kegiatan: toTitleCase(s.nama_kegiatan || ""),
                  tanggal_mulai: s.tanggal_mulai ? s.tanggal_mulai.split("T")[0] : "",
                  tanggal_selesai: s.tanggal_selesai ? s.tanggal_selesai.split("T")[0] : "",
                  keterangan: toTitleCase(s.keterangan || ""),
                  urutan: s.urutan,
                }));
                setSchedules(freshSchedules);
              }

              const freshCatatan = freshTender.catatan_kualifikasi !== undefined
                ? freshTender.catatan_kualifikasi || ""
                : initCatatan;
              setCatatanEvaluasi(freshCatatan);

              // Update snapshot awal dengan data database terbaru
              setInitialSnapshot(
                createDataSnapshot(freshCatatan, freshPeserta, freshSchedules)
              );
            }
          })
          .catch((err) => console.error("Gagal memuat detail vendor terbaru:", err));
      }
    } else {
      setTenderDetail(null);
      setInitialSnapshot("");
      setNewKontraktorId("");
      setNewKonsultanId("");
    }
  }, [open, tender]);

  // Handler update status kelayakan peserta
  const handleUpdateStatusPeserta = (vendorId: number, statusTahap: string) => {
    setEvaluasiPeserta((prev) =>
      prev.map((item) => {
        const id = item.vendor_id || item.vendor?.id;
        if (id === vendorId) {
          return {
            ...item,
            status_tahap: statusTahap,
            alasan_tidak_lolos: statusTahap === "LOLOS_KUALIFIKASI" ? "" : item.alasan_tidak_lolos,
          };
        }
        return item;
      })
    );
  };

  // Handler update alasan penolakan kualifikasi (dengan Title Case otomatis)
  const handleUpdateAlasanPeserta = (
    vendorId: number,
    alasan: string,
    applyTitleCase: boolean = false
  ) => {
    setEvaluasiPeserta((prev) =>
      prev.map((item) => {
        const id = item.vendor_id || item.vendor?.id;
        if (id === vendorId) {
          const formatted = applyTitleCase ? toTitleCase(alasan) : alasan;
          return { ...item, alasan_tidak_lolos: formatted };
        }
        return item;
      })
    );
  };

  // Handler update baris kegiatan jadwal (dengan Title Case otomatis & validasi tanggal interaktif)
  const handleUpdateScheduleItem = (
    index: number,
    field: "nama_kegiatan" | "tanggal_mulai" | "tanggal_selesai" | "keterangan",
    value: string,
    applyTitleCase: boolean = false,
    inputElement?: HTMLInputElement | null
  ) => {
    const currentItem = schedules[index];

    // Validasi interaktif tanggal saat user klik kalender atau ketik manual
    if (currentItem) {
      if (field === "tanggal_selesai" && value && currentItem.tanggal_mulai) {
        if (value < currentItem.tanggal_mulai) {
          if (inputElement) {
            inputElement.value = currentItem.tanggal_selesai || "";
          }
          setLocalFeedback({
            open: true,
            type: "error",
            title: "Tanggal Selesai Tidak Valid",
            message: `Tanggal selesai (${formatIndoDate(value)}) tidak boleh lebih awal dari tanggal mulai (${formatIndoDate(currentItem.tanggal_mulai)}). Harap tentukan tanggal selesai yang sama atau setelah tanggal mulai.`,
          });
          return;
        }
      }

      if (field === "tanggal_mulai" && value && currentItem.tanggal_selesai) {
        if (value > currentItem.tanggal_selesai) {
          if (inputElement) {
            inputElement.value = currentItem.tanggal_mulai || "";
          }
          setLocalFeedback({
            open: true,
            type: "error",
            title: "Tanggal Mulai Tidak Valid",
            message: `Tanggal mulai (${formatIndoDate(value)}) tidak boleh lebih lambat dari tanggal selesai (${formatIndoDate(currentItem.tanggal_selesai)}). Harap tentukan tanggal mulai yang sama atau sebelum tanggal selesai.`,
          });
          return;
        }
      }
    }

    setSchedules((prev) => {
      const copy = [...prev];
      if (!copy[index]) return prev;
      const formatted =
        applyTitleCase && (field === "nama_kegiatan" || field === "keterangan")
          ? toTitleCase(value)
          : value;

      const item = { ...copy[index] };
      item[field] = formatted;
      copy[index] = item;
      return copy;
    });
  };

  // Tambah item kegiatan bebas baru ke subkategori tertentu
  const handleAddScheduleItem = (kategori_jadwal: string) => {
    setSchedules((prev) => [
      ...prev,
      {
        kategori_jadwal,
        nama_kegiatan: "",
        tanggal_mulai: "",
        tanggal_selesai: "",
        keterangan: "",
      },
    ]);
  };

  // Hapus item kegiatan jadwal
  const handleRemoveScheduleItem = (index: number) => {
    setSchedules((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Validasi Step 1: Kontraktor Lolos minimal 3 & Alasan wajib diisi jika Tidak Lolos
  const kontraktorLolos = useMemo(() => {
    return evaluasiPeserta.filter(
      (p) =>
        (p.peran === "MAIN_KONTRAKTOR" || p.peran === "KONTRAKTOR") &&
        p.status_tahap === "LOLOS_KUALIFIKASI"
    );
  }, [evaluasiPeserta]);

  const hasInvalidAlasan = useMemo(() => {
    return evaluasiPeserta.some(
      (p) => p.status_tahap === "TIDAK_LOLOS" && (!p.alasan_tidak_lolos || !p.alasan_tidak_lolos.trim())
    );
  }, [evaluasiPeserta]);

  const canProceedStep2 = kontraktorLolos.length >= 3 && !hasInvalidAlasan;

  // Submit / Simpan Kualifikasi & Penjadwalan
  const handleSaveKualifikasi = async () => {
    if (!tender) return;

    // 0. Validasi Perubahan saat Mode Revisi
    if (isRevisi && !isDataChanged) {
      setLocalFeedback({
        open: true,
        type: "error",
        title: "Perubahan Belum Dilakukan",
        message: "Harap ubah minimal 1 data (rekanan/jadwal/catatan) sebelum mengajukan ulang revisi.",
      });
      return;
    }

    // 1. Validasi Jadwal: Pastikan setiap baris memiliki nama kegiatan, tanggal mulai & tanggal selesai
    if (schedules.length === 0) {
      setLocalFeedback({
        open: true,
        type: "error",
        title: "Jadwal Pelaksanaan Kosong",
        message: "Silakan input minimal 1 kegiatan jadwal pelaksanaan sebelum menyimpan.",
      });
      return;
    }

    for (let i = 0; i < schedules.length; i++) {
      const s = schedules[i];
      if (!s.nama_kegiatan || !s.nama_kegiatan.trim()) {
        setLocalFeedback({
          open: true,
          type: "error",
          title: "Nama Kegiatan Belum Diisi",
          message: `Nama kegiatan pada baris ke-${i + 1} belum diisi. Harap lengkapi semua nama kegiatan.`,
        });
        return;
      }
      if (!s.tanggal_mulai || !s.tanggal_selesai) {
        setLocalFeedback({
          open: true,
          type: "error",
          title: "Tanggal Belum Lengkap",
          message: `Tanggal pelaksanaan untuk kegiatan "${s.nama_kegiatan || `Baris ke-${i + 1}`}" belum lengkap. Harap isi tanggal mulai dan tanggal selesai.`,
        });
        return;
      }
      if (s.tanggal_selesai < s.tanggal_mulai) {
        setLocalFeedback({
          open: true,
          type: "error",
          title: "Jadwal Pelaksanaan Tidak Valid",
          message: `Tanggal selesai (${formatIndoDate(s.tanggal_selesai)}) tidak boleh lebih awal dari tanggal mulai (${formatIndoDate(s.tanggal_mulai)}) pada kegiatan "${s.nama_kegiatan}".`,
        });
        return;
      }
    }

    try {
      setSubmitting(true);

      // Tentukan status target sesuai pagu nilai proyek & mode revisi
      const userRole = (user?.role || "").toUpperCase();
      let statusTarget = "APPROVED";

      if (isRevisi) {
        statusTarget = isAbove1M ? "MENUNGGU APPROVAL DC SPECIALIST" : "APPROVED";
      } else if (isAbove1M) {
        if (userRole.includes("SPECIALIST") || userRole.includes("SPECIALIS")) {
          statusTarget = "MENUNGGU APPROVAL B&M GM";
        } else {
          statusTarget = "MENUNGGU APPROVAL DC SPECIALIST";
        }
      } else {
        statusTarget = "APPROVED";
      }

      const payload = {
        catatan_maker: activeTender?.catatan_maker,
        catatan_kualifikasi: catatanEvaluasi ? toTitleCase(catatanEvaluasi.trim()) : null,
        butuh_konsultan: activeTender?.butuh_konsultan || evaluasiPeserta.some((p) => (p.peran || "").includes("KONSULTAN")),
        tipe_konsultan: activeTender?.tipe_konsultan,
        peserta: evaluasiPeserta.map((p) => ({
          vendor_id: p.vendor_id || p.vendor?.id,
          peran: p.peran,
          status_tahap: p.status_tahap,
          alasan_tidak_lolos:
            p.status_tahap === "TIDAK_LOLOS" && p.alasan_tidak_lolos
              ? toTitleCase(p.alasan_tidak_lolos.trim())
              : null,
          is_pemenang: false,
        })),
        schedule: schedules.map((s, idx) => ({
          nama_kegiatan: toTitleCase(s.nama_kegiatan.trim()),
          kategori_jadwal: s.kategori_jadwal || "TENDER_MAIN_KONTRAKTOR",
          tanggal_mulai: s.tanggal_mulai,
          tanggal_selesai: s.tanggal_selesai,
          keterangan: s.keterangan ? toTitleCase(s.keterangan.trim()) : null,
          urutan: idx + 1,
        })),
        status_target: statusTarget,
        action_note: isRevisi
          ? (catatanEvaluasi ? toTitleCase(catatanEvaluasi.trim()) : "Pengajuan ulang perbaikan revisi proposal tender oleh maker.")
          : (catatanEvaluasi ? toTitleCase(catatanEvaluasi.trim()) : "Evaluasi kualifikasi calon rekanan dan penetapan jadwal tender resmi."),
        user_email: user?.email,
        user_name: (user as any)?.namaLengkap || (user as any)?.name || user?.email?.split("@")[0] || "Maker",
        user_role: user?.role,
      };

      const res = await fetch(`/api/dc-development/tender/${tender.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.status === "success") {
        const feedbackMessage = isRevisi
          ? (isAbove1M
            ? `Pengajuan Proposal Tender ${tender.nomor_tender} telah diperbaiki dan diajukan ulang ke DC Specialist untuk persetujuan.`
            : `Pengajuan Proposal Tender ${tender.nomor_tender} telah diperbaiki dan telah selesai disetujui.`)
          : (isAbove1M
            ? `Kualifikasi & jadwal tender ${tender.nomor_tender} berhasil disimpan dan telah diajukan ke tahapan persetujuan (${statusTarget}).`
            : `Kualifikasi & jadwal tender ${tender.nomor_tender} berhasil disimpan. Pengadaan tender resmi telah SELESAI disetujui.`);

        const feedbackTitle = isRevisi ? "Revisi Berhasil Diajukan Ulang" : "Kualifikasi & Jadwal Tersimpan";

        onSuccess(json.data, {
          title: feedbackTitle,
          message: feedbackMessage,
        });
        onOpenChange(false);
      } else {
        onError(json.message || "Gagal menyimpan evaluasi kualifikasi & jadwal tender.");
      }
    } catch (e: any) {
      console.error(e);
      onError(e.message || "Terjadi kesalahan sistem saat menyimpan.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!tender) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl sm:max-w-5xl lg:max-w-5xl w-[96vw] max-h-[92vh] overflow-hidden p-0 rounded-2xl border border-slate-200/80 shadow-2xl bg-white flex flex-col [&>button:last-child]:hidden">
          {/* Header Modal Sticky */}
          <div className="flex items-center justify-between px-6 md:px-8 py-4.5 border-b border-slate-100 bg-white sticky top-0 z-20">
            <div className="flex items-center space-x-3.5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-xs ${isRevisi
                  ? "bg-gradient-to-br from-amber-500 to-amber-700"
                  : "bg-gradient-to-br from-[#E65F2B] to-[#cf4d1a]"
                }`}>
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2.5">
                  <h2 className="text-base md:text-lg font-bold text-slate-900 tracking-tight">
                    {isRevisi ? "Formulir Perbaikan Revisi Proposal Tender" : "Kualifikasi & Penjadwalan Tender"}
                  </h2>
                  {isRevisi ? (
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wide">
                      Status: Revisi
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-orange-50 text-[#E65F2B] border border-orange-200 uppercase tracking-wide">
                      Langkah {currentStep} / 2
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nomor: <span className="font-semibold text-slate-800">{tender.nomor_tender}</span> &bull; Proyek:{" "}
                  <span className="font-semibold text-slate-800">{tender.project?.nama_proyek}</span> ({tender.cabang})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              title="Tutup dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Progress Bar */}
          <div className="px-6 md:px-8 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-3 shrink-0">
            {[
              {
                step: 1,
                title: "1. Evaluasi Kualifikasi Rekanan",
                desc: "Penetapan Status Lolos / Tidak Lolos Peserta",
              },
              {
                step: 2,
                title: "2. Jadwal Pelaksanaan (Schedule)",
                desc: "Timeline Tender, Aanwijzing & Pelaksanaan",
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
                          className={`text-xs font-bold truncate ${isActive ? "text-slate-900" : isDone ? "text-emerald-800" : "text-slate-500"
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
                  {idx === 0 && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 hidden sm:block" />}
                </React.Fragment>
              );
            })}
          </div>

          {/* Modal Body */}
          <div className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto bg-[#FAFAFA]/60">
            {/* LANGKAH 1: EVALUASI KUALIFIKASI PESERTA REKANAN */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Executive Summary & SOP Banner */}
                <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm md:text-base font-bold text-slate-900">
                        Penetapan Kualifikasi Calon Rekanan Peserta
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Verifikasi kelayakan setiap rekanan kontraktor dan konsultan. Minimal <strong>3 Kontraktor</strong> wajib dinyatakan Lolos Kualifikasi.
                      </p>
                    </div>

                    <span
                      className={`text-xs font-bold px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shrink-0 ${kontraktorLolos.length >= 3
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                    >
                      {kontraktorLolos.length >= 3 ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      )}
                      <span>
                        {kontraktorLolos.length} Kontraktor Lolos (Min. 3)
                      </span>
                    </span>
                  </div>
                </div>

                {/* Highlight Instruksi Catatan Revisi Pejabat Peninjau */}
                {isRevisi && (
                  <div className="p-4 md:p-5 rounded-2xl bg-amber-50/80 border border-amber-200/90 shadow-2xs space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-amber-900 font-extrabold text-xs tracking-wider uppercase">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Instruksi Catatan Revisi Dari Pejabat Peninjau</span>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase">
                        Wajib Perbaikan
                      </span>
                    </div>
                    <p className="text-xs md:text-sm font-bold text-amber-950 italic pl-6 leading-relaxed">
                      &ldquo;{latestRevisiLog?.notes || activeTender?.catatan_revisi || "Mohon lakukan perbaikan rekanan dan jadwal tender sesuai arahan."}&rdquo;
                    </p>
                    <div className="flex items-center space-x-2 text-[11px] text-amber-800/80 pl-6">
                      <span>Oleh: <strong>{latestRevisiLog?.user_name || latestRevisiLog?.user_email || "Pejabat Peninjau"}</strong> ({latestRevisiLog?.user_role || "Approver"})</span>
                      {latestRevisiLog?.created_at && (
                        <>
                          <span>&bull;</span>
                          <span>{formatIndoDateTime(latestRevisiLog.created_at)}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-2 pl-6 pt-2 border-t border-amber-200/60 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                      <span className="font-semibold text-amber-800">
                        Sesuai SOP SPARTA: Anda dapat menambah/menghapus rekanan, mengubah kelayakan kualifikasi, atau memperbarui timeline jadwal. <strong>Wajib minimal 1 data diubah</strong> sebelum mengajukan ulang.
                      </span>
                      {isDataChanged ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md text-[10px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Perubahan Terdeteksi
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md text-[10px]">
                          <AlertTriangle className="w-3.5 h-3.5" /> Belum Ada Perubahan
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Panel Tambah Usulan Rekanan Baru */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 text-[#E65F2B] flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs md:text-sm font-bold text-slate-900">
                          Tambah Usulan Rekanan Baru
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Coverage Cabang Proyek: <strong className="text-slate-700">{projectCabang || "Semua Cabang"}</strong> &bull; {kontraktorOptions.length} Kontraktor tersedia
                        </p>
                      </div>
                    </div>

                    {/* Tab Tipe Rekanan jika proyek butuh konsultan */}
                    {(activeTender?.butuh_konsultan || hasKonsultanPengawas || hasKonsultanPerencana) && (
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setNewRekananType("KONTRAKTOR")}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${newRekananType === "KONTRAKTOR"
                              ? "bg-white text-slate-900 shadow-2xs"
                              : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                          Kontraktor
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewRekananType("KONSULTAN")}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${newRekananType === "KONSULTAN"
                              ? "bg-white text-slate-900 shadow-2xs"
                              : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                          Konsultan
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Kontraktor Picker */}
                  {newRekananType === "KONTRAKTOR" && (
                    <div className="space-y-3">
                      {kontraktorOptions.length === 0 ? (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center font-medium">
                          Seluruh rekanan kontraktor yang memiliki cakupan di Cabang <strong>{projectCabang}</strong> sudah masuk ke dalam daftar evaluasi.
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                          <div className="flex-1">
                            <SearchableSelectInput
                              options={kontraktorOptions}
                              value={newKontraktorId}
                              onChange={setNewKontraktorId}
                              placeholder="Cari & pilih rekanan kontraktor..."
                            />
                          </div>
                          <Button
                            type="button"
                            disabled={!newKontraktorId}
                            onClick={handleAddKontraktor}
                            className="h-11 px-4 rounded-xl bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            <span>Tambah Kontraktor</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Konsultan Picker */}
                  {newRekananType === "KONSULTAN" && (
                    <div className="space-y-3">
                      {konsultanOptions.length === 0 ? (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center font-medium">
                          Tidak ditemukan rekanan konsultan yang memiliki cakupan di Cabang <strong>{projectCabang}</strong>.
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                          <div className="w-full sm:w-56 shrink-0">
                            <select
                              value={newKonsultanPeran}
                              onChange={(e) => setNewKonsultanPeran(e.target.value)}
                              className="w-full h-11 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:border-[#E65F2B]"
                            >
                              <option value="KONSULTAN_PENGAWAS">Konsultan Pengawas (MK)</option>
                              <option value="KONSULTAN_PERENCANA">Konsultan Perencana</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <SearchableSelectInput
                              options={konsultanOptions}
                              value={newKonsultanId}
                              onChange={setNewKonsultanId}
                              placeholder="Cari & pilih rekanan konsultan..."
                            />
                          </div>
                          <Button
                            type="button"
                            disabled={!newKonsultanId}
                            onClick={handleAddKonsultan}
                            className="h-11 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            <span>Tambah Konsultan</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Daftar Kartu Peserta Rekanan */}
                <div className="space-y-4">
                  {evaluasiPeserta.map((p, index) => {
                    const vendor = p.vendor || {};
                    const isKontraktor = p.peran === "MAIN_KONTRAKTOR" || p.peran === "KONTRAKTOR";
                    const isBesar = vendor.golongan === "BESAR";
                    const isLolos = p.status_tahap === "LOLOS_KUALIFIKASI";
                    const pic = vendor.pic_user || (vendor.pic_users && vendor.pic_users[0]);

                    return (
                      <div
                        key={p.id || vendor.id || index}
                        className={`p-5 md:p-6 rounded-2xl border transition-all bg-white shadow-xs space-y-4 ${isLolos ? "border-slate-200/90" : "border-rose-200 bg-rose-50/15"
                          }`}
                      >
                        {/* Header Kartu Peserta & Opsi Status Kualifikasi */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                          <div className="flex items-start space-x-3.5">
                            <div
                              className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 mt-0.5 ${isKontraktor
                                  ? "bg-orange-50 text-[#E65F2B] border border-orange-100"
                                  : "bg-blue-50 text-blue-600 border border-blue-100"
                                }`}
                            >
                              {isKontraktor ? <Building2 className="w-5 h-5" /> : <HardHat className="w-5 h-5" />}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                                  #{index + 1}
                                </span>
                                <h4 className="text-sm md:text-base font-extrabold text-slate-900 leading-tight">
                                  {vendor.nama_perusahaan || "Nama Perusahaan Rekanan"}
                                </h4>
                                <span
                                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${isBesar
                                      ? "bg-purple-100 text-purple-700 border border-purple-200"
                                      : "bg-blue-100 text-blue-700 border border-blue-200"
                                    }`}
                                >
                                  GOLONGAN {vendor.golongan || "MENENGAH"}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                                  {p.peran}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                Cabang Domisili: <strong className="text-slate-700">{vendor.cabang || "-"}</strong>
                                {vendor.coverage_cabang && (
                                  <> &bull; Coverage: <strong className="text-slate-700">{vendor.coverage_cabang}</strong></>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Toggle Tombol Status Kelayakan Kualifikasi & Tombol Hapus */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
                              <button
                                type="button"
                                onClick={() => handleUpdateStatusPeserta(p.vendor_id || vendor.id, "LOLOS_KUALIFIKASI")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${isLolos
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900"
                                  }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Lolos Kualifikasi</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatusPeserta(p.vendor_id || vendor.id, "TIDAK_LOLOS")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${!isLolos
                                    ? "bg-rose-600 text-white shadow-xs"
                                    : "text-slate-600 hover:text-rose-600"
                                  }`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Tidak Lolos</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemovePeserta(p.vendor_id || vendor.id)}
                              title="Hapus Rekanan dari Usulan"
                              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Info Kontak & Akun PIC */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                          <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" /> Kontak Perusahaan
                            </span>
                            <p className="font-semibold text-slate-800 text-xs">{vendor.nomor_telepon || "-"}</p>
                            <p className="text-[11px] text-slate-500 truncate">{vendor.email || "-"}</p>
                          </div>

                          <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" /> Alamat Kantor
                            </span>
                            <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">
                              {vendor.alamat || "Alamat kantor tercatat"}
                            </p>
                          </div>

                          <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100/90 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" /> Akun PIC / Narahubung
                            </span>
                            {pic ? (
                              <div>
                                <p className="font-bold text-slate-900 text-xs">{pic.nama}</p>
                                <p className="text-[11px] text-slate-500 truncate">{pic.email}</p>
                                {pic.role && (
                                  <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700 mt-0.5">
                                    {pic.role}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <p className="text-[11px] text-slate-400 italic">Belum ada akun PIC terhubung</p>
                            )}
                          </div>
                        </div>

                        {/* Jika Dinyatakan Tidak Lolos: Input Alasan Wajib */}
                        {!isLolos && (
                          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2 animate-in fade-in duration-150">
                            <label className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Alasan Tidak Lolos Kualifikasi <span className="text-rose-600">*</span></span>
                            </label>
                            <textarea
                              value={p.alasan_tidak_lolos || ""}
                              onChange={(e) =>
                                handleUpdateAlasanPeserta(p.vendor_id || vendor.id, e.target.value)
                              }
                              onBlur={(e) =>
                                handleUpdateAlasanPeserta(p.vendor_id || vendor.id, e.target.value, true)
                              }
                              rows={2}
                              placeholder="Tuliskan alasan penolakan kualifikasi secara spesifik (misal: kapasitas tim lapangan penuh, dokumen sertifikat belum lengkap)..."
                              className="w-full p-3 text-xs rounded-xl border border-rose-300 focus:outline-none focus:border-rose-500 bg-white"
                            />
                            {!p.alasan_tidak_lolos?.trim() && (
                              <p className="text-[10px] text-rose-600 font-medium">
                                Wajib mengisi alasan penolakan sebelum dapat melanjutkan ke langkah berikutnya.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* LANGKAH 2: PENGATURAN JADWAL TENDER & KONSTRUKSI (SCHEDULE) */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Header Jadwal */}
                <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm md:text-base font-bold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#E65F2B]" />
                      <span>Timeline Pelaksanaan Tender &amp; Pekerjaan Fisik</span>
                    </h3>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      Total {schedules.length} Kegiatan Terjadwal
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Kelola jadwal pengadaan tender dan tahap konstruksi lapangan. Anda dapat menambah baris kegiatan secara bebas, menetapkan tanggal mulai &amp; selesai, serta menambahkan catatan detail.
                  </p>
                </div>

                {/* GRUP 1: TAHAP TENDER */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 px-1">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">
                        Tahap 1: Pelaksanaan Tender (Pengadaan &amp; Aanwijzing)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Rangkaian Aanwijzing, Klarifikasi Teknis, Negosiasi Komersial, hingga Penerbitan SPK
                      </p>
                    </div>
                  </div>

                  {/* Subkategori dalam Tahap Tender */}
                  {scheduleSubCategories
                    .filter((sub) => sub.parentStage === "TENDER" && sub.isVisible)
                    .map((sub) => {
                      const subItemsWithIndices = schedules
                        .map((item, idx) => ({ item, globalIndex: idx }))
                        .filter(({ item }) => item.kategori_jadwal === sub.key);

                      return (
                        <div
                          key={sub.key}
                          className={cn(
                            "bg-white rounded-2xl border p-5 md:p-6 shadow-xs space-y-4 transition-all",
                            sub.accentBorder
                          )}
                        >
                          {/* Header Subkategori */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                                <sub.icon className="w-4 h-4 text-slate-700" />
                              </div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <h5 className="text-xs md:text-sm font-bold text-slate-900">
                                    {sub.title}
                                  </h5>
                                  <span className={cn("text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border", sub.badgeColor)}>
                                    {sub.badge}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {sub.subtitle}
                                </p>
                              </div>
                            </div>

                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                              {subItemsWithIndices.length} Kegiatan
                            </span>
                          </div>

                          {/* Daftar Input Kegiatan */}
                          <div className="space-y-3">
                            {subItemsWithIndices.length === 0 ? (
                              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 italic bg-slate-50/50">
                                Belum ada kegiatan yang diatur untuk sub-kategori ini. Klik tombol tambah di bawah untuk menambahkan.
                              </div>
                            ) : (
                              subItemsWithIndices.map(({ item, globalIndex }, subIdx) => (
                                <div
                                  key={globalIndex}
                                  className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition-all space-y-3"
                                >
                                  {/* Baris 1: Nama Kegiatan Bebas & Tombol Hapus */}
                                  <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0 font-mono">
                                      #{subIdx + 1}
                                    </span>

                                    <div className="flex-1">
                                      <Input
                                        type="text"
                                        value={item.nama_kegiatan || ""}
                                        onChange={(e) =>
                                          handleUpdateScheduleItem(globalIndex, "nama_kegiatan", e.target.value)
                                        }
                                        onBlur={(e) =>
                                          handleUpdateScheduleItem(globalIndex, "nama_kegiatan", e.target.value, true)
                                        }
                                        placeholder="Nama kegiatan (contoh: Proposal Calon MK, Rapat Aanwijzing)..."
                                        className="h-9 text-xs rounded-xl border-slate-200 bg-slate-50/40 focus:bg-white focus-visible:ring-[#E65F2B] font-bold text-slate-900"
                                      />
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleRemoveScheduleItem(globalIndex)}
                                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0"
                                      title="Hapus baris kegiatan ini"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {/* Baris 2: Tanggal Mulai, Tanggal Selesai & Catatan */}
                                  {(() => {
                                    const isDateOrderInvalid = Boolean(
                                      item.tanggal_mulai && item.tanggal_selesai && item.tanggal_selesai < item.tanggal_mulai
                                    );

                                    return (
                                      <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                          <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block">
                                              Tanggal Mulai <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                              type="date"
                                              value={item.tanggal_mulai || ""}
                                              onChange={(e) =>
                                                handleUpdateScheduleItem(globalIndex, "tanggal_mulai", e.target.value, false, e.target)
                                              }
                                              className={cn(
                                                "w-full px-3 py-1.5 text-xs rounded-xl border focus:outline-none transition-colors",
                                                isDateOrderInvalid
                                                  ? "border-rose-400 bg-rose-50/30 text-rose-800 focus:border-rose-500"
                                                  : "border-slate-200 focus:border-[#E65F2B] bg-slate-50/40 focus:bg-white"
                                              )}
                                            />
                                          </div>

                                          <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block">
                                              Tanggal Selesai <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                              type="date"
                                              value={item.tanggal_selesai || ""}
                                              min={item.tanggal_mulai || undefined}
                                              onChange={(e) =>
                                                handleUpdateScheduleItem(globalIndex, "tanggal_selesai", e.target.value, false, e.target)
                                              }
                                              className={cn(
                                                "w-full px-3 py-1.5 text-xs rounded-xl border focus:outline-none transition-colors",
                                                isDateOrderInvalid
                                                  ? "border-rose-400 bg-rose-50/30 text-rose-800 focus:border-rose-500"
                                                  : "border-slate-200 focus:border-[#E65F2B] bg-slate-50/40 focus:bg-white"
                                              )}
                                            />
                                          </div>

                                          <div className="space-y-1 sm:col-span-2 md:col-span-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block">
                                              Catatan / Deskripsi (Title Case)
                                            </label>
                                            <input
                                              type="text"
                                              value={item.keterangan || ""}
                                              onChange={(e) =>
                                                handleUpdateScheduleItem(globalIndex, "keterangan", e.target.value)
                                              }
                                              onBlur={(e) =>
                                                handleUpdateScheduleItem(globalIndex, "keterangan", e.target.value, true)
                                              }
                                              placeholder="Catatan tambahan kegiatan..."
                                              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#E65F2B] bg-slate-50/40 focus:bg-white transition-colors"
                                            />
                                          </div>
                                        </div>

                                        {isDateOrderInvalid && (
                                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200/80 px-2.5 py-1.5 rounded-lg mt-1">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                                            <span>
                                              Tanggal selesai ({formatIndoDate(item.tanggal_selesai)}) mendahului tanggal mulai ({formatIndoDate(item.tanggal_mulai)}). Harap perbaiki tanggal.
                                            </span>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              ))
                            )}
                          </div>

                          {/* Tombol Tambah Kegiatan Bebas */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddScheduleItem(sub.key)}
                            className="w-full py-2 h-9 rounded-xl border-dashed border-slate-300 text-slate-600 hover:text-[#E65F2B] hover:border-[#E65F2B] hover:bg-orange-50/50 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah Kegiatan {sub.title}</span>
                          </Button>
                        </div>
                      );
                    })}
                </div>

                {/* GRUP 2: TAHAP KONSTRUKSI */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2.5 px-1">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 text-[#E65F2B] flex items-center justify-center font-bold text-xs">
                      2
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900">
                        Tahap 2: Pelaksanaan Konstruksi &amp; Pengawasan Fisik
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Pelaksanaan Pekerjaan Lapangan, Supervisi Mutu, Monitoring Progress &amp; Serah Terima PHO
                      </p>
                    </div>
                  </div>

                  {/* Subkategori dalam Tahap Konstruksi */}
                  {scheduleSubCategories
                    .filter((sub) => sub.parentStage === "KONSTRUKSI" && sub.isVisible)
                    .map((sub) => {
                      const subItemsWithIndices = schedules
                        .map((item, idx) => ({ item, globalIndex: idx }))
                        .filter(({ item }) => item.kategori_jadwal === sub.key);

                      return (
                        <div
                          key={sub.key}
                          className={cn(
                            "bg-white rounded-2xl border p-5 md:p-6 shadow-xs space-y-4 transition-all",
                            sub.accentBorder
                          )}
                        >
                          {/* Header Subkategori */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                                <sub.icon className="w-4 h-4 text-slate-700" />
                              </div>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <h5 className="text-xs md:text-sm font-bold text-slate-900">
                                    {sub.title}
                                  </h5>
                                  <span className={cn("text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border", sub.badgeColor)}>
                                    {sub.badge}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {sub.subtitle}
                                </p>
                              </div>
                            </div>

                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                              {subItemsWithIndices.length} Kegiatan
                            </span>
                          </div>

                          {/* Daftar Input Kegiatan */}
                          <div className="space-y-3">
                            {subItemsWithIndices.length === 0 ? (
                              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 italic bg-slate-50/50">
                                Belum ada kegiatan yang diatur untuk sub-kategori ini. Klik tombol tambah di bawah untuk menambahkan.
                              </div>
                            ) : (
                              subItemsWithIndices.map(({ item, globalIndex }, subIdx) => (
                                <div
                                  key={globalIndex}
                                  className="p-4 rounded-xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition-all space-y-3"
                                >
                                  {/* Baris 1: Nama Kegiatan Bebas & Tombol Hapus */}
                                  <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0 font-mono">
                                      #{subIdx + 1}
                                    </span>

                                    <div className="flex-1">
                                      <Input
                                        type="text"
                                        value={item.nama_kegiatan || ""}
                                        onChange={(e) =>
                                          handleUpdateScheduleItem(globalIndex, "nama_kegiatan", e.target.value)
                                        }
                                        onBlur={(e) =>
                                          handleUpdateScheduleItem(globalIndex, "nama_kegiatan", e.target.value, true)
                                        }
                                        placeholder="Nama kegiatan konstruksi / pengawasan lapangan..."
                                        className="h-9 text-xs rounded-xl border-slate-200 bg-slate-50/40 focus:bg-white focus-visible:ring-[#E65F2B] font-bold text-slate-900"
                                      />
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleRemoveScheduleItem(globalIndex)}
                                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0"
                                      title="Hapus baris kegiatan ini"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {/* Baris 2: Tanggal Mulai, Tanggal Selesai & Catatan */}
                                  {(() => {
                                    const isDateOrderInvalid = Boolean(
                                      item.tanggal_mulai && item.tanggal_selesai && item.tanggal_selesai < item.tanggal_mulai
                                    );

                                    return (
                                      <>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                                          <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block">
                                              Tanggal Mulai <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                              type="date"
                                              value={item.tanggal_mulai || ""}
                                              onChange={(e) =>
                                                handleUpdateScheduleItem(globalIndex, "tanggal_mulai", e.target.value, false, e.target)
                                              }
                                              className={cn(
                                                "w-full px-3 py-1.5 text-xs rounded-xl border focus:outline-none transition-colors",
                                                isDateOrderInvalid
                                                  ? "border-rose-400 bg-rose-50/30 text-rose-800 focus:border-rose-500"
                                                  : "border-slate-200 focus:border-[#E65F2B] bg-slate-50/40 focus:bg-white"
                                              )}
                                            />
                                          </div>

                                          <div className="space-y-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block">
                                              Tanggal Selesai <span className="text-rose-500">*</span>
                                            </label>
                                            <input
                                              type="date"
                                              value={item.tanggal_selesai || ""}
                                              min={item.tanggal_mulai || undefined}
                                              onChange={(e) =>
                                                handleUpdateScheduleItem(globalIndex, "tanggal_selesai", e.target.value, false, e.target)
                                              }
                                              className={cn(
                                                "w-full px-3 py-1.5 text-xs rounded-xl border focus:outline-none transition-colors",
                                                isDateOrderInvalid
                                                  ? "border-rose-400 bg-rose-50/30 text-rose-800 focus:border-rose-500"
                                                  : "border-slate-200 focus:border-[#E65F2B] bg-slate-50/40 focus:bg-white"
                                              )}
                                            />
                                          </div>

                                          <div className="space-y-1 sm:col-span-2 md:col-span-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block">
                                              Catatan / Deskripsi (Title Case)
                                            </label>
                                            <input
                                              type="text"
                                              value={item.keterangan || ""}
                                              onChange={(e) =>
                                                handleUpdateScheduleItem(globalIndex, "keterangan", e.target.value)
                                              }
                                              onBlur={(e) =>
                                                handleUpdateScheduleItem(globalIndex, "keterangan", e.target.value, true)
                                              }
                                              placeholder="Catatan tambahan kegiatan..."
                                              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#E65F2B] bg-slate-50/40 focus:bg-white transition-colors"
                                            />
                                          </div>
                                        </div>

                                        {isDateOrderInvalid && (
                                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200/80 px-2.5 py-1.5 rounded-lg mt-1">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                                            <span>
                                              Tanggal selesai ({formatIndoDate(item.tanggal_selesai)}) mendahului tanggal mulai ({formatIndoDate(item.tanggal_mulai)}). Harap perbaiki tanggal.
                                            </span>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              ))
                            )}
                          </div>

                          {/* Tombol Tambah Kegiatan Bebas */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddScheduleItem(sub.key)}
                            className="w-full py-2 h-9 rounded-xl border-dashed border-slate-300 text-slate-600 hover:text-[#E65F2B] hover:border-[#E65F2B] hover:bg-orange-50/50 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah Kegiatan {sub.title}</span>
                          </Button>
                        </div>
                      );
                    })}
                </div>

                {/* Catatan Pengantar Pra-Kualifikasi (Readonly info dari maker pengajuan awal) */}
                {tender.catatan_maker && (
                  <div className="p-4 rounded-2xl border border-blue-200/80 bg-blue-50/40 space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                        Catatan Pengantar Pra-Kualifikasi (Maker)
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed pl-6 italic">
                      "{toTitleCase(tender.catatan_maker)}"
                    </p>
                  </div>
                )}

                {/* Notifikasi Status Perubahan Data Revisi */}
                {isRevisi && (
                  <div
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs transition-colors ${isDataChanged
                        ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                        : "bg-amber-50/80 border-amber-200 text-amber-900"
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {isDataChanged ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <div>
                        <p className="font-bold">
                          {isDataChanged
                            ? "Perubahan Data Revisi Terdeteksi"
                            : "Belum Ada Perubahan Data"}
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {isDataChanged
                            ? "Minimal 1 data telah diperbarui (rekanan/jadwal/catatan). Berkas siap diajukan ulang ke tahapan persetujuan."
                            : "SOP SPARTA mewajibkan Anda mengubah minimal 1 data sebelum tombol pengajuan ulang aktif."}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase shrink-0 ${isDataChanged
                          ? "bg-emerald-200/80 text-emerald-900"
                          : "bg-amber-200/80 text-amber-900"
                        }`}
                    >
                      {isDataChanged ? "Siap Ajukan" : "Wajib Ubah Data"}
                    </span>
                  </div>
                )}

                {/* Catatan Evaluasi / Ringkasan Kualifikasi */}
                <div className="p-5 md:p-6 rounded-2xl border border-slate-200/90 bg-white space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs md:text-sm font-bold text-slate-800 block">
                      Catatan Evaluasi / Ringkasan Kualifikasi
                    </label>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-orange-50 text-[#E65F2B] border border-orange-200 uppercase tracking-wide">
                      Tahap Kualifikasi
                    </span>
                  </div>
                  <textarea
                    value={catatanEvaluasi}
                    onChange={(e) => setCatatanEvaluasi(e.target.value)}
                    onBlur={(e) => setCatatanEvaluasi(toTitleCase(e.target.value))}
                    rows={3}
                    placeholder="Tuliskan catatan evaluasi kualifikasi rekanan dan timeline yang disepakati (otomatis format Title Case)..."
                    className="w-full p-3.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#E65F2B] bg-slate-50/40 focus:bg-white transition-colors"
                  />
                </div>
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
                  onClick={() => setCurrentStep(1)}
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

              {/* Langkah 1: Lanjut ke Jadwal */}
              {currentStep === 1 && (
                <Button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={!canProceedStep2}
                  className="h-10 px-5 rounded-xl bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <span>Lanjut: Atur Jadwal</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}

              {/* Langkah 2: Simpan Selesai / Teruskan ke Approval / Ajukan Ulang Revisi */}
              {currentStep === 2 && (
                <Button
                  type="button"
                  onClick={handleSaveKualifikasi}
                  disabled={submitting || (isRevisi && !isDataChanged)}
                  className="h-10 px-5 rounded-xl bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      <span>{isRevisi ? "Mengajukan Ulang Revisi..." : "Menyimpan Kualifikasi..."}</span>
                    </>
                  ) : isRevisi ? (
                    <>
                      <Send className="w-4 h-4 mr-1 text-white" />
                      <span>Ajukan Ulang Revisi Tender</span>
                    </>
                  ) : !isAbove1M ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1 text-white" />
                      <span>Simpan &amp; Selesaikan Tender</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1" />
                      <span>Simpan &amp; Teruskan ke Approval</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pop Up Dialog Peringatan & Feedback Interaktif */}
      <FeedbackModal
        open={localFeedback.open}
        type={localFeedback.type}
        title={localFeedback.title}
        message={localFeedback.message}
        onClose={() => setLocalFeedback((prev) => ({ ...prev, open: false }))}
      />
    </>
  );
}

export { KualifikasiTenderModal };
