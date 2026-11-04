"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Scale,
  ArrowRight,
  Trophy,
  Loader2,
  Trash2,
  AlertCircle,
  Plus,
  Eye,
  Building2,
  Layers,
  ChevronDown,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { isExternalPartnerRole } from "@/lib/permissions";

interface DaftarPenawaranProps {
  penawaranList: any[];
  userRole: string;
  userEmail: string;
  namaPt?: string | null;
  onOpenTambah?: () => void;
  onRefresh?: () => void;
}

export default function DaftarPenawaranRekananTable({
  penawaranList = [],
  userRole = "",
  userEmail: _,
  namaPt: __,
  onOpenTambah,
  onRefresh,
}: DaftarPenawaranProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  // State buka/tutup per proyek (default: terbuka / false untuk collapsed)
  const [collapsedProjects, setCollapsedProjects] = useState<Record<number, boolean>>({});

  const toggleProject = (projectId: number) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  // Fallback aman untuk mencegah TypeError length
  const safeList = Array.isArray(penawaranList) ? penawaranList : [];

  // HANYA Rekanan/Kontraktor yang boleh menambahkan penawaran
  const isRekanan = isExternalPartnerRole(userRole);
  const canCreate = isRekanan;

  const formatNumber = (n: number) => {
    if (!n && n !== 0) return "0";
    return new Intl.NumberFormat("id-ID").format(n);
  };

  const isDraftExpired = (item: any) => {
    if (item.status !== "DRAFT") return false;
    const tenderDate = item.klarifikasi?.tanggal_tender;
    if (!tenderDate) return false;
    const todayStr = new Date().toLocaleDateString("en-CA");
    const tenderStr = new Date(tenderDate).toLocaleDateString("en-CA");
    return todayStr > tenderStr;
  };

  const getStatusBadge = (status: string, item?: any) => {
    if (item && isDraftExpired(item)) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          TERELIMINASI
        </span>
      );
    }

    switch (status) {
      case "DRAFT":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            DRAFT
          </span>
        );
      case "DIAJUKAN":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            DIAJUKAN
          </span>
        );
      case "EVALUASI_DC_SPECIALIST":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            EVALUASI SPECIALIST
          </span>
        );
      case "NEGOSIASI_REKANAN":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 animate-pulse">
            <AlertCircle className="w-3 h-3 mr-1 text-amber-600" /> PERLU NEGOSIASI
          </span>
        );
      case "DIAJUKAN_ULANG":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
            DIAJUKAN ULANG
          </span>
        );
      case "SIAP_KOMPARASI":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> SIAP PEMILIHAN
          </span>
        );
      case "MENANG":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <Trophy className="w-3 h-3 mr-1 text-emerald-600" /> PEMENANG
          </span>
        );
      case "TIDAK_MENANG":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            TIDAK MENANG
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">
            {status}
          </span>
        );
    }
  };

  const handleDeleteDraft = async (id: number) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/dc-development/penawaran-rekanan/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.status === "success") {
        setDeleteConfirmId(null);
        if (onRefresh) onRefresh();
      } else {
        alert(json.message || "Gagal membatalkan draf");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setDeleting(false);
    }
  };

  // Kelompokkan daftar penawaran per Proyek DC
  const projectGroups = useMemo(() => {
    const map = new Map<number, {
      project: any;
      klarifikasi: any;
      cabang: string;
      items: any[];
    }>();

    safeList.forEach((item) => {
      const pId = item.project_id || (item.project?.id ?? 0);
      if (!map.has(pId)) {
        map.set(pId, {
          project: item.project || { nama_proyek: "Paket Proyek", cabang: item.cabang || "-" },
          klarifikasi: item.klarifikasi,
          cabang: item.cabang || item.project?.cabang || "-",
          items: [],
        });
      }
      map.get(pId)!.items.push(item);
    });

    return Array.from(map.entries()).map(([projectId, data]) => ({
      projectId,
      ...data,
    }));
  }, [safeList]);

  if (safeList.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden p-14 text-center">
        <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#E65F2B] mx-auto mb-3">
          <Scale className="w-6 h-6 stroke-1.5" />
        </div>
        <h4 className="font-bold text-slate-800 text-sm">
          Belum Ada Pengajuan Penawaran
        </h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
          {canCreate
            ? "Anda belum memiliki daftar berkas penawaran. Klik tombol '+ Tambah Penawaran' di atas untuk memulai pengisian penawaran tender paket Anda."
            : "Belum ada berkas penawaran yang diajukan oleh rekanan pada proyek-proyek di wilayah cabang Anda."}
        </p>

        {canCreate && onOpenTambah && (
          <Button
            onClick={onOpenTambah}
            className="mt-4 bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs h-9 px-4 rounded-xl font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Buat Penawaran Pertama
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Info Global */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-800 text-base">
            {isRekanan ? "Daftar Penawaran Saya" : "Daftar Berkas Penawaran Rekanan"}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {isRekanan
              ? "Daftar seluruh berkas pengajuan penawaran lelang proyek yang telah Anda buat"
              : "Dikelompokkan berdasarkan paket proyek tender DC untuk mempermudah evaluasi dan komparasi penawaran rekanan"}
          </p>
        </div>
        <div className="text-xs text-slate-400 font-medium flex items-center gap-2 flex-wrap">
          {!isRekanan && projectGroups.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const allCollapsed = projectGroups.every((g) => collapsedProjects[g.projectId]);
                const nextState: Record<number, boolean> = {};
                projectGroups.forEach((g) => {
                  nextState[g.projectId] = !allCollapsed;
                });
                setCollapsedProjects(nextState);
              }}
              className="text-[11px] h-7 px-2.5 rounded-lg border-slate-300 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              {projectGroups.every((g) => collapsedProjects[g.projectId])
                ? "Buka Semua Proyek"
                : "Tutup Semua Proyek"}
            </Button>
          )}
          {!isRekanan && (
            <>
              <span className="bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700 font-bold">
                {projectGroups.length} Proyek
              </span>
              <span>•</span>
            </>
          )}
          <span className="bg-orange-50 text-[#E65F2B] border border-orange-200/60 px-2.5 py-1 rounded-lg font-bold">
            {safeList.length} Total Penawaran
          </span>
        </div>
      </div>

      {/* VIEW KONTRAKTOR: Tabel Langsung (Flat List, Tanpa Pengelompokan & Tanpa Tombol Komparasi) */}
      {isRekanan ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4 min-w-[220px]">Paket Proyek &amp; Cabang</th>
                  <th className="py-3 px-4 min-w-[170px]">No. Penawaran &amp; Tanggal</th>
                  <th className="py-3 px-4 text-right min-w-[140px]">Nilai Penawaran (Rp)</th>
                  <th className="py-3 px-4 text-center w-28">Durasi</th>
                  <th className="py-3 px-4 text-center min-w-[140px]">Status Berkas</th>
                  <th className="py-3 px-4 text-right min-w-[140px]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {safeList.map((item, idx) => {
                  const isDraft = item.status === "DRAFT";
                  const isNegosiasi = item.status === "NEGOSIASI_REKANAN";

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 text-center text-slate-400 font-mono font-medium">
                        {idx + 1}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-xs">
                            {item.project?.nama_proyek || "Paket Proyek"}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                            {item.cabang || item.project?.cabang || "-"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                          {item.project?.kode && (
                            <span className="font-mono text-slate-500">
                              ({item.project.kode})
                            </span>
                          )}
                          {item.klarifikasi?.nomor_klarifikasi && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-slate-500">
                                BA: {item.klarifikasi.nomor_klarifikasi}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          {item.nomor_penawaran}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {item.created_at
                            ? new Date(item.created_at).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                        {item.grand_total > 0 ? (
                          <span className="text-[#E65F2B]">
                            Rp {formatNumber(item.grand_total)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal italic text-[11px]">
                            Draf Belum Selesai
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono text-slate-700">
                        {item.durasi_pekerjaan_hari > 0 ? (
                          <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-800">
                            {item.durasi_pekerjaan_hari} Hari
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(item.status, item)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {isDraft ? (
                            <>
                              {isDraftExpired(item) ? (
                                <Button
                                  size="sm"
                                  disabled
                                  className="bg-slate-100 text-slate-400 text-xs h-8 px-3 rounded-xl border border-slate-200 cursor-not-allowed"
                                  title="Batas waktu tender telah berakhir. Penawaran tidak dapat dilanjutkan."
                                >
                                  Tereliminasi
                                </Button>
                              ) : (
                                <Link href={`/dc-development/penawaran-rekanan/${item.id}`}>
                                  <Button
                                    size="sm"
                                    className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs h-8 px-3 rounded-xl shadow-xs font-semibold cursor-pointer"
                                  >
                                    Lanjutkan Input
                                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                                  </Button>
                                </Link>
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteConfirmId(item.id)}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 text-xs h-8 w-8 p-0 rounded-xl cursor-pointer"
                                title="Batalkan Draf Penawaran"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          ) : isNegosiasi ? (
                            <Link href={`/dc-development/penawaran-rekanan/${item.id}`}>
                              <Button
                                size="sm"
                                className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-3.5 rounded-xl shadow-xs font-semibold animate-pulse cursor-pointer"
                              >
                                <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                                Perbaiki Negosiasi
                              </Button>
                            </Link>
                          ) : (
                            <Link href={`/dc-development/penawaran-rekanan/${item.id}/review-penawaran`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-8 px-3 rounded-xl font-medium cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                                Lihat Penawaran
                              </Button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VIEW INTERNAL (SELAIN KONTRAKTOR): Tetap Dikelompokkan per Proyek DC dengan Komparasi Penawaran */
        projectGroups.map((group, gIdx) => {
        const isCollapsed = Boolean(collapsedProjects[group.projectId]);

        return (
          <div
            key={group.projectId || gIdx}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all duration-200"
          >
            {/* Header Grup Proyek DC (Klik untuk buka/tutup) */}
            <div
              onClick={() => toggleProject(group.projectId)}
              className={`p-4 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-100/60 transition-colors ${
                !isCollapsed ? "border-b border-slate-200/70" : ""
              }`}
            >
              <div className="flex items-start sm:items-center space-x-3 min-w-0">
                {/* Tombol Chevron Accordion */}
                <div
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all shrink-0 mt-0.5 sm:mt-0 shadow-2xs"
                  title={isCollapsed ? "Buka Daftar Rekanan" : "Tutup Daftar Rekanan"}
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isCollapsed ? "-rotate-90 text-slate-400" : "rotate-0 text-[#E65F2B]"
                    }`}
                  />
                </div>

                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#E65F2B] shrink-0 shadow-2xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm md:text-base tracking-tight truncate">
                      {group.project?.nama_proyek || "Paket Proyek"}
                    </h4>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-200/80 text-slate-700">
                      {group.cabang}
                    </span>
                    {group.project?.kode && (
                      <span className="text-xs font-mono text-slate-500 font-medium">
                        ({group.project.kode})
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 text-xs mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {group.klarifikasi?.nomor_klarifikasi && (
                      <span className="font-mono text-slate-500 text-[11px]">
                        BA Klarifikasi: <strong className="text-slate-700">{group.klarifikasi.nomor_klarifikasi}</strong>
                      </span>
                    )}
                    {group.klarifikasi?.durasi_hari_akhir && (
                      <>
                        <span>•</span>
                        <span className="text-slate-500 text-[11px]">
                          Target Durasi: <strong className="text-slate-700">{group.klarifikasi.durasi_hari_akhir} Hari</strong>
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span className="text-[11px] font-semibold text-[#E65F2B]">
                      {group.items.length} Rekanan Terdaftar
                    </span>
                  </div>
                </div>
              </div>

              {/* Aksi di Tingkat Proyek DC: Buka/Tutup & Komparasi Penawaran */}
              <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleProject(group.projectId);
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 h-8 px-2.5 rounded-xl font-medium cursor-pointer"
                >
                  {isCollapsed ? "Buka Rekanan" : "Tutup"}
                  <ChevronDown
                    className={`w-3.5 h-3.5 ml-1 transition-transform duration-200 ${
                      isCollapsed ? "-rotate-90 text-slate-400" : "rotate-0 text-[#E65F2B]"
                    }`}
                  />
                </Button>

                {!isRekanan && group.projectId ? (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Link href={`/dc-development/penawaran-rekanan/komparasi/${group.projectId}`}>
                      <Button
                        size="sm"
                        className="bg-white hover:bg-orange-50 text-[#E65F2B] border border-orange-200 hover:border-[#E65F2B] font-bold text-xs h-9 px-3.5 rounded-xl shadow-2xs transition-all cursor-pointer"
                      >
                        <Scale className="w-3.5 h-3.5 mr-1.5 text-[#E65F2B]" />
                        Komparasi Penawaran
                        <ArrowRight className="w-3.5 h-3.5 ml-1 text-[#E65F2B]" />
                      </Button>
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Sub-Tabel Penawaran Tiap Kontraktor di Bawah Proyek Ini (Bisa Buka / Tutup) */}
            {!isCollapsed ? (
              <div className="overflow-x-auto animate-in fade-in duration-150">
                <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/40 border-b border-slate-100 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="py-2.5 px-4 w-12 text-center">No</th>
                  <th className="py-2.5 px-4 min-w-[160px]">No. Penawaran &amp; Tanggal</th>
                  <th className="py-2.5 px-4 min-w-[200px]">Rekanan Kontraktor</th>
                  <th className="py-2.5 px-4 text-right min-w-[140px]">Nilai Penawaran (Rp)</th>
                  <th className="py-2.5 px-4 text-center w-28">Durasi</th>
                  <th className="py-2.5 px-4 text-center min-w-[150px]">Status Berkas</th>
                  <th className="py-2.5 px-4 text-right min-w-[130px]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {group.items.map((item, idx) => {
                  const isDraft = item.status === "DRAFT";
                  const isNegosiasi = item.status === "NEGOSIASI_REKANAN";

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          {item.nomor_penawaran}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {item.created_at ? new Date(item.created_at).toLocaleDateString("id-ID") : "-"}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 text-xs">
                          {item.vendor_nama || item.vendor?.nama_perusahaan || "-"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.vendor_email || item.vendor?.email || "-"}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {item.grand_total > 0 ? (
                          <span className="text-[#E65F2B]">
                            Rp {formatNumber(item.grand_total)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal italic text-[11px]">
                            Draf Belum Selesai
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-700">
                        {item.durasi_pekerjaan_hari > 0 ? (
                          <span className="bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-800">
                            {item.durasi_pekerjaan_hari} Hari
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(item.status, item)}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {isRekanan ? (
                            <>
                              {isDraft ? (
                                <>
                                  {isDraftExpired(item) ? (
                                    <Button
                                      size="sm"
                                      disabled
                                      className="bg-slate-100 text-slate-400 text-xs h-8 px-3 rounded-xl border border-slate-200 cursor-not-allowed"
                                      title="Batas waktu tender telah berakhir. Penawaran tidak dapat dilanjutkan."
                                    >
                                      Tereliminasi
                                    </Button>
                                  ) : (
                                    <Link href={`/dc-development/penawaran-rekanan/${item.id}`}>
                                      <Button
                                        size="sm"
                                        className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs h-8 px-3 rounded-xl shadow-xs font-semibold cursor-pointer"
                                      >
                                        Lanjutkan Input
                                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                                      </Button>
                                    </Link>
                                  )}

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDeleteConfirmId(item.id)}
                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 text-xs h-8 w-8 p-0 rounded-xl cursor-pointer"
                                    title="Batalkan Draf Penawaran"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              ) : isNegosiasi ? (
                                <Link href={`/dc-development/penawaran-rekanan/${item.id}`}>
                                  <Button
                                    size="sm"
                                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-3.5 rounded-xl shadow-xs font-semibold animate-pulse cursor-pointer"
                                  >
                                    <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
                                    Perbaiki Negosiasi
                                  </Button>
                                </Link>
                              ) : (
                                <Link href={`/dc-development/penawaran-rekanan/${item.id}/review-penawaran`}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-8 px-3 rounded-xl font-medium cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                                    Lihat Penawaran
                                  </Button>
                                </Link>
                              )}
                            </>
                          ) : (
                            // Aksi untuk Internal (BBM Manager / DC Specialist / Admin): Detail per Kontraktor
                            <Link href={`/dc-development/penawaran-rekanan/${item.id}/review-penawaran`}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-8 px-3.5 rounded-xl font-semibold shadow-2xs cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                                Detail
                              </Button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    );
  }))}

      {/* Modal Konfirmasi Hapus Draf */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-3.5 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-2.5 text-rose-600 font-bold text-sm">
              <AlertCircle className="w-5 h-5" />
              <span>Batalkan Draf Penawaran?</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Draf penawaran yang dibatalkan akan dihapus dari sistem. Anda dapat memulai pengisian ulang kapan saja dari awal.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
                className="text-xs h-8 px-3 rounded-xl border-slate-300 text-slate-700"
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={deleting}
                onClick={() => handleDeleteDraft(deleteConfirmId)}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-8 px-3.5 rounded-xl font-semibold shadow-xs"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> Menghapus...
                  </>
                ) : (
                  "Ya, Batalkan Draf"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
