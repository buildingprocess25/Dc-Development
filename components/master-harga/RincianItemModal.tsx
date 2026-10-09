"use client";

import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { CABANG_TUNGGAL, CABANG_GRUP } from "@/lib/branches";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Info, MapPin, Building2, Save } from "lucide-react";
import { FeedbackModal } from "@/components/ui/feedback-modal";

interface RincianItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any | null;
  onSuccess?: () => void;
}

export default function RincianItemModal({ isOpen, onClose, item, onSuccess }: RincianItemModalProps) {
  const [activeBranches, setActiveBranches] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ open: boolean; type: "success" | "error"; title: string; message: string }>({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  useEffect(() => {
    if (isOpen && item) {
      if (item.item_cabang && Array.isArray(item.item_cabang)) {
        const active = item.item_cabang
          .filter((c: any) => c.status_aktif)
          .map((c: any) => c.coverage_cabang || c.cabang);
        setActiveBranches(new Set(active));
      } else {
        setActiveBranches(new Set());
      }
    }
  }, [isOpen, item]);

  const toggleBranch = (branch: string) => {
    setActiveBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branch)) {
        next.delete(branch);
      } else {
        next.add(branch);
      }
      return next;
    });
  };

  const toggleGroup = (groupName: string, subBranches: string[]) => {
    setActiveBranches((prev) => {
      const next = new Set(prev);
      const allActive = subBranches.every((b) => next.has(b));
      
      if (allActive) {
        // Deactivate all
        subBranches.forEach((b) => next.delete(b));
      } else {
        // Activate all
        subBranches.forEach((b) => next.add(b));
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!item) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/dc-development/master-harga/set-cabang', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          master_item_id: item.id,
          activeBranches: Array.from(activeBranches)
        })
      });

      if (!res.ok) throw new Error("Gagal menyimpan pengaturan cabang");
      
      setFeedback({
        open: true,
        type: "success",
        title: "Berhasil Disimpan",
        message: "Pengaturan cabang aktif telah berhasil disimpan.",
      });
    } catch (error: any) {
      console.error(error);
      setFeedback({
        open: true,
        type: "error",
        title: "Gagal Menyimpan",
        message: error.message || "Terjadi kesalahan saat menyimpan pengaturan.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFeedbackClose = () => {
    setFeedback((prev) => ({ ...prev, open: false }));
    if (feedback.type === "success") {
      if (onSuccess) onSuccess();
      onClose();
    }
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50">
        
        <DialogHeader className="px-6 py-4 border-b border-slate-200 bg-white sticky top-0 z-10">
          <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Info className="w-5 h-5 text-orange-500" />
            Rincian Item & Cabang
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Section: Rincian Item */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
            
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md mb-2 inline-block border border-blue-100">
                  {item.kode_anak}
                </span>
                <h3 className="text-lg font-bold text-slate-800">{item.item_material}</h3>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  {item.merk_brand !== "-" ? `${item.merk_brand} • ` : ""}
                  {item.ukuran_dimensi !== "-" ? item.ukuran_dimensi : ""}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md mb-1 inline-block">
                  {item.kategori_pekerjaan}
                </span>
                <p className="text-xs text-slate-400 font-medium">
                  Posisi: {item.lokasi_penerapan || "Seluruh Area"}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 mb-1">Deskripsi Otomatis</p>
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                {item.deskripsi_otomatis}
              </p>
            </div>
          </div>

          {/* Section: Pengaturan Cabang */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-500" />
                Pengaturan Cabang Aktif
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Aktifkan item ini pada cabang-cabang tertentu. Jika dinonaktifkan, item tidak akan muncul di sistem cabang tersebut.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Cabang Tunggal */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    Cabang Tunggal
                  </h4>
                </div>
                <div className="p-2 overflow-y-auto max-h-[300px]">
                  <div className="space-y-1">
                    {CABANG_TUNGGAL.map((cabang) => (
                      <div 
                        key={cabang} 
                        className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-lg transition-colors group cursor-pointer"
                        onClick={() => toggleBranch(cabang)}
                      >
                        <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                          {cabang}
                        </span>
                        <Switch 
                          checked={activeBranches.has(cabang)} 
                          onCheckedChange={() => toggleBranch(cabang)}
                          onClick={(e) => e.stopPropagation()}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cabang Grup */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    Grup Cabang
                  </h4>
                </div>
                <div className="p-2 overflow-y-auto max-h-[300px]">
                  <Accordion type="multiple" className="w-full">
                    {Object.entries(CABANG_GRUP).map(([groupName, subBranches]) => {
                      const allActive = subBranches.every((b) => activeBranches.has(b));
                      const someActive = subBranches.some((b) => activeBranches.has(b)) && !allActive;

                      return (
                        <AccordionItem value={groupName} key={groupName} className="border-b-0 px-2">
                          <div className="flex items-center justify-between w-full hover:bg-slate-50 rounded-lg group/item pr-2 transition-colors">
                            <AccordionTrigger className="flex-1 hover:no-underline py-3 px-2 justify-start gap-2">
                              <span className="text-sm font-bold text-slate-700 group-hover/item:text-slate-900">
                                {groupName}
                              </span>
                            </AccordionTrigger>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-full">
                                {subBranches.filter(b => activeBranches.has(b)).length}/{subBranches.length}
                              </span>
                              <Switch 
                                checked={allActive}
                                data-state={allActive ? "checked" : someActive ? "indeterminate" : "unchecked"}
                                onCheckedChange={() => toggleGroup(groupName, subBranches)}
                                className={`
                                  ${allActive ? 'bg-emerald-500' : ''} 
                                  ${someActive ? 'bg-emerald-200 border-emerald-500 border-2' : ''}
                                `}
                              />
                            </div>
                          </div>
                          <AccordionContent className="pb-3 pt-1">
                            <div className="pl-4 space-y-1 border-l-2 border-slate-100 ml-2 mt-1">
                              {subBranches.map((subBranch) => (
                                <div 
                                  key={subBranch} 
                                  className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer group"
                                  onClick={() => toggleBranch(subBranch)}
                                >
                                  <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900">
                                    {subBranch}
                                  </span>
                                  <Switch 
                                    checked={activeBranches.has(subBranch)} 
                                    onCheckedChange={() => toggleBranch(subBranch)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="scale-75 data-[state=checked]:bg-emerald-500"
                                  />
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              </div>

            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-200 bg-white">
          <div className="flex w-full justify-end gap-3">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
            </button>
          </div>
        </DialogFooter>
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
