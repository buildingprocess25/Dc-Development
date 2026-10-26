"use client";

import React from "react";
import {
  FileText,
  Eye,
  FileDown,
  RefreshCw,
  Building2,
  Calendar,
  Users,
  AlertCircle,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DaftarAanwijzingTableProps {
  aanwijzings: any[];
  loading: boolean;
  currentUser: any;
  onViewDetail: (aanwijzing: any) => void;
  onOpenKonfirmasi: (aanwijzing: any) => void;
  onNewUndangan?: () => void;
}

export function DaftarAanwijzingTable({
  aanwijzings,
  loading,
  currentUser,
  onViewDetail,
  onOpenKonfirmasi,
  onNewUndangan,
}: DaftarAanwijzingTableProps) {
  const roleUpper = (currentUser?.role || "").toUpperCase();
  const isContractor =
    roleUpper.includes("KONTRAKTOR") ||
    roleUpper.includes("KONSULTAN") ||
    roleUpper.includes("VENDOR") ||
    roleUpper.includes("REKANAN");

  const statusBadges: Record<string, { label: string; cls: string }> = {
    MENUNGGU_KONFIRMASI: {
      label: "Menunggu Konfirmasi",
      cls: "bg-amber-50 text-amber-800 border-amber-200/80",
    },
    AANWIJZING_LANJUT: {
      label: "Aanwijzing Lanjut",
      cls: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    },
    MENUNGGU_APPROVAL_DC_MANAGER: {
      label: "Approval DC Manager",
      cls: "bg-blue-50 text-blue-800 border-blue-200/80",
    },
    ON_HOLD: {
      label: "ON HOLD (Ditahan)",
      cls: "bg-rose-50 text-rose-800 border-rose-200/80",
    },
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3.5 px-4">No. Undangan</th>
              <th className="py-3.5 px-4">Proyek &amp; Cabang</th>
              <th className="py-3.5 px-4">Jadwal Aanwijzing</th>
              <th className="py-3.5 px-4 text-center">Kehadiran (Quorum)</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#E65F2B] mb-2" />
                  Memuat data riwayat undangan aanwijzing...
                </td>
              </tr>
            ) : aanwijzings.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-slate-400">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                    <FileText className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-sm text-slate-800">
                    Belum Ada Surat Undangan Aanwijzing
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Belum ada pengajuan surat undangan yang diterbitkan atau sesuai kriteria pencarian filter Anda.
                  </p>
                  {!isContractor && onNewUndangan && (
                    <Button
                      type="button"
                      onClick={onNewUndangan}
                      className="mt-3.5 bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs font-bold rounded-xl h-9 px-4 cursor-pointer shadow-sm shadow-orange-500/20 inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Buat Undangan Baru
                    </Button>
                  )}
                </td>
              </tr>
            ) : (
              aanwijzings.map((a) => {
                const badge = statusBadges[a.status] || {
                  label: a.status,
                  cls: "bg-slate-100 text-slate-800 border-slate-200",
                };

                const hadir = (a.peserta || []).filter(
                  (p: any) => p.status_konfirmasi === "HADIR"
                ).length;
                const pending = (a.peserta || []).filter(
                  (p: any) => p.status_konfirmasi === "MENUNGGU_RESPON"
                ).length;
                const total = (a.peserta || []).length;

                // Kontraktor login status check
                const contractorPeserta = isContractor
                  ? (a.peserta || []).find((p: any) => {
                      const uEmail = (currentUser?.email || "").toLowerCase();
                      const uPt = (
                        (currentUser?.namaPt ||
                          (currentUser as any)?.nama_pt ||
                          "") as string
                      ).toLowerCase();
                      const pEmail = (p.email || p.vendor?.email || "").toLowerCase();
                      const pName = (p.vendor?.nama_perusahaan || "").toLowerCase();
                      return (uEmail && pEmail === uEmail) || (uPt && pName.includes(uPt));
                    })
                  : null;

                return (
                  <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {a.nomor_undangan}
                      <div className="text-[10px] text-slate-400 font-sans font-normal mt-0.5">
                        {a.kategori_nilai === "DI_ATAS_1M" ? "> 1M (Tender)" : "< 1M (PFR)"}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{a.project?.nama_proyek}</p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {a.cabang} &bull; {a.project?.kode}
                      </p>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">
                        {new Date(a.tanggal_pelaksanaan).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">{a.waktu_pelaksanaan}</p>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 font-bold text-xs">
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          {hadir} Hadir
                        </span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-600">{total} Rekanan</span>
                      </div>
                      {pending > 0 && a.status === "MENUNGGU_KONFIRMASI" && (
                        <p className="text-[10px] text-amber-600 mt-0.5 font-medium">
                          ({pending} belum respon)
                        </p>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {contractorPeserta &&
                        contractorPeserta.status_konfirmasi === "MENUNGGU_RESPON" &&
                        a.status === "MENUNGGU_KONFIRMASI" ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => onViewDetail(a)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl h-8 px-3 cursor-pointer shadow-xs transition-all"
                          >
                            Konfirmasi
                          </Button>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewDetail(a)}
                              title="Lihat Detail & Quorum"
                              className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                window.open(
                                  `/api/dc-development/aanwijzing/${a.id}/pdf?download=1`,
                                  "_blank"
                                )
                              }
                              title="Unduh PDF Resmi"
                              className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 text-[#E65F2B] cursor-pointer"
                            >
                              <FileDown className="w-4 h-4" />
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
