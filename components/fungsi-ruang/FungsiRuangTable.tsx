"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Eye,
  Trash2,
  AlertCircle,
  Plus,
  LayoutGrid,
  Building2,
  Calendar,
  User,
  Tag,
  Edit3,
  Printer,
  FileText,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";
import { isApprovalAdmin, isSameCreator, canManageFungsiRuang } from "@/lib/permissions";

interface FungsiRuangTableProps {
  list: any[];
  loading: boolean;
  error: string | null;
  onView: (item: any) => void;
  onDelete?: (item: any) => void;
  canEdit?: boolean;
}

export default function FungsiRuangTable({
  list,
  loading,
  error,
  onView,
  onDelete,
  canEdit = true,
}: FungsiRuangTableProps) {
  const { user } = useSession();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleViewPdf = async (item: any) => {
    setDownloadingId(item.id);
    try {
      const res = await fetch(`/api/dc-development/fungsi-ruang/${item.id}/download-pdf`);
      const json = await res.json();
      if (json.status === "success" && json.data?.file_url) {
        window.open(json.data.file_url, "_blank", "noopener,noreferrer");
      } else {
        window.open(`/api/dc-development/fungsi-ruang/${item.id}/pdf`, "_blank");
      }
    } catch {
      window.open(`/api/dc-development/fungsi-ruang/${item.id}/pdf`, "_blank");
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-16 text-center min-h-[300px]">
        <div className="w-9 h-9 border-3 border-[#E65F2B] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500 animate-pulse">Memuat data pengajuan fungsi ruang...</p>
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

  if (!list.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-16 text-center min-h-[360px]">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#E65F2B] flex items-center justify-center mb-3.5 shadow-2xs">
          <LayoutGrid className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 tracking-tight">
          Belum Ada Pengajuan Fungsi Ruang
        </h3>
        <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
          Seluruh pengajuan perubahan, pengurangan, dan penambahan fungsi ruang pada DC/Warehouse/Office existing akan tercatat di sini.
        </p>

        {canEdit ? (
          <Link href="/dc-development/fungsi-ruang/tambah" className="mt-5">
            <Button className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md shadow-[#E65F2B]/20 cursor-pointer">
              <Plus className="w-4 h-4 mr-1.5" />
              Mulai Pengajuan Baru
            </Button>
          </Link>
        ) : (
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200/80 text-slate-600 text-[11px] font-medium">
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span>Mode Peninjau: Pengajuan baru dapat dibuat oleh Branch Building & Maintenance Manager atau Admin.</span>
          </div>
        )}
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-emerald-50 text-emerald-800 border-emerald-200/80";
      case "MENUNGGU APPROVAL BM/DBM":
        return "bg-amber-50 text-amber-800 border-amber-200/80";
      case "MENUNGGU APPROVAL REGIONAL B&M MANAGER":
      case "MENUNGGU APPROVAL DC SPECIALIST":
      case "MENUNGGU APPROVAL B&M GM":
      case "MENUNGGU APPROVAL OPERATION DIRECTOR":
      case "MENUNGGU APPROVAL PROPERTY DEV DIRECTOR":
        return "bg-blue-50 text-blue-800 border-blue-200/80";
      case "REVISI":
        return "bg-orange-50 text-orange-800 border-orange-200/80";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200/80";
    }
  };

  const getJenisBadgeColor = (jenis: string) => {
    if (jenis.includes("Penambahan")) return "bg-purple-50 text-purple-700 border-purple-200";
    if (jenis.includes("Pengurangan")) return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-cyan-50 text-cyan-700 border-cyan-200";
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <th className="py-3 px-4">No. Pengajuan & Tanggal</th>
            <th className="py-3 px-4">Pemohon</th>
            <th className="py-3 px-4">Proyek & Lokasi</th>
            <th className="py-3 px-4">Jenis Pengajuan</th>
            <th className="py-3 px-4 text-center">Status</th>
            <th className="py-3 px-4 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.map((item) => {
            const isMaker = (canManageFungsiRuang(user?.role) && isSameCreator(user, item.created_by)) || isSameCreator(user, item.created_by);
            const isAdmin = isApprovalAdmin(user?.role);
            const canDeleteItem = (isMaker || isAdmin) && item.status === "REVISI";
            const canResubmit = (isMaker || isAdmin) && item.status === "REVISI";

            return (
              <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                {/* No. Pengajuan & Tanggal */}
                <td className="py-3 px-4">
                  <div className="font-extrabold text-slate-900 group-hover:text-[#E65F2B] transition-colors">
                    {item.nomor_pengajuan}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 font-medium">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </td>

                {/* Pemohon */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{item.nama_pemohon}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {item.jabatan} &bull; <span className="text-slate-400">{item.departemen || item.divisi}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {item.email_pemohon}
                  </div>
                </td>

                {/* Proyek & Lokasi */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Building2 className="w-3.5 h-3.5 text-[#E65F2B] shrink-0" />
                    <span>{item.project?.nama_proyek || "Proyek DC"}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Cabang: <span className="font-semibold text-slate-700">{item.project?.cabang || item.renovasi?.cabang || "-"}</span> &bull; Tipe: <span className="font-semibold text-slate-700">{item.project?.tipe || "-"}</span>
                  </div>
                  {item.renovasi?.nomor_pengajuan && (
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Ref RAB: {item.renovasi.nomor_pengajuan}
                    </div>
                  )}
                </td>

                {/* Jenis Pengajuan */}
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${getJenisBadgeColor(item.jenis_pengajuan)}`}>
                    <Tag className="w-3 h-3" />
                    <span>{item.jenis_pengajuan}</span>
                  </span>
                </td>

                {/* Status */}
                <td className="py-3 px-4 text-center">
                  <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${getStatusBadge(item.status)}`}>
                    {item.status}
                  </span>
                </td>

                {/* Aksi */}
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {canResubmit && (
                      <Link href={`/dc-development/fungsi-ruang/${item.id}/edit`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 rounded-lg border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-400 font-bold text-xs shadow-2xs"
                        >
                          <Edit3 className="w-3.5 h-3.5 mr-1 text-amber-700" />
                          Perbaiki
                        </Button>
                      </Link>
                    )}

                    {/* Tombol Detail & Lihat PDF disembunyikan saat status REVISI sesuai instruksi user */}
                    {item.status !== "REVISI" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onView(item)}
                          className="h-8 px-2.5 rounded-lg border-slate-200 text-slate-700 hover:text-[#E65F2B] hover:border-[#E65F2B] font-semibold text-xs shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Detail
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloadingId === item.id}
                          onClick={() => handleViewPdf(item)}
                          className="h-8 px-2.5 rounded-lg border-slate-200 text-slate-700 hover:text-[#E65F2B] hover:border-[#E65F2B] font-semibold text-xs shadow-2xs cursor-pointer flex items-center gap-1.5"
                          title="Lihat Dokumen PDF di Google Drive"
                        >
                          {downloadingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E65F2B]" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-[#E65F2B]" />
                          )}
                          <span>Lihat PDF</span>
                        </Button>
                      </>
                    )}


                    {canDeleteItem && onDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(item)}
                        className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 shadow-2xs transition-colors"
                        title="Hapus Pengajuan (Hanya status REVISI)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
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
