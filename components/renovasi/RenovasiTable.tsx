"use client";

import React from "react";
import Link from "next/link";
import { formatRupiah, cn, toTitleCase } from "@/lib/utils";
import {
  FileText,
  Eye,
  Pencil,
  Trash2,
  HardHat,
  AlertCircle,
  Building2,
  Plus,
  ShieldCheck,
  FolderArchive,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";
import { canEditRenovasiSubmission } from "@/lib/permissions";
import { hasPreviousApprovalNotes } from "@/lib/approval-notes";

interface RenovasiTableProps {
  renovasiList: any[];
  loading: boolean;
  error: string | null;
  onView: (item: any) => void;
  onRevisi?: (item: any) => void;
  onDelete?: (item: any) => void;
  canEdit?: boolean;
}

export default function RenovasiTable({
  renovasiList,
  loading,
  error,
  onView,
  onRevisi,
  onDelete,
  canEdit = true
}: RenovasiTableProps) {
  const { user } = useSession();
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-16 text-center min-h-[300px]">
        <div className="w-9 h-9 border-3 border-[#E65F2B] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500 animate-pulse">Memuat data pengajuan renovasi...</p>
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

  if (!renovasiList.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-16 text-center min-h-[360px]">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#E65F2B] flex items-center justify-center mb-3.5 shadow-2xs">
          <HardHat className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900 tracking-tight">
          Belum Ada Pengajuan Renovasi
        </h3>
        <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
          Seluruh pengajuan renovasi peremajaan bangunan DC, berkas gambar teknik, foto lingkungan,
          dan perhitungan RAB akan tercatat di sini.
        </p>

        {canEdit ? (
          <Link href="/dc-development/renovasi/tambah" className="mt-5">
            <Button className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs h-9 px-4 rounded-xl shadow-md shadow-[#E65F2B]/20 cursor-pointer">
              <Plus className="w-4 h-4 mr-1.5" />
              Mulai Pengajuan Renovasi Baru
            </Button>
          </Link>
        ) : (
          <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200/80 text-slate-600 text-[11px] font-medium">
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span>Mode Peninjau: Pengajuan baru dapat dibuat oleh Branch Building Koordinator atau Admin.</span>
          </div>
        )}
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-emerald-50 text-emerald-800 border-emerald-200/80";
      case "MENUNGGU APPROVAL B&M MANAGER":
      case "MENUNGGU APPROVAL DC SPECIALIST":
      case "MENUNGGU APPROVAL DC MANAGER":
        return "bg-blue-50 text-blue-800 border-blue-200/80";
      case "REVISI":
      case "DITOLAK":
        return "bg-rose-50 text-rose-800 border-rose-200/80";
      case "DRAFT":
      default:
        return "bg-amber-50 text-amber-900 border-amber-200/80";
    }
  };

  return (
    <div className="w-full overflow-x-auto bg-white rounded-2xl">
      <table className="w-full text-xs text-left border-collapse">
        <thead className="text-[10px] text-slate-500 bg-slate-50/80 backdrop-blur-md uppercase tracking-wider font-bold sticky top-0 z-10 border-b border-slate-200/80">
          <tr>
            <th scope="col" className="px-4 py-3.5 w-12 text-center">No</th>
            <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Nomor Pengajuan</th>
            <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Tanggal</th>
            <th scope="col" className="px-4 py-3.5 min-w-[200px]">Proyek Bangunan DC</th>
            <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Cabang</th>
            <th scope="col" className="px-4 py-3.5 min-w-[150px]">Jenis Renovasi</th>
            <th scope="col" className="px-4 py-3.5 whitespace-nowrap">Lingkup & Durasi</th>
            <th scope="col" className="px-4 py-3.5 text-right whitespace-nowrap">Total RAB / OE</th>
            <th scope="col" className="px-4 py-3.5 text-center whitespace-nowrap">Status</th>
            <th scope="col" className="px-4 py-3.5 text-center w-20">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {renovasiList.map((item, index) => {
            const project = item.project || {};
            const createdDate = new Date(item.created_at).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric"
            });

            return (
              <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3 text-center font-bold text-slate-400">
                  {index + 1}
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                  {item.nomor_pengajuan}
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-medium">
                  {createdDate}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 leading-snug">
                      {project.kode ? `${project.kode} - ` : ""}{project.nama_proyek}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      {project.tipe || "DC WAREHOUSE"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                  {item.cabang || project.cabang || "-"}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-800">
                  {item.jenis_renovasi ? toTitleCase(item.jenis_renovasi) : "-"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-semibold text-slate-800 block">{item.lingkup_pekerjaan}</span>
                  <span className="text-[11px] text-slate-400 block font-mono">{item.durasi_hari} Hari</span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap font-mono text-xs">
                  {formatRupiah(item.grand_total || 0)}
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <div className="flex flex-col items-center gap-1">
                    <span
                      className={cn(
                        "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        getStatusBadge(item.status)
                      )}
                    >
                      {item.status}
                    </span>
                    {hasPreviousApprovalNotes(item.catatan_pengajuan) && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 shadow-2xs">
                        <MessageSquare className="w-2.5 h-2.5 text-amber-600" />
                        Ada Catatan
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1">
                    {/* Jika status REVISI: di kolom HANYA ada aksi bertuliskan Revisi */}
                    {item.status === "REVISI" ? (
                      canEditRenovasiSubmission(user, item) ? (
                        onRevisi ? (
                          <Button
                            size="sm"
                            onClick={() => onRevisi(item)}
                            className="h-7 px-3 rounded-lg bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                            title="Lihat Catatan Instruksi & Lakukan Revisi"
                          >
                            Revisi
                          </Button>
                        ) : (
                          <Link href={`/dc-development/renovasi/tambah?draft_id=${item.id}`}>
                            <Button
                              size="sm"
                              className="h-7 px-3 rounded-lg bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                              title="Lakukan Revisi Pengajuan"
                            >
                              Revisi
                            </Button>
                          </Link>
                        )
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onView(item)}
                          className="h-7 px-2.5 rounded-lg border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 cursor-pointer font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                          title="Lihat Detail Pengajuan"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          Detail
                        </Button>
                      )
                    ) : (
                      <>
                        {/* Tombol Edit Draft (Hanya jika status DRAFT dan user berhak) */}
                        {canEditRenovasiSubmission(user, item) && item.status === "DRAFT" && (
                          <Link href={`/dc-development/renovasi/tambah?draft_id=${item.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-lg text-amber-700 hover:text-amber-800 hover:bg-amber-50 cursor-pointer"
                              title="Lanjutkan Edit Draft"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        )}

                        {/* Tombol View Detail */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onView(item)}
                          className="h-7 px-2.5 rounded-lg border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 cursor-pointer font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
                          title="Lihat Detail Pengajuan"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          Detail
                        </Button>

                        {/* Tombol Hapus (Hanya jika status DRAFT atau DITOLAK dan user berhak) */}
                        {canEditRenovasiSubmission(user, item) && onDelete && (item.status === "DRAFT" || item.status === "DITOLAK") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(item)}
                            className="h-8 w-8 p-0 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                            title="Hapus Pengajuan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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
