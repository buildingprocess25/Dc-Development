"use client";

import React from "react";
import { Eye, Printer, Loader2, Calendar, Building2, User, Tag, CheckCircle2, Clock, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DokumenFungsiRuangItem {
  id: number;
  nomor_pengajuan: string;
  nama_pemohon: string;
  email_pemohon: string;
  jabatan: string;
  divisi: string;
  departemen: string;
  jenis_pengajuan: string;
  alasan_pengajuan: string;
  status: string;
  created_at: string;
  updated_at: string;
  project?: {
    nama_proyek?: string | null;
    kode?: string | null;
    cabang?: string | null;
    tipe?: string | null;
  } | null;
  renovasi?: {
    nomor_pengajuan?: string | null;
    cabang?: string | null;
  } | null;
  [key: string]: any;
}

export interface DokumenFungsiRuangTableProps {
  data: DokumenFungsiRuangItem[];
  loading: boolean;
  onViewDetail: (item: DokumenFungsiRuangItem) => void;
  onDownload: (item: DokumenFungsiRuangItem) => void;
  downloadingId?: number | null;
}

export default function DokumenFungsiRuangTable({
  data,
  loading,
  onViewDetail,
  onDownload,
  downloadingId,
}: DokumenFungsiRuangTableProps) {
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
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "MENUNGGU APPROVAL BM/DBM":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "REVISI":
        return "bg-orange-50 text-orange-800 border-orange-200";
      default:
        return "bg-blue-50 text-blue-800 border-blue-200";
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
              <th className="py-3.5 px-4 w-12 text-center">No</th>
              <th className="py-3.5 px-4">No. Pengajuan & Tanggal</th>
              <th className="py-3.5 px-4">Proyek & Cabang</th>
              <th className="py-3.5 px-4">Pemohon</th>
              <th className="py-3.5 px-4">Jenis Pengajuan</th>
              <th className="py-3.5 px-4 text-center">Status Approval</th>
              <th className="py-3.5 px-4 text-center">Dokumen PDF</th>
              <th className="py-3.5 px-4 text-right w-44">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-14 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#E65F2B]" />
                  <span>Memuat arsip dokumen fungsi ruang...</span>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-14 text-center text-slate-400">
                  Tidak ada dokumen perubahan fungsi ruang yang sesuai dengan filter.
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const isApproved = item.status === "APPROVED";

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                      {index + 1}
                    </td>

                    {/* No. Pengajuan & Tanggal */}
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-900 group-hover:text-[#E65F2B] transition-colors">
                        {item.nomor_pengajuan}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 font-medium">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    </td>

                    {/* Proyek & Cabang */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Building2 className="w-3.5 h-3.5 text-[#E65F2B] shrink-0" />
                        <span>{item.project?.nama_proyek || "Proyek DC"}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Cabang: <strong className="text-slate-700">{item.project?.cabang || item.renovasi?.cabang || "-"}</strong> &bull; Tipe: <span className="font-semibold text-slate-700">{item.project?.tipe || "-"}</span>
                      </div>
                    </td>

                    {/* Pemohon */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.nama_pemohon}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {item.jabatan}
                      </div>
                    </td>

                    {/* Jenis Pengajuan */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-orange-50 text-[#E65F2B] border-orange-200">
                        <Tag className="w-3 h-3" />
                        <span>{item.jenis_pengajuan}</span>
                      </span>
                    </td>

                    {/* Status Approval */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${getStatusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </td>

                    {/* Dokumen PDF Status */}
                    <td className="py-3.5 px-4 text-center">
                      {isApproved ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Resmi Approved</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Draft / Proses</span>
                        </span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewDetail(item)}
                          className="h-8 px-2.5 rounded-lg border-slate-200 text-slate-700 hover:text-[#E65F2B] hover:border-[#E65F2B] font-semibold text-xs shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Detail
                        </Button>

                        <Button
                          size="sm"
                          disabled={downloadingId === item.id}
                          onClick={() => onDownload(item)}
                          className="h-8 px-2.5 rounded-lg bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5"
                          title="Lihat Dokumen PDF di Google Drive"
                        >
                          {downloadingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                          ) : (
                            <ExternalLink className="w-3.5 h-3.5 text-white" />
                          )}
                          <span>Lihat PDF</span>
                        </Button>
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
