"use client";

import React from "react";
import {
  Building2,
  FileSignature,
  Eye,
  Edit3,
  Trash2,
  Calendar,
  User,
  FileText,
  AlertCircle,
  Plus,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/utils";
import { isApprovalAdmin, isSameCreator } from "@/lib/permissions";

interface DaftarTenderTableProps {
  tenders: any[];
  loading: boolean;
  error?: string | null;
  user: any;
  canCreate?: boolean;
  onNewPengajuan?: () => void;
  onViewDetail: (tender: any) => void;
  onEditRevisi?: (tender: any) => void;
  onDelete?: (tender: any) => void;
  onRefresh?: () => void;
  onProcessKualifikasi?: (tender: any) => void;
}

export function DaftarTenderTable({
  tenders,
  loading,
  error,
  user,
  canCreate = true,
  onNewPengajuan,
  onViewDetail,
  onEditRevisi,
  onDelete,
  onProcessKualifikasi,
}: DaftarTenderTableProps) {
  const isAdmin = isApprovalAdmin(user?.role);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
      case "SELESAI":
        return "bg-emerald-50 text-emerald-800 border-emerald-200/80";
      case "MENUNGGU APPROVAL DC SPECIALIST":
        return "bg-amber-50 text-amber-800 border-amber-200/80";
      case "MENUNGGU APPROVAL B&M GM":
      case "MENUNGGU APPROVAL PROPERTY & DEV DIRECTOR":
        return "bg-blue-50 text-blue-800 border-blue-200/80";
      case "REVISI":
        return "bg-orange-50 text-orange-800 border-orange-200/80";
      case "DITOLAK":
        return "bg-rose-50 text-rose-800 border-rose-200/80";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200/80";
    }
  };

  const handleViewPdf = async (tender: any) => {
    try {
      const res = await fetch(`/api/dc-development/tender/${tender.id}/download-pdf`);
      const json = await res.json();
      if (json.status === "success" && json.data?.file_url) {
        window.open(json.data.file_url, "_blank", "noopener,noreferrer");
      } else {
        window.open(`/api/dc-development/tender/${tender.id}/pdf`, "_blank");
      }
    } catch {
      window.open(`/api/dc-development/tender/${tender.id}/pdf`, "_blank");
    }
  };

  // Sesuai aturan GEMINI.md: Dokumen REVISI hanya boleh dilihat oleh pembuat asli dan admin
  const visibleTenders = tenders.filter((t) => {
    if (t.status === "REVISI") {
      return isAdmin || isSameCreator(user, t.created_by);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-16 text-center min-h-[300px]">
        <div className="w-9 h-9 border-3 border-[#E65F2B] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500 animate-pulse">
          Memuat data Pengajuan Proposal Tender...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[300px]">
        <div className="bg-rose-50/80 p-6 rounded-2xl border border-rose-200/80 flex flex-col items-center max-w-sm text-center shadow-2xs">
          <AlertCircle className="w-6 h-6 text-rose-600 mb-2" />
          <p className="text-rose-900 font-bold mb-1 text-sm">Gagal Memuat Data</p>
          <p className="text-rose-600/90 text-xs leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  if (!visibleTenders.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-16 text-center min-h-[360px]">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#E65F2B] flex items-center justify-center mb-3.5 shadow-2xs">
          <FileSignature className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 tracking-tight">
          Belum Ada Pengajuan Proposal Tender
        </h3>
        <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
          Seluruh berkas pengajuan kontraktor dan konsultan pelaksana proyek renovasi DC berdasarkan dokumen PFR yang telah disetujui akan tercatat di sini.
        </p>

        {canCreate ? (
          <Button
            onClick={onNewPengajuan}
            className="mt-5 bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md shadow-[#E65F2B]/20 cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Mulai Pengajuan Baru
          </Button>
        ) : (
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200/80 text-slate-600 text-[11px] font-medium">
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span>Mode Peninjau: Pengajuan baru dapat dibuat oleh DC Specialist atau Branch B&M Manager.</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <th className="py-3 px-4">No. Tender &amp; Tanggal</th>
            <th className="py-3 px-4">Maker / Pemohon</th>
            <th className="py-3 px-4">Proyek &amp; Lokasi</th>
            <th className="py-3 px-4">Pagu &amp; Peserta Rekanan</th>
            <th className="py-3 px-4 text-center">Status</th>
            <th className="py-3 px-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visibleTenders.map((tender) => {
            const isRevisi = tender.status === "REVISI";
            const isCreator = isSameCreator(user, tender.created_by);
            const canDelete = isRevisi || tender.status === "PRAKUALIFIKASI" || tender.status === "DRAFT";
            const hasPdf = tender.status !== "PRAKUALIFIKASI" && tender.status !== "DRAFT" && !isRevisi;

            const pesertaKontraktor = (tender.peserta || []).filter(
              (p: any) => p.peran === "MAIN_KONTRAKTOR"
            );
            const pesertaKonsultan = (tender.peserta || []).filter(
              (p: any) => p.peran.includes("KONSULTAN")
            );

            return (
              <tr key={tender.id} className="hover:bg-slate-50/70 transition-colors group">
                {/* No. Tender & Tanggal */}
                <td className="py-3 px-4">
                  <div className="font-extrabold text-slate-900 group-hover:text-[#E65F2B] transition-colors">
                    {tender.nomor_tender}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 font-medium">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{formatDate(tender.created_at)}</span>
                  </div>
                </td>

                {/* Maker / Pemohon */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{tender.created_by ? tender.created_by.split("@")[0] : "Maker"}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {tender.kategori_nilai === "DI_ATAS_1M" ? "DC Specialist (HO)" : "Branch B&M Manager"}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {tender.created_by}
                  </div>
                </td>

                {/* Proyek & Lokasi */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Building2 className="w-3.5 h-3.5 text-[#E65F2B] shrink-0" />
                    <span>{tender.project?.nama_proyek || "Proyek DC"}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Cabang:{" "}
                    <span className="font-semibold text-slate-700">
                      {tender.cabang || tender.project?.cabang || "-"}
                    </span>
                    {tender.project?.kode && (
                      <>
                        {" "}
                        &bull; Kode:{" "}
                        <span className="font-semibold text-slate-700">{tender.project.kode}</span>
                      </>
                    )}
                  </div>
                  {tender.fungsi_ruang?.nomor_pengajuan && (
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Ref PFR: {tender.fungsi_ruang.nomor_pengajuan}
                    </div>
                  )}
                </td>

                {/* Pagu & Peserta Rekanan */}
                <td className="py-3 px-4">
                  <div className="font-extrabold text-slate-900">
                    {formatRupiah(tender.nilai_proyek)}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${tender.kategori_nilai === "DI_ATAS_1M"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                    >
                      {tender.kategori_nilai === "DI_ATAS_1M" ? "> Rp 1 Miliar" : "<= Rp 1 Miliar"}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">
                      {pesertaKontraktor.length} Kontraktor
                      {pesertaKonsultan.length > 0 && ` + ${pesertaKonsultan.length} Konsultan`}
                    </span>
                  </div>
                </td>

                {/* Status */}
                <td className="py-3 px-4 text-center">
                  <span
                    className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${getStatusBadge(
                      tender.status
                    )}`}
                  >
                    {tender.status}
                  </span>
                </td>

                {/* Aksi */}
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Jika REVISI: Sesuai aturan GEMINI.md, sembunyikan Detail & PDF, munculkan Perbaiki & Hapus */}
                    {isRevisi ? (
                      <>
                        {onEditRevisi && (isCreator || isAdmin) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEditRevisi(tender)}
                            className="h-8 px-2.5 rounded-lg border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-400 font-bold text-xs shadow-2xs"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1 text-amber-700" />
                            Perbaiki
                          </Button>
                        )}
                        {onDelete && (isCreator || isAdmin) && (
                          <button
                            onClick={() => onDelete(tender)}
                            title="Batalkan Pengajuan"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {onProcessKualifikasi &&
                          (tender.status === "PRAKUALIFIKASI" || tender.status === "DRAFT") && (
                            <Button
                              size="sm"
                              onClick={() => onProcessKualifikasi(tender)}
                              className="h-8 px-3 rounded-lg bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                            >
                              <ClipboardCheck className="w-3.5 h-3.5 mr-1" />
                              Proses Kualifikasi
                            </Button>
                          )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewDetail(tender)}
                          className="h-8 px-2.5 rounded-lg border-slate-200 text-slate-700 hover:text-[#E65F2B] hover:border-[#E65F2B] font-semibold text-xs shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Detail
                        </Button>

                        {hasPdf && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewPdf(tender)}
                            className="h-8 px-2.5 rounded-lg border-slate-200 text-slate-700 hover:text-[#E65F2B] hover:border-[#E65F2B] font-semibold text-xs shadow-2xs"
                          >
                            <FileText className="w-3.5 h-3.5 mr-1 text-[#E65F2B]" />
                            Lihat PDF
                          </Button>
                        )}

                        {canDelete && (isCreator || isAdmin) && onDelete && (
                          <button
                            onClick={() => onDelete(tender)}
                            title="Hapus Draft"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
