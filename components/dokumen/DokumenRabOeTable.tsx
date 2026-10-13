"use client";

import React from "react";
import { Eye, Download, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/utils";

export interface DokumenFileItem {
  id: number;
  kategori_file: string;
  nama_file: string;
  file_url: string;
}

export interface DokumenRabOeItem {
  id: number;
  nomor_pengajuan: string;
  cabang?: string | null;
  status: string;
  grand_total: number;
  project?: {
    nama_proyek?: string | null;
    kode?: string | null;
    cabang?: string | null;
  } | null;
  dokumen?: DokumenFileItem[];
  [key: string]: unknown;
}

export interface DokumenRabOeTableProps {
  data: DokumenRabOeItem[];
  loading: boolean;
  downloadingId: number | null;
  onViewDetail: (item: DokumenRabOeItem) => void;
  onDownload: (item: DokumenRabOeItem) => void;
}

export default function DokumenRabOeTable({
  data,
  loading,
  downloadingId,
  onViewDetail,
  onDownload
}: DokumenRabOeTableProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
              <th className="py-3.5 px-4 w-12 text-center">No</th>
              <th className="py-3.5 px-4">Nomor Pengajuan</th>
              <th className="py-3.5 px-4">Proyek / DC</th>
              <th className="py-3.5 px-4">Cabang</th>
              <th className="py-3.5 px-4">Status Approval</th>
              <th className="py-3.5 px-4 text-right">Total Anggaran</th>
              <th className="py-3.5 px-4 text-center">Dokumen PDF</th>
              <th className="py-3.5 px-4 text-center w-36">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#E65F2B]" />
                  Memuat daftar dokumen RAB/OE...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  Tidak ada dokumen proyek yang ditemukan.
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const pdfDoc = item.dokumen?.find((d) => d.kategori_file === "DOKUMEN_RAB_OE_PDF");
                const isDownloading = downloadingId === item.id;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                      {index + 1}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      {item.nomor_pengajuan}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800">{item.project?.nama_proyek || "-"}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{item.project?.kode}</div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600 uppercase">
                      {item.cabang || item.project?.cabang || "-"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                          item.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : item.status === "REVISI"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : item.status === "DITOLAK"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-slate-800 font-mono">
                      {formatRupiah(item.grand_total)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {pdfDoc?.file_url ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Tersedia di Drive
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">
                          Auto-Sync
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onViewDetail(item)}
                          className="h-8 w-8 p-0 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                          title="Lihat Detail Lengkap & Dokumen"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => onDownload(item)}
                          disabled={isDownloading}
                          className="h-8 px-2.5 rounded-lg bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-[11px] font-bold cursor-pointer transition-colors"
                          title="Unduh PDF Resmi"
                        >
                          {isDownloading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5 mr-1" />
                              Unduh
                            </>
                          )}
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
