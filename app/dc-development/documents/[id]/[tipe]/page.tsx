"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  UploadCloud,
  Info,
  Trash2,
  MessageSquare,
  DownloadCloud,
  FileText,
  FileSpreadsheet,
  File,
  Plus,
  History,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useSession } from "@/context/SessionContext";
import { fetchDcArchiveProjects, fetchDcDocuments, uploadDcDocuments, deleteDcDocument, buildDcDocumentViewUrl, updateDcDocument, exportDcData, fetchDcDocumentCustomItems, createDcDocumentCustomItem, deleteDcDocumentCustomItem, logDcCategoryEdit, getDcCategoryEditLogs, type DcArchiveProject, type DcDocument, type DcDocumentCustomItem, type DcDocumentUploadSlotType, type DcCategoryActivityLog } from "@/lib/api";
import { DC_DOCUMENT_LEGENDS, getDcDocumentConfigForStage, getTotalRequiredDcDocumentSlots } from "@/lib/dc-document.config";

const CUSTOM_SLOT_OPTIONS: DcDocumentUploadSlotType[] = ["PDF/JPEG", "AUTOCAD", "WORD", "EXCEL", "PPT"];

const getCustomItemKey = (item: DcDocumentCustomItem) => `CUSTOM_K_${item.id}`;

const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export default function DcDocumentDetailPage() {
  const { id, tipe } = useParams() as { id: string; tipe: string };
  const { user, isLoading } = useSession();

  const [archive, setArchive] = useState<DcArchiveProject | null>(null);
  const [documents, setDocuments] = useState<DcDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNoteDoc, setEditingNoteDoc] = useState<DcDocument | null>(null);
  const [noteUploadContext, setNoteUploadContext] = useState<{key: string, type: string} | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [customItems, setCustomItems] = useState<DcDocumentCustomItem[]>([]);
  const [customItemModalOpen, setCustomItemModalOpen] = useState(false);
  const [customItemTitle, setCustomItemTitle] = useState("");
  const [customItemSlots, setCustomItemSlots] = useState<DcDocumentUploadSlotType[]>(["PDF/JPEG"]);
  const [savingCustomItem, setSavingCustomItem] = useState(false);
  
  const [editModeCategories, setEditModeCategories] = useState<Set<string>>(new Set());
  const [draftFiles, setDraftFiles] = useState<Record<string, File[]>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedCategoryForHistory, setSelectedCategoryForHistory] = useState<{ id: string; name: string } | null>(null);
  const [categoryHistoryLogs, setCategoryHistoryLogs] = useState<DcCategoryActivityLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const actor = useMemo(() => ({
    actor_email: user?.email || "",
    actor_role: user?.role || "",
  }), [user]);

  const loadData = useCallback(async () => {
    if (!actor.actor_email) return;
    setLoading(true);
    try {
      // 1. Fetch archives to find the current one (we need project_id)
      const archRes = await fetchDcArchiveProjects({
        actor_email: actor.actor_email,
        actor_role: actor.actor_role,
      }, { suppressGlobalError: true });

      const currentArchive = (archRes.data ?? []).find(a => a.id === parseInt(id));
      if (!currentArchive) {
        throw new Error("Arsip tidak ditemukan");
      }
      setArchive(currentArchive);

      // 2. Fetch documents and custom items for this project_id and stage
      const [docsRes, customItemsRes] = await Promise.all([
        fetchDcDocuments({
          actor_email: actor.actor_email,
          actor_role: actor.actor_role,
          project_id: currentArchive.project_id,
          entity_type: "DC_ARCHIVE_PROJECT",
          stage: tipe,
        }, { suppressGlobalError: true }),
        fetchDcDocumentCustomItems(currentArchive.id, {
          actor_email: actor.actor_email,
          actor_role: actor.actor_role,
          stage: tipe,
        }, { suppressGlobalError: true }),
      ]);

      setDocuments(docsRes.data ?? []);
      setCustomItems(customItemsRes.data ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [actor.actor_email, actor.actor_role, id, tipe]);

  useEffect(() => {
    if (!isLoading && user) loadData();
  }, [isLoading, user, loadData]);

  const docConfig = useMemo(() => getDcDocumentConfigForStage(tipe), [tipe]);

  const customDocumentItemsForStage = useMemo(() => (
    customItems.filter(item => item.stage === tipe.toUpperCase())
  ), [customItems, tipe]);

  const visibleItemKeys = useMemo(() => {
    const keys = new Set<string>();
    docConfig.forEach(utama => {
      utama.details.forEach(detail => {
        detail.jenis.forEach(jenis => keys.add(jenis.key));
      });
    });
    customDocumentItemsForStage.forEach(item => keys.add(getCustomItemKey(item)));
    return keys;
  }, [customDocumentItemsForStage, docConfig]);

  const uploadedItemCount = useMemo(() => (
    new Set(
      documents
        .filter(d => !!(d.drive_file_id || d.file_name))
        .map(d => (d.document_type || "").split('__')[0])
        .filter(key => visibleItemKeys.has(key))
    ).size
  ), [documents, visibleItemKeys]);

  const requiredItemCount = useMemo(() => (
    getTotalRequiredDcDocumentSlots(tipe) + customDocumentItemsForStage.length
  ), [customDocumentItemsForStage.length, tipe]);

  const formatKey = (jenisKey: string, type: string) => `${jenisKey}__${type.replace(/\//g, '_')}`;

  const toggleEditMode = (utamaId: string) => {
    setEditModeCategories(prev => {
      const next = new Set(prev);
      if (next.has(utamaId)) next.delete(utamaId);
      else next.add(utamaId);
      return next;
    });
  };

  const handleSimpanBatch = async (utamaId: string) => {
    if (!archive || !actor.actor_email) return;

    const utama = docConfig.find(d => d.id === utamaId);
    if (!utama) return;
    
    let allJenis = utama.details.flatMap(d => d.jenis);
    if (utama.title === "DATA PENTING LAINNYA") {
       allJenis = [
         ...allJenis, 
         ...customDocumentItemsForStage.map(ci => ({
           key: getCustomItemKey(ci),
           title: ci.title,
           slots: ci.slots.map(s => ({ type: s as 'PDF/JPEG' | 'AUTOCAD' | 'WORD' | 'EXCEL' | 'PPT', label: '' }))
         }))
       ];
    }
    
    for (const jenis of allJenis) {
       let hasDoc = false;
       for (const slot of jenis.slots) {
         const compKey = formatKey(jenis.key, slot.type);
         const hasLocal = (draftFiles[compKey] && draftFiles[compKey].length > 0);
         const hasServer = documents.some(d => d.document_type === compKey && d.drive_file_id);
         if (hasLocal || hasServer) {
           hasDoc = true;
           break;
         }
       }
       
       if (!hasDoc) {
         const localNoteRaw = draftNotes[jenis.key];
         const localNote = localNoteRaw !== undefined ? localNoteRaw.trim() : undefined;
         let serverNote = documents.find(d => d.document_type === `ITEM_NOTE_${jenis.key}`)?.notes?.trim();
         
         if (!serverNote) {
           const oldDocWithNote = documents.find(d => d.document_type.startsWith(`${jenis.key}__`) && d.notes?.trim());
           if (oldDocWithNote) serverNote = oldDocWithNote.notes?.trim();
         }
         
         const effectiveNote = localNote !== undefined ? localNote : serverNote;
         if (!effectiveNote) {
            alert(`Item "${jenis.title}" belum memiliki dokumen. Anda WAJIB mengisi catatan!`);
            return;
         }
       }
    }
    
    setSavingCategory(utamaId);
    let uploadedDocsCount = 0;
    let updatedNotesCount = 0;
    const uploadedDocNames: string[] = [];
    const updatedNoteNames: string[] = [];
    const deletedNoteNames: string[] = [];

    try {
      for (const jenis of allJenis) {
        for (const slot of jenis.slots) {
          const compKey = formatKey(jenis.key, slot.type);
          const files = draftFiles[compKey];
          if (files && files.length > 0) {
             await uploadDcDocuments({
               actor_email: actor.actor_email,
               actor_role: actor.actor_role,
               project_id: archive.project_id,
               entity_type: "DC_ARCHIVE_PROJECT",
               document_type: compKey,
               stage: tipe
             }, files);
             uploadedDocsCount += files.length;
             uploadedDocNames.push(jenis.title);
          }
        }
        
        const localNoteRaw = draftNotes[jenis.key];
        if (localNoteRaw !== undefined) {
           const localNote = localNoteRaw.trim();
           const serverNoteDoc = documents.find(d => d.document_type === `ITEM_NOTE_${jenis.key}`);
           const oldDocsWithNote = documents.filter(d => d.document_type.startsWith(`${jenis.key}__`) && d.notes);
           
           if (localNote === "") {
               if (serverNoteDoc) {
                   await deleteDcDocument(serverNoteDoc.id, actor);
                   updatedNotesCount++;
                   deletedNoteNames.push(jenis.title);
               }
               for (const oldDoc of oldDocsWithNote) {
                   await updateDcDocument(oldDoc.id, { ...actor, notes: "" });
                   if (!serverNoteDoc) {
                       updatedNotesCount++; // Count if we didn't already count serverNoteDoc
                       deletedNoteNames.push(jenis.title);
                   }
               }
           } else {
               let noteUpdated = false;
               for (const oldDoc of oldDocsWithNote) {
                   await updateDcDocument(oldDoc.id, { ...actor, notes: "" });
                   noteUpdated = true;
               }
               
               if (serverNoteDoc) {
                   if (serverNoteDoc.notes?.trim() !== localNote) {
                       await updateDcDocument(serverNoteDoc.id, { ...actor, notes: localNote });
                       noteUpdated = true;
                   }
               } else {
                   await uploadDcDocuments({
                       actor_email: actor.actor_email,
                       actor_role: actor.actor_role,
                       project_id: archive.project_id,
                       entity_type: "DC_ARCHIVE_PROJECT",
                       document_type: `ITEM_NOTE_${jenis.key}`,
                       stage: tipe,
                       notes: localNote
                   }, []);
                   noteUpdated = true;
               }
               if (noteUpdated) {
                   updatedNotesCount++;
                   updatedNoteNames.push(jenis.title);
               }
           }
        }
      }
      
      setDraftFiles(prev => {
        const next = {...prev};
        allJenis.forEach(j => j.slots.forEach(s => delete next[formatKey(j.key, s.type)]));
        return next;
      });
      setDraftNotes(prev => {
        const next = {...prev};
        allJenis.forEach(j => delete next[j.key]);
        return next;
      });
      
      const action_details: string[] = [];
      if (uploadedDocsCount > 0) action_details.push(`${uploadedDocsCount} Dokumen Diunggah`);
      if (updatedNotesCount > 0) action_details.push(`${updatedNotesCount} Catatan Diubah`);

      const itemized_details: Record<string, string[]> = {};
      if (uploadedDocNames.length > 0) itemized_details.uploaded_docs = Array.from(new Set(uploadedDocNames));
      if (updatedNoteNames.length > 0) itemized_details.updated_notes = Array.from(new Set(updatedNoteNames));
      if (deletedNoteNames.length > 0) itemized_details.deleted_notes = Array.from(new Set(deletedNoteNames));

      try {
        await logDcCategoryEdit(archive.id, {
            category_id: utamaId,
            category_name: utama.title,
            actor_email: actor.actor_email,
            actor_role: actor.actor_role,
            action_details: action_details.length > 0 ? action_details : undefined,
            itemized_details: Object.keys(itemized_details).length > 0 ? itemized_details : undefined
        });
      } catch (logErr) {
        console.error("Failed to log category edit:", logErr);
      }
      
      toggleEditMode(utamaId);
      await loadData();
    } catch (err) {
       console.error(err);
       alert(getErrorMessage(err, "Terjadi kesalahan saat menyimpan data."));
    } finally {
       setSavingCategory(null);
    }
  };

  const handleOpenHistory = async (categoryId: string, categoryName: string) => {
    if (!archive) return;
    setSelectedCategoryForHistory({ id: categoryId, name: categoryName });
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const res = await getDcCategoryEditLogs(archive.id, categoryId);
      setCategoryHistoryLogs(res.data || []);
    } catch (err) {
      console.error(err);
      alert(getErrorMessage(err, "Gagal mengambil riwayat edit kategori."));
    } finally {
      setLoadingHistory(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeUploadContext, setActiveUploadContext] = useState<{key: string, type: string} | null>(null);

  const getAcceptString = (type: string) => {
    const t = type.toUpperCase();
    if (t.includes('PDF/JPEG')) return 'application/pdf,image/jpeg,image/png,image/jpg';
    if (t.includes('AUTOCAD')) return '.dwg,.dxf';
    if (t.includes('WORD')) return '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (t.includes('EXCEL')) return '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (t.includes('PPT')) return '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation';
    return '*/*';
  };

  const triggerUpload = (jenisKey: string, type: string) => {
    setActiveUploadContext({ key: jenisKey, type });
    if (fileInputRef.current) {
      fileInputRef.current.accept = getAcceptString(type);
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length === 0 || !activeUploadContext) return;
    
    const acceptStr = getAcceptString(activeUploadContext.type);
    let validFiles = selectedFiles;
    
    if (acceptStr !== '*/*') {
        const acceptList = acceptStr.split(',').map(s => s.trim().toLowerCase());
        const invalidFiles = selectedFiles.filter(f => {
            const ext = "." + (f.name.split('.').pop()?.toLowerCase() || "");
            return !acceptList.includes(f.type.toLowerCase()) && !acceptList.includes(ext);
        });

        if (invalidFiles.length > 0) {
            alert(`Beberapa file memiliki format yang tidak didukung untuk tipe ${activeUploadContext.type}.\nFile yang diabaikan: ${invalidFiles.map(f => f.name).join(', ')}`);
            validFiles = selectedFiles.filter(f => !invalidFiles.includes(f));
        }
    }

    if (validFiles.length > 0) {
        const compKey = formatKey(activeUploadContext.key, activeUploadContext.type);
        setDraftFiles(prev => ({
          ...prev,
          [compKey]: [...(prev[compKey] || []), ...validFiles]
        }));
    }
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveDraftFile = (compKey: string, index: number) => {
    setDraftFiles(prev => {
      const files = prev[compKey] || [];
      const newFiles = [...files];
      newFiles.splice(index, 1);
      return { ...prev, [compKey]: newFiles };
    });
  };

  const handleDelete = async (docId: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus dokumen ini?")) return;
    try {
      await deleteDcDocument(docId, actor);
      await loadData();
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err, "Gagal menghapus dokumen."));
    }
  };

  const renderDocumentSlot = (jenisKey: string, type: string, isEditMode: boolean) => {
    const compKey = formatKey(jenisKey, type);
    const slotDocuments = documents.filter(d => d.document_type === compKey && d.drive_file_id);
    const localFiles = draftFiles[compKey] || [];
    const isUploading = uploadingKey === compKey;

    if (!isEditMode) {
      return (
        <div key={compKey} className="relative group/slot w-full sm:w-auto">
          {slotDocuments.length > 0 ? (
            <div className="flex flex-col gap-2 w-full sm:items-end">
              {slotDocuments.map((doc, index) => (
                <div key={doc.id} className="flex flex-col gap-1 w-full sm:w-[260px] shrink-0">
                  <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg border border-slate-200 bg-white shadow-sm hover:border-emerald-300 hover:shadow-md transition-all group/doc">
                    <a href={buildDcDocumentViewUrl(doc.id, actor, "view")} target="_blank" rel="noreferrer" className="flex items-center gap-2 overflow-hidden flex-1 px-1" title={doc.file_name || type}>
                      <div className="flex shrink-0 items-center justify-center w-7 h-7 rounded bg-emerald-50 text-emerald-600">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold text-slate-700 truncate">{doc.file_name || (slotDocuments.length > 1 ? `${type} ${index + 1}` : type)}</span>
                        <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">{type}</span>
                      </div>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-400">
              Belum ada dokumen {type}
            </div>
          )}
        </div>
      );
    }

    // EDIT MODE
    return (
      <div key={compKey} className="relative group/slot w-full sm:w-auto">
        <div className="flex flex-col gap-2 w-full sm:items-end">
          {slotDocuments.map((doc, index) => (
            <div key={doc.id} className="flex items-center justify-between gap-2 p-1.5 rounded-lg border border-slate-200 bg-white shadow-sm w-full sm:w-[260px] shrink-0">
              <a href={buildDcDocumentViewUrl(doc.id, actor, "view")} target="_blank" rel="noreferrer" className="flex items-center gap-2 overflow-hidden flex-1 px-1">
                <div className="flex shrink-0 items-center justify-center w-7 h-7 rounded bg-emerald-50 text-emerald-600">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-700 truncate">{doc.file_name || type}</span>
                  <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">{type}</span>
                </div>
              </a>
              <button type="button" onClick={() => handleDelete(doc.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Hapus Dokumen">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {localFiles.map((file, index) => (
            <div key={`local-${index}`} className="flex items-center justify-between gap-2 p-1.5 rounded-lg border border-blue-200 bg-blue-50/50 shadow-sm w-full sm:w-[260px] shrink-0">
              <div className="flex items-center gap-2 overflow-hidden flex-1 px-1">
                <div className="flex shrink-0 items-center justify-center w-7 h-7 rounded bg-blue-100 text-blue-600">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-700 truncate">{file.name}</span>
                  <span className="text-[9px] text-blue-500 font-bold uppercase tracking-wider">DRAFT {type}</span>
                </div>
              </div>
              <button type="button" onClick={() => handleRemoveDraftFile(compKey, index)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Hapus Draft">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex justify-end w-full mt-1">
            <button type="button" onClick={() => triggerUpload(jenisKey, type)} className="flex items-center gap-1.5 text-[10px] font-semibold text-red-600 hover:text-red-700 transition-colors bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-md">
              <UploadCloud className="w-3 h-3" />
              Upload {type}
            </button>
          </div>
        </div>
      </div>
    );
  };
  const handleSaveNote = async () => {
    if (!actor.actor_email) return;
    setSavingNote(true);
    try {
      if (editingNoteDoc) {
        await updateDcDocument(editingNoteDoc.id, {
          ...actor,
          notes: noteText
        });
      } else if (noteUploadContext) {
        if (!archive) throw new Error("Arsip tidak ditemukan");
        const compositeKey = noteUploadContext.type 
          ? formatKey(noteUploadContext.key, noteUploadContext.type)
          : noteUploadContext.key;
          
        await uploadDcDocuments({
          actor_email: actor.actor_email,
          actor_role: actor.actor_role,
          project_id: archive.project_id,
          entity_type: "DC_ARCHIVE_PROJECT",
          document_type: compositeKey,
          stage: tipe,
          notes: noteText
        }, []);
      }
      await loadData();
      setNoteModalOpen(false);
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err, "Gagal menyimpan catatan."));
    } finally {
      setSavingNote(false);
    }
  };
  const resetCustomItemForm = () => {
    setCustomItemTitle("");
    setCustomItemSlots(["PDF/JPEG"]);
  };

  const openCreateCustomItemModal = () => {
    resetCustomItemForm();
    setCustomItemModalOpen(true);
  };

  const toggleCustomItemSlot = (slot: DcDocumentUploadSlotType) => {
    setCustomItemSlots(current => (
      current.includes(slot)
        ? current.filter(item => item !== slot)
        : [...current, slot]
    ));
  };

  const handleCreateCustomItem = async () => {
    if (!archive || !actor.actor_email) return;
    const title = customItemTitle.trim();
    if (!title) {
      alert("Nama item wajib diisi.");
      return;
    }
    if (customItemSlots.length === 0) {
      alert("Pilih minimal satu jenis file upload.");
      return;
    }

    setSavingCustomItem(true);
    try {
      await createDcDocumentCustomItem(archive.id, {
        ...actor,
        stage: tipe.toUpperCase() as DcDocumentCustomItem["stage"],
        title,
        slots: customItemSlots,
      });
      await loadData();
      setCustomItemModalOpen(false);
      resetCustomItemForm();
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err, "Gagal menambah item dokumen."));
    } finally {
      setSavingCustomItem(false);
    }
  };

  const handleDeleteCustomItem = async (item: DcDocumentCustomItem) => {
    if (!confirm(`Hapus item tambahan "${item.title}" dari tahap ini?`)) return;
    try {
      await deleteDcDocumentCustomItem(item.id, actor);
      await loadData();
    } catch (err: unknown) {
      console.error(err);
      alert(getErrorMessage(err, "Gagal menghapus item dokumen."));
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </main>
    );
  }

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    try {
      await exportDcData(Number(id), format, user?.role || "", user?.email || "", tipe);
    } catch (e: unknown) {
      console.error(e);
      alert(getErrorMessage(e, "Gagal mengunduh laporan"));
    }
  };

  if (!archive) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
        <p className="text-lg font-medium text-slate-500">Data Arsip tidak ditemukan.</p>
        <Link href="/dc-development/documents">
          <Button variant="outline" className="mt-4">Kembali</Button>
        </Link>
      </main>
    );
  }

  const tipeLabel = tipe.charAt(0) + tipe.slice(1).toLowerCase();

  return (
    <main className="min-h-screen bg-[#f4f7f9] text-slate-900 pb-20 [font-family:var(--font-sans)]">
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} multiple />

      {/* HEADER PREMIUM */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-red-700 to-red-600 shadow-md">
        <div className="mx-auto flex h-[80px] max-w-[1400px] items-center gap-5 px-6 lg:px-8">
          <Link href="/dc-development/documents" className="group flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white hover:text-red-700" title="Kembali">
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
          </Link>
          <Image src="/assets/Alfamart-Emblem.png" alt="Alfamart" width={94} height={42} className="h-[42px] w-auto drop-shadow-md" priority />
          <div className="h-8 w-px bg-white/20" />
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-white">{archive.archive_name}</h1>
            <p className="text-xs font-medium text-red-100 flex items-center gap-2">
              <span className="bg-red-800/50 px-2 py-0.5 rounded uppercase tracking-wider">{tipeLabel}</span>
              {archive.branch_name}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-red-400 bg-red-700/50 text-white hover:bg-red-700 hover:text-white transition-colors">
                  <DownloadCloud className="mr-2 h-4 w-4" />
                  Ekspor Laporan
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white border-slate-200 shadow-xl">
                <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer hover:bg-slate-50 font-medium text-slate-700">
                  <FileText className="mr-2 h-4 w-4 text-slate-500" />
                  Unduh CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer hover:bg-slate-50 font-medium text-slate-700">
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                  Unduh Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer hover:bg-slate-50 font-medium text-slate-700">
                  <File className="mr-2 h-4 w-4 text-red-500" />
                  Unduh PDF (Laporan)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex flex-col items-end">
              <span className="text-[11px] font-medium text-red-200 uppercase tracking-wider">Progress Dokumen</span>
              <span className="text-lg font-bold text-white">{uploadedItemCount} / {requiredItemCount}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8 flex flex-col lg:flex-row gap-8 items-start">

        {/* LEFT MAIN CONTENT */}
        <div className="flex-1 w-full space-y-6">

          <Accordion type="multiple" defaultValue={docConfig.map(d => d.id)} className="space-y-4">
            {docConfig.map((utama, uIdx) => (
              <AccordionItem key={utama.id} value={utama.id} className="border-0 rounded-2xl bg-white shadow-sm overflow-hidden">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-slate-50/50 transition-colors [&>svg]:ml-4">
                  <div className="flex flex-1 items-center justify-between gap-4 text-left">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 font-black shrink-0 text-lg">
                        {uIdx + 1}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight">{utama.title}</h3>
                        <p className="text-xs font-medium text-slate-500 mt-0.5 uppercase tracking-wider">Kategori Dokumen Utama</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 mr-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200" onClick={(e) => e.stopPropagation()}>
                        <Switch checked={editModeCategories.has(utama.id)} onCheckedChange={() => toggleEditMode(utama.id)} id={`switch-${utama.id}`} />
                        <label htmlFor={`switch-${utama.id}`} className="text-xs font-semibold text-slate-700 cursor-pointer">
                          Edit Mode
                        </label>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mr-4 rounded-full h-8 px-3 border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors bg-white/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenHistory(utama.id, utama.title);
                        }}
                      >
                        <History className="h-4 w-4 mr-1.5" />
                        <span className="text-xs font-semibold">Riwayat Edit</span>
                      </Button>
                      {/* 
                      (() => {
                        const catNoteKey = `CAT_NOTE_${utama.id}`;
                        const catNoteDoc = documents.find(d => d.document_type === catNoteKey);
                        const hasNote = !!catNoteDoc?.notes;
                        return (
                          <Button
                            type="button"
                            size="sm"
                            variant={hasNote ? "default" : "outline"}
                            className={`rounded-lg shadow-sm transition-all ${hasNote ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300"}`}
                            onClick={(event) => { 
                              event.stopPropagation();
                              if (catNoteDoc) {
                                setEditingNoteDoc(catNoteDoc);
                                setNoteUploadContext(null);
                                setNoteText(catNoteDoc.notes || "");
                              } else {
                                setEditingNoteDoc(null);
                                setNoteUploadContext({ key: catNoteKey, type: "" });
                                setNoteText("");
                              }
                              setNoteModalOpen(true);
                            }}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            {hasNote ? "Lihat Catatan Kategori" : "Catatan Kategori"}
                          </Button>
                        );
                      })()
                      */}
                      {utama.title === "DATA PENTING LAINNYA" && !actor.actor_role.toUpperCase().includes("DC DOCUMENT ADMIN") && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={(event) => { event.stopPropagation(); openCreateCustomItemModal(); }}
                          className="bg-red-600 text-white hover:bg-red-700"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Tambah Item
                        </Button>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-6 pb-6 pt-2">
                  <div className="space-y-8 pl-14">
                    {utama.details.map((detail, dIdx) => (
                      <div key={dIdx} className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="h-px bg-slate-200 flex-1"></div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 bg-white px-2">
                            {detail.title}
                          </span>
                          <div className="h-px bg-slate-200 flex-1"></div>
                        </div>

                        <div className="grid gap-3">
                          {detail.jenis.map((jenis, jIdx) => (
                            <div key={jenis.key} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-colors hover:border-slate-200 hover:bg-white">
                              <div className="flex items-start gap-3 mt-1.5">
                                <span className="text-sm font-bold text-slate-400 w-6 shrink-0">{jIdx + 1}.</span>
                                <p className="font-semibold text-slate-700 leading-tight">{jenis.title}</p>
                              </div>

                              <div className="flex flex-col items-end gap-2 w-full sm:w-auto ml-9 sm:ml-0">
                                {jenis.slots.map(slot => renderDocumentSlot(jenis.key, slot.type, editModeCategories.has(utama.id)))}
                                {editModeCategories.has(utama.id) && (
                                  <div className="w-full sm:w-[260px] mt-2">
                                    <Textarea
                                      placeholder="Catatan item (wajib jika tanpa dokumen)..."
                                      className="min-h-[80px] text-xs resize-none"
                                      value={draftNotes[jenis.key] !== undefined ? draftNotes[jenis.key] : (documents.find(d => d.document_type === `ITEM_NOTE_${jenis.key}`)?.notes || documents.find(d => d.document_type.startsWith(`${jenis.key}__`) && d.notes)?.notes || "")}
                                      onChange={(e) => setDraftNotes(prev => ({...prev, [jenis.key]: e.target.value}))}
                                    />
                                  </div>
                                )}
                                {!editModeCategories.has(utama.id) && (documents.find(d => d.document_type === `ITEM_NOTE_${jenis.key}`)?.notes || documents.find(d => d.document_type.startsWith(`${jenis.key}__`) && d.notes)?.notes) && (
                                  <div className="w-full sm:w-[260px] mt-1 p-2 rounded-lg bg-yellow-50 border border-yellow-200 text-xs text-yellow-800">
                                    <span className="font-semibold">Catatan:</span> {documents.find(d => d.document_type === `ITEM_NOTE_${jenis.key}`)?.notes || documents.find(d => d.document_type.startsWith(`${jenis.key}__`) && d.notes)?.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          {utama.title === "DATA PENTING LAINNYA" && customDocumentItemsForStage.map((customItem, customIdx) => (
                            <div key={customItem.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 rounded-xl border border-red-100 bg-red-50/40 p-4 transition-colors hover:border-red-200 hover:bg-white">
                              <div className="flex items-start gap-3 mt-1.5">
                                <span className="mt-0.5 text-sm font-bold text-red-300 w-6 shrink-0">{detail.jenis.length + customIdx + 1}.</span>
                                <div>
                                  <p className="font-semibold text-slate-800 leading-tight">{customItem.title}</p>
                                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-red-500">Item tambahan</p>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-2 w-full sm:w-auto ml-9 sm:ml-0">
                                {customItem.slots.map(slotType => renderDocumentSlot(getCustomItemKey(customItem), slotType, editModeCategories.has(utama.id)))}
                                {editModeCategories.has(utama.id) && (
                                  <div className="w-full sm:w-[260px] mt-2">
                                    <Textarea
                                      placeholder="Catatan item..."
                                      className="min-h-[80px] text-xs resize-none"
                                      value={draftNotes[getCustomItemKey(customItem)] !== undefined ? draftNotes[getCustomItemKey(customItem)] : (documents.find(d => d.document_type === `ITEM_NOTE_${getCustomItemKey(customItem)}`)?.notes || documents.find(d => d.document_type.startsWith(`${getCustomItemKey(customItem)}__`) && d.notes)?.notes || "")}
                                      onChange={(e) => setDraftNotes(prev => ({...prev, [getCustomItemKey(customItem)]: e.target.value}))}
                                    />
                                  </div>
                                )}
                                {!editModeCategories.has(utama.id) && (documents.find(d => d.document_type === `ITEM_NOTE_${getCustomItemKey(customItem)}`)?.notes || documents.find(d => d.document_type.startsWith(`${getCustomItemKey(customItem)}__`) && d.notes)?.notes) && (
                                  <div className="w-full sm:w-[260px] mt-1 p-2 rounded-lg bg-yellow-50 border border-yellow-200 text-xs text-yellow-800">
                                    <span className="font-semibold">Catatan:</span> {documents.find(d => d.document_type === `ITEM_NOTE_${getCustomItemKey(customItem)}`)?.notes || documents.find(d => d.document_type.startsWith(`${getCustomItemKey(customItem)}__`) && d.notes)?.notes}
                                  </div>
                                )}
                                {editModeCategories.has(utama.id) && (
                                  <button type="button" onClick={() => handleDeleteCustomItem(customItem)} className="mt-2 flex items-center justify-center p-2 rounded-lg border border-red-200 bg-white text-red-500 transition-all hover:bg-red-50 hover:text-red-700 hover:border-red-300 w-full sm:w-[260px]" title="Hapus Item Tambahan">
                                    <Trash2 className="h-4 w-4 mr-2" /> Hapus Item
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {editModeCategories.has(utama.id) && (
                      <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        <Button type="button" variant="outline" onClick={() => toggleEditMode(utama.id)}>Batal</Button>
                        <Button type="button" onClick={() => handleSimpanBatch(utama.id)} disabled={savingCategory === utama.id} className="bg-red-600 hover:bg-red-700 text-white">
                          {savingCategory === utama.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                          Simpan Semua
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

        </div>

        {/* RIGHT SIDEBAR / LEGEND */}
        <div className="w-full lg:w-80 shrink-0 sticky top-28 rounded-2xl bg-white p-6 shadow-xl border border-slate-200 h-fit">
          <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="rounded-xl bg-red-50 p-2.5">
              <Info className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Legenda Singkatan</h3>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Panduan arti singkatan dokumen</p>
            </div>
          </div>
          <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
            {DC_DOCUMENT_LEGENDS.map(leg => (
              <div key={leg.abbrev}>
                <div className="font-bold text-red-600">{leg.abbrev}</div>
                <div className="text-sm leading-tight text-slate-600 mt-1">{leg.meaning}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* DIALOG TAMBAH ITEM */}
      <Dialog open={customItemModalOpen} onOpenChange={(open) => { setCustomItemModalOpen(open); if (!open) resetCustomItemForm(); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Tambah Item Data Penting Lainnya</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="custom-item-title">Nama Item</label>
              <Input
                id="custom-item-title"
                placeholder="Contoh: Berita Acara Pemeriksaan Lapangan"
                value={customItemTitle}
                onChange={(event) => setCustomItemTitle(event.target.value)}
              />
            </div>
            <div className="space-y-3">
              <div className="text-sm font-semibold text-slate-700">Jenis File Upload</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CUSTOM_SLOT_OPTIONS.map(slot => {
                  const selected = customItemSlots.includes(slot);
                  return (
                    <label key={slot} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${selected ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-red-600"
                        checked={selected}
                        onChange={() => toggleCustomItemSlot(slot)}
                      />
                      {slot}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomItemModalOpen(false)}>Batal</Button>
            <Button onClick={handleCreateCustomItem} disabled={savingCustomItem || !customItemTitle.trim() || customItemSlots.length === 0} className="bg-red-600 hover:bg-red-700 text-white">
              {savingCustomItem ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Tambah Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* DIALOG CATATAN */}
      <Dialog open={noteModalOpen} onOpenChange={setNoteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Catatan Dokumen</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              placeholder="Tulis catatan opsional..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteModalOpen(false)}>Batal</Button>
            <Button onClick={handleSaveNote} disabled={savingNote} className="bg-red-600 hover:bg-red-700 text-white">
              {savingNote ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* DIALOG RIWAYAT EDIT */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-800">
              <History className="h-5 w-5 text-red-600" />
              Riwayat Edit Kategori
            </DialogTitle>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Kategori: <span className="font-semibold text-slate-700">{selectedCategoryForHistory?.name}</span>
            </p>
          </DialogHeader>
          <div className="p-6 bg-slate-50/50 max-h-[60vh] overflow-y-auto">
            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-red-500 mb-4" />
                <p className="text-sm font-medium">Memuat riwayat...</p>
              </div>
            ) : categoryHistoryLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Clock className="h-8 w-8 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">Belum ada riwayat edit untuk kategori ini.</p>
              </div>
            ) : (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {categoryHistoryLogs.map((log) => (
                  <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-transform hover:scale-110">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-100 bg-white shadow-sm transition-all hover:shadow-md">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-red-600">
                          {new Date(log.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                        <span className="text-sm font-bold text-slate-800">{log.actor_email}</span>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{log.actor_role}</span>
                        {log.metadata?.action_details && log.metadata.action_details.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                            {log.metadata.action_details.map((detail: string, idx: number) => (
                              <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100">
                                {detail}
                              </span>
                            ))}
                            {log.metadata.itemized_details && Object.keys(log.metadata.itemized_details).length > 0 && (
                              <div className="relative group cursor-pointer ml-1">
                                <Info className="h-4 w-4 text-slate-400 hover:text-slate-600 transition-colors" />
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-max max-w-[250px] p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl z-50 border border-slate-700 backdrop-blur-md bg-opacity-95">
                                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-800/95"></div>
                                  <div className="flex flex-col gap-2">
                                    {log.metadata.itemized_details.uploaded_docs && (
                                      <div>
                                        <span className="font-semibold text-emerald-400">Tambah Dokumen:</span>
                                        <ul className="list-disc list-inside mt-0.5 text-slate-300 leading-tight">
                                          {log.metadata.itemized_details.uploaded_docs.map((doc: string, i: number) => <li key={i}>{doc}</li>)}
                                        </ul>
                                      </div>
                                    )}
                                    {log.metadata.itemized_details.updated_notes && (
                                      <div>
                                        <span className="font-semibold text-blue-400">Edit Catatan:</span>
                                        <ul className="list-disc list-inside mt-0.5 text-slate-300 leading-tight">
                                          {log.metadata.itemized_details.updated_notes.map((note: string, i: number) => <li key={i}>{note}</li>)}
                                        </ul>
                                      </div>
                                    )}
                                    {log.metadata.itemized_details.deleted_notes && (
                                      <div>
                                        <span className="font-semibold text-rose-400">Hapus Dokumen/Catatan:</span>
                                        <ul className="list-disc list-inside mt-0.5 text-slate-300 leading-tight">
                                          {log.metadata.itemized_details.deleted_notes.map((del: string, i: number) => <li key={i}>{del}</li>)}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="p-4 border-t border-slate-100 bg-white">
            <Button variant="outline" className="w-full sm:w-auto hover:bg-slate-50" onClick={() => setHistoryModalOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </main>
  );
}
