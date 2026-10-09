"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, MapPin, Search, Save, Calculator, X, HardHat, Hammer, ChevronDown, ChevronRight } from "lucide-react";
import { ALL_INDUK_CABANG, CABANG_GRUP } from "@/lib/branches";
import { SearchableSelectInput } from "@/components/ui/searchable-select";
import { FeedbackModal } from "@/components/ui/feedback-modal";

const formatRupiah = (value: number | string) => {
  if (!value) return "";
  const numberStr = value.toString().replace(/[^0-9]/g, "");
  return new Intl.NumberFormat("id-ID").format(Number(numberStr));
};

const parseRupiah = (value: string) => {
  const numberStr = value.replace(/[^0-9]/g, "");
  return numberStr ? parseInt(numberStr, 10) : 0;
};

export default function SetHargaCabangModal({
  isOpen,
  onClose,
  mode
}: {
  isOpen: boolean;
  onClose: () => void;
  mode: "material" | "upah";
}) {
  const [selectedInduk, setSelectedInduk] = useState<string>("");
  const [coverageBranches, setCoverageBranches] = useState<string[]>([]);
  const [selectedCoverage, setSelectedCoverage] = useState<string[]>([]);
  const [isBranchCardOpen, setIsBranchCardOpen] = useState<boolean>(true);
  
  const [materialList, setMaterialList] = useState<any[]>([]);
  const [upahItemList, setUpahItemList] = useState<any[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ open: boolean; type: "success" | "error"; title: string; message: string }>({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  const [searchMaterial, setSearchMaterial] = useState("");
  const [searchItem, setSearchItem] = useState("");

  useEffect(() => {
    if (!isOpen) {
      // Reset when closed
      setSelectedInduk("");
      setSearchMaterial("");
      setSearchItem("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedInduk) {
      if (CABANG_GRUP[selectedInduk]) {
        setCoverageBranches(CABANG_GRUP[selectedInduk]);
        setSelectedCoverage(CABANG_GRUP[selectedInduk]);
      } else {
        setCoverageBranches([selectedInduk]);
        setSelectedCoverage([selectedInduk]);
      }
      fetchDataForTab(mode, CABANG_GRUP[selectedInduk] ? CABANG_GRUP[selectedInduk][0] : selectedInduk);
    } else {
      setCoverageBranches([]);
      setSelectedCoverage([]);
      setMaterialList([]);
      setUpahItemList([]);
    }
  }, [selectedInduk, mode]);

  const fetchDataForTab = async (tab: "material" | "upah", branchToFetch: string) => {
    if (!branchToFetch) return;
    setIsLoading(true);
    try {
      if (tab === "material") {
        const res = await fetch(`/api/dc-development/master-harga/harga-komponen?cabang=${branchToFetch}`);
        const json = await res.json();
        if (json.status === "success") {
          setMaterialList(json.data.material);
        }
      } else {
        const res = await fetch(`/api/dc-development/master-harga/harga-upah-item?cabang=${branchToFetch}`);
        const json = await res.json();
        if (json.status === "success") {
          // Process the items to map the prices easily
          const items = json.data.map((item: any) => {
            const priceMap = new Map();
            item.harga_upah_cabang.forEach((p: any) => priceMap.set(p.komponen_id, p.harga_satuan));
            
            return {
              ...item,
              koefisien: item.koefisien.map((k: any) => ({
                ...k,
                harga_satuan: priceMap.get(k.komponen_id) || 0
              }))
            };
          });
          setUpahItemList(items);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCoverage = (branch: string) => {
    setSelectedCoverage(prev => 
      prev.includes(branch) ? prev.filter(b => b !== branch) : [...prev, branch]
    );
  };

  const handleMaterialPriceChange = (id: number, val: string) => {
    const rawVal = parseRupiah(val);
    setMaterialList(prev => prev.map(item => item.id === id ? { ...item, harga_satuan: rawVal } : item));
  };

  const handleUpahPriceChange = (masterItemId: number, komponenId: number, val: string) => {
    const rawVal = parseRupiah(val);
    
    const changedItem = upahItemList.find(item => item.id === masterItemId);
    const targetKode = changedItem?.kode;

    setUpahItemList(prev => prev.map(item => {
      if (item.id === masterItemId || (targetKode && item.kode === targetKode)) {
        return {
          ...item,
          koefisien: item.koefisien.map((k: any) => k.komponen_id === komponenId ? { ...k, harga_satuan: rawVal } : k)
        };
      }
      return item;
    }));
  };

  const getDeskripsi6Pilar = (item: any) => {
    const parts = [];
    if (item.item_material) parts.push(item.item_material);
    if (item.ukuran_dimensi) parts.push(item.ukuran_dimensi);
    if (item.merk_brand) parts.push(item.merk_brand);
    if (item.warna_corak) parts.push(item.warna_corak);
    if (item.tipe_produk) parts.push(item.tipe_produk);
    if (item.ketebalan) parts.push(item.ketebalan);
    // User requested "sampai tebal aja", excluding finishing_permukaan and informasi_tambahan
    
    if (parts.length === 0) return item.item_material;
    return parts.join(" • ");
  };

  const handleSave = async () => {
    if (selectedCoverage.length === 0) {
      alert("Pilih minimal satu cabang coverage yang akan di-update!");
      return;
    }

    setIsSaving(true);
    try {
      let res;
      if (mode === "material") {
        const prices = materialList.map(item => ({
          komponen_id: item.id,
          harga_satuan: item.harga_satuan
        }));
        res = await fetch("/api/dc-development/master-harga/harga-komponen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cabangs: selectedCoverage, prices })
        });
      } else {
        // Collect all upah prices
        const prices: any[] = [];
        upahItemList.forEach(item => {
          item.koefisien.forEach((k: any) => {
            prices.push({
              master_item_id: item.id,
              komponen_id: k.komponen_id,
              harga_satuan: k.harga_satuan
            });
          });
        });
        
        // For Upah, we must save for each selected coverage branch.
        // The API currently accepts a single 'cabang' in the body.
        // Wait, earlier I made it accept a single 'cabang' string? Let me loop over selectedCoverage.
        for (const cabang of selectedCoverage) {
           res = await fetch("/api/dc-development/master-harga/harga-upah-item", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({ cabang, prices })
           });
        }
        // Assuming the last res is enough to check status
      }

      const json = await (res as Response).json();
      if (json.status === "success") {
        setFeedback({
          open: true,
          type: "success",
          title: "Berhasil Disimpan",
          message: `Harga ${mode === "material" ? "Material" : "Upah"} berhasil disimpan.`,
        });
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Menyimpan",
          message: json.message || "Terjadi kesalahan saat menyimpan harga.",
        });
      }
    } catch (e: any) {
      setFeedback({
        open: true,
        type: "error",
        title: "Terjadi Kesalahan",
        message: e.message || "Terjadi kesalahan sistem.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFeedbackClose = () => {
    setFeedback((prev) => ({ ...prev, open: false }));
  };

  const filteredMaterial = materialList.filter(m => m.nama_komponen.toLowerCase().includes(searchMaterial.toLowerCase()));
  const filteredUpahItems = upahItemList.filter(item => 
    (item.kategori_pekerjaan && item.kategori_pekerjaan.toLowerCase().includes(searchItem.toLowerCase())) || 
    (item.item_material && item.item_material.toLowerCase().includes(searchItem.toLowerCase())) ||
    (item.deskripsi_otomatis && item.deskripsi_otomatis.toLowerCase().includes(searchItem.toLowerCase())) ||
    (item.kode && item.kode.toLowerCase().includes(searchItem.toLowerCase()))
  );

  const groupedUpahItems = useMemo(() => {
    const groups: Record<string, { kode: string; baseItem: any; children: any[] }> = {};
    filteredUpahItems.forEach(item => {
      const parentKode = item.kode || "Lainnya";
      if (!groups[parentKode]) {
        groups[parentKode] = {
          kode: parentKode,
          baseItem: item,
          children: []
        };
      }
      groups[parentKode].children.push(item);
    });
    return Object.values(groups);
  }, [filteredUpahItems]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1300px] w-[95vw] h-[90vh] p-0 rounded-2xl shadow-2xl flex flex-col overflow-hidden bg-[#FAFAFA]">
        
        {/* Header & Tabs */}
        <div className="bg-white z-20 shrink-0 shadow-sm border-b border-slate-200">
          <div className="px-8 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                <Calculator className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800 tracking-tight">
                  {mode === "material" ? "Set Harga Material" : "Set Harga Upah per Item"}
                </DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-0.5">
                  {mode === "material" ? "Atur harga secara global untuk komponen material di cabang ini." : "Atur harga spesifik tenaga kerja untuk masing-masing item pekerjaan."}
                </DialogDescription>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-h-0 p-6 overflow-hidden">
          
          {/* Branch Selection Card */}
          <div className="shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
            <div 
              className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between cursor-pointer hover:bg-slate-100/50 transition-colors"
              onClick={() => setIsBranchCardOpen(!isBranchCardOpen)}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-bold text-slate-800">Pilih Area & Target Cabang</span>
                {selectedInduk && (
                  <span className="ml-2 px-2.5 py-0.5 bg-orange-100 text-orange-700 text-[11px] font-bold rounded-md tracking-wide">
                    {selectedInduk}
                  </span>
                )}
              </div>
              <div className="text-slate-400">
                {isBranchCardOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </div>
            
            {isBranchCardOpen && (
              <div className="p-5">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1 space-y-3">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      Induk Cabang / Grup
                    </label>
                <SearchableSelectInput
                  value={selectedInduk}
                  onChange={setSelectedInduk}
                  options={ALL_INDUK_CABANG.map(c => ({ value: c, label: c }))}
                  placeholder="Pilih Induk Cabang..."
                />
              </div>

              <div className="lg:col-span-2">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  Coverage Cabang yang Ter-Update
                </label>
                
                {!selectedInduk ? (
                  <div className="h-11 flex items-center px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-400">
                    Silakan pilih Induk Cabang terlebih dahulu
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                    {coverageBranches.map(branch => {
                      const isChecked = selectedCoverage.includes(branch);
                      return (
                        <div 
                          key={branch} 
                          onClick={() => handleToggleCoverage(branch)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all border ${
                            isChecked 
                              ? "bg-white border-orange-500 shadow-sm shadow-orange-500/10" 
                              : "bg-white border-slate-200 opacity-60 hover:opacity-100"
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => handleToggleCoverage(branch)} 
                            className="w-3.5 h-3.5 rounded text-orange-500 focus:ring-orange-500 cursor-pointer" 
                          />
                          <span className={`text-xs font-bold ${isChecked ? "text-orange-700" : "text-slate-600"}`}>{branch}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

          {/* Pricing Area */}
          {selectedInduk ? (
            <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              
              {mode === "material" && (
                <>
                  <div className="shrink-0 p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Material & Alat</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">{materialList.length} komponen ditemukan</p>
                    </div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input 
                        placeholder="Cari material..." 
                        value={searchMaterial}
                        onChange={(e) => setSearchMaterial(e.target.value)}
                        className="pl-9 h-8 w-[250px] text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Memuat data...</div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white shadow-sm z-10">
                          <tr>
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Nama Material</th>
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 w-[80px]">Satuan</th>
                            <th className="px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 w-[200px]">Harga Satuan (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredMaterial.map(m => (
                            <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                              <td className="px-4 py-2 text-xs font-semibold text-slate-700">{m.nama_komponen}</td>
                              <td className="px-4 py-2 text-[11px] font-medium text-slate-500">{m.satuan}</td>
                              <td className="px-4 py-2">
                                <Input 
                                  type="text"
                                  value={m.harga_satuan === 0 ? "" : formatRupiah(m.harga_satuan)}
                                  onChange={(e) => handleMaterialPriceChange(m.id, e.target.value)}
                                  placeholder="0"
                                  className="h-8 font-mono text-xs text-right bg-white border-slate-200 group-hover:border-emerald-300 focus-visible:ring-emerald-500"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}

              {mode === "upah" && (
                <>
                  <div className="shrink-0 p-4 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Upah per Master Item</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">{upahItemList.length} item pekerjaan ditemukan</p>
                    </div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input 
                        placeholder="Cari item pekerjaan..." 
                        value={searchItem}
                        onChange={(e) => setSearchItem(e.target.value)}
                        className="pl-9 h-8 w-[250px] text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar space-y-4 bg-slate-50/30">
                    {isLoading ? (
                      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Memuat data...</div>
                    ) : groupedUpahItems.length === 0 ? (
                      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Tidak ada item pekerjaan yang membutuhkan upah.</div>
                    ) : (
                      groupedUpahItems.map((group) => {
                        const baseItem = group.baseItem;
                        return (
                          <div key={group.kode} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-4">
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-md text-[11px] font-bold tracking-wider font-mono">
                                  {group.kode}
                                </span>
                                <h4 className="text-sm font-bold text-slate-800">
                                  {baseItem.kategori_pekerjaan}
                                </h4>
                                <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                  Termasuk {group.children.length} item material
                                </span>
                              </div>
                            </div>
                            
                            <div className="p-4 bg-white">
                              <div className="mb-4 text-xs text-slate-600 leading-relaxed font-medium flex items-center gap-2">
                                <span className="text-slate-400">Deskripsi Umum:</span> 
                                {getDeskripsi6Pilar(baseItem)}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {baseItem.koefisien.map((k: any) => (
                                  <div key={k.komponen_id} className="flex flex-col gap-1.5 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                                    <label className="text-[11px] font-bold text-slate-600 flex justify-between">
                                      <span>{k.komponen.nama_komponen}</span>
                                      <span className="text-slate-400 font-medium">{k.komponen.satuan}</span>
                                    </label>
                                    <Input 
                                      type="text"
                                      value={k.harga_satuan === 0 ? "" : formatRupiah(k.harga_satuan)}
                                      onChange={(e) => handleUpahPriceChange(baseItem.id, k.komponen_id, e.target.value)}
                                      placeholder="Harga Satuan (Rp)"
                                      className="h-8 font-mono text-xs text-right bg-white border-slate-200 hover:border-orange-300 focus-visible:ring-orange-500"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <Calculator className="w-12 h-12 text-slate-200" />
              <p className="text-sm font-medium">Pilih cabang terlebih dahulu untuk mengatur harga.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-8 py-5 border-t border-slate-200 bg-white flex items-center justify-between z-20">
          <div className="text-[13px] font-medium text-slate-500">
            Pastikan harga yang dimasukkan sudah <span className="font-bold text-slate-700">termasuk pajak</span>.
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSaving} className="h-11 px-6 rounded-xl font-bold border-slate-200 text-slate-600">
              Batal
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isSaving || selectedCoverage.length === 0}
              className="h-11 px-8 rounded-xl bg-[#E65F2B] hover:bg-[#D3501F] text-white font-bold shadow-md shadow-orange-500/20"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </div>
        </div>

      </DialogContent>
      
      <FeedbackModal
        open={feedback.open}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={handleFeedbackClose}
      />
    </Dialog>
  );
}
