"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  MapPin,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileDown,
  Eye,
  Mail,
  Timer,
  ExternalLink,
  Loader2,
  X,
  FileText,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatRupiah } from "@/lib/utils";
import ApprovalNotesHistory from "@/components/approval/ApprovalNotesHistory";
import SubmissionReasonCard from "@/components/approval/SubmissionReasonCard";

export interface PesertaItem {
  id: number;
  vendor_id: number;
  email: string;
  status_konfirmasi: "MENUNGGU_RESPON" | "HADIR" | "TIDAK_HADIR";
  respon_at?: string | null;
  alasan_tidak_hadir?: string | null;
  email_sent: boolean;
  email_sent_at?: string | null;
  email_error?: string | null;
  vendor: {
    id: number;
    nama_perusahaan: string;
    alamat?: string | null;
    nomor_telepon?: string | null;
    email: string;
    cabang?: string | null;
  };
}

export interface AanwijzingDetail {
  id: number;
  nomor_undangan: string;
  kategori_nilai: "DI_ATAS_1M" | "DI_BAWAH_1M";
  tanggal_pelaksanaan: string;
  waktu_pelaksanaan: string;
  lokasi: string;
  catatan?: string | null;
  status: "MENUNGGU_KONFIRMASI" | "AANWIJZING_LANJUT" | "MENUNGGU_APPROVAL_DC_MANAGER" | "ON_HOLD";
  deadline_konfirmasi: string;
  file_url?: string | null;
  drive_file_id?: string | null;
  created_by: string;
  cabang: string;
  created_at: string;
  project: {
    id: number;
    nama_proyek: string;
    kode: string;
    cabang: string;
    alamat?: string | null;
    tipe?: string | null;
  };
  renovasi?: {
    id: number;
    nomor_pengajuan: string;
    grand_total: number;
  } | null;
  tender?: {
    id: number;
    nomor_tender: string;
    judul_tender?: string | null;
  } | null;
  peserta: PesertaItem[];
  audit_logs?: any[];
}

export interface DetailAanwijzingModalProps {
  /** Standard SPARTA open prop */
  open?: boolean;
  /** Legacy prop support */
  isOpen?: boolean;
  /** Standard SPARTA onOpenChange prop */
  onOpenChange?: (open: boolean) => void;
  /** Legacy prop support */
  onClose?: () => void;
  aanwijzing: AanwijzingDetail | null;
  onOpenKonfirmasi?: (pesertaId: number) => void;
  currentUser?: {
    email?: string | null;
    role?: string | null;
    nama_pt?: string | null;
    namaPt?: string | null;
  } | null;
}

export function DetailAanwijzingModal({
  open,
  isOpen,
  onOpenChange,
  onClose,
  aanwijzing: initialAanwijzing,
  onOpenKonfirmasi,
  currentUser,
}: DetailAanwijzingModalProps) {
  const effectiveOpen = open !== undefined ? open : !!isOpen;

  const handleOpenChange = (val: boolean) => {
    if (onOpenChange) onOpenChange(val);
    if (!val && onClose) onClose();
  };

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [resendingEmailId, setResendingEmailId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<AanwijzingDetail | null>(null);
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({ hours: 0, minutes: 0, seconds: 0, isExpired: false });

  // Auto fetch data terbaru jika modal dibuka
  useEffect(() => {
    if (effectiveOpen && initialAanwijzing?.id) {
      fetch(`/api/dc-development/aanwijzing/${initialAanwijzing.id}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.status === "success" && json.data) {
            setDetailData(json.data);
          }
        })
        .catch((err) => console.error("Gagal memuat detail aanwijzing:", err));
    } else if (!effectiveOpen) {
      setDetailData(null);
    }
  }, [effectiveOpen, initialAanwijzing?.id]);

  const aanwijzing = detailData || initialAanwijzing;

  // Countdown timer 48 jam (Hari D+2 @ 24:00 WIB)
  useEffect(() => {
    if (!aanwijzing?.deadline_konfirmasi) return;

    const calculateTime = () => {
      const now = new Date().getTime();
      const deadline = new Date(aanwijzing.deadline_konfirmasi).getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds, isExpired: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [aanwijzing?.deadline_konfirmasi]);

  if (!aanwijzing) return null;

  const project = aanwijzing.project || {};
  const renovasi = aanwijzing.renovasi || null;
  const tender = aanwijzing.tender || null;

  const roleUpper = (currentUser?.role || "").toUpperCase();
  const isContractor =
    roleUpper.includes("KONTRAKTOR") ||
    roleUpper.includes("KONSULTAN") ||
    roleUpper.includes("VENDOR") ||
    roleUpper.includes("REKANAN");

  // Temukan apakah akun kontraktor login terdaftar di undangan ini
  const myContractorPeserta = isContractor
    ? (aanwijzing.peserta || []).find((p) => {
      const uEmail = (currentUser?.email || "").toLowerCase();
      const uPt = ((currentUser?.nama_pt || currentUser?.namaPt || "") as string).toLowerCase();
      const pEmail = (p.email || p.vendor?.email || "").toLowerCase();
      const pName = (p.vendor?.nama_perusahaan || "").toLowerCase();
      return (uEmail && pEmail === uEmail) || (uPt && pName.includes(uPt));
    })
    : null;

  const hadirList = (aanwijzing.peserta || []).filter((p) => p.status_konfirmasi === "HADIR");
  const tidakHadirList = (aanwijzing.peserta || []).filter((p) => p.status_konfirmasi === "TIDAK_HADIR");
  const pendingList = (aanwijzing.peserta || []).filter((p) => p.status_konfirmasi === "MENUNGGU_RESPON");

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "AANWIJZING_LANJUT":
        return {
          label: "Aanwijzing Lanjut",
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
          dot: "bg-emerald-500",
        };
      case "MENUNGGU_KONFIRMASI":
        return {
          label: "Menunggu Konfirmasi",
          bg: "bg-amber-50 text-amber-800 border-amber-200/80",
          dot: "bg-amber-500",
        };
      case "MENUNGGU_APPROVAL_DC_MANAGER":
        return {
          label: "Approval DC Manager",
          bg: "bg-blue-50 text-blue-800 border-blue-200/80",
          dot: "bg-blue-500",
        };
      case "ON_HOLD":
        return {
          label: "ON HOLD (Ditahan)",
          bg: "bg-rose-50 text-rose-800 border-rose-200/80",
          dot: "bg-rose-500",
        };
      default:
        return {
          label: status,
          bg: "bg-slate-50 text-slate-800 border-slate-200/80",
          dot: "bg-slate-500",
        };
    }
  };

  const statusInfo = getStatusBadge(aanwijzing.status);

  // Lihat Berkas PDF Surat Undangan Resmi (Internal atau Khusus Kontraktor / Konsultan / Rekanan via Proxy)
  const handleDownloadPdf = async (vendorId?: number) => {
    if (!aanwijzing?.id) return;
    setDownloadingPdf(true);
    try {
      const targetParam = vendorId
        ? `?tipe=kontraktor&vendor_id=${vendorId}`
        : isContractor
          ? `?tipe=kontraktor`
          : "";

      // Rekanan eksternal (Kontraktor, Konsultan, Rekanan) tidak punya akun SAT Google Drive (@alfamart.co.id).
      // Selalu gunakan proxy endpoint SPARTA untuk melihat PDF secara inline di tab baru tanpa auto download.
      if (isContractor) {
        // Trigger sinkronisasi/arsip ke Google Drive di background
        fetch(`/api/dc-development/aanwijzing/${aanwijzing.id}/download-pdf${targetParam}`).catch(() => { });
        const proxyParam = targetParam || "?tipe=kontraktor";
        window.open(`/api/dc-development/aanwijzing/${aanwijzing.id}/pdf${proxyParam}`, "_blank");
        return;
      }

      const res = await fetch(`/api/dc-development/aanwijzing/${aanwijzing.id}/download-pdf${targetParam}`);
      const json = await res.json();
      if (json.status === "success" && json.data?.file_url) {
        window.open(json.data.file_url, "_blank", "noopener,noreferrer");
      } else {
        const fallbackParam = targetParam || "";
        window.open(`/api/dc-development/aanwijzing/${aanwijzing.id}/pdf${fallbackParam}`, "_blank");
      }
    } catch {
      const fallbackParam = vendorId
        ? `?tipe=kontraktor&vendor_id=${vendorId}`
        : isContractor
          ? "?tipe=kontraktor"
          : "";
      window.open(`/api/dc-development/aanwijzing/${aanwijzing.id}/pdf${fallbackParam}`, "_blank");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Kirim Ulang Email ke Kontraktor
  const handleResendEmail = async (vendorId?: number) => {
    if (!aanwijzing?.id) return;
    setResendingEmailId(vendorId || -1);
    try {
      const res = await fetch(`/api/dc-development/aanwijzing/${aanwijzing.id}/resend-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vendorId ? { vendor_id: vendorId } : {}),
      });
      const json = await res.json();
      if (json.status === "success") {
        // Refresh detail
        const freshRes = await fetch(`/api/dc-development/aanwijzing/${aanwijzing.id}`);
        const freshJson = await freshRes.json();
        if (freshJson.status === "success" && freshJson.data) {
          setDetailData(freshJson.data);
        }
      }
    } catch (err) {
      console.error("Gagal mengirim ulang email:", err);
    } finally {
      setResendingEmailId(null);
    }
  };

  // Normalisasi audit logs untuk komponen ApprovalNotesHistory
  const normalizedAuditLogs = Array.isArray(aanwijzing.audit_logs)
    ? aanwijzing.audit_logs.map((log: any) => ({
      id: log.id,
      aksi: log.action || "NOTE",
      user_name: log.user_name || log.user_email || "System",
      user_role: log.user_role || "User",
      catatan: log.notes || log.catatan || null,
      created_at: log.created_at,
    }))
    : [];

  return (
    <Dialog open={effectiveOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white border border-slate-200/90 shadow-xl rounded-2xl max-h-[90vh] flex flex-col [&>button:last-child]:hidden">
        {/* Header Modal: Cohesive, light, enterprise aesthetic sesuai SPARTA */}
        <div className="px-6 py-5 bg-white border-b border-slate-200/80 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 text-[#E65F2B] flex items-center justify-center shrink-0 mt-0.5">
              <FileText className="w-5 h-5 text-[#E65F2B]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border",
                    statusInfo.bg
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", statusInfo.dot)} />
                  {statusInfo.label}
                </span>
                <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/70">
                  {aanwijzing.nomor_undangan}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  &bull; {aanwijzing.kategori_nilai === "DI_ATAS_1M" ? "Proyek > 1M (Tender)" : "Proyek < 1M (Direct)"}
                </span>
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight truncate">
                {project.kode ? `${project.kode} — ` : ""}
                {project.nama_proyek || "Proyek Bangunan DC"}
              </DialogTitle>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDownloadPdf()}
              disabled={downloadingPdf}
              className="rounded-xl border-slate-200 text-xs font-semibold h-9 px-3.5 flex items-center gap-1.5 shadow-2xs hover:bg-slate-50 cursor-pointer"
            >
              {downloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#E65F2B]" />
              ) : (
                <Eye className="w-4 h-4 text-[#E65F2B]" />
              )}
              Lihat PDF
            </Button>

            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <DialogDescription className="sr-only">
          Rincian dokumen surat undangan rapat penjelasan pekerjaan (Aanwijzing), spesifikasi proyek, quorum rekanan kontraktor, dan riwayat aktivitas.
        </DialogDescription>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs space-y-5 bg-[#FAFAFA]">
          {/* BANNER KHUSUS KONTRAKTOR JIKA PERLU RESPON */}
          {myContractorPeserta && myContractorPeserta.status_konfirmasi === "MENUNGGU_RESPON" && (
            <div className="p-4 bg-orange-50 border border-orange-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <p className="text-xs font-bold text-orange-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-[#E65F2B]" />
                  Perusahaan Anda Diundang dalam Aanwijzing Ini
                </p>
                <p className="text-[11.5px] text-orange-800/90 mt-0.5">
                  Mohon berikan konfirmasi kesediaan hadir sebelum batas waktu 2x24 JAM (Hari ke-2 pukul 24:00 WIB) berakhir.
                </p>
              </div>
              {onOpenKonfirmasi && (
                <Button
                  type="button"
                  onClick={() => onOpenKonfirmasi(myContractorPeserta.id)}
                  className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs font-bold rounded-xl h-9 px-4 cursor-pointer shadow-sm"
                >
                  Konfirmasi Kehadiran
                </Button>
              )}
            </div>
          )}

          {/* TIMER COUNTDOWN 48 JAM (Aktif jika MENUNGGU_KONFIRMASI) */}
          {aanwijzing.status === "MENUNGGU_KONFIRMASI" && (
            <div className="p-4 bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-amber-50/80 border border-amber-200/90 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-amber-200 text-[#E65F2B] flex items-center justify-center shrink-0 shadow-2xs">
                  <Timer className="w-5 h-5 text-[#E65F2B]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Batas Waktu Respon Kontraktor (2x24 JAM)
                  </p>
                  <p className="text-[11.5px] text-slate-600 mt-0.5">
                    Deadline:{" "}
                    <span className="font-semibold text-slate-800">
                      {new Date(aanwijzing.deadline_konfirmasi).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      WIB
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {timeLeft.isExpired ? (
                  <span className="px-3.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold shadow-2xs flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    Waktu Konfirmasi Berakhir
                  </span>
                ) : (
                  <div className="flex items-center gap-2.5 bg-white px-3.5 py-2 rounded-xl border border-amber-200/90 shadow-2xs">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Sisa Waktu
                    </span>
                    <div className="flex items-center gap-1 font-mono text-sm font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-amber-100/70 text-amber-900 border border-amber-200/80">
                        {String(timeLeft.hours).padStart(2, "0")}
                      </span>
                      <span className="text-amber-500 font-sans">:</span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-100/70 text-amber-900 border border-amber-200/80">
                        {String(timeLeft.minutes).padStart(2, "0")}
                      </span>
                      <span className="text-amber-500 font-sans">:</span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-100/70 text-amber-900 border border-amber-200/80">
                        {String(timeLeft.seconds).padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Panel 1: Spesifikasi & Informasi Proyek */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100">
            <div className="p-4 sm:p-5">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3.5">
                Spesifikasi & Informasi Proyek
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Cabang</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                    {project.cabang || aanwijzing.cabang || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Nilai Proyek / Anggaran</span>
                  <span className="text-sm font-bold text-[#E65F2B] mt-0.5 block font-mono">
                    {renovasi?.grand_total ? formatRupiah(Number(renovasi.grand_total)) : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Ref. Penawaran RAB</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block font-mono">
                    {renovasi?.nomor_pengajuan || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Ref. Proposal Tender</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block font-mono">
                    {tender?.nomor_tender || (aanwijzing.kategori_nilai === "DI_ATAS_1M" ? "Dalam Proses" : "Tanpa Tender (<1M)")}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Kategori Aanwijzing</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                    {aanwijzing.kategori_nilai === "DI_ATAS_1M" ? "Proyek > 1M" : "Proyek < 1M"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-slate-50/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-slate-400">Diterbitkan oleh:</span>
                  <span className="font-semibold text-slate-800">{aanwijzing.created_by || "-"}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">Waktu Terbit:</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {formatDate(aanwijzing.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Panel 2: Jadwal & Lokasi Pelaksanaan Aanwijzing */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100">
            <div className="p-4 sm:p-5">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3.5">
                Jadwal & Lokasi Pelaksanaan Aanwijzing
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-[#E65F2B] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Hari / Tanggal</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                      {new Date(aanwijzing.tanggal_pelaksanaan).toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-[#E65F2B] flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Waktu Pelaksanaan</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                      {aanwijzing.waktu_pelaksanaan}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#E65F2B] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[11px] text-slate-400 block font-medium">Tempat / Lokasi Proyek</span>
                    <span className="text-xs font-semibold text-slate-800 mt-0.5 block leading-relaxed">
                      {aanwijzing.lokasi}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Panel 3: SubmissionReasonCard (Catatan Khusus jika ada) */}
          {aanwijzing.catatan && (
            <SubmissionReasonCard
              reason={aanwijzing.catatan}
              title="Catatan Khusus Pelaksanaan Aanwijzing"
            />
          )}

          {/* Panel 4: Daftar Rekanan Kontraktor Diundang & Status Quorum */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100 overflow-hidden">
            <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#E65F2B]" />
                <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Daftar Kontraktor Diundang ({(aanwijzing.peserta || []).length})
                </h4>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  {hadirList.length} Hadir
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
                  {tidakHadirList.length} Tidak Hadir
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                  {pendingList.length} Menunggu
                </span>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ml-1",
                  pendingList.length > 0
                    ? "bg-amber-100/70 text-amber-800 border-amber-300"
                    : hadirList.length >= 3
                      ? "bg-emerald-100/70 text-emerald-800 border-emerald-300"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                )}>
                  {pendingList.length > 0
                    ? `Menunggu Respon (${pendingList.length})`
                    : hadirList.length >= 3
                      ? "Quorum Terpenuhi (≥3)"
                      : "Belum Quorum (<3)"}
                </span>

                {!isContractor && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleResendEmail()}
                    disabled={resendingEmailId !== null}
                    className="h-7 text-[11px] px-2.5 rounded-lg border-slate-200 hover:bg-slate-50 cursor-pointer ml-1 inline-flex items-center gap-1"
                    title="Kirim ulang email undangan ke semua rekanan"
                  >
                    {resendingEmailId === -1 ? (
                      <Loader2 className="w-3 h-3 animate-spin text-[#E65F2B]" />
                    ) : (
                      <Send className="w-3 h-3 text-[#E65F2B]" />
                    )}
                    Kirim Ulang Semua
                  </Button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4 w-10 text-center">No</th>
                    <th className="py-2.5 px-4">Nama Rekanan Kontraktor</th>
                    <th className="py-2.5 px-4">Email / Kontak</th>
                    <th className="py-2.5 px-4 text-center">Status Email</th>
                    <th className="py-2.5 px-4 text-center">Respon Kehadiran</th>
                    {!isContractor && <th className="py-2.5 px-4 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(isContractor && myContractorPeserta ? [myContractorPeserta] : (aanwijzing.peserta || [])).map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-semibold">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{p.vendor?.nama_perusahaan}</p>
                        {p.vendor?.alamat && (
                          <p className="text-[11px] text-slate-400 truncate max-w-xs">{p.vendor.alamat}</p>
                        )}
                        {p.alasan_tidak_hadir && (
                          <p className="text-[11px] text-rose-600 mt-0.5 font-medium italic">
                            Alasan Menolak: {p.alasan_tidak_hadir}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        <p>{p.email || p.vendor?.email}</p>
                        <p className="text-[10px] text-slate-400 font-sans">{p.vendor?.nomor_telepon || "-"}</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {p.email_sent ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Terkirim
                          </span>
                        ) : p.email_error?.includes("Simulasi") ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200"
                            title={p.email_error}
                          >
                            <AlertCircle className="w-3 h-3 text-amber-600" /> Mode Simulasi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            <Mail className="w-3 h-3" /> Menunggu
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {p.status_konfirmasi === "HADIR" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> HADIR
                          </span>
                        ) : p.status_konfirmasi === "TIDAK_HADIR" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" /> TIDAK HADIR
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                            MENUNGGU
                          </span>
                        )}
                      </td>
                      {!isContractor && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadPdf(p.vendor_id)}
                              title="Lihat / Unduh Surat Khusus Rekanan Ini (Tanpa Nama Rekanan Lain)"
                              className="h-7 px-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer text-[10px] flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-600" />
                              <span className="hidden sm:inline text-[10px]">PDF Rekanan</span>
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResendEmail(p.vendor_id)}
                              disabled={resendingEmailId !== null}
                              title="Kirim ulang email ke rekanan ini"
                              className="h-7 px-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer text-[10px]"
                            >
                              {resendingEmailId === p.vendor_id ? (
                                <Loader2 className="w-3 h-3 animate-spin text-[#E65F2B]" />
                              ) : (
                                <Send className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel 5: ApprovalNotesHistory Reusable Component (Collapsible, default closed) */}
          <ApprovalNotesHistory
            auditLogs={normalizedAuditLogs}
            title="Riwayat Aktivitas & Catatan Evaluasi"
            defaultOpen={false}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200/80 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">SOP SAT/SOP/BM/004 — Penjelasan Pekerjaan (Aanwijzing)</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="rounded-xl border-slate-200 text-xs font-semibold h-9 px-5 hover:bg-slate-50 cursor-pointer"
            >
              Tutup
            </Button>

            {myContractorPeserta &&
              myContractorPeserta.status_konfirmasi === "MENUNGGU_RESPON" &&
              aanwijzing.status === "MENUNGGU_KONFIRMASI" &&
              onOpenKonfirmasi && (
                <Button
                  type="button"
                  onClick={() => onOpenKonfirmasi(myContractorPeserta.id)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl h-9 px-5 cursor-pointer shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Konfirmasi Kehadiran
                </Button>
              )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DetailAanwijzingModal;
