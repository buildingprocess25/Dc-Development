"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Camera,
  FileText,
  Eye,
  MapPin,
  FileCode,
  ShieldCheck,
  FileSpreadsheet,
  Building2,
  ExternalLink,
  Folder,
} from "lucide-react";

interface ReviewPenawaranProps {
  penawaran: any;
  dokumenList: any[];
  isKontraktor?: boolean;
}

export default function ReviewPenawaranCard({
  penawaran,
  dokumenList = [],
  isKontraktor = false,
}: ReviewPenawaranProps) {
  const [activeTab, setActiveTab] = useState<"FINANSIAL" | "FOTO" | "GAMBAR">("FINANSIAL");
  const [lingkupFilter, setLingkupFilter] = useState<"SEMUA" | "SIPIL" | "ME">("SEMUA");

  const formatNumber = (n: number) => {
    if (!n && n !== 0) return "0";
    return new Intl.NumberFormat("id-ID").format(n);
  };

  // Helper penapis dokumen: Berkas RAB/OE dilarang masuk ke tab Gambar Teknis (PDF Gambar/Foto Lingkungan tetap ada)
  const isRabOeDoc = (d: any) => {
    const cat = (d.kategori_file || "").toUpperCase();
    const name = (d.nama_file || "").toUpperCase();
    const label = (d.nama_label || "").toUpperCase();
    return (
      cat.includes("RAB") ||
      cat.includes("OE") ||
      cat.includes("ESTIMATE") ||
      name.includes("RAB_OE") ||
      name.includes("RAB-OE") ||
      name.includes("RAB_") ||
      name.startsWith("RAB") ||
      label.includes("RAB") ||
      label.includes("OE") ||
      label.includes("OWNER ESTIMATE")
    );
  };

  const fotoLingkungan = useMemo(
    () => dokumenList.filter((d) => d.kategori_file === "FOTO_LINGKUNGAN"),
    [dokumenList]
  );
  // Gambar Teknis: Menampilkan berkas gambar teknis arsitektur, sipil, ME, dan PDF gambar/foto lingkungan (tanpa berkas RAB/OE)
  const gambarTeknis = useMemo(
    () => dokumenList.filter((d) => d.kategori_file !== "FOTO_LINGKUNGAN" && !isRabOeDoc(d)),
    [dokumenList]
  );

  // Pemisahan item item pekerjaan Sipil & ME
  const itemsSipil = useMemo(
    () => (penawaran.items || []).filter((it: any) => (it.lingkup || "SIPIL").toUpperCase() === "SIPIL"),
    [penawaran.items]
  );
  const itemsMe = useMemo(
    () => (penawaran.items || []).filter((it: any) => (it.lingkup || "").toUpperCase() === "ME"),
    [penawaran.items]
  );

  const totalSipil = useMemo(
    () => itemsSipil.reduce((sum: number, it: any) => sum + (it.total_harga || 0), 0),
    [itemsSipil]
  );
  const totalMe = useMemo(
    () => itemsMe.reduce((sum: number, it: any) => sum + (it.total_harga || 0), 0),
    [itemsMe]
  );

  const groupByCategory = (itemList: any[]) => {
    const map = new Map<string, { list: any[]; subtotal: number }>();
    itemList.forEach((it) => {
      const cat = (it.kategori_pekerjaan || "PEKERJAAN LAINNYA").trim();
      if (!map.has(cat)) {
        map.set(cat, { list: [], subtotal: 0 });
      }
      const group = map.get(cat)!;
      group.list.push(it);
      group.subtotal += Number(it.total_harga || 0);
    });
    return Array.from(map.entries()).map(([kategori, data]) => ({
      kategori,
      list: data.list,
      subtotal: data.subtotal,
    }));
  };

  const sipilCategories = useMemo(() => groupByCategory(itemsSipil), [itemsSipil]);
  const meCategories = useMemo(() => groupByCategory(itemsMe), [itemsMe]);

  // Helper penentu link berkas dokumen aanwijzing (Foto Lingkungan & Gambar Teknis):
  // Jika user internal (BBM, DC Specialist, Admin / !isKontraktor), buka langsung tautan Google Drive mentah tanpa proxy.
  // Jika rekanan/kontraktor eksternal, gunakan streaming proxy SPARTA.
  const getDocumentUrl = (doc: any) => {
    if (!isKontraktor) {
      if (doc.file_url && (doc.file_url.startsWith("http://") || doc.file_url.startsWith("https://"))) {
        return doc.file_url;
      }
      if (doc.drive_file_id) {
        return `https://drive.google.com/file/d/${doc.drive_file_id}/view`;
      }
    }
    if (doc.id) {
      return `/api/dc-development/klarifikasi-aanwijzing/dokumen/${doc.id}/proxy`;
    }
    if (doc.drive_file_id) {
      return `/api/dc-development/klarifikasi-aanwijzing/dokumen/0/proxy?drive_id=${doc.drive_file_id}&nama=${encodeURIComponent(doc.nama_file || "dokumen")}`;
    }
    return doc.file_url || "#";
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigasi Review */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab("FINANSIAL")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === "FINANSIAL"
              ? "bg-[#E65F2B] text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
          >
            Ringkasan Finansial Penawaran
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("FOTO")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === "FOTO"
              ? "bg-[#E65F2B] text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
          >
            Foto Lingkungan ({fotoLingkungan.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("GAMBAR")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${activeTab === "GAMBAR"
              ? "bg-[#E65F2B] text-white shadow-xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
          >
            Gambar Teknis ({gambarTeknis.length})
          </button>
        </div>

        <div className="text-right px-2">
          <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Nilai Penawaran:</span>
          <div className="text-sm font-bold text-[#E65F2B] font-mono">Rp {formatNumber(penawaran.grand_total)}</div>
        </div>
      </div>

      {/* Konten Tab 1: Finansial */}
      {activeTab === "FINANSIAL" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setLingkupFilter((prev) => (prev === "SIPIL" ? "SEMUA" : "SIPIL"))}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${lingkupFilter === "SIPIL"
                  ? "bg-orange-50/70 border-[#E65F2B] ring-2 ring-[#E65F2B]/30"
                  : "bg-white border-slate-200/80 hover:border-slate-300"
                }`}
              title="Klik untuk filter hanya Pekerjaan Sipil"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Subtotal Pekerjaan Sipil
                </span>
                {lingkupFilter === "SIPIL" && (
                  <span className="text-[9px] bg-[#E65F2B] text-white px-1.5 py-0.5 rounded font-bold uppercase">
                    Aktif
                  </span>
                )}
              </div>
              <div className="text-lg font-bold text-slate-900 font-mono mt-1">
                Rp {formatNumber(totalSipil || penawaran.total_biaya_sipil)}
              </div>
              <span className="text-[11px] text-slate-400">
                {itemsSipil.length} Item Pekerjaan (Klik untuk filter)
              </span>
            </div>

            <div
              onClick={() => setLingkupFilter((prev) => (prev === "ME" ? "SEMUA" : "ME"))}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${lingkupFilter === "ME"
                  ? "bg-orange-50/70 border-[#E65F2B] ring-2 ring-[#E65F2B]/30"
                  : "bg-white border-slate-200/80 hover:border-slate-300"
                }`}
              title="Klik untuk filter hanya Pekerjaan ME"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Subtotal Pekerjaan ME
                </span>
                {lingkupFilter === "ME" && (
                  <span className="text-[9px] bg-[#E65F2B] text-white px-1.5 py-0.5 rounded font-bold uppercase">
                    Aktif
                  </span>
                )}
              </div>
              <div className="text-lg font-bold text-slate-900 font-mono mt-1">
                Rp {formatNumber(totalMe || penawaran.total_biaya_me)}
              </div>
              <span className="text-[11px] text-slate-400">
                {itemsMe.length} Item Pekerjaan (Klik untuk filter)
              </span>
            </div>

            <div
              onClick={() => setLingkupFilter("SEMUA")}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-xs ${lingkupFilter === "SEMUA"
                  ? "bg-orange-50/80 border-[#E65F2B] ring-2 ring-[#E65F2B]/30"
                  : "bg-orange-50/50 border-orange-200/80 hover:border-orange-300"
                }`}
              title="Klik untuk menampilkan semua lingkup"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[#E65F2B] uppercase tracking-wider">
                  Grand Total Penawaran
                </span>
                {lingkupFilter === "SEMUA" && (
                  <span className="text-[9px] bg-[#E65F2B] text-white px-1.5 py-0.5 rounded font-bold uppercase">
                    Semua
                  </span>
                )}
              </div>
              <div className="text-xl font-bold text-[#E65F2B] font-mono mt-1">
                Rp {formatNumber(penawaran.grand_total)}
              </div>
              <span className="text-[11px] text-orange-600/80 font-medium">
                Target Durasi: {penawaran.durasi_pekerjaan_hari} Hari ({penawaran.items?.length || 0} Total Item)
              </span>
            </div>
          </div>

          {/* Card Kelengkapan Dokumen & Asuransi Proyek */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-xl bg-orange-50 border border-orange-200 text-[#E65F2B] flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-slate-900 text-sm">{penawaran.vendor_nama}</h3>
                    <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Rekanan Terdaftar
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                    <span>
                      Polis Asuransi CAR:{" "}
                      <strong className="text-slate-700 font-mono">
                        {penawaran.asuransi_no_polis || "-"}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Masa Berlaku:{" "}
                      <strong className="text-slate-700">
                        {penawaran.asuransi_masa_berlaku
                          ? new Date(penawaran.asuransi_masa_berlaku).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })
                          : "-"}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {penawaran.kontraktor_logo_url && (
                  <a
                    href={`/api/dc-development/penawaran-rekanan/${penawaran.id}/dokumen-proxy/logo`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs font-semibold text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-[#E65F2B]" />
                    <span>Lihat Logo</span>
                  </a>
                )}
                {penawaran.analisa_harga_url && (
                  <a
                    href={`/api/dc-development/penawaran-rekanan/${penawaran.id}/dokumen-proxy/ahs`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                    <span>Unduh AHS (Excel)</span>
                  </a>
                )}
                {penawaran.asuransi_file_url && (
                  <a
                    href={`/api/dc-development/penawaran-rekanan/${penawaran.id}/dokumen-proxy/asuransi`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition-all shadow-2xs"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                    <span>Lihat Polis (PDF)</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Pill Selector Filter Lingkup */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setLingkupFilter("SEMUA")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${lingkupFilter === "SEMUA"
                    ? "bg-white text-slate-800 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                Semua Lingkup ({penawaran.items?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setLingkupFilter("SIPIL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${lingkupFilter === "SIPIL"
                    ? "bg-[#E65F2B] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                Pekerjaan Sipil ({itemsSipil.length})
              </button>
              <button
                type="button"
                onClick={() => setLingkupFilter("ME")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${lingkupFilter === "ME"
                    ? "bg-[#E65F2B] text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                Pekerjaan ME ({itemsMe.length})
              </button>
            </div>

            <span className="text-xs text-slate-400 font-medium">
              {lingkupFilter === "SEMUA"
                ? "Menampilkan tabel terpisah untuk Pekerjaan Sipil dan Pekerjaan ME"
                : `Menampilkan hanya tabel Pekerjaan ${lingkupFilter}`}
            </span>
          </div>

          {/* TABEL A: PEKERJAAN SIPIL */}
          {(lingkupFilter === "SEMUA" || lingkupFilter === "SIPIL") && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <span className="w-6 h-6 rounded-lg bg-[#E65F2B] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    A
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      Item Pekerjaan Sipil ({itemsSipil.length} Item)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Pekerjaan persiapan, pondasi, struktur, dinding, lantai, dan arsitektur
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Subtotal Sipil:</span>
                  <div className="text-sm font-bold text-[#E65F2B] font-mono">
                    Rp {formatNumber(totalSipil)}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/40 border-b border-slate-200/70 text-slate-600 font-medium uppercase tracking-wider">
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      <th className="py-2.5 px-3">Deskripsi Pekerjaan</th>
                      <th className="py-2.5 px-3 w-28 text-center">Volume</th>
                      <th className="py-2.5 px-3 w-32 text-right">Harga Material</th>
                      <th className="py-2.5 px-3 w-32 text-right">Harga Upah</th>
                      <th className="py-2.5 px-3 w-36 text-right">Total (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemsSipil.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                          Tidak ada item pekerjaan sipil yang diajukan
                        </td>
                      </tr>
                    ) : (
                      (() => {
                        let runningItemNo = 0;
                        return sipilCategories.map((catGroup) => (
                          <React.Fragment key={`sipil-${catGroup.kategori}`}>
                            <tr className="bg-slate-100/75 border-y border-slate-200/80">
                              <td colSpan={5} className="py-2 px-3">
                                <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
                                  <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                  <span className="uppercase tracking-wider">{catGroup.kategori}</span>
                                  <span className="text-[11px] text-slate-400 font-normal">
                                    ({catGroup.list.length} Item)
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-700 text-xs">
                                Rp {formatNumber(catGroup.subtotal)}
                              </td>
                            </tr>
                            {catGroup.list.map((it: any) => {
                              runningItemNo++;
                              const itemNo = runningItemNo;
                              return (
                                <tr key={it.id} className="hover:bg-slate-50/40">
                                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono font-medium">{itemNo}</td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-800 text-[12px]">{it.deskripsi}</div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono">
                                    {it.volume} {it.satuan}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono">
                                    Rp {formatNumber(it.harga_material)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono">
                                    Rp {formatNumber(it.harga_upah)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                                    Rp {formatNumber(it.total_harga)}
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ));
                      })()
                    )}
                  </tbody>
                  {itemsSipil.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50/80 border-t border-slate-200 font-semibold">
                        <td colSpan={5} className="py-2.5 px-3 text-right text-slate-600">
                          Subtotal Pekerjaan Sipil :
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          Rp {formatNumber(totalSipil)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* TABEL B: PEKERJAAN ME */}
          {(lingkupFilter === "SEMUA" || lingkupFilter === "ME") && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <span className="w-6 h-6 rounded-lg bg-orange-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    B
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      Item Pekerjaan Mekanikal &amp; Elektrikal / ME ({itemsMe.length} Item)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Instalasi kelistrikan, panel, penerangan, AC, tata udara, plumbing, dan pemadam kebakaran
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Subtotal ME:</span>
                  <div className="text-sm font-bold text-[#E65F2B] font-mono">
                    Rp {formatNumber(totalMe)}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/40 border-b border-slate-200/70 text-slate-600 font-medium uppercase tracking-wider">
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      <th className="py-2.5 px-3">Deskripsi Pekerjaan</th>
                      <th className="py-2.5 px-3 w-28 text-center">Volume</th>
                      <th className="py-2.5 px-3 w-32 text-right">Harga Material</th>
                      <th className="py-2.5 px-3 w-32 text-right">Harga Upah</th>
                      <th className="py-2.5 px-3 w-36 text-right">Total (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemsMe.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                          Tidak ada item pekerjaan mekanikal &amp; elektrikal yang diajukan
                        </td>
                      </tr>
                    ) : (
                      (() => {
                        let runningItemNo = 0;
                        return meCategories.map((catGroup) => (
                          <React.Fragment key={`me-${catGroup.kategori}`}>
                            <tr className="bg-slate-100/75 border-y border-slate-200/80">
                              <td colSpan={5} className="py-2 px-3">
                                <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs">
                                  <Folder className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                  <span className="uppercase tracking-wider">{catGroup.kategori}</span>
                                  <span className="text-[11px] text-slate-400 font-normal">
                                    ({catGroup.list.length} Item)
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-700 text-xs">
                                Rp {formatNumber(catGroup.subtotal)}
                              </td>
                            </tr>
                            {catGroup.list.map((it: any) => {
                              runningItemNo++;
                              const itemNo = runningItemNo;
                              return (
                                <tr key={it.id} className="hover:bg-slate-50/40">
                                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono font-medium">{itemNo}</td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-800 text-[12px]">{it.deskripsi}</div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono">
                                    {it.volume} {it.satuan}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono">
                                    Rp {formatNumber(it.harga_material)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono">
                                    Rp {formatNumber(it.harga_upah)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                                    Rp {formatNumber(it.total_harga)}
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ));
                      })()
                    )}
                  </tbody>
                  {itemsMe.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50/80 border-t border-slate-200 font-semibold">
                        <td colSpan={5} className="py-2.5 px-3 text-right text-slate-600">
                          Subtotal Pekerjaan ME :
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          Rp {formatNumber(totalMe)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Rekapitulasi Akhir Penawaran BoQ */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Rekapitulasi Total Penawaran BoQ
              </span>
              <div className="text-xs text-slate-600 mt-0.5">
                {itemsSipil.length} Item Sipil (Rp {formatNumber(totalSipil)}) + {itemsMe.length} Item ME (Rp {formatNumber(totalMe)}) = {penawaran.items?.length || 0} Total Item
              </div>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] text-[#E65F2B] uppercase font-bold tracking-wider">
                Grand Total Penawaran
              </span>
              <div className="text-xl font-bold text-[#E65F2B] font-mono">
                Rp {formatNumber(penawaran.grand_total)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Konten Tab 2: Foto Lingkungan */}
      {activeTab === "FOTO" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Foto Lingkungan &amp; Kondisi Lapangan DC</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Dokumentasi foto eksisting lapangan dari tahap klarifikasi aanwijzing
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-orange-50 text-[#E65F2B] border border-orange-200/60 shrink-0 self-start sm:self-auto">
              Total {fotoLingkungan.length} Foto
            </span>
          </div>

          {fotoLingkungan.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Camera className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
              Tidak ada arsip foto lingkungan yang dilampirkan pada klarifikasi aanwijzing ini
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {fotoLingkungan.map((foto, idx) => {
                const targetUrl = getDocumentUrl(foto);
                return (
                  <div
                    key={foto.id || idx}
                    className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:border-orange-300 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#E65F2B] shrink-0 mt-0.5">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-slate-800 text-xs truncate" title={foto.nama_label || foto.nama_file}>
                          {foto.nama_label || foto.nama_file}
                        </h4>
                        <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5" title={foto.nama_file}>
                          {foto.nama_file}
                        </p>
                        {foto.lokasi_wilayah && (
                          <div className="flex items-center space-x-1 text-[11px] text-slate-500 mt-1.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{foto.lokasi_wilayah}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                        {foto.sumber || "FOTO"}
                      </span>
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs font-semibold text-[#E65F2B] hover:text-[#d04f1f] bg-orange-50 hover:bg-orange-100/70 border border-orange-200/80 px-3 py-1.5 rounded-lg transition-colors shadow-2xs cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                        Lihat Foto
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Konten Tab 3: Gambar Teknis */}
      {activeTab === "GAMBAR" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Gambar Teknis Arsitektur, Sipil &amp; ME (PDF &amp; DWG)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar berkas gambar teknis dan dokumen pendukung resmi dari panitia tender
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-orange-50 text-[#E65F2B] border border-orange-200/60 shrink-0 self-start sm:self-auto">
              Total {gambarTeknis.length} Berkas
            </span>
          </div>

          {gambarTeknis.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2 stroke-1" />
              Tidak ada lampiran gambar teknis yang tercatat pada klarifikasi aanwijzing ini
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
              {gambarTeknis.map((gbr, idx) => {
                const targetUrl = getDocumentUrl(gbr);
                const isDwg = gbr.nama_file?.toLowerCase().endsWith(".dwg");

                return (
                  <div key={gbr.id || idx} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center space-x-3 min-w-0 pr-3">
                      <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-200/60 flex items-center justify-center text-[#E65F2B] shrink-0">
                        {isDwg ? <FileCode className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 text-xs truncate" title={gbr.nama_file}>
                          {gbr.nama_file}
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">{gbr.kategori_file}</span>
                      </div>
                    </div>

                    <a
                      href={targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-[#E65F2B] hover:text-[#d04f1f] bg-orange-50 hover:bg-orange-100/70 border border-orange-200/80 px-3.5 py-1.5 rounded-lg font-semibold transition-colors shrink-0 shadow-2xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5" />
                      Lihat Berkas
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
