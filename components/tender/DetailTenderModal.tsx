"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Building2,
  Calendar,
  User,
  Clock,
  ExternalLink,
  Loader2,
  X,
  FileSignature,
  FileText,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HardHat,
  Tag,
  Briefcase,
  Users,
  ShieldCheck,
  Layers,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatRupiah, toTitleCase } from "@/lib/utils";
import ApprovalStepper, {
  TENDER_APPROVAL_STEPS_ABOVE_1M,
  TENDER_APPROVAL_STEPS_BELOW_1M,
} from "@/components/approval/ApprovalStepper";
import ApprovalNotesHistory from "@/components/approval/ApprovalNotesHistory";
import SubmissionReasonCard from "@/components/approval/SubmissionReasonCard";

export interface DetailTenderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tender: any | null;
  showApprovalActions?: boolean;
  onApprovalAction?: (action: "APPROVE" | "REVISI" | "TOLAK", item: any) => void;
  userRole?: string | null;
}

export function DetailTenderModal({
  open,
  onOpenChange,
  tender: initialTender,
  showApprovalActions = false,
  onApprovalAction,
  userRole,
}: DetailTenderModalProps) {
  const [activeTab, setActiveTab] = useState<"peserta" | "jadwal">("peserta");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [detailData, setDetailData] = useState<any | null>(null);

  // Ambil detail terbaru dari API saat modal dibuka agar profil vendor & PIC terisi lengkap
  useEffect(() => {
    if (open && initialTender?.id) {
      setDetailData(null);
      fetch(`/api/dc-development/tender/${initialTender.id}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.status === "success" && json.data) {
            setDetailData(json.data);
          }
        })
        .catch((err) => console.error("Gagal memuat detail tender:", err));
    } else if (!open) {
      setDetailData(null);
    }
  }, [open, initialTender?.id]);

  const tender = detailData || initialTender;

  if (!tender) return null;

  const project = tender.project || {};
  const renovasi = tender.renovasi || {};
  const fungsiRuang = tender.fungsi_ruang || {};
  const pesertaList: any[] = tender.peserta || [];
  const scheduleList: any[] = tender.schedule || [];
  const isAbove1M =
    tender.kategori_nilai === "DI_ATAS_1M" || Number(tender.nilai_proyek) > 1_000_000_000;
  const hasPdf =
    tender.status !== "PRAKUALIFIKASI" &&
    tender.status !== "DRAFT" &&
    tender.status !== "REVISI";

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

  const formatScheduleDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    switch (s) {
      case "APPROVED":
        return {
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
          dot: "bg-emerald-500",
        };
      case "MENUNGGU APPROVAL DC SPECIALIST":
      case "MENUNGGU APPROVAL B&M GM":
      case "MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR":
      case "PRAKUALIFIKASI":
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200/80",
          dot: "bg-amber-500",
        };
      case "REVISI":
        return {
          bg: "bg-orange-50 text-orange-800 border-orange-200/80",
          dot: "bg-orange-500",
        };
      case "DITOLAK":
        return {
          bg: "bg-rose-50 text-rose-800 border-rose-200/80",
          dot: "bg-rose-500",
        };
      default:
        return {
          bg: "bg-blue-50 text-blue-800 border-blue-200/80",
          dot: "bg-blue-500",
        };
    }
  };

  const statusInfo = getStatusBadge(tender.status);

  const handleDownloadPdf = async () => {
    if (!tender?.id) return;
    setDownloadingPdf(true);
    try {
      window.open(`/api/dc-development/tender/${tender.id}/pdf`, "_blank");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const isActionable =
    showApprovalActions &&
    tender.status !== "REVISI" &&
    tender.status !== "APPROVED" &&
    tender.status !== "DITOLAK" &&
    tender.status !== "DRAFT" &&
    tender.status !== "SELESAI";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white border border-slate-200/90 shadow-xl rounded-2xl max-h-[90vh] flex flex-col [&>button:last-child]:hidden">
        {/* Header Modal Standar SPARTA */}
        <div className="px-6 py-5 bg-white border-b border-slate-200/80 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 text-[#E65F2B] flex items-center justify-center shrink-0 mt-0.5">
              <FileSignature className="w-5 h-5 text-[#E65F2B]" />
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
                  {tender.status}
                </span>

                <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/70">
                  {tender.nomor_tender}
                </span>

                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${isAbove1M
                    ? "bg-purple-100 text-purple-700 border border-purple-200"
                    : "bg-blue-100 text-blue-700 border border-blue-200"
                    }`}
                >
                  {isAbove1M ? "> Rp 1 Miliar" : "<= Rp 1 Miliar"}
                </span>
              </div>

              <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight truncate">
                {project.kode ? `${project.kode} — ` : ""}
                {project.nama_proyek || "Pengajuan Proposal Tender Proyek DC"}
              </DialogTitle>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer shrink-0 -mr-2 -mt-1"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <DialogDescription className="sr-only">
          Detail Pengajuan Proposal Tender rekanan kontraktor dan konsultan pelaksana proyek renovasi DC.
        </DialogDescription>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs space-y-5 bg-[#FAFAFA]/60">
          {/* Visual Approval Progress Stepper Sesuai Standar SPARTA */}
          <ApprovalStepper
            currentStatus={tender.status}
            steps={isAbove1M ? TENDER_APPROVAL_STEPS_ABOVE_1M : TENDER_APPROVAL_STEPS_BELOW_1M}
            catatanRevisi={
              tender.audit_logs?.find((l: any) => l.action === "REVISI")?.notes || null
            }
          />

          {/* Panel 1: Spesifikasi & Informasi Proyek */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100">
            <div className="p-4 sm:p-5">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3.5">
                Spesifikasi &amp; Informasi Tender
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Cabang / Wilayah</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                    {tender.cabang || project.cabang || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Grand Total Projek</span>
                  <span className="text-sm font-bold text-[#E65F2B] mt-0.5 block font-mono">
                    {formatRupiah(tender.nilai_proyek)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Ref. Dokumen PFR</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block font-mono">
                    {fungsiRuang.nomor_pengajuan || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Ref. Penawaran RAB</span>
                  <span className="text-sm font-bold text-slate-900 mt-0.5 block font-mono">
                    {renovasi.nomor_pengajuan || "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-slate-50/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">Dibuat oleh:</span>
                  <span className="font-semibold text-slate-800">{tender.created_by || "-"}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400">Waktu Pengajuan:</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {formatDate(tender.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Panel 2: Catatan Pengantar Pra-Kualifikasi (Maker) & Catatan Evaluasi Kualifikasi */}
          {tender.catatan_maker && (
            <SubmissionReasonCard
              reason={tender.catatan_maker}
              title="Catatan Pengantar Pra-Kualifikasi (Maker)"
            />
          )}

          {(tender as any).catatan_kualifikasi && (
            <SubmissionReasonCard
              reason={(tender as any).catatan_kualifikasi}
              title="Catatan Evaluasi / Ringkasan Kualifikasi"
            />
          )}

          {/* Panel 3: Tab Peserta Rekanan & Jadwal Pelaksanaan */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="flex items-center space-x-2 border-b border-slate-200/80 px-4 pt-3 pb-2 text-xs font-semibold bg-slate-50/50">
              <button
                type="button"
                onClick={() => setActiveTab("peserta")}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg transition-all cursor-pointer font-bold",
                  activeTab === "peserta"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                Peserta Rekanan ({pesertaList.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("jadwal")}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg transition-all cursor-pointer font-bold",
                  activeTab === "jadwal"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                )}
              >
                Jadwal Timeline ({scheduleList.length})
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5">
              {/* TAB PESERTA REKANAN */}
              {activeTab === "peserta" && (
                <div className="space-y-3.5">
                  {pesertaList.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl">
                      Belum ada rekanan peserta yang terdaftar pada pengajuan ini.
                    </div>
                  ) : (
                    pesertaList.map((p: any, idx: number) => {
                      const vendor = p.vendor || {};
                      const isKontraktor =
                        p.peran === "MAIN_KONTRAKTOR" || p.peran === "KONTRAKTOR";
                      const isLolos = p.status_tahap === "LOLOS_KUALIFIKASI";
                      const isTidakLolos = p.status_tahap === "TIDAK_LOLOS";
                      const isBesar = vendor.golongan === "BESAR";
                      const pic = vendor.pic_user || (vendor.pic_users && vendor.pic_users[0]);

                      return (
                        <div
                          key={p.id || vendor.id || idx}
                          className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all space-y-3 shadow-2xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5">
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono shrink-0">
                                #{idx + 1}
                              </span>
                              <h5 className="font-extrabold text-xs md:text-sm text-slate-900 truncate">
                                {vendor.nama_perusahaan || "Nama Perusahaan Rekanan"}
                              </h5>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase shrink-0">
                                {p.peran}
                              </span>
                              {vendor.golongan && (
                                <span
                                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0 ${isBesar
                                    ? "bg-purple-100 text-purple-700 border border-purple-200"
                                    : "bg-blue-100 text-blue-700 border border-blue-200"
                                    }`}
                                >
                                  GOLONGAN {vendor.golongan}
                                </span>
                              )}
                            </div>

                            <span
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 ${isLolos
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : isTidakLolos
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}
                            >
                              {isLolos ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>LOLOS KUALIFIKASI</span>
                                </>
                              ) : isTidakLolos ? (
                                <>
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  <span>TIDAK LOLOS</span>
                                </>
                              ) : (
                                <span>PRAKUALIFIKASI</span>
                              )}
                            </span>
                          </div>

                          {/* Grid 3 Kolom Info Kontak, Alamat & Akun PIC */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                            <div className="p-3 rounded-lg bg-slate-50/70 border border-slate-100 space-y-0.5">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" /> Kontak Kantor
                              </span>
                              <p className="font-semibold text-slate-800 text-xs">
                                {vendor.nomor_telepon || "-"}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {vendor.email || "-"}
                              </p>
                            </div>

                            <div className="p-3 rounded-lg bg-slate-50/70 border border-slate-100 space-y-0.5">
                              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400" /> Alamat &amp; Domisili
                              </span>
                              <p className="text-xs text-slate-700 leading-relaxed line-clamp-2">
                                {vendor.alamat || "Alamat kantor tercatat"}
                              </p>
                              <p className="text-[11px] text-slate-500 font-medium">
                                Cabang: <strong className="text-slate-700">{vendor.cabang || "-"}</strong>
                              </p>
                            </div>

                            <div className="p-3 rounded-lg bg-slate-50/70 border border-slate-100 space-y-0.5">
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
                                <p className="text-[11px] text-slate-400 italic">
                                  Belum ada akun PIC terhubung
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Catatan Tidak Lolos jika ada */}
                          {isTidakLolos && p.alasan_tidak_lolos && (
                            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs">
                              <span className="text-[10px] uppercase font-bold text-rose-700 flex items-center gap-1 mb-0.5">
                                <AlertTriangle className="w-3 h-3 text-rose-600" /> Alasan Tidak Lolos:
                              </span>
                              <p className="text-rose-900 italic font-medium">
                                "{p.alasan_tidak_lolos}"
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB JADWAL PELAKSANAAN */}
              {activeTab === "jadwal" && (
                <div className="space-y-6">
                  {scheduleList.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      Belum ada timeline jadwal yang ditetapkan untuk tender ini.
                    </div>
                  ) : (
                    (() => {
                      const stages = [
                        {
                          id: "TENDER",
                          number: 1,
                          title: "Tahap 1: Pelaksanaan Tender",
                          description:
                            "Rangkaian Aanwijzing, Penawaran Harga, Negosiasi & Penerbitan SPK",
                          subcategories: [
                            {
                              key: "TENDER_MAIN_KONTRAKTOR",
                              title: "Tender Kontraktor",
                              icon: Building2,
                              badge: "Wajib",
                              badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
                              accentBorder: "border-blue-200",
                            },
                            {
                              key: "TENDER_KONSULTAN_PENGAWAS",
                              title: "Tender Konsultan Pengawas (MK)",
                              icon: Users,
                              badge: "Konsultan MK",
                              badgeColor: "bg-purple-100 text-purple-700 border-purple-200",
                              accentBorder: "border-purple-200",
                            },
                            {
                              key: "TENDER_KONSULTAN_PERENCANA",
                              title: "Tender Konsultan Perencana",
                              icon: Layers,
                              badge: "Konsultan Desain",
                              badgeColor: "bg-cyan-100 text-cyan-700 border-cyan-200",
                              accentBorder: "border-cyan-200",
                            },
                          ],
                        },
                        {
                          id: "KONSTRUKSI",
                          number: 2,
                          title: "Tahap 2: Pelaksanaan Konstruksi & Pengawasan Fisik",
                          description:
                            "Pelaksanaan Pekerjaan Lapangan, Supervisi Mutu, Monitoring Progress & Serah Terima PHO",
                          subcategories: [
                            {
                              key: "KONSTRUKSI_MAIN_KONTRAKTOR",
                              title: "Pekerjaan Konstruksi Kontraktor",
                              icon: HardHat,
                              badge: "Konstruksi Fisik",
                              badgeColor: "bg-orange-100 text-[#E65F2B] border-orange-200",
                              accentBorder: "border-orange-200",
                            },
                            {
                              key: "KONSTRUKSI_KONSULTAN_PENGAWAS",
                              title: "Pengawasan Fisik Konsultan Pengawas (MK)",
                              icon: ShieldCheck,
                              badge: "Supervisi MK",
                              badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
                              accentBorder: "border-emerald-200",
                            },
                            {
                              key: "KONSTRUKSI_KONSULTAN_PERENCANA",
                              title: "Supervisi Desain Konsultan Perencana",
                              icon: FileText,
                              badge: "Supervisi Desain",
                              badgeColor: "bg-teal-100 text-teal-700 border-teal-200",
                              accentBorder: "border-teal-200",
                            },
                          ],
                        },
                      ];

                      return stages.map((stage) => {
                        const activeSubcategories = stage.subcategories.filter((sub) => {
                          return scheduleList.some((s: any) => {
                            const cat = s.kategori_jadwal || "TENDER_MAIN_KONTRAKTOR";
                            if (cat === sub.key) return true;
                            if (
                              sub.key === "TENDER_MAIN_KONTRAKTOR" &&
                              !cat.startsWith("KONSTRUKSI") &&
                              !cat.includes("KONSULTAN")
                            ) {
                              return true;
                            }
                            if (
                              sub.key === "KONSTRUKSI_MAIN_KONTRAKTOR" &&
                              cat.startsWith("KONSTRUKSI") &&
                              !cat.includes("KONSULTAN")
                            ) {
                              return true;
                            }
                            return false;
                          });
                        });

                        if (activeSubcategories.length === 0) return null;

                        return (
                          <div key={stage.id} className="space-y-3.5">
                            <div className="flex items-center gap-2.5 px-1">
                              <div className="w-6 h-6 rounded-lg bg-orange-50 border border-orange-200 text-[#E65F2B] flex items-center justify-center font-bold text-xs shrink-0">
                                {stage.number}
                              </div>
                              <div>
                                <h4 className="text-xs md:text-sm font-extrabold text-slate-900">
                                  {stage.title}
                                </h4>
                                <p className="text-[11px] text-slate-500">
                                  {stage.description}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              {activeSubcategories.map((sub) => {
                                const items = scheduleList.filter((s: any) => {
                                  const cat = s.kategori_jadwal || "TENDER_MAIN_KONTRAKTOR";
                                  if (cat === sub.key) return true;
                                  if (
                                    sub.key === "TENDER_MAIN_KONTRAKTOR" &&
                                    !cat.startsWith("KONSTRUKSI") &&
                                    !cat.includes("KONSULTAN")
                                  ) {
                                    return true;
                                  }
                                  if (
                                    sub.key === "KONSTRUKSI_MAIN_KONTRAKTOR" &&
                                    cat.startsWith("KONSTRUKSI") &&
                                    !cat.includes("KONSULTAN")
                                  ) {
                                    return true;
                                  }
                                  return false;
                                });

                                const SubIcon = sub.icon;

                                return (
                                  <div
                                    key={sub.key}
                                    className={cn(
                                      "bg-white rounded-xl border p-4 shadow-2xs space-y-2.5",
                                      sub.accentBorder
                                    )}
                                  >
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                      <div className="flex items-center space-x-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                                          <SubIcon className="w-3.5 h-3.5 text-slate-700" />
                                        </div>
                                        <h5 className="font-bold text-xs text-slate-800">
                                          {sub.title}
                                        </h5>
                                      </div>
                                      <span
                                        className={cn(
                                          "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                          sub.badgeColor
                                        )}
                                      >
                                        {sub.badge}
                                      </span>
                                    </div>

                                    <div className="space-y-2 pt-1">
                                      {items.map((s: any, idx: number) => {
                                        const durasi =
                                          s.tanggal_mulai && s.tanggal_selesai
                                            ? Math.ceil(
                                              Math.abs(
                                                new Date(s.tanggal_selesai).getTime() -
                                                new Date(s.tanggal_mulai).getTime()
                                              ) /
                                              (1000 * 60 * 60 * 24)
                                            ) + 1
                                            : null;

                                        return (
                                          <div
                                            key={s.id || idx}
                                            className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50 transition-colors"
                                          >
                                            <div className="flex items-start space-x-2.5 min-w-0">
                                              <span className="w-5 h-5 rounded-md bg-white border border-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                                {idx + 1}
                                              </span>
                                              <div className="min-w-0">
                                                <h6 className="font-bold text-xs text-slate-900 truncate">
                                                  {toTitleCase(s.nama_kegiatan)}
                                                </h6>
                                                {s.keterangan && (
                                                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                                    {toTitleCase(s.keterangan)}
                                                  </p>
                                                )}
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-2 text-[11px] font-mono bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shrink-0 self-start sm:self-auto">
                                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                              <span className="font-semibold text-slate-700">
                                                {formatScheduleDate(s.tanggal_mulai)}
                                              </span>
                                              <span className="text-slate-400">s/d</span>
                                              <span className="font-semibold text-slate-700">
                                                {formatScheduleDate(s.tanggal_selesai)}
                                              </span>
                                              {durasi && (
                                                <span className="ml-1 text-[10px] font-sans font-bold px-1.5 py-0.2 rounded bg-orange-50 text-[#E65F2B] border border-orange-200">
                                                  {durasi} Hari
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Panel 4: Riwayat Persetujuan & Catatan Reviewer (Komponen Reusable Collapsible) */}
          <ApprovalNotesHistory
            data={tender}
            auditLogs={tender.audit_logs}
          />
        </div>

        {/* Footer Actions Standar SPARTA (Fixed di Bawah dengan Aksi Approval) */}
        <div className="px-6 py-3.5 bg-slate-50/90 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 shrink-0 backdrop-blur-xs">
          <div className="flex items-center gap-2.5">
            {hasPdf ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="rounded-xl text-xs h-9 px-3.5 border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-bold cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
                title="Lihat Dokumen PDF di Tab Baru"
              >
                {downloadingPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E65F2B]" />
                    <span>Mempersiapkan PDF...</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-3.5 h-3.5 text-[#E65F2B]" />
                    <span>Lihat PDF</span>
                  </>
                )}
              </Button>
            ) : null}

            {isActionable ? (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-800 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80">
                <ShieldCheck className="w-3.5 h-3.5 text-[#E65F2B] shrink-0" />
                <span>Menunggu Keputusan Anda {userRole ? `(${userRole})` : ""}</span>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Mode Peninjau (Read Only)</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {isActionable && onApprovalAction && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onApprovalAction("REVISI", tender)}
                  className="rounded-xl text-xs h-9 px-4 border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-orange-600" />
                  <span>Kembalikan Revisi</span>
                </Button>

                <Button
                  type="button"
                  onClick={() => onApprovalAction("APPROVE", tender)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 px-5 font-bold shadow-md shadow-emerald-600/20 cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Setujui (Approve)</span>
                </Button>
              </>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs h-9 px-4 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer font-semibold"
            >
              Tutup
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DetailTenderModal;
