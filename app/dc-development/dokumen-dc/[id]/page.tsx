"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { 
  ArrowLeft, Save, Edit3, X, 
  UploadCloud, CheckCircle2, AlertCircle, 
  ExternalLink, Loader2, ChevronDown, Download, History, Info
} from "lucide-react";
import { PEMBANGUNAN_TEMPLATE, RENOVASI_TEMPLATE, PERLUASAN_TEMPLATE } from "@/lib/constants/dokumen-dc";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type DokumenDB = {
  id: number;
  kategori: string;
  nama_dokumen: string;
  file_url: string | null;
  catatan: string | null;
};

// Singkatan untuk sidebar legenda
const LEGENDA = [
  { singkatan: "IMB", arti: "Izin Mendirikan Bangunan" },
  { singkatan: "AMDAL", arti: "Analisis Mengenai Dampak Lingkungan" },
  { singkatan: "UKL - UPL", arti: "Upaya Pengelolaan Lingkungan Hidup dan Upaya Pemantauan Lingkungan Hidup" },
  { singkatan: "PBG", arti: "Persetujuan Bangunan Gedung" },
  { singkatan: "NIDI", arti: "Nomor Identitas Instalasi Tenaga Listrik" },
  { singkatan: "SLF", arti: "Sertifikat Layak Fungsi" },
  { singkatan: "SLO", arti: "Sertifikat Layak Operasional" },
  { singkatan: "SIPA", arti: "Surat Izin Pengusahaan Air Tanah" },
  { singkatan: "SPK", arti: "Surat Perintah Kerja" },
  { singkatan: "KAK & TOR", arti: "Kerangka Acuan Kerja & Terms of Reference" },
  { singkatan: "BAST", arti: "Berita Acara Serah Terima" }
];

export default function DetailDokumenDcPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = params.id as string;
  const initialFase = searchParams.get('fase') || "PEMBANGUNAN";

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [activeFase] = useState(initialFase);
  
  // Data Database
  const [dbDokumen, setDbDokumen] = useState<DokumenDB[]>([]);
  
  // Edit Mode (per kategori)
  const [editModes, setEditModes] = useState<Record<string, boolean>>({});
  
  // State Edit Data
  const [editState, setEditState] = useState<Record<string, {
    file_url?: string;
    catatan?: string;
    isUploading?: boolean;
    uploadError?: string;
  }>>({});
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async (fase: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/dc-development/dokumen-dc/${projectId}?fase=${fase}`);
      const json = await res.json();
      if (json.success) {
        setProject(json.project);
        setDbDokumen(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(activeFase);
  }, [activeFase, projectId]);

  // Master Data (Nested)
  const masterTemplate = useMemo(() => {
    if (activeFase === "PEMBANGUNAN") return PEMBANGUNAN_TEMPLATE;
    if (activeFase === "RENOVASI") return RENOVASI_TEMPLATE;
    return PERLUASAN_TEMPLATE;
  }, [activeFase]);

  // Hitung Total Slots (Semua jenis file dari semua item)
  const totalRequired = useMemo(() => {
    return masterTemplate.reduce((acc, cat) => 
      acc + cat.items.reduce((sum, item) => sum + item.jenis_file.length, 0)
    , 0);
  }, [masterTemplate]);

  const totalUploaded = useMemo(() => {
    return dbDokumen.filter(d => d.file_url).length;
  }, [dbDokumen]);

  // Handler Upload
  const handleFileUpload = async (keyId: string, kategori: string, file: File) => {
    setEditState(prev => ({
      ...prev,
      [keyId]: { ...prev[keyId], isUploading: true, uploadError: "" }
    }));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("kategori", kategori);
    formData.append("fase", activeFase);

    try {
      const res = await fetch(`/api/dc-development/dokumen-dc/${projectId}/upload`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (json.success) {
        setEditState(prev => ({
          ...prev,
          [keyId]: { ...prev[keyId], file_url: json.data.file_url, isUploading: false }
        }));
      } else {
        throw new Error(json.message);
      }
    } catch (err: any) {
      setEditState(prev => ({
        ...prev,
        [keyId]: { ...prev[keyId], isUploading: false, uploadError: err.message || "Gagal upload" }
      }));
    }
  };

  // Handler Simpan
  const handleSimpan = async (kategori: string) => {
    // Kumpulkan data yang ada di state khusus untuk kategori ini
    // Kita harus mapping ulang berdasarkan formasi key: `${kategori}_${item.nama_item}_${jenis}`
    const payload: any[] = [];

    const categoryData = masterTemplate.find(c => c.kategori === kategori);
    if (!categoryData) return;

    categoryData.items.forEach(item => {
      item.jenis_file.forEach(jenis => {
        const nama_dokumen = `${item.nama_item} (${jenis})`;
        const keyId = `${kategori}_${nama_dokumen}`;
        const state = editState[keyId];

        if (state && (state.file_url !== undefined || state.catatan !== undefined)) {
          payload.push({
            kategori,
            nama_dokumen,
            file_url: state.file_url,
            catatan: state.catatan,
            is_custom: false
          });
        }
      });
    });

    if (payload.length === 0) {
      // Tidak ada perubahan
      setEditModes(prev => ({ ...prev, [kategori]: false }));
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/dc-development/dokumen-dc/${projectId}/simpan-massal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fase_proyek: activeFase,
          items: payload
        }),
      });
      
      const json = await res.json();
      if (json.success) {
        setEditModes(prev => ({ ...prev, [kategori]: false }));
        loadData(activeFase); // Reload
      } else {
        alert("Gagal menyimpan: " + json.message);
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan sistem.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 text-red-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
      
      {/* RED FULL HEADER */}
      <div className="bg-[#E60000] sticky top-0 z-50 shadow-md">
        <div className="px-4 md:px-6 h-[72px] flex items-center justify-between">
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push("/dc-development/dokumen-dc")}
              className="w-10 h-10 flex items-center justify-center text-white hover:bg-black/10 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="px-3 py-1 bg-white rounded flex items-center justify-center shadow-sm">
                <span className="text-[#E60000] font-black text-sm italic tracking-tighter">Alfamart</span>
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-white uppercase tracking-wide">
                  {activeFase}
                </h1>
                <span className="w-1 h-1 rounded-full bg-white/70" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button className="hidden md:flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#CC0000] hover:bg-[#B30000] rounded-full transition-colors shadow-sm">
              <Download className="w-4 h-4" /> Ekspor Laporan
            </button>
            <div className="flex flex-col items-end justify-center h-full">
              <span className="text-[9px] font-bold text-white/90 uppercase tracking-widest mb-0.5">Progress Dokumen</span>
              <div className="text-xl font-black text-white tabular-nums leading-none flex items-baseline gap-1">
                {totalUploaded} <span className="text-white/80 text-sm">/ {totalRequired}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 p-4 md:p-6 lg:p-8 flex items-start justify-center gap-6 max-w-[1600px] mx-auto w-full">
        
        {/* LEFT COLUMN: CARDS */}
        <div className="flex-1 flex flex-col gap-6 max-w-4xl">
          {masterTemplate.map((cat, catIndex) => {
            const isEditMode = editModes[cat.kategori] || false;

            return (
              <div key={cat.kategori} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${catIndex * 100}ms` }}>
                
                {/* CARD HEADER */}
                <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 bg-white">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-black text-sm">
                      {catIndex + 1}
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-800 tracking-tight">{cat.kategori}</h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Kategori Dokumen Utama</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">Edit Mode</span>
                      <Switch 
                        checked={isEditMode} 
                        onCheckedChange={(c) => {
                          if (c) {
                            setEditModes(prev => ({ ...prev, [cat.kategori]: true }));
                          } else {
                            setEditModes(prev => ({ ...prev, [cat.kategori]: false }));
                          }
                        }} 
                      />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 shadow-sm">
                      <History className="w-3.5 h-3.5 text-slate-400" /> Riwayat Edit
                    </button>
                    <button className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* CARD BODY (ITEMS) */}
                <div className="px-6 py-2 flex flex-col">
                  {cat.items.map((item, itemIndex) => (
                    <div key={item.nama_item} className="flex gap-4 py-6 border-b border-slate-100 last:border-0">
                      {/* Item Number */}
                      <div className="w-6 shrink-0 text-right">
                        <span className="text-sm font-bold text-slate-400">{itemIndex + 1}.</span>
                      </div>
                      
                      <div className="flex-1 flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-slate-800">{item.nama_item}</h3>
                        
                        {/* File Slots (Jenis File) */}
                        <div className="flex flex-col gap-3 pl-0 md:pl-2">
                          {item.jenis_file.map(jenis => {
                            const nama_dokumen = `${item.nama_item} (${jenis})`;
                            const keyId = `${cat.kategori}_${nama_dokumen}`;
                            
                            const dbMatch = dbDokumen.find(db => db.kategori === cat.kategori && db.nama_dokumen === nama_dokumen);
                            const state = editState[keyId] || {};
                            
                            const fileUrl = isEditMode && state.file_url !== undefined ? state.file_url : (dbMatch?.file_url || "");
                            const catatan = isEditMode && state.catatan !== undefined ? state.catatan : (dbMatch?.catatan || "");
                            
                            const hasFile = !!fileUrl;

                            return (
                              <div key={jenis} className="flex flex-col gap-2 w-full max-w-3xl">
                                {!isEditMode ? (
                                  <>
                                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50">
                                      {hasFile ? (
                                        <>
                                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                          <a 
                                            href={fileUrl} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="text-xs font-bold text-slate-700 hover:text-blue-600 hover:underline flex-1"
                                          >
                                            Dokumen {jenis} Tersedia
                                          </a>
                                        </>
                                      ) : (
                                        <>
                                          <Info className="w-4 h-4 text-slate-400" />
                                          <span className="text-xs font-medium text-slate-500 flex-1">
                                            Belum ada dokumen {jenis}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    {catatan && (
                                      <div className="px-4 py-2 text-[11px] text-slate-500 font-medium italic bg-white border border-slate-100 rounded-lg ml-4">
                                        Catatan: {catatan}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  // EDIT MODE
                                  <div className="flex flex-col md:flex-row gap-3 w-full">
                                    {state.isUploading ? (
                                      <div className="flex items-center justify-center gap-2 flex-1 h-11 text-xs font-bold text-blue-600 bg-blue-50 rounded-xl border border-blue-100">
                                        <Loader2 className="w-4 h-4 animate-spin" /> Mengunggah...
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 flex-1">
                                        <label className={cn(
                                          "flex-1 flex items-center justify-center gap-2 h-11 px-4 text-xs font-bold rounded-xl border border-dashed cursor-pointer transition-colors shadow-sm",
                                          hasFile 
                                            ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100" 
                                            : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400"
                                        )}>
                                          <input 
                                            type="file" 
                                            className="hidden" 
                                            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.dwg"
                                            onChange={(e) => {
                                              if (e.target.files && e.target.files[0]) {
                                                handleFileUpload(keyId, cat.kategori, e.target.files[0]);
                                              }
                                            }}
                                          />
                                          <UploadCloud className="w-4 h-4" />
                                          {hasFile ? `Ubah File ${jenis}` : `Upload File ${jenis}`}
                                        </label>
                                        {hasFile && (
                                          <button
                                            onClick={() => setEditState(prev => ({ ...prev, [keyId]: { ...prev[keyId], file_url: "" } }))}
                                            className="w-11 h-11 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-100 transition-colors shadow-sm"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                    
                                    <Input
                                      placeholder={hasFile ? "Catatan opsional..." : "Wajib isi catatan jika file kosong..."}
                                      value={catatan}
                                      onChange={(e) => {
                                        setEditState(prev => ({ ...prev, [keyId]: { ...prev[keyId], catatan: e.target.value } }));
                                      }}
                                      className={cn(
                                        "h-11 text-xs bg-white rounded-xl flex-1 shadow-sm",
                                        !hasFile && !catatan ? "border-amber-300 focus-visible:ring-amber-500 placeholder:text-amber-500/70" : "border-slate-200"
                                      )}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CARD FOOTER (SAVE BUTTON) */}
                {isEditMode && (
                  <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleSimpan(cat.kategori)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-2 px-8 py-3 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Simpan Bagian Ini
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT COLUMN: SIDEBAR LEGENDA */}
        <div className="hidden lg:flex w-72 shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 flex-col sticky top-28 h-[calc(100vh-140px)]">
          <div className="p-5 border-b border-slate-100 flex gap-3 items-start bg-slate-50/50 rounded-t-2xl shrink-0">
            <div className="p-1.5 bg-red-50 text-red-600 rounded-md shrink-0">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">Legenda Singkatan</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Panduan arti singkatan dokumen</p>
            </div>
          </div>
          
          <div className="p-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-4">
            {LEGENDA.map((item) => (
              <div key={item.singkatan} className="flex flex-col gap-0.5">
                <span className="text-xs font-black text-red-600">{item.singkatan}</span>
                <span className="text-[11px] font-medium text-slate-600 leading-tight">{item.arti}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
