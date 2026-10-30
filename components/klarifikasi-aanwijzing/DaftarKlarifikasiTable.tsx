"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  Eye,
  FileDown,
  RefreshCw,
  Building2,
  Calendar,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Layers,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isSameCreator, isApprovalAdmin } from "@/lib/permissions";

interface DaftarKlarifikasiTableProps {
  items: any[];
  loading: boolean;
  currentUser: any;
  onViewDetail: (item: any) => void;
  onDelete?: (item: any) => void;
  onNewKlarifikasi?: () => void;
}

export function DaftarKlarifikasiTable({
  items,
  loading,
  currentUser,
  onViewDetail,
  onDelete,
  onNewKlarifikasi,
}: DaftarKlarifikasiTableProps) {
  const [loadingPdfId, setLoadingPdfId] = React.useState<number | null>(null);

  const handleOpenPdf = async (item: any) => {
    if (!item?.id) return;
    const directUrl = item.file_url;
    if (directUrl && (directUrl.startsWith("http://") || directUrl.startsWith("https://"))) {
      window.open(directUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setLoadingPdfId(item.id);
    try {
      const res = await fetch(`/api/dc-development/klarifikasi-aanwijzing/${item.id}/download-pdf`);
      const json = await res.json();
      if (json.status === "success" && json.data?.file_url) {
        window.open(json.data.file_url, "_blank", "noopener,noreferrer");
      } else {
        window.open(`/api/dc-development/klarifikasi-aanwijzing/${item.id}/pdf`, "_blank");
      }
    } catch {
      window.open(`/api/dc-development/klarifikasi-aanwijzing/${item.id}/pdf`, "_blank");
    } finally {
      setLoadingPdfId(null);
    }
  };

  const roleUpper = (currentUser?.role || "").toUpperCase();
  const isAdmin = isApprovalAdmin(roleUpper);

  const statusBadges: Record<string, { label: string; cls: string }> = {
    DRAFT: {
      label: "Draft",
      cls: "bg-slate-100 text-slate-700 border-slate-200",
    },
    MENUNGGU_APPROVAL_BBM_MANAGER: {
      label: "Menunggu B&M Mgr",
      cls: "bg-amber-50 text-amber-800 border-amber-200/80",
    },
    MENUNGGU_APPROVAL_DC_SPECIALIST: {
      label: "Menunggu DC Specialist",
      cls: "bg-purple-50 text-purple-800 border-purple-200/80",
    },
    REVISI: {
      label: "Revisi",
      cls: "bg-rose-50 text-rose-800 border-rose-200/80",
    },
    APPROVED: {
      label: "Disetujui (Approved)",
      cls: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    },
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3.5 px-4">No. Berita Acara</th>
              <th className="py-3.5 px-4">Proyek &amp; Cabang</th>
              <th className="py-3.5 px-4">Referensi Aanwijzing</th>
              <th className="py-3.5 px-4 text-center">Rekap Perubahan</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#E65F2B] mb-2" />
                  Memuat data riwayat klarifikasi aanwijzing...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-slate-400">
                  <div className="max-w-sm mx-auto flex flex-col items-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
                      <FileText className="w-6 h-6" />
                    </div>
                    <p className="font-semibold text-slate-700 text-sm">Belum Ada Berita Acara Klarifikasi</p>
                    <p className="text-xs text-slate-500 mt-1 mb-4 text-center">
                      Setelah sesi absensi aanwijzing selesai (quorum terpenuhi), BBK dapat menyusun Berita Acara Klarifikasi.
                    </p>
                    {onNewKlarifikasi && (
                      <Button
                        type="button"
                        onClick={onNewKlarifikasi}
                        className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold rounded-xl h-9 px-4 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Buat Klarifikasi Baru</span>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isCreator = isSameCreator(currentUser, item.created_by);
                const isRevisi = item.status === "REVISI";
                const isDraft = item.status === "DRAFT";
                const canEdit = isCreator || isAdmin;
                const badge = statusBadges[item.status] || {
                  label: item.status,
                  cls: "bg-slate-100 text-slate-700 border-slate-200",
                };

                const totalBaru = item.total_item_baru || 0;
                const totalUbah = item.total_item_ubah_vol || 0;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* No Berita Acara */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#E65F2B] shrink-0" />
                        <span>{item.nomor_klarifikasi}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Dibuat oleh: {item.created_by}
                      </div>
                    </td>

                    {/* Proyek & Cabang */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {item.project?.nama_proyek || "-"}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3" />
                        <span>{item.cabang || item.project?.cabang || "-"}</span>
                        <span>•</span>
                        <span>{item.project?.kode || "-"}</span>
                      </div>
                    </td>

                    {/* Referensi Aanwijzing */}
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">
                        {item.aanwijzing?.nomor_undangan || "-"}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Kategori: {item.aanwijzing?.kategori_nilai === "DI_ATAS_1M" ? "> Rp 1 Miliar" : "< Rp 1 Miliar"}
                      </div>
                    </td>

                    {/* Rekap Perubahan */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          +{totalBaru} Baru
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {totalUbah} Ubah Vol
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </td>

                    {/* Aksi */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap sm:flex-nowrap">
                        {/* Tombol Perbaiki (saat status REVISI atau DRAFT) */}
                        {(isRevisi || isDraft) && canEdit && (
                          <Link href={`/dc-development/klarifikasi-aanwijzing/${item.id}/edit`}>
                            <Button
                              type="button"
                              size="sm"
                              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl h-8 px-3 cursor-pointer shadow-xs inline-flex items-center gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>{isRevisi ? "Perbaiki" : "Lanjutkan"}</span>
                            </Button>
                          </Link>
                        )}

                        {/* Tombol Hapus (saat status REVISI atau DRAFT) */}
                        {(isRevisi || isDraft) && canEdit && onDelete && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(item)}
                            title="Batalkan / Hapus Pengajuan"
                            className="h-8 w-8 p-0 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}

                        {/* Tombol Detail & Unduh PDF: Wajib disembunyikan jika baris berstatus REVISI sesuai SOP GEMINI.md */}
                        {!isRevisi && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewDetail(item)}
                              title="Lihat Detail Klarifikasi"
                              className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={loadingPdfId === item.id}
                              onClick={() => handleOpenPdf(item)}
                              title="Lihat Berita Acara Resmi (PDF)"
                              className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 text-[#E65F2B] cursor-pointer"
                            >
                              {loadingPdfId === item.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <FileDown className="w-4 h-4" />
                              )}
                            </Button>
                          </>
                        )}
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
  );
}
