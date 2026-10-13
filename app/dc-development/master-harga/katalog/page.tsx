"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ChevronRight, ChevronDown, Search, ArrowLeft } from "lucide-react";
import Dashboard from "@/components/dashboard/dashboard";
import { BranchFilterSelect } from "@/components/ui/branch-filter-select";
import Link from "next/link";

export default function KatalogHargaPage() {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lingkupTab, setLingkupTab] = useState<"SIPIL" | "ME">("SIPIL");
  const [search, setSearch] = useState("");
  const [selectedCabang, setSelectedCabang] = useState("all");

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const url = new URL('/api/dc-development/master-harga/katalog', window.location.origin);
      url.searchParams.append("lingkup", lingkupTab);
      if (selectedCabang !== "all") url.searchParams.append("cabang", selectedCabang);
      if (search) url.searchParams.append("search", search);

      const res = await fetch(url.toString());
      const text = await res.text();
      
      try {
        const json = JSON.parse(text);
        if (json.status === "success") {
          setItems(json.data);
        } else {
          console.error("API Error:", json.message);
        }
      } catch (err) {
        console.error("Failed to parse JSON. Response was:", text.substring(0, 200));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // debounce search
    const delayDebounceFn = setTimeout(() => {
      fetchItems();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [lingkupTab, selectedCabang, search]);

  // Process items into a flat list
  const flatItems = useMemo(() => {
    const variants: Record<string, { master_item: any, rawCabangs: any[] }> = {};
    items.forEach(item => {
        const vId = item.master_item_id.toString();
        if (!variants[vId]) {
            variants[vId] = { master_item: item.master_item, rawCabangs: [] };
        }
        variants[vId].rawCabangs.push(item);
    });

    const rows: any[] = [];

    for (const v of Object.values(variants)) {
        const byInduk: Record<string, any[]> = {};
        for (const c of v.rawCabangs) {
            if (!byInduk[c.cabang]) byInduk[c.cabang] = [];
            byInduk[c.cabang].push(c);
        }

        for (const [induk, itemsOfInduk] of Object.entries(byInduk)) {
            const byPrice: Record<string, any[]> = {};
            for (const item of itemsOfInduk) {
                const pKey = `${item.harga_release}_${item.total_material}_${item.total_upah}`;
                if (!byPrice[pKey]) byPrice[pKey] = [];
                byPrice[pKey].push(item);
            }
            
            const priceKeys = Object.keys(byPrice);
            if (priceKeys.length === 1) {
                rows.push({
                   ...itemsOfInduk[0],
                   displayCabang: induk,
                   master_item: v.master_item
                });
            } else {
                for (const pKey of priceKeys) {
                    const groupItems = byPrice[pKey];
                    const coverages = groupItems.map(i => i.coverage_cabang);
                    let displayCabang = `${induk} (${coverages.join(', ')})`;
                    if (coverages.length === 1 && coverages[0] === induk) {
                        displayCabang = induk;
                    }
                    rows.push({
                        ...groupItems[0],
                        displayCabang,
                        master_item: v.master_item
                    });
                }
            }
        }
    }

    return rows.sort((a, b) => {
        const cabCmp = a.displayCabang.localeCompare(b.displayCabang);
        if (cabCmp !== 0) return cabCmp;
        const katCmp = (a.master_item?.kategori_pekerjaan || "").localeCompare(b.master_item?.kategori_pekerjaan || "");
        if (katCmp !== 0) return katCmp;
        return (a.master_item?.item_material || "").localeCompare(b.master_item?.item_material || "");
    });
  }, [items]);
  return (
    <Dashboard title="Katalog Harga">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-4 lg:p-5 animate-in fade-in duration-500 overflow-y-auto h-[calc(100vh-60px)]">
        
        {/* Header Action / Toolbar */}
        <div className="bg-white p-2.5 lg:p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5 mb-4 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Link href="/dc-development/master-harga" className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-500">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            {/* TABS (MASTER vs DEPLOYED) */}
            <div className="flex bg-slate-50 p-1 rounded-full border border-slate-200 shadow-inner">
              <button
                onClick={() => setLingkupTab("SIPIL")}
                className={`px-6 py-1.5 text-xs font-bold rounded-full transition-all ${lingkupTab === "SIPIL" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                SIPIL
              </button>
              <button
                onClick={() => setLingkupTab("ME")}
                className={`px-6 py-1.5 text-xs font-bold rounded-full transition-all ${lingkupTab === "ME" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                ME
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* SEARCH */}
            <div className="relative w-full md:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Cari material, spesifikasi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
              />
            </div>

            {/* CABANG FILTER */}
            <div className="w-full md:w-56 z-50">
              <BranchFilterSelect
                value={selectedCabang}
                onChange={(val) => setSelectedCabang(val)}
                placeholder="Pilih Cabang..."
                triggerClassName="w-full rounded-full text-xs font-medium bg-white border-slate-200"
              />
            </div>
          </div>
        </div>

        {/* LIST CONTENT */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500 text-sm font-medium">Loading data...</div>
          ) : flatItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm font-medium">Tidak ada data ditemukan</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-4 w-[10%]">Kode</th>
                    <th className="p-4 w-[25%]">Nama Item (Spesifikasi)</th>
                    <th className="p-4 w-[20%]">Kategori & Lokasi</th>
                    <th className="p-4 w-[15%]">Cabang</th>
                    <th className="p-4 text-right">Material</th>
                    <th className="p-4 text-right">Upah</th>
                    <th className="p-4 text-right text-blue-600">Harga Release</th>
                  </tr>
                </thead>
                <tbody>
                  {flatItems.map((row, idx) => (
                    <tr key={`${row.id}_${idx}`} className="text-sm border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          {row.master_item?.kode_anak || '-'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800">{row.master_item?.item_material || '-'}</span>
                          <span className="text-xs text-slate-500">{row.master_item?.deskripsi_otomatis || '-'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-700">{row.master_item?.kategori_pekerjaan || '-'}</span>
                          <span className="text-[11px] text-slate-500">{row.master_item?.lokasi_penerapan || '-'}</span>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-slate-700">{row.displayCabang}</td>
                      <td className="p-4 text-right font-medium text-slate-600 whitespace-nowrap">
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-slate-400/70 font-normal text-xs">Rp</span>
                          <span>{row.total_material.toLocaleString('id-ID')}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right font-medium text-slate-600 whitespace-nowrap">
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-slate-400/70 font-normal text-xs">Rp</span>
                          <span>{row.total_upah.toLocaleString('id-ID')}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right font-bold text-blue-600 bg-blue-50/20 whitespace-nowrap">
                        <div className="flex justify-between items-center gap-4">
                          <span className="text-blue-400/70 font-normal text-xs">Rp</span>
                          <span>{row.harga_release.toLocaleString('id-ID')}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Dashboard>
  );
}
