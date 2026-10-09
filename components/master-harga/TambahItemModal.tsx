"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Calculator, Info, Layers, HardHat, X } from "lucide-react";
import TambahKomponenModal from "./TambahKomponenModal";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";

interface Komponen {
  id: number;
  nama_komponen: string;
  satuan: string;
}

export interface KoefisienRow {
  id: string; // temp id for UI
  komponen_id: number | "";
  tipe: "UPAH" | "MATERIAL";
  volume: string;
  nama_komponen?: string;
  satuan?: string;
}

import { CreatableSelectInput } from "@/components/ui/creatable-select";
import { SearchableSelectInput } from "@/components/ui/searchable-select";
import ReviewItemStep from "./ReviewItemStep";


export default function TambahItemModal({
  isOpen,
  onClose,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  // Master Data States
  const [upahList, setUpahList] = useState<Komponen[]>([]);
  const [materialList, setMaterialList] = useState<Komponen[]>([]);

  // Dynamic Dropdown States
  const [katSipil, setKatSipil] = useState<any[]>([]);
  const [katME, setKatME] = useState<any[]>([]);

  const [recommendations, setRecommendations] = useState<any>({
    ukuran_dimensi: ["60x60", "30x30"],
    merk_brand: ["Roman", "Milan"],
    warna_corak: ["Putih", "Hitam"],
    tipe_produk: ["Keramik", "Granit"],
    lokasi_penerapan: ["Lantai", "Dinding"],
    implementasi: ["Baru", "Renovasi"],
    finishing_permukaan: ["Matte", "Glossy", "Polished", "Unpolished"],
    ketebalan_units: ["mm", "cm"],
    toleransi_units: ["mm", "cm"],
  });

  const [lingkup, setLingkup] = useState<"SIPIL" | "ME">("SIPIL");
  const [kodePreview, setKodePreview] = useState({
    kode: "Memuat...",
    abjad_lokasi: "A",
    kode_anak: "Memuat..."
  });
  const [isKodeLoading, setIsKodeLoading] = useState(false);

  // Form States - Spesifikasi
  const [spec, setSpec] = useState({
    kategori_pekerjaan: "", custom_kategori: "",
    item_material: "", ukuran_dimensi: "", merk_brand: "",
    warna_corak: "", tipe_produk: "", ketebalan: "", toleransi: "", finishing_permukaan: "",
    lokasi_penerapan: "", custom_lokasi: "",
    implementasi: "", custom_implementasi: "",
    informasi_tambahan: "",
  });

  const [koefisiens, setKoefisiens] = useState<KoefisienRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isKomponenModalOpen, setIsKomponenModalOpen] = useState(false);
  const [ketebalanUnit, setKetebalanUnit] = useState("");
  const [toleransiUnit, setToleransiUnit] = useState("");
  const [feedback, setFeedback] = useState<{ open: boolean; type: "success" | "error"; title: string; message: string }>({ open: false, type: "success", title: "", message: "" });
  const [ahsWarning, setAhsWarning] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "review">("form");

  useEffect(() => {
    if (isOpen) {
      fetchDropdowns();
      fetchMasterKomponen();
      // Reset form
      setSpec({
        kategori_pekerjaan: "", custom_kategori: "", item_material: "", ukuran_dimensi: "", merk_brand: "",
        warna_corak: "", tipe_produk: "", ketebalan: "", toleransi: "", finishing_permukaan: "",
        lokasi_penerapan: "", custom_lokasi: "",
        implementasi: "", custom_implementasi: "",
        informasi_tambahan: "",
      });
      setKoefisiens([]);
      setAhsWarning(null);
      setKetebalanUnit("");
      setToleransiUnit("");
      setStep("form");
    }
  }, [isOpen]);

  // Effect khusus untuk reset kategori jika lingkup berubah
  useEffect(() => {
    if (!isOpen) return;
    setSpec(prev => ({ ...prev, kategori_pekerjaan: "", custom_kategori: "" }));
  }, [lingkup, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setIsKodeLoading(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch("/api/dc-development/master-harga/preview-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            lingkup, 
            spesifikasi: spec,
            koefisiens: koefisiens
          })
        });
        const json = await res.json();
        if (json.status === "success") {
          setKodePreview(json.data);

          // Auto-fill AHS jika masih kosong dan ada saran dari server
          if (json.data.suggested_ahs && koefisiens.length === 0) {
            const newKoefs = json.data.suggested_ahs.map((k: any) => {
              const isUpah = k.tipe === "UPAH";
              const list = isUpah ? upahList : materialList;
              const found = list.find((l: any) => l.id === k.komponen_id);
              return {
                id: Date.now().toString() + Math.random(),
                komponen_id: k.komponen_id.toString(),
                tipe: k.tipe,
                volume: k.volume_koefisien.toString(),
                nama_komponen: found ? found.nama_komponen : "",
                satuan: found ? found.satuan : ""
              };
            });
            setKoefisiens(newKoefs);
          }

          // Handle Warning Toasts
          if (json.data.is_new_kode && koefisiens.length > 0) {
            setAhsWarning(`⚠️ AHS diubah. Item akan disimpan sebagai Kode Induk baru (${json.data.kode}).`);
          } else if (json.data.is_ahs_matched_another) {
            setAhsWarning(`ℹ️ AHS cocok dengan ${json.data.matched_kode}. Kode Induk otomatis mengikuti.`);
          } else {
            setAhsWarning(null);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsKodeLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [spec, lingkup, koefisiens, isOpen, upahList, materialList]);

  const fetchDropdowns = async () => {
    try {
      const res = await fetch("/api/dc-development/master-harga/dropdowns");
      const json = await res.json();
      if (json.status === "success") {
        setKatSipil(json.data.kategori_sipil);
        setKatME(json.data.kategori_me);
        if (json.data.recommendations) {
          setRecommendations((prev: any) => ({
            ukuran_dimensi: Array.from(new Set([...(prev.ukuran_dimensi || []), ...(json.data.recommendations.ukuran_dimensi || [])])),
            merk_brand: Array.from(new Set([...(prev.merk_brand || []), ...(json.data.recommendations.merk_brand || [])])),
            warna_corak: Array.from(new Set([...(prev.warna_corak || []), ...(json.data.recommendations.warna_corak || [])])),
            tipe_produk: Array.from(new Set([...(prev.tipe_produk || []), ...(json.data.recommendations.tipe_produk || [])])),
            lokasi_penerapan: Array.from(new Set([...(prev.lokasi_penerapan || []), ...(json.data.recommendations.lokasi_penerapan || [])])),
            implementasi: Array.from(new Set([...(prev.implementasi || []), ...(json.data.recommendations.implementasi || [])])),
            finishing_permukaan: Array.from(new Set([...(prev.finishing_permukaan || []), ...(json.data.recommendations.finishing_permukaan || [])])),
            ketebalan_units: Array.from(new Set([...(prev.ketebalan_units || []), ...(json.data.recommendations.ketebalan_units || [])])),
            toleransi_units: Array.from(new Set([...(prev.toleransi_units || []), ...(json.data.recommendations.toleransi_units || [])])),
          }));
        }
      }
    } catch (error) {
      console.error(error);
    }
  };



  const fetchMasterKomponen = async () => {
    try {
      const res = await fetch("/api/dc-development/master-harga/komponen");
      const json = await res.json();
      if (json.status === "success") {
        setUpahList(json.data.upah);
        setMaterialList(json.data.material);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSpecChange = (field: string, value: string) => {
    setSpec(prev => ({ ...prev, [field]: value }));
  };

  const addKoefisienRow = (tipe: "UPAH" | "MATERIAL") => {
    setKoefisiens(prev => [
      ...prev,
      { id: Date.now().toString() + Math.random(), komponen_id: "", tipe, volume: "" }
    ]);
  };

  const updateKoefisien = (id: string, field: string, value: any) => {
    setKoefisiens(prev => prev.map(row => {
      if (row.id === id) {
        let updates: any = { [field]: value };
        if (field === "komponen_id") {
          const list = row.tipe === "UPAH" ? upahList : materialList;
          const found = list.find(l => l.id.toString() === value.toString());
          if (found) {
            updates.nama_komponen = found.nama_komponen;
            updates.satuan = found.satuan;
          }
        }
        return { ...row, ...updates };
      }
      return row;
    }));
  };

  const removeKoefisien = (id: string) => {
    setKoefisiens(prev => prev.filter(row => row.id !== id));
  };

  const generatedDeskripsi = useMemo(() => {
    let parts = [];
    if (spec.item_material) parts.push(spec.item_material);
    if (spec.ukuran_dimensi) parts.push(spec.ukuran_dimensi);
    if (spec.merk_brand) parts.push(spec.merk_brand);
    if (spec.warna_corak) parts.push(spec.warna_corak);
    if (spec.tipe_produk) parts.push(`Tipe ${spec.tipe_produk}`);
    if (spec.ketebalan) parts.push(`Tebal ${spec.ketebalan}`);
    if (spec.finishing_permukaan) parts.push(spec.finishing_permukaan);
    
    if (spec.toleransi) {
       const tebalVal = parseFloat(spec.ketebalan) || 0;
       const tolVal = parseFloat(spec.toleransi) || 0;
       const minimalTebal = (tebalVal - tolVal).toFixed(2);
       // ketebalan and toleransi already contain their units (e.g., "9 mm"), so we extract unit
       const kUnit = spec.ketebalan.replace(/[0-9.]/g, '').trim() || ketebalanUnit;
       parts.push(`Toleransi ${spec.toleransi} (Toleransi Terukur Minimal: ${minimalTebal} ${kUnit})`);
    }

    const loc = spec.lokasi_penerapan === "__new__" ? spec.custom_lokasi : spec.lokasi_penerapan;
    if (loc) parts.push(`Lokasi ${loc}`);

    const imp = spec.implementasi === "__new__" ? spec.custom_implementasi : spec.implementasi;
    if (imp) parts.push(`Implementasi ${imp}`);

    if (spec.informasi_tambahan) parts.push(`(${spec.informasi_tambahan})`);

    return parts.join(" ").replace(/\s+/g, " ");
  }, [spec, ketebalanUnit]);

  const handleReview = () => {
    if (!spec.item_material) {
      setFeedback({ open: true, type: "error", title: "Data Tidak Lengkap", message: "Nama Material wajib diisi!" });
      return;
    }
    if (!spec.kategori_pekerjaan) {
      setFeedback({ open: true, type: "error", title: "Data Tidak Lengkap", message: "Pilih Kategori Pekerjaan!" });
      return;
    }
    setStep("review");
  };

  const confirmSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/dc-development/master-harga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lingkup,
          kode_anak: kodePreview.kode_anak,
          kode: kodePreview.kode,
          abjad_lokasi: kodePreview.abjad_lokasi,
          spesifikasi: spec,
          koefisien: koefisiens.filter(k => k.komponen_id !== "" && k.volume !== "")
        })
      });
      const json = await res.json();
      if (json.status === "success") {
        setFeedback({ open: true, type: "success", title: "Berhasil Menyimpan", message: "Master Item berhasil ditambahkan!" });
      } else {
        setFeedback({ open: true, type: "error", title: "Gagal Menyimpan", message: "Gagal menyimpan data: " + json.message });
      }
    } catch (error) {
      setFeedback({ open: true, type: "error", title: "Kesalahan Sistem", message: "Terjadi kesalahan sistem saat menghubungi server!" });
    } finally {
      setIsSaving(false);
    }
  };

  const upahRows = koefisiens.filter(k => k.tipe === "UPAH");
  const materialRows = koefisiens.filter(k => k.tipe === "MATERIAL");
  const activeKategori = lingkup === "SIPIL" ? katSipil : katME;

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
          }
        }}
      />

      <Dialog open={isOpen && !feedback.open} onOpenChange={onClose}>
        <DialogContent className="max-w-[1100px] w-[95vw] max-h-[90vh] p-0 rounded-2xl shadow-2xl flex flex-col overflow-hidden bg-white">

          {/* Sleek Header */}
          <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white z-10">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center border border-orange-100">
                <Calculator className="w-5 h-5 text-[#E65F2B]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-800 tracking-tight">Tambah Master Item</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-0.5">
                  Konfigurasi spesifikasi item dan referensi kalkulasi AHS.
                </DialogDescription>
              </div>
            </div>

            {/* LINGKUP SELECTOR */}
            <div className={`flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 ${step === "review" ? "opacity-60 pointer-events-none" : ""}`}>
              <button
                onClick={() => setLingkup("SIPIL")}
                disabled={step === "review"}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${lingkup === "SIPIL" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                SIPIL
              </button>
              <button
                onClick={() => setLingkup("ME")}
                disabled={step === "review"}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${lingkup === "ME" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                ME
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 ml-4 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conditional Content: Form or Review */}
          {step === "form" ? (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row">

            {/* LEFT COLUMN: Spesifikasi (Scrollable) */}
            <div className="w-full lg:w-[55%] p-8 overflow-y-auto bg-white custom-scrollbar border-r border-slate-100">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1 h-5 bg-[#E65F2B] rounded-full"></div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Spesifikasi Detail</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">

                  <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kode Item Preview</Label>
                  <div className="flex gap-4 items-center mt-1">
                    <div className="flex items-center space-x-2 bg-slate-100 px-4 py-2 rounded-lg border border-slate-200">
                      <span className="text-sm font-semibold text-slate-500">Kode Induk:</span>
                      <span className={`text-lg font-bold text-slate-800 transition-opacity ${isKodeLoading ? "opacity-50" : "opacity-100"}`}>
                        {kodePreview.kode}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Kode Anak</span>
                      <span className={`text-sm font-medium ${isKodeLoading ? "text-slate-400 animate-pulse" : "text-orange-600"}`}>
                        {kodePreview.kode_anak}
                      </span>
                    </div>
                  </div>
                  {ahsWarning && (
                    <div className={`mt-2 px-3 py-2 rounded-md text-xs font-medium inline-block animate-in fade-in zoom-in duration-300 ${
                      ahsWarning.startsWith('⚠️') 
                        ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}>
                      {ahsWarning}
                    </div>
                  )}
                </div>

                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">Kategori Pekerjaan <span className="text-red-500">*</span></Label>
                  <CreatableSelectInput
                    value={spec.kategori_pekerjaan}
                    onChange={(v) => handleSpecChange("kategori_pekerjaan", v)}
                    options={activeKategori.map(k => ({ value: k.nama, label: k.nama }))}
                    placeholder="Pilih atau ketik kategori baru..."
                    formatAs="titleCase"
                    maxMenuHeight={300}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Nama Material <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Contoh: Keramik Lantai"
                    className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-orange-500"
                    value={spec.item_material}
                    onChange={(e) => {
                      const val = e.target.value.replace(
                        /\w\S*/g,
                        (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
                      );
                      handleSpecChange("item_material", val);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Ukuran Dimensi</Label>
                  <CreatableSelectInput
                    value={spec.ukuran_dimensi}
                    onChange={(v) => handleSpecChange("ukuran_dimensi", v)}
                    options={recommendations.ukuran_dimensi.map((v: string) => ({ value: v, label: v }))}
                    placeholder="Contoh: 60x60"
                    formatAs="titleCase"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Merk / Brand</Label>
                  <CreatableSelectInput
                    value={spec.merk_brand}
                    onChange={(v) => handleSpecChange("merk_brand", v)}
                    options={recommendations.merk_brand.map((v: string) => ({ value: v, label: v }))}
                    placeholder="Contoh: Sandimas"
                    formatAs="titleCase"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Warna / Corak</Label>
                  <CreatableSelectInput
                    value={spec.warna_corak}
                    onChange={(v) => handleSpecChange("warna_corak", v)}
                    options={recommendations.warna_corak.map((v: string) => ({ value: v, label: v }))}
                    placeholder="Contoh: Grey"
                    formatAs="titleCase"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Tipe Produk</Label>
                  <CreatableSelectInput
                    value={spec.tipe_produk}
                    onChange={(v) => handleSpecChange("tipe_produk", v)}
                    options={recommendations.tipe_produk.map((v: string) => ({ value: v, label: v }))}
                    placeholder="Contoh: Sicilly"
                    formatAs="titleCase"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Ketebalan</Label>
                  <div className="flex">
                    <Input
                      placeholder="0"
                      inputMode="decimal"
                      className="h-11 rounded-r-none bg-slate-50/50 border-slate-200 focus-visible:z-10 focus-visible:ring-orange-500"
                      value={spec.ketebalan.replace(/[^0-9.]/g, '')}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        if (val) {
                          handleSpecChange("ketebalan", `${val} ${ketebalanUnit}`);
                        } else {
                          handleSpecChange("ketebalan", "");
                        }
                      }}
                    />
                    <CreatableSelectInput
                      value={ketebalanUnit}
                      onChange={(v) => {
                        setKetebalanUnit(v);
                        const val = spec.ketebalan.replace(/[^0-9.]/g, '');
                        if (val) handleSpecChange("ketebalan", `${val} ${v}`);
                      }}
                      options={recommendations.ketebalan_units.map((v: string) => ({ value: v, label: v }))}
                      placeholder="Satuan"
                      formatAs="lowercase"
                      className="w-[130px] shrink-0"
                      removeLeftRadius
                      isClearable={false}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Toleransi</Label>
                  <div className="flex">
                    <Input
                      placeholder="0"
                      inputMode="decimal"
                      className="h-11 rounded-r-none bg-slate-50/50 border-slate-200 focus-visible:z-10 focus-visible:ring-orange-500"
                      value={spec.toleransi.replace(/[^0-9.]/g, '')}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        if (val) {
                          handleSpecChange("toleransi", `${val} ${toleransiUnit}`);
                        } else {
                          handleSpecChange("toleransi", "");
                        }
                      }}
                    />
                    <CreatableSelectInput
                      value={toleransiUnit}
                      onChange={(v) => {
                        setToleransiUnit(v);
                        const val = spec.toleransi.replace(/[^0-9.]/g, '');
                        if (val) handleSpecChange("toleransi", `${val} ${v}`);
                      }}
                      options={recommendations.toleransi_units.map((v: string) => ({ value: v, label: v }))}
                      placeholder="Satuan"
                      formatAs="lowercase"
                      className="w-[130px] shrink-0"
                      removeLeftRadius
                      isClearable={false}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Permukaan</Label>
                  <CreatableSelectInput
                    value={spec.finishing_permukaan}
                    onChange={(v) => handleSpecChange("finishing_permukaan", v)}
                    options={recommendations.finishing_permukaan.map((v: string) => ({ value: v, label: v }))}
                    placeholder="Pilih Permukaan"
                    formatAs="titleCase"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Lokasi Penerapan</Label>
                  <CreatableSelectInput
                    value={spec.lokasi_penerapan}
                    onChange={(v) => handleSpecChange("lokasi_penerapan", v)}
                    options={recommendations.lokasi_penerapan.map((v: string) => ({ value: v, label: v }))}
                    placeholder="Pilih atau ketik lokasi baru..."
                    formatAs="titleCase"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Implementasi</Label>
                  <CreatableSelectInput
                    value={spec.implementasi}
                    onChange={(v) => handleSpecChange("implementasi", v)}
                    options={recommendations.implementasi.map((v: string) => ({ value: v, label: v }))}
                    placeholder="Pilih atau ketik implementa..."
                    formatAs="titleCase"
                  />
                </div>

                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">Informasi Tambahan</Label>
                  <Input
                    placeholder="Contoh: Menggunakan Nat Warna Senada"
                    className="h-11 bg-slate-50/50 border-slate-200 focus-visible:ring-orange-500"
                    value={spec.informasi_tambahan}
                    onChange={(e) => {
                      const val = e.target.value.replace(
                        /\w\S*/g,
                        (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
                      );
                      handleSpecChange("informasi_tambahan", val);
                    }}
                  />
                </div>

              </div>

              {/* Live Preview Deskripsi */}
              <div className="mt-8 p-5 bg-slate-50 border border-slate-100 rounded-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#E65F2B]"></div>
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Preview Nama Master Item</p>
                    <p className="text-[15px] font-medium text-slate-800 leading-relaxed">
                      {generatedDeskripsi || <span className="text-slate-300 italic font-normal">Mulai isi spesifikasi di atas untuk melihat preview...</span>}
                    </p>
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Kalkulasi (Scrollable with sticky footer) */}
            <div className="w-full lg:w-[45%] bg-[#FAFAFA] flex flex-col min-h-0">

              <div className="flex-1 overflow-y-auto min-h-0 p-8 custom-scrollbar">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 bg-slate-800 rounded-full"></div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Koefisien (AHS)</h3>
                  </div>
                  <button
                    onClick={() => setIsKomponenModalOpen(true)}
                    className="text-[11px] font-bold text-slate-500 hover:text-orange-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors shadow-sm hover:shadow"
                  >
                    <HardHat className="w-3.5 h-3.5" /> + Komponen Baru
                  </button>
                </div>

                {/* UPAH */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Komponen Upah</span>
                  </div>

                  <div className="space-y-4">
                    {upahRows.map((row, idx) => (
                      <div key={row.id} className="group flex flex-col md:flex-row items-start md:items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-[#E65F2B]/40 transition-all">

                        {/* KOMPONEN SELECTOR (SEARCHABLE) */}
                        <div className="flex-1 w-full relative">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest absolute -top-2.5 left-2 bg-white px-1 z-10">Pilih Tenaga Kerja</label>
                          <SearchableSelectInput
                            value={row.komponen_id ? row.komponen_id.toString() : ""}
                            onChange={(v) => updateKoefisien(row.id, "komponen_id", v ? parseInt(v) : "")}
                            options={upahList.map(item => ({ value: item.id.toString(), label: item.nama_komponen }))}
                            placeholder="Search"
                            disabledIds={upahRows.map(r => r.komponen_id.toString())}
                          />
                        </div>

                        {/* VOLUME INPUT */}
                        <div className="w-full md:w-32 relative mt-2 md:mt-0">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest absolute -top-2.5 left-2 bg-white px-1 z-10">Volume</label>
                          <div className="flex items-center">
                            <Input
                              type="text"
                              inputMode="decimal"
                              className="h-11 rounded-r-none border-slate-200 focus-visible:z-10 focus-visible:ring-[#E65F2B] focus-visible:border-[#E65F2B]"
                              value={row.volume}
                              onChange={(e) => updateKoefisien(row.id, "volume", e.target.value.replace(/[^0-9.]/g, ''))}
                              placeholder="0.0"
                            />
                            <div className="h-11 px-3 bg-slate-50 border border-l-0 border-slate-200 rounded-r-md flex items-center justify-center text-xs font-bold text-slate-500 whitespace-nowrap min-w-[3.5rem]">
                              {row.satuan || "-"}
                            </div>
                          </div>
                        </div>

                        {/* ACTION BUTTON */}
                        <button onClick={() => removeKoefisien(row.id)} className="shrink-0 w-11 h-11 mt-2 md:mt-0 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={() => addKoefisienRow("UPAH")}
                      className="flex items-center gap-2 text-sm font-semibold text-[#E65F2B] hover:text-white hover:bg-[#E65F2B] border border-[#E65F2B]/30 hover:border-[#E65F2B] px-4 py-2.5 rounded-xl transition-all shadow-sm w-fit"
                    >
                      <Plus className="w-4 h-4" /> Tambah Baris Upah
                    </button>
                  </div>
                </div>

                {/* MATERIAL */}
                <div>
                  <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Komponen Material</span>
                  </div>

                  <div className="space-y-4">
                    {materialRows.map((row, idx) => (
                      <div key={row.id} className="group flex flex-col md:flex-row items-start md:items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-[#E65F2B]/40 transition-all">

                        {/* KOMPONEN SELECTOR (SEARCHABLE) */}
                        <div className="flex-1 w-full relative">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest absolute -top-2.5 left-2 bg-white px-1 z-10">Pilih Material</label>
                          <SearchableSelectInput
                            value={row.komponen_id ? row.komponen_id.toString() : ""}
                            onChange={(v) => updateKoefisien(row.id, "komponen_id", v ? parseInt(v) : "")}
                            options={materialList.map(item => ({ value: item.id.toString(), label: item.nama_komponen }))}
                            placeholder="Search"
                            disabledIds={materialRows.map(r => r.komponen_id.toString())}
                          />
                        </div>

                        {/* VOLUME INPUT */}
                        <div className="w-full md:w-32 relative mt-2 md:mt-0">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest absolute -top-2.5 left-2 bg-white px-1 z-10">Volume</label>
                          <div className="flex items-center">
                            <Input
                              type="text"
                              inputMode="decimal"
                              className="h-11 rounded-r-none border-slate-200 focus-visible:z-10 focus-visible:ring-[#E65F2B] focus-visible:border-[#E65F2B]"
                              value={row.volume}
                              onChange={(e) => updateKoefisien(row.id, "volume", e.target.value.replace(/[^0-9.]/g, ''))}
                              placeholder="0.0"
                            />
                            <div className="h-11 px-3 bg-slate-50 border border-l-0 border-slate-200 rounded-r-md flex items-center justify-center text-xs font-bold text-slate-500 whitespace-nowrap min-w-[3.5rem]">
                              {row.satuan || "-"}
                            </div>
                          </div>
                        </div>

                        {/* ACTION BUTTON */}
                        <button onClick={() => removeKoefisien(row.id)} className="shrink-0 w-11 h-11 mt-2 md:mt-0 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={() => addKoefisienRow("MATERIAL")}
                      className="flex items-center gap-2 text-sm font-semibold text-[#E65F2B] hover:text-white hover:bg-[#E65F2B] border border-[#E65F2B]/30 hover:border-[#E65F2B] px-4 py-2.5 rounded-xl transition-all shadow-sm w-fit"
                    >
                      <Plus className="w-4 h-4" /> Tambah Baris Material
                    </button>
                  </div>
                </div>

              </div>

              {/* Action Area */}
              <div className="shrink-0 bg-white border-t border-slate-100 p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.03)] z-10">
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={onClose} disabled={isSaving} className="flex-1 h-12 rounded-xl font-bold border-slate-200 text-slate-600 hover:bg-slate-50">
                    Batal
                  </Button>
                  <Button
                    onClick={handleReview}
                    className="flex-[2] h-12 rounded-xl font-bold bg-[#E65F2B] hover:bg-[#D3501F] text-white shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5"
                  >
                    Lanjut Review
                  </Button>
                </div>
              </div>

            </div>
          </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white custom-scrollbar relative">
              <ReviewItemStep
                spec={spec}
                kodePreview={kodePreview}
                ahsWarning={ahsWarning}
                koefisiens={koefisiens}
                deskripsiOtomatis={generatedDeskripsi}
                isSaving={isSaving}
                onRevisi={() => setStep("form")}
                onConfirm={confirmSave}
              />
            </div>
          )}
        </DialogContent>

        <TambahKomponenModal
          isOpen={isKomponenModalOpen}
          onClose={() => setIsKomponenModalOpen(false)}
          onSuccess={() => {
            fetchMasterKomponen(); // Refresh list dropdown upah/material
          }}
        />
      </Dialog>
    </>
  );
}
