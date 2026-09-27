"use client";

import React, { useEffect, useState, useMemo } from "react";
import { 
  ArrowLeft, Save, X, 
  UploadCloud, CheckCircle2, AlertCircle, 
  ExternalLink, Loader2, ChevronDown, Download, History, Info, FileText, Trash2, Clock
} from "lucide-react";
import { PEMBANGUNAN_TEMPLATE, RENOVASI_TEMPLATE, PERLUASAN_TEMPLATE } from "@/lib/constants/dokumen-dc";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertModal, AlertType } from "@/components/ui/alert-modal";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

type DokumenDB = {
  id: number;
  kategori: string;
  nama_item: string;
  jenis_file: string;
  file_url: string | null;
  file_name: string | null;
  catatan: string | null;
  is_custom: boolean;
};

type FileItem = {
  url: string;
  name: string;
  jenis: string;
};

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
  { singkatan: "BAST", arti: "Berita Acara Serah Terima" },
  { singkatan: "KAK", arti: "Kerangka Acuan Kerja" },
  { singkatan: "TOR", arti: "Term of Reference" },
  { singkatan: "PKS", arti: "Perjanjian Kerja Sama" },
  { singkatan: "OE", arti: "Owner Estimate" },
  { singkatan: "RAB", arti: "Rencana Anggaran Biaya" },
  { singkatan: "MK", arti: "Manajemen Konstruksi" }
];

interface DetailDokumenModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any | null;
  fase: string;
}

const getAcceptTypes = (jenis: string) => {
  const j = jenis.toUpperCase();
  if (j.includes("PDF") || j.includes("JPEG") || j.includes("JPG") || j.includes("PNG")) return ".pdf,.jpg,.jpeg,.png";
  if (j.includes("AUTOCAD") || j.includes("DWG")) return ".dwg,.dxf";
  if (j.includes("EXCEL") || j.includes("XLS")) return ".xls,.xlsx,.csv";
  if (j.includes("WORD") || j.includes("DOC")) return ".doc,.docx";
  if (j.includes("PPT") || j.includes("POWERPOINT")) return ".ppt,.pptx";
  return ".pdf,.jpg,.jpeg,.png,.dwg,.doc,.docx,.xls,.xlsx";
};

export default function DetailDokumenModal({ isOpen, onClose, project, fase }: DetailDokumenModalProps) {
  const [loading, setLoading] = useState(true);
  const [dbDokumen, setDbDokumen] = useState<DokumenDB[]>([]);
  const [riwayatData, setRiwayatData] = useState<any[]>([]);
  
  // State for toggling Edit Mode per category
  const [editModes, setEditModes] = useState<Record<string, boolean>>({});
  
  // Custom Items
  const [dbCustomItems, setDbCustomItems] = useState<{ kategori: string, nama_item: string, jenis_file: string[] }[]>([]);
  const [addCustomModalOpen, setAddCustomModalOpen] = useState(false);
  const [customForm, setCustomForm] = useState<{ nama_item: string, jenis_file: string[] }>({ nama_item: "", jenis_file: [] });
  const [customFormKategori, setCustomFormKategori] = useState("");
  
  // State for Draft Files and Catatan (Working Copy)
  const [draftFiles, setDraftFiles] = useState<Record<string, FileItem[]>>({});
  const [draftCatatan, setDraftCatatan] = useState<Record<string, string>>({});
  
  // Loading states per category
  const [isSavingKategori, setIsSavingKategori] = useState<Record<string, boolean>>({});
  const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({});

  // History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyKategori, setHistoryKategori] = useState("");

  // Alert Modal State
  const [alertState, setAlertState] = useState<{ open: boolean, title: string, message: string, type: AlertType }>({
    open: false,
    title: "",
    message: "",
    type: "error"
  });

  const showAlert = (title: string, message: string, type: AlertType = 'error') => {
    setAlertState({ open: true, title, message, type });
  };

  useEffect(() => {
    if (isOpen && project && fase) {
      loadData(fase);
    } else {
      setDbDokumen([]);
      setEditModes({});
      setDraftFiles({});
      setDraftCatatan({});
      setDbCustomItems([]);
    }
  }, [isOpen, project, fase]);

  const loadData = async (activeFase: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/dc-development/dokumen-dc/${project.id}?fase=${activeFase}`);
      const json = await res.json();
      if (json.success) {
        setDbDokumen(json.data.dokumen);
        setRiwayatData(json.data.riwayat || []);
        
        // Parse DB to Draft State
        const newDraftFiles: Record<string, FileItem[]> = {};
        const newDraftCatatan: Record<string, string> = {};

        json.data.dokumen.forEach((row: DokumenDB) => {
          const itemKey = `${row.kategori}::${row.nama_item}`;
          
          // Catatan (one per item)
          if (row.catatan && !newDraftCatatan[itemKey]) {
            newDraftCatatan[itemKey] = row.catatan;
          }

          // Files
          if (row.file_url) {
            try {
              // Try to parse if it's JSON array
              const parsed = JSON.parse(row.file_url);
              if (Array.isArray(parsed)) {
                if (!newDraftFiles[itemKey]) newDraftFiles[itemKey] = [];
                parsed.forEach(p => {
                  newDraftFiles[itemKey].push({
                    url: p.url,
                    name: p.name,
                    jenis: row.jenis_file
                  });
                });
              }
            } catch (e) {
              // Not JSON, fallback to single string
              if (!newDraftFiles[itemKey]) newDraftFiles[itemKey] = [];
              newDraftFiles[itemKey].push({
                url: row.file_url,
                name: row.file_name || `File ${row.jenis_file}`,
                jenis: row.jenis_file
              });
            }
          }
        });

        setDraftFiles(newDraftFiles);
        setDraftCatatan(newDraftCatatan);
        
        const customFromDb = json.data.dokumen
          .filter((row: DokumenDB) => row.is_custom)
          .map((row: DokumenDB) => ({
            kategori: row.kategori,
            nama_item: row.nama_item,
            jenis_file: row.jenis_file.split(',').map(s => s.trim()).filter(Boolean)
          }));
        setDbCustomItems(customFromDb);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const masterTemplate = useMemo(() => {
    if (fase === "PEMBANGUNAN") return PEMBANGUNAN_TEMPLATE;
    if (fase === "RENOVASI") return RENOVASI_TEMPLATE;
    return PERLUASAN_TEMPLATE;
  }, [fase]);

  const totalRequired = useMemo(() => {
    return masterTemplate.reduce((acc, cat) => {
      const dbCustomCount = dbCustomItems.filter(c => c.kategori === cat.kategori).reduce((sum, item) => sum + item.jenis_file.length, 0);
      return acc + cat.items.reduce((sum, item) => sum + item.jenis_file.length, 0) + dbCustomCount;
    }, 0);
  }, [masterTemplate, dbCustomItems]);

  const getCategoryItems = (catKategori: string, catTemplateItems: any[]) => {
    const customItemsForCat = dbCustomItems.filter(c => c.kategori === catKategori);
    // Avoid duplicates if a custom item was already fetched
    const seenNames = new Set(catTemplateItems.map(i => i.nama_item));
    const uniqueCustom = customItemsForCat.filter(c => {
      if (seenNames.has(c.nama_item)) return false;
      seenNames.add(c.nama_item);
      return true;
    });
    return [...catTemplateItems, ...uniqueCustom];
  };

  // For visual progress, count items that have at least one file or catatan
  const totalUploaded = useMemo(() => {
    let count = 0;
    masterTemplate.forEach(cat => {
      const allItems = getCategoryItems(cat.kategori, cat.items);
      allItems.forEach(item => {
        const key = `${cat.kategori}::${item.nama_item}`;
        const hasFiles = draftFiles[key] && draftFiles[key].length > 0;
        const hasCatatan = draftCatatan[key] && draftCatatan[key].trim().length > 0;
        if (hasFiles || hasCatatan) count++;
      });
    });
    return count;
  }, [draftFiles, draftCatatan, masterTemplate]);

  const handleFileUpload = async (kategori: string, nama_item: string, jenis_file: string, file: File) => {
    const itemKey = `${kategori}::${nama_item}`;
    setUploadingState(prev => ({ ...prev, [`${itemKey}::${jenis_file}`]: true }));
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kategori", kategori);
    formData.append("fase", fase);
    formData.append("nama_item", nama_item);

    try {
      const res = await fetch(`/api/dc-development/dokumen-dc/${project.id}/upload`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (json.success) {
        setDraftFiles(prev => {
          const existing = prev[itemKey] || [];
          return {
            ...prev,
            [itemKey]: [...existing, {
              url: json.data.file_url,
              name: json.data.file_name,
              jenis: jenis_file
            }]
          };
        });
      } else {
        alert(json.message);
      }
    } catch (err: any) {
      alert("Gagal mengunggah file");
    } finally {
      setUploadingState(prev => ({ ...prev, [`${itemKey}::${jenis_file}`]: false }));
    }
  };

  const removeFile = (kategori: string, nama_item: string, fileUrl: string) => {
    const itemKey = `${kategori}::${nama_item}`;
    setDraftFiles(prev => {
      const existing = prev[itemKey] || [];
      return {
        ...prev,
        [itemKey]: existing.filter(f => f.url !== fileUrl)
      };
    });
  };

  const handleSimpanKategori = async (kategori_name: string) => {
    setIsSavingKategori(prev => ({ ...prev, [kategori_name]: true }));
    try {
      const payload: any[] = [];
      const catTemplate = masterTemplate.find(c => c.kategori === kategori_name);
      
      if (catTemplate) {
        const allItems = getCategoryItems(catTemplate.kategori, catTemplate.items);

        // Validation: Ensure all items have at least one file or a catatan
        let isInvalid = false;
        for (const item of allItems) {
          const itemKey = `${catTemplate.kategori}::${item.nama_item}`;
          const files = draftFiles[itemKey] || [];
          const catatan = draftCatatan[itemKey] || "";

          if (files.length === 0 && catatan.trim() === "") {
            isInvalid = true;
            break;
          }
        }

        if (isInvalid) {
          showAlert("Validasi Gagal", "Semua item dalam kategori ini harus diisi! Jika belum ada dokumen, Anda wajib mengisi catatan pada item yang kosong.", "warning");
          setIsSavingKategori(prev => ({ ...prev, [kategori_name]: false }));
          return;
        }

        allItems.forEach(item => {
          const itemKey = `${catTemplate.kategori}::${item.nama_item}`;
          const files = draftFiles[itemKey] || [];
          const catatan = draftCatatan[itemKey] || "";

          // Get unique kinds actually uploaded
          const uploadedJenis = Array.from(new Set(files.map(f => f.jenis)));
          
          // If there are files or a note, we send a payload
          if (files.length > 0 || catatan) {
            const fileUrlJson = files.length > 0 ? JSON.stringify(files.map(f => ({ url: f.url, name: f.name, jenis: f.jenis }))) : null;
            // Commas separated as requested
            const jenisToSave = uploadedJenis.length > 0 ? uploadedJenis.join(', ') : item.jenis_file.join(', ');

            const isCustom = !catTemplate.items.some(t => t.nama_item === item.nama_item);

            payload.push({
              kategori: catTemplate.kategori,
              nama_item: item.nama_item,
              jenis_file: jenisToSave,
              file_url: fileUrlJson,
              file_name: files.length > 0 ? `${files.length} Dokumen` : null,
              catatan: catatan,
              is_custom: isCustom
            });
          }
        });
      }

      const res = await fetch(`/api/dc-development/dokumen-dc/${project.id}/simpan-massal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fase_proyek: fase, items: payload, updated_by: "USER" }),
      });
      
      const json = await res.json();
      if (json.success) {
        alert(`Berhasil menyimpan ${kategori_name}!`);
        setEditModes(prev => ({ ...prev, [kategori_name]: false }));
        loadData(fase);
      } else {
        alert("Gagal menyimpan: " + json.message);
      }
    } catch (err) {
      alert("Terjadi kesalahan sistem.");
    } finally {
      setIsSavingKategori(prev => ({ ...prev, [kategori_name]: false }));
    }
  };

  const openHistory = (kategori: string) => {
    setHistoryKategori(kategori);
    setHistoryModalOpen(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-full p-0 overflow-hidden bg-slate-50 flex flex-col rounded-2xl border-0 shadow-2xl">
        
        {/* HEADER: Clean White */}
        <div className="bg-white shrink-0 border-b border-[#EAEAEA] z-10 relative pt-3">
          <div className="px-6 h-[72px] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center text-[#111111] hover:bg-gray-100 rounded-full transition-colors border border-transparent hover:border-gray-200"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <h1 className="text-xl font-extrabold text-[#111111] uppercase tracking-wide flex items-center gap-2">
                    {project?.kode} {project?.nama_proyek}
                  </h1>
                  <div className="flex items-center gap-2 text-gray-500 text-[11px] font-medium uppercase tracking-widest mt-0.5">
                    <span>{fase}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span>{project?.cabang}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <button className="hidden md:flex items-center gap-2 px-5 py-2 text-xs font-bold text-[#111111] bg-white border border-[#EAEAEA] hover:border-[#111111] hover:shadow-sm rounded-full transition-all">
                <Download className="w-4 h-4" /> Ekspor Laporan
              </button>
              <div className="flex flex-col items-end justify-center h-full">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Progress Dokumen</span>
                <div className="text-xl font-black text-[#111111] tabular-nums leading-none flex items-baseline gap-1">
                  {totalUploaded} <span className="text-gray-400 text-sm font-bold">/ {masterTemplate.reduce((acc, cat) => acc + cat.items.length, 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
          <div className="p-4 md:p-6 lg:p-8 flex items-start justify-center gap-6 max-w-[1600px] mx-auto w-full min-h-full pb-28">
            
            {loading ? (
              <div className="flex-1 flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-12 h-12 text-[#E65F2B] animate-spin" />
              </div>
            ) : (
              <>
                {/* LEFT COLUMN: CARDS */}
                <div className="flex-1 flex flex-col gap-8 max-w-4xl">
                  {masterTemplate.map((cat, catIndex) => {
                    const isEditMode = editModes[cat.kategori] || false;
                    return (
                      <div key={cat.kategori} className="bg-white rounded-xl shadow-sm border border-[#EAEAEA] overflow-hidden">
                        
                        {/* CARD HEADER */}
                        <div className="px-6 py-5 flex items-center justify-between bg-white border-b border-[#EAEAEA]">
                          <div className="flex items-center gap-4">
                            <div className="w-9 h-9 rounded-full bg-orange-50 text-[#E65F2B] flex items-center justify-center font-black text-sm">
                              {catIndex + 1}
                            </div>
                            <div>
                              <h2 className="text-base font-extrabold text-[#111111] tracking-tight">{cat.kategori}</h2>
                              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-0.5">Kategori Dokumen Utama</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                              <span className="text-xs font-bold text-slate-700">Edit Mode</span>
                              {/* Using simple toggle style from screenshot (black active state) */}
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer" 
                                  checked={isEditMode} 
                                  onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    setEditModes(prev => ({ ...prev, [cat.kategori]: isChecked }));
                                    if (!isChecked) loadData(fase); // Discard drafts if toggled off
                                  }} 
                                />
                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#111111]"></div>
                              </label>
                            </div>
                            <button onClick={() => openHistory(cat.kategori)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 rounded-full transition-colors border border-slate-200">
                              <History className="w-3.5 h-3.5" /> Riwayat Edit
                            </button>
                            {cat.kategori === "DATA PENTING LAINNYA" && (
                              <button 
                                onClick={() => { 
                                  setCustomFormKategori(cat.kategori); 
                                  setAddCustomModalOpen(true); 
                                }}
                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-[#E65F2B] hover:bg-[#D3501F] rounded-full transition-colors shadow-sm"
                              >
                                + Tambah Item
                              </button>
                            )}
                            <button className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors">
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* CARD BODY (ITEMS) */}
                        <div className="px-6 py-6 flex flex-col gap-8">
                          {getCategoryItems(cat.kategori, cat.items).map((item, itemIndex) => {
                            const itemKey = `${cat.kategori}::${item.nama_item}`;
                            const files = draftFiles[itemKey] || [];
                            const catatan = draftCatatan[itemKey] || "";

                            return (
                              <div key={item.nama_item} className="flex flex-col gap-4">
                                {/* Divider with title if needed, but for now just item layout */}
                                <div className="flex gap-4">
                                  <div className="w-6 shrink-0 text-right pt-0.5">
                                    <span className="text-sm font-medium text-slate-400">{itemIndex + 1}.</span>
                                  </div>
                                  
                                  <div className="flex-1 flex flex-col md:flex-row gap-6 justify-between border-b border-dashed border-slate-200 pb-8 last:border-0 last:pb-0">
                                    {/* Kiri: Nama Item */}
                                    <h3 className="text-sm font-medium text-[#111111] w-full md:w-1/3 pt-0.5">
                                      {item.nama_item}
                                    </h3>
                                    
                                    {/* Kanan: Dokumen & Upload */}
                                    <div className="flex-1 flex flex-col gap-3">
                                      
                                      {/* Daftar File */}
                                      {files.length > 0 && (
                                        <div className="flex flex-col gap-2">
                                          {files.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-[#EAEAEA] bg-[#F9F9F9]">
                                              <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="p-2 bg-blue-50 text-blue-500 rounded">
                                                  <FileText className="w-4 h-4" />
                                                </div>
                                                <div className="flex flex-col truncate">
                                                  <a href={file.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-700 hover:underline truncate">
                                                    {file.name}
                                                  </a>
                                                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                                                    {file.jenis}
                                                  </span>
                                                </div>
                                              </div>
                                              {isEditMode && (
                                                <button onClick={() => removeFile(cat.kategori, item.nama_item, file.url)} className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded transition-colors shrink-0">
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Tombol Upload (Hanya saat Edit Mode) */}
                                      {isEditMode && (
                                        <div className="flex flex-col items-end gap-2 mt-1">
                                          {item.jenis_file.map((jenis: string) => {
                                            const isUploading = uploadingState[`${itemKey}::${jenis}`];
                                            return (
                                              <label key={jenis} className="flex items-center gap-2 px-4 py-2 bg-orange-50 hover:bg-orange-100 text-[#E65F2B] rounded-lg cursor-pointer transition-colors border border-orange-100">
                                                <input 
                                                  type="file" 
                                                  className="hidden" 
                                                  accept={getAcceptTypes(jenis)}
                                                  onChange={(e) => {
                                                    if (e.target.files && e.target.files[0]) {
                                                      handleFileUpload(cat.kategori, item.nama_item, jenis, e.target.files[0]);
                                                    }
                                                    // Reset input so same file can be selected again
                                                    e.target.value = '';
                                                  }}
                                                  disabled={isUploading}
                                                />
                                                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                                                <span className="text-xs font-bold uppercase">
                                                  {isUploading ? "Mengunggah..." : `Upload ${jenis}`}
                                                </span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}

                                      {/* Catatan Area */}
                                      {isEditMode ? (
                                        <textarea 
                                          className="w-full mt-2 p-3 bg-[#F9F9F9] border border-[#EAEAEA] rounded-lg text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-300 transition-shadow"
                                          placeholder="Catatan item (wajib jika tanpa dokumen)..."
                                          rows={3}
                                          value={catatan}
                                          onChange={(e) => setDraftCatatan(prev => ({ ...prev, [itemKey]: e.target.value }))}
                                        />
                                      ) : (
                                        catatan && (
                                          <div className="w-full mt-2 p-3 bg-[#F9F9F9] border border-[#EAEAEA] rounded-lg text-xs font-medium text-slate-600 italic">
                                            {catatan}
                                          </div>
                                        )
                                      )}

                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* FOOTER ACTION BUTTONS (Only when Edit Mode is ON) */}
                        {isEditMode && (
                          <div className="px-6 py-4 bg-orange-50/30 border-t border-[#EAEAEA] flex justify-end gap-3 shrink-0">
                            <button 
                              onClick={() => {
                                setEditModes(prev => ({ ...prev, [cat.kategori]: false }));
                                loadData(fase); // Reload to discard drafts
                              }}
                              className="px-6 py-2 text-sm font-bold text-[#111111] bg-white hover:bg-gray-50 border border-[#EAEAEA] rounded-full transition-colors shadow-sm"
                            >
                              Batal
                            </button>
                            <button 
                              onClick={() => handleSimpanKategori(cat.kategori)}
                              disabled={isSavingKategori[cat.kategori]}
                              className="flex items-center gap-2 px-8 py-2 text-sm font-bold text-white bg-[#E65F2B] hover:bg-[#D3501F] rounded-full transition-colors shadow-sm disabled:opacity-50"
                            >
                              {isSavingKategori[cat.kategori] ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                              Simpan Bagian Ini
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* RIGHT COLUMN: SIDEBAR LEGENDA */}
                <div className="hidden lg:flex w-72 shrink-0 bg-white rounded-xl shadow-sm border border-[#EAEAEA] flex-col sticky top-6 h-[calc(100vh-140px)]">
                  <div className="p-5 border-b border-[#EAEAEA] flex gap-3 items-start bg-[#F9F9F9] rounded-t-xl shrink-0">
                    <div className="p-1.5 bg-gray-200 text-[#111111] rounded-lg shrink-0"><Info className="w-4 h-4" /></div>
                    <div><h3 className="text-sm font-extrabold text-[#111111]">Legenda Singkatan</h3><p className="text-[10px] font-bold text-gray-500 mt-0.5">Panduan arti singkatan dokumen</p></div>
                  </div>
                  <div className="p-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-4">
                    {LEGENDA.map((item) => (
                      <div key={item.singkatan} className="flex flex-col gap-0.5">
                        <span className="text-xs font-black text-[#E65F2B]">{item.singkatan}</span>
                        <span className="text-[11px] font-medium text-gray-600 leading-tight">{item.arti}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

          </div>
        </div>

        {/* We removed the global BOTTOM ACTION BAR as requested */}

      </DialogContent>

      {/* HISTORY MODAL OVERLAY */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-white rounded-2xl border-0 shadow-2xl">
          <div className="p-5 flex items-center justify-between border-b border-[#EAEAEA] bg-[#F9F9F9]">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-[#E65F2B]" />
              <div>
                <h3 className="text-base font-extrabold text-[#111111]">Riwayat Edit Kategori</h3>
                <p className="text-xs font-medium text-slate-500 mt-0.5">Kategori: <span className="font-bold text-[#111111]">{historyKategori}</span></p>
              </div>
            </div>
            {/* shadcn DialogContent automatically provides a close button, so we don't add another X here */}
          </div>
          
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            <div className="relative border-l-2 border-slate-100 ml-4 pl-6 pb-6 flex flex-col gap-8">
              {riwayatData.filter((r: any) => r.dokumen?.kategori === historyKategori).length === 0 ? (
                <div className="text-sm font-medium text-slate-500 italic">
                  Belum ada riwayat
                </div>
              ) : (
                riwayatData
                  .filter((r: any) => r.dokumen?.kategori === historyKategori)
                  .map((r: any) => (
                    <div key={r.id} className="relative">
                      <div className="absolute -left-[35px] bg-white border border-slate-200 rounded-full p-1.5 text-slate-400">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="bg-white border border-[#EAEAEA] rounded-xl p-4 shadow-sm">
                        <div className="text-xs font-bold text-[#E65F2B] mb-1">
                          {format(new Date(r.created_at), "dd MMM yyyy, HH.mm", { locale: localeId })}
                        </div>
                        <div className="text-sm font-extrabold text-[#111111]">{r.user_nama || r.created_by}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{r.user_role || 'USER'}</div>
                        <div className="mt-3 text-xs text-slate-600 bg-orange-50/50 p-2.5 rounded-lg border border-orange-100 flex items-start gap-2">
                          <Info className="w-4 h-4 text-[#E65F2B] shrink-0 mt-0.5" />
                          <span className="leading-relaxed whitespace-pre-wrap">{r.deskripsi_log}</span>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
          
          <div className="p-4 border-t border-[#EAEAEA] bg-white flex justify-end">
            <button onClick={() => setHistoryModalOpen(false)} className="px-5 py-2 text-sm font-bold text-[#111111] bg-white hover:bg-gray-50 border border-[#EAEAEA] rounded-full transition-colors">
              Tutup
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADD CUSTOM ITEM MODAL */}
      <Dialog open={addCustomModalOpen} onOpenChange={(open) => {
        if (!open) {
          setAddCustomModalOpen(false);
          setCustomForm({ nama_item: "", jenis_file: [] });
        }
      }}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-white rounded-2xl border-0 shadow-2xl">
          <div className="p-5 flex items-center justify-between border-b border-[#EAEAEA] bg-[#F9F9F9]">
            <h3 className="text-base font-extrabold text-[#111111]">Tambah Item Data Penting Lainnya</h3>
          </div>
          <div className="p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-700">Nama Item</label>
              <input 
                type="text" 
                placeholder="Contoh: Berita Acara Pemeriksaan Lapangan"
                className="w-full px-4 py-2.5 bg-[#F9F9F9] border border-[#EAEAEA] rounded-lg text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-slate-300 transition-colors"
                value={customForm.nama_item}
                onChange={(e) => setCustomForm(prev => ({ ...prev, nama_item: e.target.value }))}
              />
            </div>
            
            <div className="flex flex-col gap-3">
              <label className="text-xs font-bold text-slate-700">Jenis File Upload</label>
              <div className="grid grid-cols-2 gap-3">
                {["PDF/JPEG", "AUTOCAD", "WORD", "EXCEL", "PPT"].map(tipe => (
                  <label key={tipe} className={cn("flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors", customForm.jenis_file.includes(tipe) ? "border-[#E65F2B] bg-orange-50/30 text-[#E65F2B]" : "border-[#EAEAEA] bg-white text-slate-600 hover:bg-slate-50")}>
                    <input 
                      type="checkbox" 
                      className="accent-[#E65F2B]"
                      checked={customForm.jenis_file.includes(tipe)}
                      onChange={(e) => {
                        setCustomForm(prev => {
                          const current = new Set(prev.jenis_file);
                          if (e.target.checked) current.add(tipe);
                          else current.delete(tipe);
                          return { ...prev, jenis_file: Array.from(current) };
                        });
                      }}
                    />
                    <span className="text-xs font-bold uppercase">{tipe}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-[#EAEAEA] bg-white flex justify-end gap-3">
            <button onClick={() => setAddCustomModalOpen(false)} className="px-5 py-2 text-sm font-bold text-[#111111] bg-white hover:bg-gray-50 border border-[#EAEAEA] rounded-full transition-colors">
              Batal
            </button>
            <button 
              onClick={async () => {
                if (!customForm.nama_item.trim()) return showAlert("Perhatian", "Nama item wajib diisi", "warning");
                if (customForm.jenis_file.length === 0) return showAlert("Perhatian", "Pilih minimal satu jenis file", "warning");
                
                try {
                  const payload = [{
                    kategori: customFormKategori,
                    nama_item: customForm.nama_item.trim(),
                    jenis_file: customForm.jenis_file.join(', '),
                    file_url: null,
                    file_name: null,
                    catatan: null,
                    is_custom: true
                  }];

                  const res = await fetch(`/api/dc-development/dokumen-dc/${project.id}/simpan-massal`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fase_proyek: fase, items: payload, updated_by: "USER" }),
                  });
                  
                  const json = await res.json();
                  if (json.success) {
                    setAddCustomModalOpen(false);
                    setCustomForm({ nama_item: "", jenis_file: [] });
                    loadData(fase); // Reload to show the saved item
                  } else {
                    showAlert("Gagal", "Gagal menambahkan item: " + json.message, "error");
                  }
                } catch (e) {
                  showAlert("Kesalahan Sistem", "Terjadi kesalahan sistem saat menyimpan item.", "error");
                }
              }}
              className="px-5 py-2 text-sm font-bold text-white bg-[#E65F2B] hover:bg-[#D3501F] rounded-full transition-colors"
            >
              + Tambah Item
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CUSTOM ALERT MODAL */}
      <AlertModal
        open={alertState.open}
        onOpenChange={(open) => setAlertState(prev => ({ ...prev, open }))}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />
    </Dialog>
  );
}
