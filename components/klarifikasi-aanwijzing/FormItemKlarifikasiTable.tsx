"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Trash2, Layers, HardHat, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { VolumeInput } from "@/components/ui/volume-input";
import { SatuanCombobox } from "@/components/ui/satuan-combobox";
import { SearchableSelectInput } from "@/components/ui/searchable-select";
import { RabItemSelector, MasterItemOption } from "@/components/renovasi/RabItemSelector";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { formatRupiah, cn, toTitleCase } from "@/lib/utils";
import { calculateStringSimilarity } from "@/lib/similarity";
import { useSession } from "@/context/SessionContext";
import { RevisionPinpointBadge } from "@/components/approval/RevisionPinpointBadge";
import {
  getUserCoverageBranches,
  isBranchAccessible,
  getIndukFromCabang,
  getBranchesUnderInduk,
} from "@/lib/branches";

export interface KlarifikasiItemPayload {
  id?: number;
  tipe_perubahan: "ITEM_BARU" | "UBAH_VOLUME";
  original_renovasi_item_id?: number | null;
  lingkup: "SIPIL" | "ME";
  kategori_pekerjaan: string;
  deskripsi: string;
  satuan: string;
  volume_awal: number;
  volume_akhir: number;
  harga_material: number;
  harga_upah: number;
  total_biaya_awal: number;
  total_biaya_akhir: number;
  status_perubahan?: string; // "Item Baru Ditambahkan" | "Volume Berubah" | "Harga Upah Berubah" | "Harga Material Berubah" | "Volume & Harga Berubah" | "Dikembalikan Sesuai RAB Awal"
  catatan: string; // Catatan wajib dari user
  keterangan: string; // Keterangan ringkas deskriptif
}

interface FormItemKlarifikasiTableProps {
  originalItems: any[];
  initialKlarifikasiItems?: any[];
  cabang?: string;
  isRevision?: boolean;
  flaggedItemsMap?: Record<string, { isFlagged: boolean; catatan: string; isModified: boolean }>;
  onChange: (items: KlarifikasiItemPayload[]) => void;
}

// Helper untuk memisahkan catatan riwayat sebelumnya dan catatan perbaikan baru saat revisi
function parseCatatanHistory(rawCatatan?: string | null): { prevNote: string; currentDraftNote: string } {
  if (!rawCatatan) return { prevNote: "", currentDraftNote: "" };
  const delimiter = "\n[Perbaikan Revisi]: ";
  const altDelimiter = " | [Perbaikan Revisi]: ";
  if (rawCatatan.includes(delimiter)) {
    const parts = rawCatatan.split(delimiter);
    return { prevNote: parts[0].trim(), currentDraftNote: parts.slice(1).join(delimiter).trim() };
  }
  if (rawCatatan.includes(altDelimiter)) {
    const parts = rawCatatan.split(altDelimiter);
    return { prevNote: parts[0].trim(), currentDraftNote: parts.slice(1).join(altDelimiter).trim() };
  }
  return { prevNote: rawCatatan.trim(), currentDraftNote: "" };
}

export function FormItemKlarifikasiTable({
  originalItems,
  initialKlarifikasiItems,
  cabang = "",
  isRevision = false,
  flaggedItemsMap,
  onChange,
}: FormItemKlarifikasiTableProps) {
  const { user } = useSession();

  // Tab Switcher Sipil vs ME (persis seperti konsep Penawaran RAB/OE)
  const [activeTab, setActiveTab] = useState<"SIPIL" | "ME">("SIPIL");

  // Master Data untuk katalog penambahan item baru
  const [masterCategories, setMasterCategories] = useState<any[]>([]);
  const [masterItems, setMasterItems] = useState<any[]>([]);

  // State untuk pop-up deteksi kemiripan item baru terhadap item eksisting RAB/OE (>70%)
  const [similarityWarning, setSimilarityWarning] = useState<{
    open: boolean;
    newItemName: string;
    existingItemName: string;
    kategori: string;
    similarity: number;
    onProceed: () => void;
    onCancel: () => void;
  } | null>(null);

  // State 1: Map volume baru untuk item eksisting (key: original_renovasi_item_id, val: volume_akhir)
  const [volumeMap, setVolumeMap] = useState<Record<number, number>>(() => {
    const vMap: Record<number, number> = {};
    if (initialKlarifikasiItems && initialKlarifikasiItems.length > 0) {
      initialKlarifikasiItems.forEach((it) => {
        if (it.tipe_perubahan === "UBAH_VOLUME" && it.original_renovasi_item_id) {
          vMap[it.original_renovasi_item_id] = it.volume_akhir;
        }
      });
    }
    return vMap;
  });

  // State 2: Map harga baru untuk item eksisting (key: original_renovasi_item_id, val: { material: number, upah: number })
  const [priceMap, setPriceMap] = useState<Record<number, { material: number; upah: number }>>(() => {
    const pMap: Record<number, { material: number; upah: number }> = {};
    if (initialKlarifikasiItems && initialKlarifikasiItems.length > 0) {
      initialKlarifikasiItems.forEach((it) => {
        if (it.tipe_perubahan === "UBAH_VOLUME" && it.original_renovasi_item_id) {
          pMap[it.original_renovasi_item_id] = {
            material: Number(it.harga_material) || 0,
            upah: Number(it.harga_upah) || 0,
          };
        }
      });
    }
    return pMap;
  });

  // Map item klarifikasi awal untuk referensi item yang pernah diajukan sebelumnya
  const initialItemMap = useMemo(() => {
    const map: Record<number, any> = {};
    if (initialKlarifikasiItems && initialKlarifikasiItems.length > 0) {
      initialKlarifikasiItems.forEach((it) => {
        if (it.tipe_perubahan === "UBAH_VOLUME" && it.original_renovasi_item_id) {
          map[it.original_renovasi_item_id] = it;
        }
      });
    }
    return map;
  }, [initialKlarifikasiItems]);

  // Catatan lama dari pengajuan sebelumnya (Read-Only saat revisi)
  const previousNoteMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (initialKlarifikasiItems && initialKlarifikasiItems.length > 0) {
      initialKlarifikasiItems.forEach((it) => {
        if (it.tipe_perubahan === "UBAH_VOLUME" && it.original_renovasi_item_id) {
          const parsed = parseCatatanHistory(it.catatan);
          map[it.original_renovasi_item_id] = parsed.prevNote;
        }
      });
    }
    return map;
  }, [initialKlarifikasiItems]);

  // State 3a: Catatan baru saat revisi (terpisah dari catatan lama yang read-only)
  const [revisionNoteMap, setRevisionNoteMap] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    if (initialKlarifikasiItems && initialKlarifikasiItems.length > 0) {
      initialKlarifikasiItems.forEach((it) => {
        if (it.tipe_perubahan === "UBAH_VOLUME" && it.original_renovasi_item_id) {
          const parsed = parseCatatanHistory(it.catatan);
          if (parsed.currentDraftNote) {
            map[it.original_renovasi_item_id] = parsed.currentDraftNote;
          }
        }
      });
    }
    return map;
  });

  // State 3b: Map catatan penyesuaian saat pengajuan awal (bukan revisi)
  const [noteMap, setNoteMap] = useState<Record<number, string>>(() => {
    const nMap: Record<number, string> = {};
    if (initialKlarifikasiItems && initialKlarifikasiItems.length > 0) {
      initialKlarifikasiItems.forEach((it) => {
        if (it.tipe_perubahan === "UBAH_VOLUME" && it.original_renovasi_item_id) {
          nMap[it.original_renovasi_item_id] = it.catatan || it.keterangan || "";
        }
      });
    }
    return nMap;
  });

  // State 4: List item baru yang ditambahkan
  const [newItemRows, setNewItemRows] = useState<
    (KlarifikasiItemPayload & {
      tempId: string;
      master_item_id?: number | null;
      is_custom?: boolean;
      catatan_sebelumnya?: string;
      catatan_baru?: string;
    })[]
  >(() => {
    const nRows: (KlarifikasiItemPayload & {
      tempId: string;
      master_item_id?: number | null;
      is_custom?: boolean;
      catatan_sebelumnya?: string;
      catatan_baru?: string;
    })[] = [];
    if (initialKlarifikasiItems && initialKlarifikasiItems.length > 0) {
      initialKlarifikasiItems.forEach((it, idx) => {
        if (it.tipe_perubahan === "ITEM_BARU") {
          const parsed = parseCatatanHistory(it.catatan);
          nRows.push({
            tempId: `init_${it.id || idx}`,
            tipe_perubahan: "ITEM_BARU",
            lingkup: it.lingkup || "SIPIL",
            kategori_pekerjaan: it.kategori_pekerjaan || "PEKERJAAN PERSIAPAN",
            deskripsi: it.deskripsi || "",
            satuan: it.satuan || "",
            volume_awal: 0,
            volume_akhir: Number(it.volume_akhir) || 0,
            harga_material: Number(it.harga_material) || 0,
            harga_upah: Number(it.harga_upah) || 0,
            total_biaya_awal: 0,
            total_biaya_akhir: Number(it.total_biaya_akhir) || 0,
            status_perubahan: "Item Baru Ditambahkan",
            catatan: it.catatan || it.keterangan || "",
            catatan_sebelumnya: parsed.prevNote || "",
            catatan_baru: parsed.currentDraftNote || "",
            keterangan: "Item Baru Ditambahkan",
            master_item_id: it.master_item_id || null,
            is_custom: it.is_custom ?? true,
          });
        }
      });
    }
    return nRows;
  });

  // Fetch Master Data untuk dropdown RabItemSelector saat komponen pertama mount
  useEffect(() => {
    let isMounted = true;
    const fetchMaster = async () => {
      try {
        const res = await fetch("/api/dc-development/renovasi/master-data");
        const json = await res.json();
        if (isMounted && json.status === "success" && json.data) {
          setMasterCategories(json.data.categories || []);
          setMasterItems(json.data.masterItems || []);
        }
      } catch (err) {
        console.error("Gagal memuat master item:", err);
      }
    };
    fetchMaster();
    return () => {
      isMounted = false;
    };
  }, []);

  // Helper murni event-driven untuk mengompilasi dan mengoper perubahan ke parent
  const emitCompiled = useCallback(
    (
      currentVolMap: Record<number, number>,
      currentPriceMap: Record<number, { material: number; upah: number }>,
      currentNoteMap: Record<number, string>,
      currentRevNoteMap: Record<number, string>,
      currentNewRows: (KlarifikasiItemPayload & { tempId: string; catatan_sebelumnya?: string; catatan_baru?: string })[]
    ) => {
      const compiled: KlarifikasiItemPayload[] = [];

      // 1. Kumpulkan item eksisting yang volumenya ATAU harganya BERUBAH (atau dikembalikan saat REVISI)
      originalItems.forEach((orig) => {
        const volAwal = Number(orig.volume) || 0;
        const volAkhir = currentVolMap[orig.id] !== undefined ? currentVolMap[orig.id] : volAwal;

        const matAwal = Number(orig.harga_material) || 0;
        const upahAwal = Number(orig.harga_upah) || 0;

        const matAkhir =
          currentPriceMap[orig.id]?.material !== undefined
            ? currentPriceMap[orig.id].material
            : matAwal;
        const upahAkhir =
          currentPriceMap[orig.id]?.upah !== undefined
            ? currentPriceMap[orig.id].upah
            : upahAwal;

        const isVolChanged = volAkhir !== volAwal;
        const isMatChanged = matAkhir !== matAwal;
        const isUpahChanged = upahAkhir !== upahAwal;
        const isDifferentFromRab = isVolChanged || isMatChanged || isUpahChanged;

        const wasInPreviousSubmission = Boolean(initialItemMap[orig.id]);
        const shouldInclude = isRevision
          ? (wasInPreviousSubmission || isDifferentFromRab)
          : isDifferentFromRab;

        if (shouldInclude) {
          const totalAwal = volAwal * (matAwal + upahAwal);
          const totalAkhir = volAkhir * (matAkhir + upahAkhir);

          // Status Otomatis Sistem
          let statusPerubahan = "Item Disesuaikan";
          if (!isDifferentFromRab && isRevision && wasInPreviousSubmission) {
            statusPerubahan = "Dikembalikan Sesuai RAB Awal";
          } else if (isVolChanged && (isMatChanged || isUpahChanged)) {
            statusPerubahan = "Volume & Harga Berubah";
          } else if (isVolChanged) {
            statusPerubahan = "Volume Berubah";
          } else if (isMatChanged && isUpahChanged) {
            statusPerubahan = "Harga Material & Upah Berubah";
          } else if (isMatChanged) {
            statusPerubahan = "Harga Material Berubah";
          } else if (isUpahChanged) {
            statusPerubahan = "Harga Upah Berubah";
          }

          // Catatan dari user: Jika saat revisi dan ada catatan sebelumnya, catatan baru adalah add-on (bukan replace)
          const prevNote = previousNoteMap[orig.id] || "";
          const newRevNote = (currentRevNoteMap[orig.id] || "").trim();
          let userCatatan = "";
          if (isRevision) {
            if (prevNote) {
              userCatatan = newRevNote ? `${prevNote}\n[Perbaikan Revisi]: ${newRevNote}` : "";
            } else {
              userCatatan = newRevNote;
            }
          } else {
            userCatatan = currentNoteMap[orig.id] || "";
          }

          // Keterangan ringkas deskriptif
          let ket = "";
          if (!isDifferentFromRab && isRevision && wasInPreviousSubmission) {
            ket = `Volume dan harga dikembalikan sesuai nilai RAB awal (${volAwal} ${orig.satuan || "m2"}, Mat: ${formatRupiah(matAwal)}, Upah: ${formatRupiah(upahAwal)})`;
          } else if (isVolChanged && (isMatChanged || isUpahChanged)) {
            ket = `Volume (${volAwal} -> ${volAkhir} ${orig.satuan || "m2"}) & Harga disesuaikan (Mat: ${formatRupiah(matAwal)} -> ${formatRupiah(matAkhir)}, Upah: ${formatRupiah(upahAwal)} -> ${formatRupiah(upahAkhir)})`;
          } else if (isVolChanged) {
            ket = `Volume berubah dari ${volAwal} ${orig.satuan || "m2"} menjadi ${volAkhir} ${orig.satuan || "m2"}`;
          } else {
            ket = `Harga disesuaikan (Mat: ${formatRupiah(matAwal)} -> ${formatRupiah(matAkhir)}, Upah: ${formatRupiah(upahAwal)} -> ${formatRupiah(upahAkhir)})`;
          }

          compiled.push({
            tipe_perubahan: "UBAH_VOLUME",
            original_renovasi_item_id: orig.id,
            lingkup: orig.lingkup || "SIPIL",
            kategori_pekerjaan: orig.kategori_pekerjaan || "Pekerjaan",
            deskripsi: orig.deskripsi,
            satuan: orig.satuan || "m2",
            volume_awal: volAwal,
            volume_akhir: volAkhir,
            harga_material: matAkhir,
            harga_upah: upahAkhir,
            total_biaya_awal: totalAwal,
            total_biaya_akhir: totalAkhir,
            status_perubahan: statusPerubahan,
            catatan: userCatatan,
            keterangan: ket,
          });
        }
      });

      // 2. Kumpulkan seluruh item baru yang memiliki deskripsi
      currentNewRows.forEach((row) => {
        if (row.deskripsi.trim()) {
          const vol = Number(row.volume_akhir) || 0;
          const mat = Number(row.harga_material) || 0;
          const upah = Number(row.harga_upah) || 0;

          let finalCatatan = row.catatan || "";
          if (isRevision && row.catatan_sebelumnya) {
            finalCatatan = row.catatan_baru?.trim()
              ? `${row.catatan_sebelumnya}\n[Perbaikan Revisi]: ${row.catatan_baru.trim()}`
              : "";
          }

          compiled.push({
            tipe_perubahan: "ITEM_BARU",
            original_renovasi_item_id: null,
            lingkup: row.lingkup,
            kategori_pekerjaan: row.kategori_pekerjaan,
            deskripsi: row.deskripsi,
            satuan: row.satuan,
            volume_awal: 0,
            volume_akhir: vol,
            harga_material: mat,
            harga_upah: upah,
            total_biaya_awal: 0,
            total_biaya_akhir: vol * (mat + upah),
            status_perubahan: "Item Baru Ditambahkan",
            catatan: finalCatatan,
            keterangan: "Item Baru Ditambahkan",
          });
        }
      });

      onChange(compiled);
    },
    [originalItems, isRevision, initialItemMap, previousNoteMap, onChange]
  );

  // Handle perubahan volume item eksisting
  const handleVolumeChange = (origId: number, val: number | string) => {
    const num = typeof val === "number" ? val : parseFloat(val) || 0;
    const nextMap = {
      ...volumeMap,
      [origId]: num,
    };
    setVolumeMap(nextMap);
    emitCompiled(nextMap, priceMap, noteMap, revisionNoteMap, newItemRows);
  };

  // Handle perubahan harga (material / upah) item eksisting
  const handlePriceChange = (origId: number, field: "material" | "upah", val: number) => {
    const origItem = originalItems.find((it) => it.id === origId);
    const currentEntry = priceMap[origId] || {
      material: Number(origItem?.harga_material) || 0,
      upah: Number(origItem?.harga_upah) || 0,
    };

    const nextEntry = {
      ...currentEntry,
      [field]: val,
    };

    const nextPriceMap = {
      ...priceMap,
      [origId]: nextEntry,
    };

    setPriceMap(nextPriceMap);
    emitCompiled(volumeMap, nextPriceMap, noteMap, revisionNoteMap, newItemRows);
  };

  // Handle perubahan catatan penyesuaian item eksisting saat pengajuan awal
  const handleNoteChange = (origId: number, val: string) => {
    const nextNoteMap = {
      ...noteMap,
      [origId]: val,
    };
    setNoteMap(nextNoteMap);
    emitCompiled(volumeMap, priceMap, nextNoteMap, revisionNoteMap, newItemRows);
  };

  // Handle perubahan catatan perbaikan revisi baru
  const handleRevisionNoteChange = (origId: number, val: string) => {
    const nextRevMap = {
      ...revisionNoteMap,
      [origId]: val,
    };
    setRevisionNoteMap(nextRevMap);
    emitCompiled(volumeMap, priceMap, noteMap, nextRevMap, newItemRows);
  };

  // Kategori yang tersedia untuk Tab Aktif
  const categoriesForActiveTab = useMemo(() => {
    const list = masterCategories
      .filter((c) => (c.lingkup || "SIPIL").trim().toUpperCase() === activeTab)
      .map((c) => c.nama);

    if (list.length > 0) return list;

    // Fallback kategori standar sesuai SOP DC-Development
    return activeTab === "SIPIL"
      ? [
          "PEKERJAAN PERSIAPAN",
          "PEKERJAAN BOBOKAN / BONGKARAN",
          "PEKERJAAN TANAH",
          "PEKERJAAN PONDASI & BETON",
          "PEKERJAAN PASANGAN",
          "PEKERJAAN BESI",
          "PEKERJAAN KERAMIK",
          "PEKERJAAN PLUMBING",
          "PEKERJAAN SANITARY & ACECORIES",
          "PEKERJAAN JANITOR",
          "PEKERJAAN ATAP",
          "PEKERJAAN KUSEN, PINTU & KACA",
          "PEKERJAAN FINISHING",
          "PEKERJAAN BEANSPOT",
          "PEKERJAAN AREA TERBUKA",
          "PEKERJAAN TAMBAHAN",
          "PEKERJAAN LIFT BARANG",
          "PEKERJAAN SBO",
          "PEKERJAAN LAIN-LAIN",
        ]
      : [
          "PEKERJAAN INSTALASI LISTRIK",
          "PEKERJAAN PENERANGAN & STOP KONTAK",
          "PEKERJAAN PANEL & DISTRIBUSI",
          "PEKERJAAN PLUMBING & SANITASI",
          "PEKERJAAN TATA UDARA / HVAC",
          "PEKERJAAN FIRE FIGHTING & SAFETY",
          "PEKERJAAN LAIN-LAIN ME",
        ];
  }, [masterCategories, activeTab]);

  // Handle tambah baris item baru pada tab yang aktif
  const handleAddNewRow = () => {
    const newRow: KlarifikasiItemPayload & {
      tempId: string;
      master_item_id?: number | null;
      is_custom?: boolean;
    } = {
      tempId: `row_${Date.now()}_${Math.random()}`,
      tipe_perubahan: "ITEM_BARU",
      lingkup: activeTab,
      kategori_pekerjaan: "", // Dikosongkan agar user wajib memilih kategori terlebih dahulu
      deskripsi: "",
      satuan: "",
      volume_awal: 0,
      volume_akhir: 0,
      harga_material: 0,
      harga_upah: 0,
      total_biaya_awal: 0,
      total_biaya_akhir: 0,
      status_perubahan: "Item Baru Ditambahkan",
      catatan: "",
      keterangan: "Item Baru Ditambahkan",
      master_item_id: null,
      is_custom: true,
    };

    const nextRows = [...newItemRows, newRow];
    setNewItemRows(nextRows);
    emitCompiled(volumeMap, priceMap, noteMap, revisionNoteMap, nextRows);
  };

  // Handle update field item baru
  const handleUpdateNewRow = (
    tempId: string,
    field: string,
    val: any
  ) => {
    const nextRows = newItemRows.map((r) => {
      if (r.tempId !== tempId) return r;
      const target = { ...r, [field]: val };

      // Jika kategori pekerjaan diubah, reset pemilihan item master agar tidak salah kategori
      if (field === "kategori_pekerjaan" && val !== r.kategori_pekerjaan) {
        target.kategori_pekerjaan = val;
        target.deskripsi = "";
        target.master_item_id = null;
        target.is_custom = true;
        target.harga_material = 0;
        target.harga_upah = 0;
        target.total_biaya_akhir = 0;
      }

      // Hitung ulang total biaya
      if (
        field === "volume_akhir" ||
        field === "harga_material" ||
        field === "harga_upah"
      ) {
        const vol = Number(target.volume_akhir) || 0;
        const mat = Number(target.harga_material) || 0;
        const upah = Number(target.harga_upah) || 0;
        target.total_biaya_akhir = vol * (mat + upah);
      }
      return target;
    });

    setNewItemRows(nextRows);
    emitCompiled(volumeMap, priceMap, noteMap, revisionNoteMap, nextRows);
  };

  // Handle pemilihan item dari Master Item via RabItemSelector
  const handleSelectMasterItem = (
    tempId: string,
    val: string,
    option?: MasterItemOption
  ) => {
    const targetRow = newItemRows.find((r) => r.tempId === tempId);
    if (!targetRow) return;

    const mId = option?.masterItemId || (option?.masterItem?.id ? Number(option.masterItem.id) : null);
    const deskripsi = option?.label || val;
    const kat = targetRow.kategori_pekerjaan || option?.kategori_pekerjaan || "";
    const mat = Number(option?.recommendedMaterial) || 0;
    const upah = Number(option?.recommendedUpah) || 0;
    const vol = Number(targetRow.volume_akhir) || 1;

    // Deteksi kemiripan terhadap originalItems pada kategori yang sama (>70%)
    const targetCat = (kat || "").trim().toLowerCase();
    let highestSim = 0;
    let mostSimilarOrig: any = null;

    if (targetCat) {
      originalItems.forEach((orig) => {
        const origCat = (orig.kategori_pekerjaan || "").trim().toLowerCase();
        if (origCat === targetCat && orig.deskripsi) {
          const sim = calculateStringSimilarity(deskripsi, orig.deskripsi);
          if (sim > highestSim) {
            highestSim = sim;
            mostSimilarOrig = orig;
          }
        }
      });
    }

    const applySelection = () => {
      const nextRows = newItemRows.map((r) => {
        if (r.tempId !== tempId) return r;
        return {
          ...r,
          master_item_id: mId,
          deskripsi,
          kategori_pekerjaan: kat,
          is_custom: false,
          harga_material: mat,
          harga_upah: upah,
          total_biaya_akhir: vol * (mat + upah),
        };
      });

      setNewItemRows(nextRows);
      emitCompiled(volumeMap, priceMap, noteMap, revisionNoteMap, nextRows);
    };

    if (highestSim >= 70 && mostSimilarOrig) {
      setSimilarityWarning({
        open: true,
        newItemName: deskripsi,
        existingItemName: mostSimilarOrig.deskripsi,
        kategori: kat,
        similarity: highestSim,
        onProceed: () => {
          applySelection();
          setSimilarityWarning(null);
        },
        onCancel: () => {
          setSimilarityWarning(null);
        },
      });
    } else {
      applySelection();
    }
  };

  // Handle custom text saat user mengetik bebas di RabItemSelector
  const handleSetCustomRabItem = (tempId: string, customText: string) => {
    // Format otomatis dengan title case
    const formattedText = toTitleCase(customText.trim());
    const targetRow = newItemRows.find((r) => r.tempId === tempId);
    if (!targetRow) return;

    // Deteksi kemiripan terhadap originalItems pada kategori yang sama (>70%)
    const targetCat = (targetRow.kategori_pekerjaan || "").trim().toLowerCase();
    let highestSim = 0;
    let mostSimilarOrig: any = null;

    if (targetCat) {
      originalItems.forEach((orig) => {
        const origCat = (orig.kategori_pekerjaan || "").trim().toLowerCase();
        if (origCat === targetCat && orig.deskripsi) {
          const sim = calculateStringSimilarity(formattedText, orig.deskripsi);
          if (sim > highestSim) {
            highestSim = sim;
            mostSimilarOrig = orig;
          }
        }
      });
    }

    const applyChange = () => {
      const nextRows = newItemRows.map((r) => {
        if (r.tempId !== tempId) return r;
        return {
          ...r,
          master_item_id: null,
          deskripsi: formattedText,
          is_custom: true,
        };
      });

      setNewItemRows(nextRows);
      emitCompiled(volumeMap, priceMap, noteMap, revisionNoteMap, nextRows);
    };

    if (highestSim >= 70 && mostSimilarOrig) {
      setSimilarityWarning({
        open: true,
        newItemName: formattedText,
        existingItemName: mostSimilarOrig.deskripsi,
        kategori: targetRow.kategori_pekerjaan,
        similarity: highestSim,
        onProceed: () => {
          applyChange();
          setSimilarityWarning(null);
        },
        onCancel: () => {
          setSimilarityWarning(null);
        },
      });
    } else {
      applyChange();
    }
  };

  // Handle hapus baris item baru
  const handleRemoveNewRow = (tempId: string) => {
    const nextRows = newItemRows.filter((r) => r.tempId !== tempId);
    setNewItemRows(nextRows);
    emitCompiled(volumeMap, priceMap, noteMap, revisionNoteMap, nextRows);
  };

  // Options master item khusus untuk kategori & lingkup yang aktif,
  // serta difilter strictly berdasarkan coverage cabang projek dan hak akses user
  const getMasterItemOptions = useCallback(
    (kategori: string, lingkup: string): MasterItemOption[] => {
      // 1. Kategori wajib ada, jika belum dipilih jangan tampilkan opsi sama sekali
      if (!kategori || !kategori.trim()) {
        return [];
      }

      const normCat = kategori.trim().toLowerCase();
      const normScope = (lingkup || "SIPIL").trim().toUpperCase();
      const projectBranch = (cabang || "").trim().toUpperCase();
      const projectInduk = getIndukFromCabang(projectBranch).toUpperCase();
      const branchesUnderProject = getBranchesUnderInduk(projectBranch).map((b) => b.toUpperCase());
      const userAllowedBranches = getUserCoverageBranches(user);

      // 2. Filter master items berdasarkan lingkup & kategori pekerjaan secara persis (case-insensitive)
      const matchingItems = masterItems.filter((m) => {
        const scopeMatch = (m.lingkup || "SIPIL").trim().toUpperCase() === normScope;
        const catMatch = (m.kategori_pekerjaan || "").trim().toLowerCase() === normCat;
        return scopeMatch && catMatch;
      });

      // 3. Filter berdasarkan coverage cabang projek dan status_aktif === true
      const validOptions: MasterItemOption[] = [];

      matchingItems.forEach((m) => {
        // Cari entri item_cabang yang AKTIF (status_aktif: true) dan mencakup cabang proyek
        const activeBranchEntries = (m.item_cabang || []).filter((c: any) => {
          if (!c.status_aktif) return false;

          const cCoverage = (c.coverage_cabang || "").trim().toUpperCase();
          const cCabang = (c.cabang || "").trim().toUpperCase();

          const matchesProject =
            cCoverage === projectBranch ||
            cCabang === projectBranch ||
            cCoverage === projectInduk ||
            cCabang === projectInduk ||
            branchesUnderProject.includes(cCoverage) ||
            branchesUnderProject.includes(cCabang);

          if (!matchesProject) return false;

          // Cek wewenang user coverage (jika bukan admin / non-null)
          if (userAllowedBranches !== null) {
            const isAccessible =
              isBranchAccessible(projectBranch, userAllowedBranches) &&
              (isBranchAccessible(cCoverage || cCabang, userAllowedBranches) ||
                cCoverage === "ALL" ||
                cCabang === "ALL");
            if (!isAccessible) return false;
          }

          return true;
        });

        if (activeBranchEntries.length === 0) {
          // Item ini tidak aktif di cabang proyek / coverage user ini
          return;
        }

        // Ambil entri yang paling spesifik (prioritaskan exact coverage_cabang proyek)
        const sorted = activeBranchEntries.sort((a: any, b: any) => {
          const aCov = (a.coverage_cabang || "").trim().toUpperCase();
          const bCov = (b.coverage_cabang || "").trim().toUpperCase();
          if (aCov === projectBranch && bCov !== projectBranch) return -1;
          if (bCov === projectBranch && aCov !== projectBranch) return 1;
          return 0;
        });

        const bestEntry = sorted[0];
        const mat = Number(bestEntry.total_material) || 0;
        const upah = Number(bestEntry.total_upah) || 0;

        validOptions.push({
          value: String(m.id),
          label: m.deskripsi_otomatis || m.item_material || `Item #${m.id}`,
          masterItemId: m.id,
          masterItem: m,
          source: "master",
          recommendedMaterial: mat,
          recommendedUpah: upah,
          kategori_pekerjaan: m.kategori_pekerjaan,
          lingkup: m.lingkup,
        });
      });

      return validOptions;
    },
    [masterItems, cabang, user]
  );

  // Filter list item eksisting berdasarkan tab lingkup (SIPIL atau ME)
  const filteredOriginalItems = useMemo(() => {
    return originalItems.filter(
      (it) => (it.lingkup || "SIPIL").trim().toUpperCase() === activeTab
    );
  }, [originalItems, activeTab]);

  // Kelompokkan item eksisting berdasarkan kategori pekerjaan
  const groupedOriginalItems = useMemo(() => {
    const map: Record<string, typeof filteredOriginalItems> = {};
    filteredOriginalItems.forEach((it) => {
      const cat = (it.kategori_pekerjaan || "PEKERJAAN LAIN-LAIN").trim().toUpperCase();
      if (!map[cat]) map[cat] = [];
      map[cat].push(it);
    });
    return map;
  }, [filteredOriginalItems]);

  // Filter list item baru berdasarkan tab lingkup (SIPIL atau ME)
  const filteredNewRows = useMemo(() => {
    return newItemRows.filter((it) => it.lingkup === activeTab);
  }, [newItemRows, activeTab]);

  // Hitung subtotal Sipil dan ME secara dinamis memperhitungkan volumeMap & priceMap
  const totalSipil = useMemo(() => {
    let sum = 0;
    originalItems
      .filter((it) => (it.lingkup || "SIPIL").trim().toUpperCase() === "SIPIL")
      .forEach((it) => {
        const vol = volumeMap[it.id] !== undefined ? volumeMap[it.id] : Number(it.volume) || 0;
        const mat =
          priceMap[it.id]?.material !== undefined
            ? priceMap[it.id].material
            : Number(it.harga_material) || 0;
        const upah =
          priceMap[it.id]?.upah !== undefined
            ? priceMap[it.id].upah
            : Number(it.harga_upah) || 0;
        sum += vol * (mat + upah);
      });
    newItemRows
      .filter((it) => it.lingkup === "SIPIL")
      .forEach((it) => {
        sum += (Number(it.volume_akhir) || 0) * ((Number(it.harga_material) || 0) + (Number(it.harga_upah) || 0));
      });
    return sum;
  }, [originalItems, volumeMap, priceMap, newItemRows]);

  const totalMe = useMemo(() => {
    let sum = 0;
    originalItems
      .filter((it) => (it.lingkup || "SIPIL").trim().toUpperCase() === "ME")
      .forEach((it) => {
        const vol = volumeMap[it.id] !== undefined ? volumeMap[it.id] : Number(it.volume) || 0;
        const mat =
          priceMap[it.id]?.material !== undefined
            ? priceMap[it.id].material
            : Number(it.harga_material) || 0;
        const upah =
          priceMap[it.id]?.upah !== undefined
            ? priceMap[it.id].upah
            : Number(it.harga_upah) || 0;
        sum += vol * (mat + upah);
      });
    newItemRows
      .filter((it) => it.lingkup === "ME")
      .forEach((it) => {
        sum += (Number(it.volume_akhir) || 0) * ((Number(it.harga_material) || 0) + (Number(it.harga_upah) || 0));
      });
    return sum;
  }, [originalItems, volumeMap, priceMap, newItemRows]);

  return (
    <div className="space-y-5">
      {/* Tab Switcher Lingkup Sipil vs ME (Persis seperti pada Penawaran RAB/OE) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("SIPIL")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs",
              activeTab === "SIPIL"
                ? "bg-[#E65F2B] text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
            )}
          >
            <HardHat className="w-4 h-4" />
            <span>Item Pekerjaan Sipil</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                activeTab === "SIPIL" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              )}
            >
              {formatRupiah(totalSipil)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ME")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs",
              activeTab === "ME"
                ? "bg-[#E65F2B] text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
            )}
          >
            <Layers className="w-4 h-4" />
            <span>Item Pekerjaan ME</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                activeTab === "ME" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              )}
            >
              {formatRupiah(totalMe)}
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Menampilkan item <span className="font-bold text-slate-800">{activeTab}</span>
        </div>
      </div>

      {/* SEKSI 1: Penyesuaian Volume & Harga Item Eksisting (Berdasarkan Tab Aktif) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
              <span>1. Penyesuaian Volume &amp; Harga Item Eksisting ({activeTab})</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Rincian item pekerjaan RAB awal {activeTab}. Anda dapat menyesuaikan <span className="font-semibold text-slate-700">Volume</span>, <span className="font-semibold text-slate-700">Harga Material</span>, dan <span className="font-semibold text-slate-700">Harga Upah</span>. Jika ada perubahan, <span className="text-rose-600 font-bold">* Catatan wajib diisi</span> untuk menjelaskan alasan penyesuaian.
            </p>
          </div>
        </div>

        {Object.keys(groupedOriginalItems).length === 0 ? (
          <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 bg-slate-50/50">
            <p className="text-xs">Tidak ada item pekerjaan {activeTab} pada RAB awal proyek ini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedOriginalItems).map(([categoryName, items]) => {
              const catSubtotal = items.reduce((sum, it) => {
                const currentVol =
                  volumeMap[it.id] !== undefined ? volumeMap[it.id] : Number(it.volume) || 0;
                const mat =
                  priceMap[it.id]?.material !== undefined
                    ? priceMap[it.id].material
                    : Number(it.harga_material) || 0;
                const upah =
                  priceMap[it.id]?.upah !== undefined
                    ? priceMap[it.id].upah
                    : Number(it.harga_upah) || 0;
                return sum + currentVol * (mat + upah);
              }, 0);

              return (
                <div
                  key={categoryName}
                  className="border border-slate-200/90 rounded-xl overflow-hidden bg-white shadow-2xs"
                >
                  {/* Category Header */}
                  <div className="px-4 py-2.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#E65F2B]" />
                      <h5 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                        {categoryName}
                      </h5>
                      <span className="text-[11px] text-slate-400 font-medium">
                        ({items.length} item)
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="text-slate-400 font-normal">Subtotal Kategori:</span>
                      <span className="text-[#E65F2B] font-extrabold">{formatRupiah(catSubtotal)}</span>
                    </div>
                  </div>

                  {/* Category Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100/60 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200/70">
                        <tr>
                          <th className="py-2 px-2.5 w-8 text-center">No</th>
                          <th className="py-2 px-2.5 min-w-[160px]">Item Pekerjaan</th>
                          <th className="py-2 px-2.5 text-center w-24">Volume</th>
                          <th className="py-2 px-2.5 text-right w-28">Harga Material</th>
                          <th className="py-2 px-2.5 text-right w-28">Harga Upah</th>
                          <th className="py-2 px-2.5 text-right w-28">Harga Satuan</th>
                          <th className="py-2.5 px-2.5 text-right w-32">Total Biaya</th>
                          <th className="py-2 px-2.5 text-center min-w-[140px]">Status Perubahan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item, idx) => {
                          const volAwal = Number(item.volume) || 0;
                          const currentVal =
                            volumeMap[item.id] !== undefined ? volumeMap[item.id] : volAwal;
                          const isVolChanged = currentVal !== volAwal;

                          const hrgMatAwal = Number(item.harga_material) || 0;
                          const hrgUpahAwal = Number(item.harga_upah) || 0;

                          const currentMat =
                            priceMap[item.id]?.material !== undefined
                              ? priceMap[item.id].material
                              : hrgMatAwal;
                          const currentUpah =
                            priceMap[item.id]?.upah !== undefined
                              ? priceMap[item.id].upah
                              : hrgUpahAwal;

                          const isMatChanged = currentMat !== hrgMatAwal;
                          const isUpahChanged = currentUpah !== hrgUpahAwal;
                          const isPriceChanged = isMatChanged || isUpahChanged;
                          const isDifferentFromRab = isVolChanged || isPriceChanged;

                          // Cek apakah item ini pernah diajukan sebelumnya di klarifikasi
                          const wasInPreviousSubmission = Boolean(initialItemMap[item.id]);

                          // Saat REVISI: jika item pernah diajukan sebelumnya, maka MESKIPUN nilainya diubah jadi = RAB awal,
                          // item ini TETAP dianggap aktif dalam perbaikan revisi (harus ada catatan alasan pengembalian/perubahan)!
                          const isItemModified = isRevision
                            ? (wasInPreviousSubmission || isDifferentFromRab)
                            : isDifferentFromRab;

                          const currentSatuan = currentMat + currentUpah;
                          const totalBaru = currentVal * currentSatuan;
                          const totalAwal = volAwal * (hrgMatAwal + hrgUpahAwal);

                          const prevNote = previousNoteMap[item.id] || "";
                          const currentNewNote = isRevision
                            ? (revisionNoteMap[item.id] || "")
                            : (noteMap[item.id] || "");

                          const matchingKlarifikasi = (initialKlarifikasiItems || []).find((k: any) => k.original_renovasi_item_id === item.id);
                          const flaggedInfo = flaggedItemsMap
                            ? flaggedItemsMap[String(item.id)] ||
                              (matchingKlarifikasi ? flaggedItemsMap[String(matchingKlarifikasi.id)] : undefined)
                            : undefined;

                          return (
                            <React.Fragment key={item.id}>
                              <tr
                                className={cn(
                                  "hover:bg-slate-50/70 transition-colors",
                                  isItemModified && "bg-blue-50/30"
                                )}
                              >
                                <td className="py-2.5 px-2.5 text-center text-slate-400">{idx + 1}</td>
                                <td className="py-2.5 px-2.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-slate-800">{item.deskripsi}</span>
                                    {flaggedInfo && (
                                      <RevisionPinpointBadge
                                        catatan={flaggedInfo.catatan}
                                        isModified={flaggedInfo.isModified}
                                        label="Wajib Direvisi"
                                      />
                                    )}
                                  </div>
                                </td>

                                {/* Kolom Volume dengan Teks Volume Awal di bawahnya */}
                                <td className="py-2.5 px-2.5 text-center">
                                  <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-1 justify-center">
                                      <VolumeInput
                                        value={currentVal}
                                        onChange={(val) => handleVolumeChange(item.id, val)}
                                        className={cn(
                                          "h-8 w-20 text-xs",
                                          isVolChanged && "border-blue-400 ring-1 ring-blue-300/40 bg-blue-50/40 text-blue-900"
                                        )}
                                      />
                                      <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                        {item.satuan || "m2"}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1 whitespace-nowrap font-medium">
                                      Awal: {volAwal} {item.satuan || "m2"}
                                    </span>
                                  </div>
                                </td>

                                {/* Kolom Harga Material dengan Teks Harga Material Awal di bawahnya */}
                                <td className="py-2.5 px-2.5 text-right">
                                  <div className="flex flex-col items-end">
                                    <CurrencyInput
                                      value={currentMat}
                                      onChange={(val) => handlePriceChange(item.id, "material", val)}
                                      className={cn(
                                        "h-8 w-24 text-right text-xs font-mono rounded-lg border-slate-300 bg-white ml-auto",
                                        isMatChanged && "border-amber-400 ring-1 ring-amber-300/40 bg-amber-50/40 font-bold text-amber-900"
                                      )}
                                    />
                                    <span className="text-[10px] text-slate-400 mt-1 font-mono whitespace-nowrap">
                                      Awal: {formatRupiah(hrgMatAwal)}
                                    </span>
                                  </div>
                                </td>

                                {/* Kolom Harga Upah dengan Teks Harga Upah Awal di bawahnya */}
                                <td className="py-2.5 px-2.5 text-right">
                                  <div className="flex flex-col items-end">
                                    <CurrencyInput
                                      value={currentUpah}
                                      onChange={(val) => handlePriceChange(item.id, "upah", val)}
                                      className={cn(
                                        "h-8 w-24 text-right text-xs font-mono rounded-lg border-slate-300 bg-white ml-auto",
                                        isUpahChanged && "border-amber-400 ring-1 ring-amber-300/40 bg-amber-50/40 font-bold text-amber-900"
                                      )}
                                    />
                                    <span className="text-[10px] text-slate-400 mt-1 font-mono whitespace-nowrap">
                                      Awal: {formatRupiah(hrgUpahAwal)}
                                    </span>
                                  </div>
                                </td>

                                {/* Kolom Harga Satuan Total dengan Teks Harga Satuan Awal di bawahnya */}
                                <td className="py-2.5 px-2.5 text-right">
                                  <div className="flex flex-col items-end">
                                    <div className="font-bold text-slate-800 whitespace-nowrap font-mono text-[11px]">
                                      {formatRupiah(currentSatuan)}
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1 font-mono whitespace-nowrap">
                                      Awal: {formatRupiah(hrgMatAwal + hrgUpahAwal)}
                                    </span>
                                  </div>
                                </td>

                                {/* Kolom Total Biaya Baru dengan Teks Total Awal di bawahnya */}
                                <td className="py-2.5 px-2.5 text-right">
                                  <div className="flex flex-col items-end">
                                    <div className="font-bold text-[#E65F2B] whitespace-nowrap font-mono text-[11px]">
                                      {formatRupiah(totalBaru)}
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-1 font-mono whitespace-nowrap">
                                      Awal: {formatRupiah(totalAwal)}
                                    </span>
                                  </div>
                                </td>

                                {/* Kolom Status Perubahan (Otomatis) */}
                                <td className="py-2.5 px-2.5 text-center">
                                  {isItemModified ? (
                                    <div>
                                      {!isDifferentFromRab && isRevision && wasInPreviousSubmission ? (
                                        <span className="inline-block bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-300 whitespace-nowrap">
                                          Dikembalikan Sesuai RAB Awal
                                        </span>
                                      ) : isVolChanged && isPriceChanged ? (
                                        <span className="inline-block bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200 whitespace-nowrap">
                                          Volume &amp; Harga Berubah
                                        </span>
                                      ) : isVolChanged ? (
                                        <span className="inline-block bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200 whitespace-nowrap">
                                          Volume Berubah
                                        </span>
                                      ) : isMatChanged && isUpahChanged ? (
                                        <span className="inline-block bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 whitespace-nowrap">
                                          Harga Material &amp; Upah
                                        </span>
                                      ) : isMatChanged ? (
                                        <span className="inline-block bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 whitespace-nowrap">
                                          Harga Material
                                        </span>
                                      ) : (
                                        <span className="inline-block bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-200 whitespace-nowrap">
                                          Harga Upah
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-[11px] font-medium">Sesuai RAB awal</span>
                                  )}
                                </td>
                              </tr>

                              {/* Sub-row Khusus Catatan Alasan Perubahan (Satu-satunya Tempat Catatan, Full Width) */}
                              {isItemModified && (
                                <tr key={`${item.id}_subrow`} className="bg-amber-50/60 border-b border-amber-200/80">
                                  <td colSpan={8} className="py-2.5 px-4">
                                    <div className="flex flex-col gap-2">
                                      {/* Catatan Sebelumnya (Jika Revisi & Ada Catatan Sebelumnya) */}
                                      {isRevision && prevNote ? (
                                        <div className="flex items-start gap-2 bg-slate-100/90 border border-slate-200 rounded-lg p-2 text-xs">
                                          <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0 mt-0.5 flex items-center gap-1">
                                            <History className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Catatan Sebelumnya:</span>
                                          </span>
                                          <span className="text-slate-700 italic select-all">&quot;{prevNote}&quot;</span>
                                          <span className="ml-auto text-[9px] text-slate-400 font-medium shrink-0 bg-slate-200/70 px-1.5 py-0.5 rounded">
                                            Read-Only
                                          </span>
                                        </div>
                                      ) : null}

                                      {/* Input Catatan Baru */}
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className="w-2 h-2 rounded-full bg-[#E65F2B] animate-pulse inline-block" />
                                          <span className="text-xs font-bold text-slate-800">
                                            {isRevision
                                              ? `Catatan Perbaikan Revisi (${item.deskripsi}):`
                                              : `Catatan Alasan Perubahan (${item.deskripsi}):`}
                                          </span>
                                          <span className="text-slate-400 text-[11px] font-normal">(Opsional)</span>
                                        </div>
                                        <div className="flex-1">
                                          <Input
                                            type="text"
                                            placeholder={
                                              !isDifferentFromRab && isRevision && wasInPreviousSubmission
                                                ? `Jelaskan alasan pengembalian ${item.deskripsi} sesuai kondisi RAB awal (opsional)...`
                                                : isRevision
                                                ? `Tuliskan catatan perbaikan revisi jika ada (opsional)...`
                                                : `Masukkan alasan penyesuaian jika ada (opsional)...`
                                            }
                                            value={currentNewNote}
                                            onChange={(e) =>
                                              isRevision
                                                ? handleRevisionNoteChange(item.id, e.target.value)
                                                : handleNoteChange(item.id, e.target.value)
                                            }
                                            className="h-8 text-xs bg-white rounded-lg border-slate-300 w-full focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SEKSI 2: Penambahan Item Baru (Sipil / ME Berdasarkan Tab Aktif) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div>
            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
              <span>2. Penambahan Item Pekerjaan Baru ({activeTab})</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih dari Master Harga atau ketik custom item baru yang disepakati saat rapat aanwijzing lapangan, lengkap dengan breakdown Harga Material &amp; Upah per cabang.
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleAddNewRow}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-8 px-3 text-xs inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Item {activeTab}</span>
          </Button>
        </div>

        {filteredNewRows.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 bg-slate-50/50">
            <p className="text-xs">Belum ada item baru {activeTab} yang ditambahkan.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Klik tombol &quot;Tambah Item {activeTab}&quot; untuk memilih dari Master Harga atau menginput item pekerjaan baru.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNewRows.map((row, idx) => {
              const categoryOptions = getMasterItemOptions(row.kategori_pekerjaan, row.lingkup);
              const vol = Number(row.volume_akhir) || 0;
              const mat = Number(row.harga_material) || 0;
              const upah = Number(row.harga_upah) || 0;
              const hrgSatuan = mat + upah;
              const totalItem = vol * hrgSatuan;

              const newRowFlaggedInfo = flaggedItemsMap
                ? (row.id ? flaggedItemsMap[String(row.id)] : undefined) || flaggedItemsMap[row.tempId]
                : undefined;

              return (
                <div
                  key={row.tempId}
                  className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 space-y-3.5 transition-all hover:border-slate-300 shadow-2xs"
                >
                  {/* Baris 1: Nomor, ComboBox Kategori, Selector Master Item / Custom, Subtotal, Hapus */}
                  <div className="flex items-center gap-2.5 w-full flex-wrap sm:flex-nowrap">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      {newRowFlaggedInfo && (
                        <RevisionPinpointBadge
                          catatan={newRowFlaggedInfo.catatan}
                          isModified={newRowFlaggedInfo.isModified}
                          label="Wajib Direvisi"
                        />
                      )}
                    </div>

                    {/* Kategori ComboBox (SearchableSelectInput) */}
                    <div className="w-full sm:w-64 shrink-0">
                      <SearchableSelectInput
                        value={row.kategori_pekerjaan}
                        onChange={(val) =>
                          handleUpdateNewRow(row.tempId, "kategori_pekerjaan", val)
                        }
                        options={categoriesForActiveTab.map((cat) => ({
                          value: cat,
                          label: cat,
                        }))}
                        placeholder="Pilih Kategori..."
                        controlHeight={36}
                        fontSize="0.75rem"
                        menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                      />
                    </div>

                    {/* RabItemSelector Reusable persis seperti Penawaran RAB/OE */}
                    <div className="flex-1 min-w-[200px]">
                      <RabItemSelector
                        masterItemId={row.master_item_id || null}
                        deskripsi={row.deskripsi}
                        isCustom={row.is_custom || false}
                        options={categoryOptions}
                        disabled={!row.kategori_pekerjaan || !row.kategori_pekerjaan.trim()}
                        onSelectMasterItem={(val, opt) =>
                          handleSelectMasterItem(row.tempId, val, opt)
                        }
                        onSetCustomItem={(customText) =>
                          handleSetCustomRabItem(row.tempId, customText)
                        }
                        placeholder={
                          row.kategori_pekerjaan && row.kategori_pekerjaan.trim()
                            ? `Pilih master item ${row.kategori_pekerjaan} atau ketik custom...`
                            : "Pilih kategori pekerjaan terlebih dahulu..."
                        }
                      />
                    </div>

                    {/* Subtotal Item */}
                    <div className="text-right shrink-0 min-w-[130px]">
                      <span className="text-[10px] text-slate-400 font-medium block">Total Biaya</span>
                      <span className="font-extrabold text-[#E65F2B] text-xs sm:text-sm whitespace-nowrap">
                        {formatRupiah(totalItem)}
                      </span>
                    </div>

                    {/* Tombol Hapus */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveNewRow(row.tempId)}
                      className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Baris 2: Harga Material, Harga Upah, Harga Satuan Kalkulasi, Volume, Satuan, Status */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-2.5 border-t border-slate-200/80 text-xs">
                    {/* Harga Material */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Harga Material (Rp)
                      </label>
                      <CurrencyInput
                        value={row.harga_material || 0}
                        onChange={(val) => handleUpdateNewRow(row.tempId, "harga_material", val)}
                        className="h-8 text-xs bg-white rounded-lg"
                      />
                    </div>

                    {/* Harga Upah */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Harga Upah (Rp)
                      </label>
                      <CurrencyInput
                        value={row.harga_upah || 0}
                        onChange={(val) => handleUpdateNewRow(row.tempId, "harga_upah", val)}
                        className="h-8 text-xs bg-white rounded-lg"
                      />
                    </div>

                    {/* Harga Satuan Total */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Harga Satuan (Total)
                      </label>
                      <div className="h-8 px-2 flex items-center bg-slate-100 rounded-lg border border-slate-200 text-slate-700 font-mono text-[11px] font-bold truncate">
                        {formatRupiah(hrgSatuan)}
                      </div>
                    </div>

                    {/* Volume */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Volume Baru
                      </label>
                      <VolumeInput
                        value={row.volume_akhir}
                        onChange={(val) =>
                          handleUpdateNewRow(
                            row.tempId,
                            "volume_akhir",
                            val
                          )
                        }
                        className="h-8 bg-white"
                      />
                    </div>

                    {/* Satuan */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Satuan
                      </label>
                      <SatuanCombobox
                        value={row.satuan}
                        onChange={(val) => handleUpdateNewRow(row.tempId, "satuan", val)}
                        className="h-8 bg-white"
                        placeholder="Pilih / ketik satuan..."
                      />
                    </div>

                    {/* Status Otomatis Sistem */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Status
                      </label>
                      <div className="h-8 px-2 flex items-center justify-center bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 text-[10px] font-bold whitespace-nowrap text-center">
                        Item Baru Ditambahkan
                      </div>
                    </div>
                  </div>

                  {/* Baris 3: Kolom Catatan User (Wajib Diisi Saat Tambah Item Baru) */}
                  <div className="pt-2 border-t border-slate-200/60 space-y-2">
                    {/* Catatan Sebelumnya (Jika Revisi & Ada Catatan Sebelumnya) */}
                    {isRevision && row.catatan_sebelumnya ? (
                      <div className="flex items-start gap-2 bg-slate-100/90 border border-slate-200 rounded-lg p-2 text-xs">
                        <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0 mt-0.5 flex items-center gap-1">
                          <History className="w-3.5 h-3.5 text-slate-400" />
                          <span>Catatan Sebelumnya:</span>
                        </span>
                        <span className="text-slate-700 italic select-all">&quot;{row.catatan_sebelumnya}&quot;</span>
                        <span className="ml-auto text-[9px] text-slate-400 font-medium shrink-0 bg-slate-200/70 px-1.5 py-0.5 rounded">
                          Read-Only
                        </span>
                      </div>
                    ) : null}

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span>
                            {isRevision && row.catatan_sebelumnya
                              ? "Catatan Perbaikan Revisi Baru"
                              : "Catatan Alasan Penambahan Item Baru"}
                          </span>
                        </span>
                        <span className="text-slate-400 text-[10px] font-normal">(Opsional)</span>
                      </label>
                      <Input
                        type="text"
                        placeholder={
                          isRevision && row.catatan_sebelumnya
                            ? "Tuliskan catatan perbaikan revisi untuk item baru ini jika ada (opsional)..."
                            : "Tuliskan catatan penjelasan alasan penambahan item baru ini di lapangan (opsional)..."
                        }
                        value={
                          isRevision && row.catatan_sebelumnya
                            ? row.catatan_baru || ""
                            : row.catatan || ""
                        }
                        onChange={(e) => {
                          if (isRevision && row.catatan_sebelumnya) {
                            handleUpdateNewRow(row.tempId, "catatan_baru", e.target.value);
                          } else {
                            handleUpdateNewRow(row.tempId, "catatan", e.target.value);
                          }
                        }}
                        className="h-8 text-xs bg-white rounded-lg border-slate-300"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Feedback Modal Peringatan Kemiripan Item (>70%) */}
      {similarityWarning && (
        <FeedbackModal
          open={similarityWarning.open}
          type="warning"
          title={`Kemiripan Item Terdeteksi (${similarityWarning.similarity}%)`}
          message={`Item baru "${similarityWarning.newItemName}" memiliki tingkat kemiripan ${similarityWarning.similarity}% dengan item eksisting "${similarityWarning.existingItemName}" pada kategori "${similarityWarning.kategori}".\n\nSesuai SOP, disarankan untuk menyesuaikan volume atau harga pada item eksisting di Seksi 1 daripada membuat item baru.`}
          actionText="Tetap Tambahkan"
          cancelText="Sesuaikan Item Eksisting"
          onConfirm={similarityWarning.onProceed}
          onClose={similarityWarning.onCancel}
        />
      )}
    </div>
  );
}
