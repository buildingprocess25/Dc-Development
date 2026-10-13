"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  X,
  Sparkles,
  Loader2,
  CheckCircle2,
  FileImage,
  AlertCircle
} from "lucide-react";
import { toTitleCase, cn } from "@/lib/utils";

export interface PendingFotoItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  sizeFormatted: string;
}

interface UploadFotoLingkunganModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: File[];
  isUploading: boolean;
  uploadProgress: { current: number; total: number } | null;
  onConfirmUpload: (items: { file: File; name: string }[]) => Promise<void>;
}

export default function UploadFotoLingkunganModal({
  open,
  onOpenChange,
  files,
  isUploading,
  uploadProgress,
  onConfirmUpload
}: UploadFotoLingkunganModalProps) {
  const [items, setItems] = useState<PendingFotoItem[]>([]);
  const [batchBaseName, setBatchBaseName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inisialisasi daftar foto saat file baru dipilih
  useEffect(() => {
    if (open && files.length > 0) {
      const initialItems: PendingFotoItem[] = files.map((file, idx) => {
        const previewUrl = URL.createObjectURL(file);
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        const sizeFormatted = file.size > 1024 * 1024 ? `${sizeMb} MB` : `${Math.round(file.size / 1024)} KB`;

        return {
          id: `pending-${Date.now()}-${idx}-${Math.random()}`,
          file,
          previewUrl,
          name: "", // Kosongkan agar user memberi nama sendiri
          sizeFormatted
        };
      });

      setItems(initialItems);
      setBatchBaseName("");
      setErrorMessage(null);
    } else if (!open) {
      // Bersihkan preview URL untuk mencegah memory leak
      items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setItems([]);
      setBatchBaseName("");
      setErrorMessage(null);
    }
  }, [open, files]);

  const handleUpdateName = (id: string, newName: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, name: newName } : it))
    );
  };

  const handleBlurName = (id: string, value: string) => {
    const formatted = toTitleCase(value.trim());
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, name: formatted } : it))
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const remaining = prev.filter((it) => it.id !== id);
      if (remaining.length === 0) {
        onOpenChange(false);
      }
      return remaining;
    });
  };

  // Terapkan penamaan massal dengan penomoran otomatis
  const handleApplyBatchName = () => {
    if (!batchBaseName.trim()) return;
    const baseFormatted = toTitleCase(batchBaseName.trim());

    setItems((prev) =>
      prev.map((it, idx) => ({
        ...it,
        name: prev.length > 1 ? `${baseFormatted} ${idx + 1}` : baseFormatted
      }))
    );
  };

  const handleUploadClick = async () => {
    if (items.length === 0 || isUploading) return;

    // Pastikan semua item memiliki nama; jika kosong gunakan fallback "Foto Lingkungan #{idx+1}"
    const finalItems = items.map((it, idx) => {
      let finalName = it.name.trim();
      if (!finalName) {
        finalName = `Foto Lingkungan ${idx + 1}`;
      }
      return {
        file: it.file,
        name: toTitleCase(finalName)
      };
    });

    try {
      setErrorMessage(null);
      await onConfirmUpload(finalItems);
    } catch (err: any) {
      setErrorMessage(err.message || "Gagal mengunggah foto ke Google Drive.");
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl sm:max-w-3xl p-0 overflow-hidden bg-white border border-slate-200/90 shadow-2xl rounded-2xl max-h-[90vh] flex flex-col [&>button:last-child]:hidden z-50">
        {/* Header Modal */}
        <div className="px-6 py-4.5 bg-white border-b border-slate-200/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 text-[#E65F2B] flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">
                  Penamaan Foto Lingkungan
                </DialogTitle>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-[#E65F2B] border border-orange-200/80">
                  {items.length} Foto
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Beri nama/keterangan setiap foto sebelum diunggah dan disimpan ke Google Drive.
              </DialogDescription>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Fitur Penamaan Cepat Sekaligus (Khusus jika lebih dari 1 file) */}
          {items.length > 1 && (
            <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-200/70 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Sparkles className="w-4 h-4 text-[#E65F2B]" />
                <span>Penamaan Cepat Sekaligus (Opsional):</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Ketik nama dasar area untuk menamai seluruh {items.length} foto secara otomatis dengan penomoran urut (misal: <em>Loading Dock 1, Loading Dock 2</em>).
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={batchBaseName}
                  onChange={(e) => setBatchBaseName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyBatchName();
                    }
                  }}
                  placeholder="Contoh: Area Loading Dock"
                  className="h-9 text-xs bg-white border-orange-200 focus-visible:ring-[#E65F2B]"
                  disabled={isUploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleApplyBatchName}
                  disabled={!batchBaseName.trim() || isUploading}
                  className="h-9 text-xs px-3.5 bg-white border-orange-300 text-[#E65F2B] hover:bg-orange-100/60 font-semibold shrink-0 cursor-pointer"
                >
                  Terapkan ke Semua
                </Button>
              </div>
            </div>
          )}

          {/* Alert Error jika ada */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* List Kartu Foto */}
          <div className="flex flex-col gap-3">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="p-3 sm:p-3.5 bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center gap-3.5 transition-all"
              >
                {/* Thumbnail Preview */}
                <div className="relative w-24 h-20 sm:w-24 sm:h-20 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                  <img
                    src={item.previewUrl}
                    alt={`Preview ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900/75 text-white">
                    #{idx + 1}
                  </div>
                </div>

                {/* Form Input Nama */}
                <div className="flex-1 min-w-0 w-full flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Nama / Keterangan Foto #{idx + 1}</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.sizeFormatted}
                    </span>
                  </div>
                  <Input
                    value={item.name}
                    onChange={(e) => handleUpdateName(item.id, e.target.value)}
                    onBlur={(e) => handleBlurName(item.id, e.target.value)}
                    placeholder={`Contoh: Tampak Samping Loading Dock`}
                    className="h-9 text-xs border-slate-200 focus-visible:ring-[#E65F2B] font-medium"
                    disabled={isUploading}
                    autoFocus={idx === 0}
                  />
                  <span className="text-[10px] text-slate-400 truncate">
                    File asli: <span className="font-mono">{item.file.name}</span>
                  </span>
                </div>

                {/* Tombol Hapus Item */}
                <button
                  type="button"
                  onClick={() => handleRemoveItem(item.id)}
                  disabled={isUploading}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0 sm:self-center disabled:opacity-40"
                  title="Batalkan foto ini"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {isUploading && uploadProgress ? (
              <span className="flex items-center gap-2 font-medium text-[#E65F2B]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Mengunggah foto {uploadProgress.current} dari {uploadProgress.total} ke Google Drive...
              </span>
            ) : (
              <span>
                Total <strong>{items.length} foto</strong> akan diberi nama & diunggah ke Google Drive
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
              className="w-full sm:w-auto h-10 px-4 text-xs font-semibold text-slate-700 bg-white border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleUploadClick}
              disabled={items.length === 0 || isUploading}
              className="w-full sm:w-auto h-10 px-5 text-xs font-bold text-white bg-[#E65F2B] hover:bg-[#d04f1f] shadow-md shadow-[#E65F2B]/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mengunggah ke Drive...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Unggah ke Google Drive</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
