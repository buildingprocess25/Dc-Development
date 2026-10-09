"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Plus, Download, FileSpreadsheet, Calculator, HardHat, Hammer, ChevronRight, ChevronDown } from "lucide-react";
import TambahItemModal from "@/components/master-harga/TambahItemModal";
import TambahKomponenModal from "@/components/master-harga/TambahKomponenModal";
import SetHargaCabangModal from "@/components/master-harga/SetHargaCabangModal";
import RincianItemModal from "@/components/master-harga/RincianItemModal";
import Dashboard from "@/components/dashboard/dashboard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MasterHargaPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isKomponenModalOpen, setIsKomponenModalOpen] = useState(false);
  const [hargaCabangModalMode, setHargaCabangModalMode] = useState<"material" | "upah" | null>(null);
  const [isRincianModalOpen, setIsRincianModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lingkupTab, setLingkupTab] = useState<"SIPIL" | "ME">("SIPIL");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group items by 'kode' (Kode Induk)
  const groupedItems = useMemo(() => {
    const groups: Record<string, { kode: string; baseItem: any; children: any[] }> = {};

    items.forEach(item => {
      const parentKode = item.kode || "Uncategorized";
      if (!groups[parentKode]) {
        groups[parentKode] = {
          kode: parentKode,
          baseItem: item, // The first item acts as the base representative
          children: []
        };
      }
      groups[parentKode].children.push(item);
    });

    return Object.values(groups);
  }, [items]);

  const toggleGroup = (kode: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(kode)) {
        next.delete(kode);
      } else {
        next.add(kode);
      }
      return next;
    });
  };

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dc-development/master-harga/list?lingkup=${lingkupTab}`);
      const json = await res.json();
      if (json.status === "success") {
        setItems(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [lingkupTab]);

  return (
    <Dashboard title="Master Harga">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-4 lg:p-5 animate-in fade-in duration-500 overflow-y-auto h-[calc(100vh-60px)]">
        {/* Header Action / Toolbar */}
        <div className="bg-white p-2.5 lg:p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5 mb-4 sticky top-0 z-20">

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

          <div className="flex items-center gap-2 w-full md:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm"
                >
                  <Calculator className="w-4 h-4 text-blue-500" />
                  Set Harga Cabang
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1 rounded-xl shadow-lg border-slate-100">
                <DropdownMenuItem onClick={() => setHargaCabangModalMode("material")} className="cursor-pointer py-2 px-3 focus:bg-emerald-50 rounded-lg group transition-colors">
                  <div className="flex gap-3 items-start">
                    <div className="mt-0.5 bg-emerald-100 p-1.5 rounded-md text-emerald-600 group-hover:bg-emerald-200 transition-colors">
                      <Hammer className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm text-slate-700">Harga Material</span>
                      <span className="text-[11px] text-slate-500 leading-tight">Setting global per cabang</span>
                    </div>
                  </div>
                </DropdownMenuItem>
                
                <DropdownMenuItem onClick={() => setHargaCabangModalMode("upah")} className="cursor-pointer py-2 px-3 focus:bg-orange-50 rounded-lg group transition-colors mt-1">
                  <div className="flex gap-3 items-start">
                    <div className="mt-0.5 bg-orange-100 p-1.5 rounded-md text-orange-600 group-hover:bg-orange-200 transition-colors">
                      <HardHat className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm text-slate-700">Upah per Item</span>
                      <span className="text-[11px] text-slate-500 leading-tight">Harga borongan spesifik item</span>
                    </div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={() => setIsKomponenModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm"
            >
              <HardHat className="w-4 h-4 text-slate-500" />
              Kelola Komponen
            </button>

            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Ekspor
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#E65F2B] hover:bg-[#D3501F] rounded-full transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4" />
              Tambah Item
            </button>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-600">
                <tr>
                  <th className="px-6 py-4 text-center w-16">No</th>
                  <th className="px-6 py-4 text-blue-600">Kode Induk</th>
                  <th className="px-6 py-4">Material & Spesifikasi</th>
                  <th className="px-6 py-4">Kategori & Lokasi</th>
                  <th className="px-6 py-4 text-center">Cabang Aktif</th>
                  <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                      Memuat data master...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center">
                        <Calculator className="w-12 h-12 text-slate-200 mb-3" />
                        <p className="font-semibold text-slate-500 text-lg">Belum ada Master Item</p>
                        <p className="text-sm mt-1">Klik "Tambah Item Baru" untuk membuat harga satuan baru.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  groupedItems.map((group, index) => {
                    const isExpanded = expandedGroups.has(group.kode);
                    const base = group.baseItem;

                    return (
                      <React.Fragment key={group.kode}>
                        {/* PARENT ROW */}
                        <tr
                          onClick={() => toggleGroup(group.kode)}
                          className="bg-white hover:bg-slate-50 transition-colors cursor-pointer group/row border-b border-slate-100"
                        >
                          <td className="px-6 py-5 text-center font-bold text-slate-700">
                            <div className="flex items-center justify-center gap-2">
                              {index + 1}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                              <span className="text-slate-700 font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs shadow-sm">{group.kode}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-slate-800 text-sm">{base.item_material}</span>
                              <span className="text-xs text-slate-500 font-medium">
                                {base.merk_brand && base.merk_brand !== '-' ? `${base.merk_brand} • ` : ''}
                                {base.ukuran_dimensi && base.ukuran_dimensi !== '-' ? base.ukuran_dimensi : ''}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-slate-700 text-sm">{base.kategori_pekerjaan}</span>
                              <span className="text-xs text-slate-500">
                                Posisi: {base.lokasi_penerapan || "Seluruh Area"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className="bg-slate-100 text-slate-600 font-bold text-[11px] px-3 py-1 rounded-full">
                              {group.children.length} Varian
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 group-hover/row:text-orange-600 transition-colors">
                              <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              {isExpanded ? "Tutup" : "Buka"}
                            </div>
                          </td>
                        </tr>

                        {/* CHILD ROWS (EXPANDED) */}
                        {isExpanded && group.children.map((child, childIndex) => {
                          // Extract specific variations (Tipe, dll) if needed
                          let extraSpecs = child.tipe_produk && child.tipe_produk !== '-' ? `Tipe ${child.tipe_produk}` : '';

                          return (
                            <tr key={child.id} className="bg-[#FAFAFA] hover:bg-orange-50/40 transition-colors border-b border-slate-100/70 last:border-b-0 relative">

                              <td className="px-6 py-4 text-center relative">
                                <span className="text-slate-300">-</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2 pl-2">
                                  <span className="text-slate-300 font-serif text-lg">↳</span>
                                  <span className="text-blue-600 font-bold bg-blue-50/50 border border-blue-100 px-3 py-1 rounded-lg text-[11px]">{child.kode_anak}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                  <span className="font-bold text-slate-800 text-xs">{child.item_material}</span>
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {child.merk_brand && child.merk_brand !== '-' ? `${child.merk_brand} • ` : ''}
                                    {child.deskripsi_otomatis?.substring(0, 40)}...
                                  </span>
                                  <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                                    {child.deskripsi_otomatis}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1">
                                  <span className="font-bold text-slate-700 text-xs">{child.lokasi_penerapan || child.kategori_pekerjaan}</span>
                                  <span className="text-[11px] text-slate-400">{child.kategori_pekerjaan}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                {(() => {
                                  const activeBranches = child.item_cabang 
                                    ? child.item_cabang.filter((c: any) => c.status_aktif).map((c: any) => c.cabang) 
                                    : [];
                                  const activeCount = new Set(activeBranches).size;

                                  if (activeCount > 0) {
                                    return (
                                      <span className="inline-flex whitespace-nowrap bg-emerald-50 border border-emerald-100 text-emerald-600 font-bold text-[10px] px-3 py-1 rounded-full shadow-sm">
                                        {activeCount} Cabang Aktif
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="inline-flex whitespace-nowrap bg-white border border-slate-200 text-slate-500 font-semibold text-[10px] px-3 py-1 rounded-full shadow-sm">
                                      Belum Ada Cabang
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <button 
                                  onClick={() => {
                                    setSelectedItem(child);
                                    setIsRincianModalOpen(true);
                                  }}
                                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-orange-600 transition-all shadow-sm mx-auto"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></svg>
                                  Rincian
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <TambahItemModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            fetchItems();
          }}
        />
        <TambahKomponenModal
          isOpen={isKomponenModalOpen}
          onClose={() => setIsKomponenModalOpen(false)}
          onSuccess={() => {
            // Komponen berhasil ditambah, data bisa di-refresh jika perlu (meskipun tidak ada list komponen di page ini)
          }}
        />
        <SetHargaCabangModal
          isOpen={hargaCabangModalMode !== null}
          onClose={() => setHargaCabangModalMode(null)}
          mode={hargaCabangModalMode || "material"}
        />
        <RincianItemModal
          isOpen={isRincianModalOpen}
          onClose={() => setIsRincianModalOpen(false)}
          item={selectedItem}
          onSuccess={fetchItems}
        />
      </div>
    </Dashboard>
  );
}
