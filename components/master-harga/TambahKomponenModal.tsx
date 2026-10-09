"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HardHat } from "lucide-react";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { CreatableSelectInput } from "@/components/ui/creatable-select";

export default function TambahKomponenModal({
  isOpen,
  onClose,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [kategori, setKategori] = useState<"UPAH" | "MATERIAL" | "">("");
  const [namaKomponen, setNamaKomponen] = useState("");
  const [satuan, setSatuan] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ open: boolean; type: "success" | "error"; title: string; message: string }>({ open: false, type: "success", title: "", message: "" });

  const handleSave = async () => {
    if (!kategori || !namaKomponen || !satuan) {
      setFeedback({ open: true, type: "error", title: "Data Tidak Lengkap", message: "Semua field wajib diisi!" });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/dc-development/master-harga/komponen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kategori,
          nama_komponen: namaKomponen,
          satuan
        })
      });
      const json = await res.json();
      if (json.status === "success") {
        setFeedback({ open: true, type: "success", title: "Berhasil Ditambahkan", message: "Komponen berhasil ditambahkan!" });
      } else {
        setFeedback({ open: true, type: "error", title: "Gagal Menambahkan", message: "Gagal menambah komponen: " + json.message });
      }
    } catch (e) {
      setFeedback({ open: true, type: "error", title: "Terjadi Kesalahan", message: "Terjadi kesalahan sistem saat menghubungi server!" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <FeedbackModal
        open={feedback.open}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => {
          setFeedback(prev => ({ ...prev, open: false }));
          if (feedback.type === "success") {
            onSuccess();
            onClose();
            setKategori("");
            setNamaKomponen("");
            setSatuan("");
          }
        }}
      />

      <Dialog open={isOpen && !feedback.open} onOpenChange={onClose}>
        <DialogContent className="max-w-[450px] p-0 rounded-2xl shadow-2xl bg-white overflow-hidden">
        
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center border border-orange-100">
            <HardHat className="w-5 h-5 text-[#E65F2B]" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-slate-800 tracking-tight">Tambah Komponen</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 mt-0.5">
              Tambahkan tenaga kerja atau material baru.
            </DialogDescription>
          </div>
        </div>

        <div className="p-6 space-y-5 bg-[#FAFAFA]">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700">Kategori <span className="text-red-500">*</span></Label>
            <Select value={kategori} onValueChange={(v: "UPAH" | "MATERIAL") => setKategori(v)}>
              <SelectTrigger className="h-11 bg-white border-slate-200 focus:ring-orange-500">
                <SelectValue placeholder="Pilih Kategori..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UPAH">UPAH</SelectItem>
                <SelectItem value="MATERIAL">MATERIAL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700">Nama Komponen <span className="text-red-500">*</span></Label>
            <Input 
              placeholder="Contoh: Semen Portland, Mandor..." 
              value={namaKomponen}
              onChange={(e) => {
                const val = e.target.value.replace(
                  /\w\S*/g,
                  (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
                );
                setNamaKomponen(val);
              }}
              className="h-11 bg-white border-slate-200 focus-visible:ring-orange-500" 
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700">Satuan <span className="text-red-500">*</span></Label>
            <CreatableSelectInput 
              value={satuan}
              onChange={(val) => setSatuan(val)}
              options={[
                { value: "kg", label: "kg" },
                { value: "m2", label: "m2" },
                { value: "sak", label: "sak" },
                { value: "oh", label: "oh" },
                { value: "ltr", label: "ltr" }
              ]}
              placeholder="Pilih atau ketik satuan..."
              formatAs="lowercase"
            />
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSaving} className="font-semibold text-slate-600 rounded-xl h-11">
            Batal
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="font-bold bg-[#E65F2B] hover:bg-[#D3501F] text-white rounded-xl h-11 px-6 shadow-md shadow-orange-500/20">
            {isSaving ? "Menyimpan..." : "Simpan Komponen"}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
    </>
  );
}
