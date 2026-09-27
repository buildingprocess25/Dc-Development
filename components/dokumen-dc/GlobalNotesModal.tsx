"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, FileText, Clock, Building2, Hammer, Maximize, User } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface GlobalNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any | null;
}

export default function GlobalNotesModal({ isOpen, onClose, project }: GlobalNotesModalProps) {
  const [loading, setLoading] = useState(true);
  const [notesData, setNotesData] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && project) {
      loadNotes();
    } else {
      setNotesData([]);
    }
  }, [isOpen, project]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/dc-development/dokumen-dc/${project.id}?fase=ALL`);
      const json = await res.json();
      if (json.success) {
        // We only care about documents that actually have a 'catatan'
        const docsWithNotes = json.data.dokumen.filter((d: any) => d.catatan && d.catatan.trim().length > 0);
        setNotesData(docsWithNotes);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const groupedNotes = useMemo(() => {
    const grouped: Record<string, Record<string, any[]>> = {
      PEMBANGUNAN: {},
      RENOVASI: {},
      PERLUASAN: {}
    };

    notesData.forEach(doc => {
      const fase = doc.fase_proyek;
      const kategori = doc.kategori;
      
      if (!grouped[fase]) grouped[fase] = {};
      if (!grouped[fase][kategori]) grouped[fase][kategori] = [];
      
      grouped[fase][kategori].push(doc);
    });

    return grouped;
  }, [notesData]);

  const phaseDetails = [
    { key: "PEMBANGUNAN", label: "Pembangunan", icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
    { key: "RENOVASI", label: "Renovasi", icon: Hammer, color: "text-amber-600", bg: "bg-amber-50" },
    { key: "PERLUASAN", label: "Perluasan", icon: Maximize, color: "text-emerald-600", bg: "bg-emerald-50" }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-slate-50 flex flex-col rounded-2xl border-0 shadow-2xl max-h-[90vh] h-full">
        
        {/* HEADER */}
        <div className="bg-white shrink-0 border-b border-[#EAEAEA] p-6 flex items-start justify-between relative z-10">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#E65F2B] flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#111111] flex items-center gap-2">
                Catatan
              </h2>
              <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-widest mt-1">
                <span>{project?.kode} {project?.nama_proyek}</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span>{project?.cabang}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E65F2B]"></div>
            </div>
          ) : notesData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <FileText className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-medium">Belum ada catatan di proyek ini.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-10 max-w-3xl mx-auto">
              {phaseDetails.map(phase => {
                const phaseGroup = groupedNotes[phase.key];
                const categories = Object.keys(phaseGroup || {});
                if (categories.length === 0) return null;

                const totalNotesInPhase = categories.reduce((sum, cat) => sum + phaseGroup[cat].length, 0);

                return (
                  <div key={phase.key} className="flex flex-col gap-5 animate-in slide-in-from-bottom-4 fade-in duration-500">
                    {/* PHASE HEADER */}
                    <div className="flex items-center gap-3 pb-2 border-b-2 border-slate-200">
                      <div className={cn("p-2 rounded-lg", phase.bg, phase.color)}>
                        <phase.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-[#111111] tracking-tight">{phase.label}</h3>
                        <p className="text-xs font-medium text-slate-500">{totalNotesInPhase} catatan pada tahap ini</p>
                      </div>
                    </div>

                    {/* CATEGORIES */}
                    <div className="flex flex-col gap-6 pl-2 md:pl-4 border-l-2 border-slate-100">
                      {categories.map(kategori => {
                        const items = phaseGroup[kategori];
                        return (
                          <div key={kategori} className="flex flex-col gap-3 relative">
                            {/* Connector dot */}
                            <div className="absolute -left-[21px] md:-left-[29px] top-2 w-3 h-3 bg-white border-2 border-[#E65F2B] rounded-full" />
                            
                            <h4 className="text-xs font-bold text-[#E65F2B] uppercase tracking-wider bg-orange-50 inline-block px-3 py-1.5 rounded-lg w-fit">
                              {kategori}
                            </h4>
                            
                            {/* ITEMS */}
                            <div className="flex flex-col gap-3 mt-1">
                              {items.map(doc => (
                                <div key={doc.id} className="bg-white border border-[#EAEAEA] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex justify-between items-start gap-4 mb-3">
                                    <div className="font-extrabold text-[#111111] text-sm">
                                      {doc.nama_item}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 whitespace-nowrap bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                      <Clock className="w-3 h-3" />
                                      {format(new Date(doc.updated_at || doc.created_at), "dd MMM yyyy", { locale: localeId })}
                                    </div>
                                  </div>
                                  
                                  <div className="bg-[#F9F9F9] border border-slate-100 rounded-lg p-3 text-sm text-slate-700 font-medium leading-relaxed mb-3 italic">
                                    "{doc.catatan}"
                                  </div>
                                  
                                  <div className="flex justify-end">
                                    <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                      <User className="w-3.5 h-3.5" />
                                      Oleh: <span className="text-[#E65F2B]">{doc.user_nama || doc.updated_by || 'Sistem'}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
