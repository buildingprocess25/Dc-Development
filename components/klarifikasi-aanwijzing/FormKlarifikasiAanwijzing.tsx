"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Building2,
  Calendar,
  MapPin,
  Users,
  AlertCircle,
  Save,
  Send,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormItemKlarifikasiTable, KlarifikasiItemPayload } from "./FormItemKlarifikasiTable";
import { FormDurasiKlarifikasiCard } from "./FormDurasiKlarifikasiCard";
import { FormTanggalTenderCard } from "./FormTanggalTenderCard";
import { FormGambarTeknisKlarifikasiCard, KlarifikasiDokumenItem } from "./FormGambarTeknisKlarifikasiCard";
import { FormFotoLingkunganKlarifikasiCard } from "./FormFotoLingkunganKlarifikasiCard";
import { DetailKlarifikasiModal } from "./DetailKlarifikasiModal";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { SearchableSelectInput } from "@/components/ui/searchable-select";
import { useSession } from "@/context/SessionContext";
import { RevisionInstructionBanner } from "@/components/approval/RevisionInstructionBanner";
import { RevisionPinpointBadge } from "@/components/approval/RevisionPinpointBadge";
import { cn } from "@/lib/utils";

interface FormKlarifikasiAanwijzingProps {
  mode: "tambah" | "edit";
  initialData?: any;
}

export function FormKlarifikasiAanwijzing({
  mode,
  initialData,
}: FormKlarifikasiAanwijzingProps) {
  const router = useRouter();
  const { user } = useSession();

  // Mode Tambah: State daftar aanwijzing yang siap diklarifikasi
  const [readyList, setReadyList] = useState<any[]>([]);
  const [selectedAanwijzingId, setSelectedAanwijzingId] = useState<number | null>(
    initialData?.aanwijzing_id || null
  );
  const [loadingReady, setLoadingReady] = useState(mode === "tambah");

  // Selected Aanwijzing Object
  const [selectedAanwijzing, setSelectedAanwijzing] = useState<any | null>(
    initialData?.aanwijzing || null
  );

  // Form Fields: Items
  const [itemsPayload, setItemsPayload] = useState<KlarifikasiItemPayload[]>(
    () => initialData?.items || []
  );
  const [catatanMaker, setCatatanMaker] = useState(initialData?.catatan_maker || "");

  // Form Fields: Durasi Pekerjaan (Awal vs Klarifikasi)
  const [durasiHariAwal, setDurasiHariAwal] = useState<number>(() => {
    return initialData?.durasi_hari_awal ?? initialData?.renovasi?.durasi_hari ?? 0;
  });
  const [durasiHariAkhir, setDurasiHariAkhir] = useState<number>(() => {
    return (
      initialData?.durasi_hari_akhir ??
      initialData?.durasi_hari_awal ??
      initialData?.renovasi?.durasi_hari ??
      0
    );
  });
  const [catatanDurasi, setCatatanDurasi] = useState<string>(() => {
    return initialData?.catatan_durasi || "";
  });

  // Form Field: Tanggal Pelaksanaan Tender Rekanan
  const [tanggalTender, setTanggalTender] = useState<string>(() => {
    if (initialData?.tanggal_tender) {
      try {
        const d = new Date(initialData.tanggal_tender);
        return d.toISOString().split("T")[0];
      } catch {
        return "2026-11-03";
      }
    }
    return "2026-11-03";
  });

  // Form Fields: Dokumen Teknis (Sipil & ME, PDF & DWG) & Foto Lingkungan
  const [dokumenKlarifikasi, setDokumenKlarifikasi] = useState<KlarifikasiDokumenItem[]>(() => {
    if (initialData?.dokumen && Array.isArray(initialData.dokumen) && initialData.dokumen.length > 0) {
      return initialData.dokumen;
    }
    const rabDocs = initialData?.renovasi?.dokumen || [];
    return rabDocs.map((d: any) => ({
      kategori_file: d.kategori_file,
      nama_file: d.nama_file,
      nama_label: d.nama_label || d.nama_file,
      file_url: d.file_url,
      drive_file_id: d.drive_file_id,
      mime_type: d.mime_type,
      latitude: d.latitude,
      longitude: d.longitude,
      lokasi_wilayah: d.lokasi_wilayah,
      timestamp_watermark: d.timestamp_watermark,
      sumber: "DARI_RAB",
    }));
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleItemsChange = useCallback((items: KlarifikasiItemPayload[]) => {
    setItemsPayload(items);
  }, []);

  // Feedback Modal
  const [feedback, setFeedback] = useState<{
    open: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  // Fetch ready aanwijzings saat mode tambah
  const fetchReady = useCallback(async () => {
    if (mode !== "tambah") return;
    setLoadingReady(true);
    try {
      const res = await fetch("/api/dc-development/klarifikasi-aanwijzing/ready-aanwijzings");
      const json = await res.json();
      if (json.status === "success") {
        setReadyList(json.data || []);
      }
    } catch (err) {
      console.error("Gagal memuat proyek aanwijzing siap klarifikasi:", err);
    } finally {
      setLoadingReady(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchReady();
  }, [fetchReady]);

  // Saat user memilih aanwijzing dari dropdown / ComboBox
  const handleSelectAanwijzing = (idStr: string) => {
    const id = parseInt(idStr, 10);
    setSelectedAanwijzingId(isNaN(id) ? null : id);
    const found = readyList.find((a) => a.id === id);
    setSelectedAanwijzing(found || null);
    setItemsPayload([]);

    if (found) {
      const durasi = found.renovasi?.durasi_hari || 0;
      setDurasiHariAwal(durasi);
      setDurasiHariAkhir(durasi);
      setCatatanDurasi("");

      // Inisialisasi seluruh item dari renovasi dengan status awal "Sama dengan RAB/OE"
      const rabItems = found.renovasi?.item_rab || [];
      setItemsPayload(
        rabItems.map((orig: any) => {
          const vol = Number(orig.volume) || 0;
          const mat = Number(orig.harga_material) || 0;
          const upah = Number(orig.harga_upah) || 0;
          return {
            tipe_perubahan: "SAMA_DENGAN_RAB" as const,
            original_renovasi_item_id: orig.id,
            lingkup: orig.lingkup || "SIPIL",
            kategori_pekerjaan: orig.kategori_pekerjaan || "Pekerjaan",
            deskripsi: orig.deskripsi,
            satuan: orig.satuan || "m2",
            volume_awal: vol,
            volume_akhir: vol,
            harga_material: mat,
            harga_upah: upah,
            total_biaya_awal: vol * (mat + upah),
            total_biaya_akhir: vol * (mat + upah),
            status_perubahan: "Sama dengan RAB/OE",
            catatan: "",
            keterangan: "Sama dengan RAB/OE",
          };
        })
      );

      const rabDocs = found.renovasi?.dokumen || [];
      setDokumenKlarifikasi(
        rabDocs.map((d: any) => ({
          kategori_file: d.kategori_file,
          nama_file: d.nama_file,
          nama_label: d.nama_label || d.nama_file,
          file_url: d.file_url,
          drive_file_id: d.drive_file_id,
          mime_type: d.mime_type,
          latitude: d.latitude,
          longitude: d.longitude,
          lokasi_wilayah: d.lokasi_wilayah,
          timestamp_watermark: d.timestamp_watermark,
          sumber: "DARI_RAB",
        }))
      );
    } else {
      setItemsPayload([]);
      setDokumenKlarifikasi([]);
    }
  };

  // Original items dari renovasi.item_rab
  const originalItems = useMemo(() => {
    if (mode === "edit" && initialData?.renovasi?.item_rab) {
      return initialData.renovasi.item_rab;
    }
    return selectedAanwijzing?.renovasi?.item_rab || [];
  }, [mode, initialData, selectedAanwijzing]);

  // Cari catatan revisi terakhir jika status revisi (atau jika berkas draft sedang diperbaiki dari revisi)
  const latestRevisionNote = useMemo(() => {
    const logs = initialData?.audit_logs || [];
    const rev = [...logs].reverse().find((l: any) => l.to_status === "REVISI" || l.action === "REVISI");
    if (!rev) return null;
    if (initialData?.status === "REVISI" || (initialData?.status === "DRAFT" && rev)) {
      return rev?.notes || null;
    }
    return null;
  }, [initialData]);

  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Hitung jumlah item baru, item ubah vol, dan item tetap (sama dgn RAB)
  const totalItemBaru = itemsPayload.filter((it) => it.tipe_perubahan === "ITEM_BARU").length;
  const totalItemUbahVol = itemsPayload.filter((it) => it.tipe_perubahan === "UBAH_VOLUME").length;
  const totalItemTetap = itemsPayload.filter((it) => it.tipe_perubahan === "SAMA_DENGAN_RAB").length;

  // Objek sintesis data Berita Acara untuk Review Modal
  const reviewKlarifikasiData = useMemo(() => {
    if (!selectedAanwijzing && !initialData) return null;
    return {
      id: initialData?.id || 0,
      nomor_klarifikasi: initialData?.nomor_klarifikasi || "(DRAFT)",
      status: initialData?.status || "DRAFT",
      cabang: selectedAanwijzing?.cabang || initialData?.cabang || "",
      created_by: user?.email || "Saya (Branch Building Koordinator)",
      created_at: initialData?.created_at || new Date().toISOString(),
      project: selectedAanwijzing?.project || initialData?.project,
      aanwijzing: selectedAanwijzing || initialData?.aanwijzing,
      renovasi: selectedAanwijzing?.renovasi || initialData?.renovasi,
      items: itemsPayload,
      durasi_hari_awal: durasiHariAwal,
      durasi_hari_akhir: durasiHariAkhir,
      status_durasi: durasiHariAkhir !== durasiHariAwal ? "BERUBAH" : "TETAP",
      catatan_durasi: catatanDurasi,
      dokumen: dokumenKlarifikasi,
      catatan_maker: catatanMaker,
      audit_logs: initialData?.audit_logs || [],
    };
  }, [
    selectedAanwijzing,
    initialData,
    user,
    itemsPayload,
    durasiHariAwal,
    durasiHariAkhir,
    catatanDurasi,
    dokumenKlarifikasi,
    catatanMaker,
  ]);

  const isRevision = initialData?.status === "REVISI";

  // Granular detail revisi dari approver
  const detailRevisiList = useMemo(() => {
    const raw = initialData?.detail_revisi;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [initialData?.detail_revisi]);

  // Evaluasi status perubahan pada setiap item yang ditandai approver
  const flaggedItemsWithStatus = useMemo(() => {
    return detailRevisiList.map((revItem: any) => {
      let isModified = false;
      if (revItem.category === "ITEM_KLARIFIKASI") {
        const currentItem = itemsPayload.find(
          (it: any) =>
            String(it.id) === String(revItem.fieldOrId) ||
            String(it.original_renovasi_item_id) === String(revItem.fieldOrId)
        );
        if (!currentItem) {
          // Item dihapus
          isModified = true;
        } else {
          const init = revItem.initialValue || {};
          const volChanged = Number(currentItem.volume_akhir) !== Number(init.volume_akhir);
          const matChanged = Number(currentItem.harga_material) !== Number(init.harga_material);
          const upahChanged = Number(currentItem.harga_upah) !== Number(init.harga_upah);
          const descChanged = (currentItem.deskripsi || "").trim() !== (init.deskripsi || "").trim();
          const satChanged = (currentItem.satuan || "").trim() !== (init.satuan || "").trim();
          isModified = volChanged || matChanged || upahChanged || descChanged || satChanged;
        }
      } else if (revItem.category === "CATATAN_MAKER") {
        isModified = (catatanMaker || "").trim() !== (revItem.initialValue || "").trim();
      } else if (revItem.category === "DURASI_PEKERJAAN") {
        const initDurasi = revItem.initialValue?.durasi_hari_akhir ?? initialData?.durasi_hari_akhir ?? durasiHariAwal;
        const initCatatan = revItem.initialValue?.catatan_durasi ?? initialData?.catatan_durasi ?? "";
        isModified =
          Number(durasiHariAkhir) !== Number(initDurasi) ||
          (catatanDurasi || "").trim() !== (initCatatan || "").trim();
      } else if (revItem.category === "GAMBAR_TEKNIS") {
        const oldDrawings = (initialData?.dokumen || []).filter((d: any) => d.kategori_file?.startsWith("GAMBAR_"));
        const currentDrawings = dokumenKlarifikasi.filter((d) => d.kategori_file?.startsWith("GAMBAR_"));
        const oldUrls = oldDrawings.map((d: any) => `${d.kategori_file}:${d.file_url}`).sort().join("|");
        const currentUrls = currentDrawings.map((d) => `${d.kategori_file}:${d.file_url}`).sort().join("|");
        isModified = oldUrls !== currentUrls;
      } else if (revItem.category === "FOTO_LINGKUNGAN") {
        const oldPhotos = (initialData?.dokumen || []).filter((d: any) => d.kategori_file === "FOTO_LINGKUNGAN");
        const currentPhotos = dokumenKlarifikasi.filter((d) => d.kategori_file === "FOTO_LINGKUNGAN");
        const oldUrls = oldPhotos.map((d: any) => d.file_url).sort().join("|");
        const currentUrls = currentPhotos.map((d) => d.file_url).sort().join("|");
        isModified = oldPhotos.length !== currentPhotos.length || oldUrls !== currentUrls;
      }
      return {
        item: revItem,
        isModified,
      };
    });
  }, [
    detailRevisiList,
    itemsPayload,
    catatanMaker,
    durasiHariAkhir,
    durasiHariAwal,
    catatanDurasi,
    dokumenKlarifikasi,
    initialData,
  ]);

  const totalFlaggedCount = flaggedItemsWithStatus.length;
  const modifiedFlaggedCount = flaggedItemsWithStatus.filter((f) => f.isModified).length;
  const allFlaggedModified = totalFlaggedCount > 0 ? modifiedFlaggedCount === totalFlaggedCount : true;

  // Cek jika approver tidak menandai Item spesifik, apakah maker telah mengubah minimal 1 field
  const isAnyFieldModified = useMemo(() => {
    if (mode !== "edit" || !initialData) return true;
    const oldItems = initialData.items || [];
    if (oldItems.length !== itemsPayload.length) return true;

    const oldStr = JSON.stringify(
      oldItems.map((it: any) => ({
        deskripsi: it.deskripsi,
        volume_akhir: Number(it.volume_akhir) || 0,
        harga_material: Number(it.harga_material) || 0,
        harga_upah: Number(it.harga_upah) || 0,
        satuan: it.satuan,
      }))
    );
    const newStr = JSON.stringify(
      itemsPayload.map((it: any) => ({
        deskripsi: it.deskripsi,
        volume_akhir: Number(it.volume_akhir) || 0,
        harga_material: Number(it.harga_material) || 0,
        harga_upah: Number(it.harga_upah) || 0,
        satuan: it.satuan,
      }))
    );
    const catatanChanged = (catatanMaker || "").trim() !== (initialData.catatan_maker || "").trim();
    const durasiChanged =
      Number(durasiHariAkhir) !== Number(initialData.durasi_hari_akhir ?? initialData.durasi_hari_awal ?? 0) ||
      (catatanDurasi || "").trim() !== (initialData.catatan_durasi || "").trim();

    const oldDocs = (initialData.dokumen || []).map((d: any) => `${d.kategori_file}:${d.file_url}`).sort().join("|");
    const currentDocs = dokumenKlarifikasi.map((d) => `${d.kategori_file}:${d.file_url}`).sort().join("|");
    const dokumenChanged = oldDocs !== currentDocs;
    const oldTanggal = initialData.tanggal_tender
      ? new Date(initialData.tanggal_tender).toISOString().split("T")[0]
      : "";
    const tanggalTenderChanged = oldTanggal !== tanggalTender;

    return oldStr !== newStr || catatanChanged || durasiChanged || dokumenChanged || tanggalTenderChanged;
  }, [mode, initialData, itemsPayload, catatanMaker, durasiHariAkhir, catatanDurasi, dokumenKlarifikasi, tanggalTender]);

  const canSubmitRevision = isRevision
    ? totalFlaggedCount > 0
      ? allFlaggedModified
      : isAnyFieldModified
    : true;

  // Map flagged items untuk penanda pinpoint badge pada tabel item
  const flaggedItemsMap = useMemo(() => {
    const map: Record<string, { isFlagged: boolean; catatan: string; isModified: boolean }> = {};
    for (const f of flaggedItemsWithStatus) {
      if (f.item.category === "ITEM_KLARIFIKASI") {
        map[String(f.item.fieldOrId)] = {
          isFlagged: true,
          catatan: f.item.catatan,
          isModified: f.isModified,
        };
      }
    }
    return map;
  }, [flaggedItemsWithStatus]);

  const catatanMakerFlag = useMemo(() => {
    return flaggedItemsWithStatus.find((f) => f.item.category === "CATATAN_MAKER");
  }, [flaggedItemsWithStatus]);

  const durasiFlag = useMemo(() => {
    return flaggedItemsWithStatus.find((f) => f.item.category === "DURASI_PEKERJAAN");
  }, [flaggedItemsWithStatus]);

  const gambarFlag = useMemo(() => {
    return flaggedItemsWithStatus.find((f) => f.item.category === "GAMBAR_TEKNIS");
  }, [flaggedItemsWithStatus]);

  const fotoFlag = useMemo(() => {
    return flaggedItemsWithStatus.find((f) => f.item.category === "FOTO_LINGKUNGAN");
  }, [flaggedItemsWithStatus]);

  // Rab Dokumen & Foto List untuk baseline comparison
  const rabDokumenList = useMemo(() => {
    return selectedAanwijzing?.renovasi?.dokumen || initialData?.renovasi?.dokumen || [];
  }, [selectedAanwijzing, initialData]);

  const rabFotoList = useMemo(() => {
    return rabDokumenList.filter((d: any) => d.kategori_file === "FOTO_LINGKUNGAN");
  }, [rabDokumenList]);

  // Project Info untuk Folder Google Drive
  const projectInfo = useMemo(() => {
    const proj = selectedAanwijzing?.project || initialData?.project;
    return {
      cabang: selectedAanwijzing?.cabang || initialData?.cabang || "",
      kode: proj?.kode || "",
      nama_proyek: proj?.nama_proyek || "",
      inisial: proj?.inisial || null,
      nomor_undangan: selectedAanwijzing?.nomor_undangan || initialData?.aanwijzing?.nomor_undangan || "",
    };
  }, [selectedAanwijzing, initialData]);

  // Fungsi validasi form
  const validateForm = () => {
    if (!selectedAanwijzingId) {
      setFeedback({
        open: true,
        type: "error",
        title: "Proyek Belum Dipilih",
        message: "Silakan pilih salah satu proyek aanwijzing yang akan dibuatkan berita acara klarifikasi.",
      });
      return false;
    }

    // 1. Validasi Kategori Pekerjaan Item Baru (Wajib Dipilih)
    const missingCategory = itemsPayload.find(
      (it) => it.tipe_perubahan === "ITEM_BARU" && (!it.kategori_pekerjaan || !it.kategori_pekerjaan.trim())
    );
    if (missingCategory) {
      setFeedback({
        open: true,
        type: "error",
        title: "Kategori Pekerjaan Wajib Dipilih",
        message: `Harap pilih Kategori Pekerjaan untuk penambahan item baru "${missingCategory.deskripsi || "Item Baru"}".`,
      });
      return false;
    }

    // 2. Validasi Deskripsi Item Baru (Wajib Diisi atau Dipilih dari Master)
    const missingDeskripsi = itemsPayload.find(
      (it) => it.tipe_perubahan === "ITEM_BARU" && (!it.deskripsi || !it.deskripsi.trim())
    );
    if (missingDeskripsi) {
      setFeedback({
        open: true,
        type: "error",
        title: "Item Pekerjaan Wajib Diisi",
        message: `Harap pilih item dari Master Harga atau ketik nama item pekerjaan baru pada kategori "${missingDeskripsi.kategori_pekerjaan}".`,
      });
      return false;
    }

    // 3. Validasi Satuan Item Baru (Wajib Diisi atau Dipilih)
    const missingSatuan = itemsPayload.find(
      (it) => it.tipe_perubahan === "ITEM_BARU" && (!it.satuan || !it.satuan.trim())
    );
    if (missingSatuan) {
      setFeedback({
        open: true,
        type: "error",
        title: "Satuan Pekerjaan Wajib Diisi",
        message: `Harap pilih atau ketik Satuan (misal: m2, ls, unit) untuk item baru "${missingSatuan.deskripsi || "Item Baru"}".`,
      });
      return false;
    }

    // 4. Validasi Perubahan Durasi Pekerjaan (Wajib Catatan jika berubah)
    if (durasiHariAkhir !== durasiHariAwal && !catatanDurasi.trim()) {
      setFeedback({
        open: true,
        type: "error",
        title: "Catatan Perubahan Durasi Wajib Diisi",
        message: `Durasi pekerjaan disesuaikan dari ${durasiHariAwal} hari menjadi ${durasiHariAkhir} hari. Harap berikan catatan alasan penyesuaian durasi.`,
      });
      return false;
    }

    // 5. Validasi Catatan Gambar Teknis (Wajib Catatan jika mengunggah gambar revisi baru)
    const revisedDrawingsWithoutNote = dokumenKlarifikasi.filter(
      (d) =>
        (d.kategori_file || "").startsWith("GAMBAR_") &&
        (d.sumber === "REVISI" || d.sumber === "BARU") &&
        (!d.catatan || !d.catatan.trim())
    );
    if (revisedDrawingsWithoutNote.length > 0) {
      setFeedback({
        open: true,
        type: "error",
        title: "Catatan Gambar Teknis Wajib Diisi",
        message: `Anda mengunggah berkas revisi baru untuk gambar kerja teknis (${revisedDrawingsWithoutNote.map((d) => d.nama_file).join(", ")}). Harap isi catatan alasan perubahan gambar sebelum mengajukan.`,
      });
      return false;
    }

    // 6. Validasi SOP Revisi
    if (isRevision) {
      if (totalFlaggedCount > 0 && !allFlaggedModified) {
        const remaining = totalFlaggedCount - modifiedFlaggedCount;
        setFeedback({
          open: true,
          type: "error",
          title: "Item Revisi Belum Lengkap",
          message: `Peninjau menandai ${totalFlaggedCount} Item pekerjaan yang wajib diperbaiki. Masih terdapat ${remaining} item yang belum disesuaikan. Harap perbaiki seluruh item yang ditandai sebelum mengajukan ulang.`,
        });
        return false;
      }

      if (totalFlaggedCount === 0 && !isAnyFieldModified) {
        setFeedback({
          open: true,
          type: "error",
          title: "Belum Ada Perubahan Data",
          message:
            "Sesuai aturan SOP SPARTA, Anda wajib mengubah atau memperbaiki minimal satu data pekerjaan sebelum dapat mengajukan ulang berkas revisi.",
        });
        return false;
      }
    }

    // 7. Validasi berkas foto yang sedang dalam proses upload ke Google Drive
    const isStillUploading = dokumenKlarifikasi.some((d) => d.uploading === true);
    if (isStillUploading) {
      setFeedback({
        open: true,
        type: "error",
        title: "Proses Unggah Belum Selesai",
        message:
          "Masih terdapat foto yang sedang dalam proses sinkronisasi ke Google Drive. Harap tunggu beberapa detik hingga seluruh berkas selesai diunggah.",
      });
      return false;
    }

    return true;
  };

  // Handler untuk membuka Review Modal sebelum pengajuan resmi
  const handleOpenReview = () => {
    if (validateForm()) {
      setIsReviewOpen(true);
    }
  };

  // Submit Handler Aktual ke Backend
  const executeSubmit = async (isDraft: boolean) => {
    if (!isDraft && !validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const url =
        mode === "tambah"
          ? "/api/dc-development/klarifikasi-aanwijzing"
          : `/api/dc-development/klarifikasi-aanwijzing/${initialData.id}`;

      const method = mode === "tambah" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aanwijzing_id: selectedAanwijzingId,
          catatan_maker: catatanMaker,
          items: itemsPayload,
          durasi_hari_awal: durasiHariAwal,
          durasi_hari_akhir: durasiHariAkhir,
          status_durasi: durasiHariAkhir !== durasiHariAwal ? "BERUBAH" : "TETAP",
          catatan_durasi: catatanDurasi,
          tanggal_tender: tanggalTender,
          dokumen: dokumenKlarifikasi,
          is_draft: isDraft,
        }),
      });

      const json = await res.json();

      if (json.status === "success") {
        setIsReviewOpen(false);
        setFeedback({
          open: true,
          type: "success",
          title: "Berhasil Disimpan",
          message: json.message || "Berita Acara Klarifikasi berhasil disimpan.",
        });
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Menyimpan",
          message: json.message || "Terjadi kesalahan saat menyimpan formulir.",
        });
      }
    } catch (err: any) {
      setFeedback({
        open: true,
        type: "error",
        title: "Kesalahan Sistem",
        message: err.message || "Gagal menghubungi server.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full h-full overflow-hidden">
      {/* SCROLLABLE FORM BODY */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-3">
            <Link href="/dc-development/klarifikasi-aanwijzing">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 rounded-xl hover:bg-slate-100 text-slate-600"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <span className="text-[10px] font-bold text-[#E65F2B] uppercase tracking-wider bg-orange-50 px-2 py-0.5 rounded border border-orange-200/70 inline-block mb-1">
                SOP SAT/SOP/DCB/003
              </span>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#E65F2B]" />
                <span>
                  {mode === "tambah"
                    ? "Penyusunan Berita Acara Klarifikasi Aanwijzing"
                    : `Perbaikan Berita Acara — ${initialData?.nomor_klarifikasi}`}
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Banner Instruksi Revisi (Jika Berstatus REVISI atau Ada Catatan Revisi) */}
        {isRevision && (
          <RevisionInstructionBanner
            nomorPengajuan={initialData?.nomor_klarifikasi || "Klarifikasi Aanwijzing"}
            statusLabel="STATUS: REVISI"
            instructionNotes={
              latestRevisionNote
                ? [
                  {
                    id: "1",
                    author: "Peninjau / Approver",
                    date: initialData?.updated_at || new Date().toISOString(),
                    note: latestRevisionNote,
                  },
                ]
                : []
            }
            flaggedItems={flaggedItemsWithStatus}
            totalCount={totalFlaggedCount}
            modifiedCount={modifiedFlaggedCount}
            allModified={allFlaggedModified}
          />
        )}

        {/* Pemilihan Proyek Aanwijzing (Hanya Mode Tambah) */}
        {mode === "tambah" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3 shadow-xs">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Pilih Proyek Aanwijzing Siap Klarifikasi <span className="text-rose-500">*</span>
            </label>
            {loadingReady ? (
              <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#E65F2B]" />
                <span>Memuat daftar proyek aanwijzing...</span>
              </div>
            ) : readyList.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  Tidak ada proyek aanwijzing yang siap diklarifikasi saat ini. Pastikan sesi absensi aanwijzing hari-H telah selesai diselesaikan (status AANWIJZING_SELESAI).
                </span>
              </div>
            ) : (
              <SearchableSelectInput
                value={selectedAanwijzingId ? String(selectedAanwijzingId) : ""}
                onChange={(val) => handleSelectAanwijzing(val)}
                options={readyList.map((a) => ({
                  value: String(a.id),
                  label: `${a.nomor_undangan} • ${a.project?.nama_proyek} (${a.project?.kode}) — Cabang ${a.cabang}`,
                }))}
                placeholder="-- Cari & Pilih Proyek Aanwijzing Selesai Absen --"
              />
            )}
          </div>
        )}

        {/* Info Detail Metadata Proyek Terpilih */}
        {(selectedAanwijzing || initialData) && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs shadow-2xs">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Nama Proyek</div>
              <div className="font-bold text-slate-900 mt-0.5 truncate">
                {selectedAanwijzing?.project?.nama_proyek || initialData?.project?.nama_proyek || "-"}
              </div>
              <div className="text-[11px] text-slate-500">
                Kode: {selectedAanwijzing?.project?.kode || initialData?.project?.kode || "-"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Cabang &amp; Lokasi</div>
              <div className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{selectedAanwijzing?.cabang || initialData?.cabang || "-"}</span>
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                {selectedAanwijzing?.project?.alamat || initialData?.project?.alamat || "-"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">No. Surat Undangan</div>
              <div className="font-semibold text-slate-800 mt-0.5">
                {selectedAanwijzing?.nomor_undangan || initialData?.aanwijzing?.nomor_undangan || "-"}
              </div>
              <div className="text-[11px] text-slate-500">
                Status: {selectedAanwijzing?.status || initialData?.aanwijzing?.status || "-"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Rekap Status Item Proyek</div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                  {totalItemTetap} Sama dgn RAB
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {totalItemUbahVol} Disesuaikan
                </span>
                {totalItemBaru > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    +{totalItemBaru} Item Baru
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabel Input Perubahan Item & Penambahan Item Baru */}
        {(selectedAanwijzing || initialData) && (
          <FormItemKlarifikasiTable
            key={selectedAanwijzingId || initialData?.id || 0}
            originalItems={originalItems}
            initialKlarifikasiItems={initialData?.items}
            isRevision={mode === "edit" || initialData?.status === "REVISI"}
            cabang={selectedAanwijzing?.cabang || initialData?.cabang || ""}
            flaggedItemsMap={flaggedItemsMap}
            onChange={handleItemsChange}
          />
        )}

        {/* Input Penyesuaian Durasi Pekerjaan Proyek */}
        {(selectedAanwijzing || initialData) && (
          <FormDurasiKlarifikasiCard
            durasiAwal={durasiHariAwal}
            durasiAkhir={durasiHariAkhir}
            onChangeDurasi={setDurasiHariAkhir}
            catatanDurasi={catatanDurasi}
            onChangeCatatan={setCatatanDurasi}
            isRevision={mode === "edit" || initialData?.status === "REVISI"}
            pinpoint={
              durasiFlag
                ? {
                  isFlagged: true,
                  catatan: durasiFlag.item.catatan,
                  isModified: durasiFlag.isModified,
                }
                : undefined
            }
          />
        )}

        {/* Input Jadwal Pelaksanaan Tender Rekanan */}
        {(selectedAanwijzing || initialData) && (
          <FormTanggalTenderCard
            tanggalTender={tanggalTender}
            onChangeTanggal={setTanggalTender}
            isRevision={mode === "edit" || initialData?.status === "REVISI"}
          />
        )}

        {/* Input & Manajemen Gambar Teknis (Sipil & ME, PDF & DWG) */}
        {(selectedAanwijzing || initialData) && (
          <FormGambarTeknisKlarifikasiCard
            rabDokumenList={rabDokumenList}
            klarifikasiDokumenList={dokumenKlarifikasi}
            onChangeDokumen={setDokumenKlarifikasi}
            projectInfo={projectInfo}
            pinpoint={
              gambarFlag
                ? {
                  isFlagged: true,
                  catatan: gambarFlag.item.catatan,
                  isModified: gambarFlag.isModified,
                }
                : undefined
            }
          />
        )}

        {/* Input & Manajemen Foto Lingkungan & Eksisting Proyek */}
        {(selectedAanwijzing || initialData) && (
          <FormFotoLingkunganKlarifikasiCard
            rabFotoList={rabFotoList}
            klarifikasiFotoList={dokumenKlarifikasi}
            onChangeFotos={setDokumenKlarifikasi}
            projectInfo={projectInfo}
            pinpoint={
              fotoFlag
                ? {
                  isFlagged: true,
                  catatan: fotoFlag.item.catatan,
                  isModified: fotoFlag.isModified,
                }
                : undefined
            }
          />
        )}

        {/* Catatan Tambahan Maker */}
        {(selectedAanwijzing || initialData) && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-2 shadow-xs mb-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Catatan Tambahan / Ringkasan Rapat Aanwijzing (Opsional)
              </label>
              {catatanMakerFlag && (
                <RevisionPinpointBadge
                  catatan={catatanMakerFlag.item.catatan}
                  isModified={catatanMakerFlag.isModified}
                  label="Wajib Direvisi"
                />
              )}
            </div>
            <textarea
              value={catatanMaker}
              onChange={(e) => setCatatanMaker(e.target.value)}
              rows={3}
              placeholder="Tuliskan catatan khusus kondisi lapangan atau kesepakatan bersama rekanan kontraktor..."
              className={cn(
                "w-full text-xs p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#E65F2B] bg-white text-slate-800",
                catatanMakerFlag && !catatanMakerFlag.isModified && "border-amber-400 ring-1 ring-amber-300/40 bg-amber-50/20"
              )}
            />
          </div>
        )}
      </div>

      {/* DOCKED SOLID BOTTOM ACTION BAR */}
      {(selectedAanwijzing || initialData) && (
        <div className="shrink-0 bg-white border-t border-slate-200/90 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] py-3 px-4 sm:px-6 z-20 w-full">
          <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400">Status Berkas</span>
                <span className="text-xs font-bold text-slate-800">
                  {selectedAanwijzing?.project?.nama_proyek
                    ? `${selectedAanwijzing.project.nama_proyek} (${selectedAanwijzing.cabang})`
                    : initialData?.project?.nama_proyek
                      ? `${initialData.project.nama_proyek} (${initialData.cabang})`
                      : "Penyusunan Berita Acara"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {totalItemUbahVol} Disesuaikan
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  +{totalItemBaru} Item Baru
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => executeSubmit(true)}
                className="rounded-xl h-10 px-4 text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Save className="w-4 h-4 text-slate-500" />
                <span>Simpan Draft</span>
              </Button>

              <Button
                type="button"
                disabled={isSubmitting || (isRevision && !canSubmitRevision)}
                onClick={() => handleOpenReview()}
                className={cn(
                  "font-bold rounded-xl h-10 px-5 text-xs inline-flex items-center gap-2 shadow-md transition-all cursor-pointer",
                  isRevision && !canSubmitRevision
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                    : "bg-[#E65F2B] hover:bg-[#d04f1f] text-white shadow-[#E65F2B]/20"
                )}
                title={
                  isRevision && !canSubmitRevision
                    ? totalFlaggedCount > 0
                      ? `Harap perbaiki seluruh ${totalFlaggedCount} item revisi yang ditandai (${modifiedFlaggedCount}/${totalFlaggedCount} selesai)`
                      : "Harap ubah minimal satu data sebelum mengajukan ulang"
                    : undefined
                }
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{mode === "tambah" ? "Ajukan Berita Acara" : "Ajukan Ulang Revisi"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable DetailKlarifikasiModal as Review Modal Sebelum Pengajuan Resmi */}
      {reviewKlarifikasiData && (
        <DetailKlarifikasiModal
          open={isReviewOpen}
          onOpenChange={setIsReviewOpen}
          klarifikasi={reviewKlarifikasiData}
          isReviewMode={true}
          isRevision={initialData?.status === "REVISI"}
          isSubmitting={isSubmitting}
          onConfirmSubmit={() => executeSubmit(false)}
        />
      )}

      {/* Feedback Modal Pop-up */}
      <FeedbackModal
        isOpen={feedback.open}
        onClose={() => {
          setFeedback((prev) => ({ ...prev, open: false }));
          if (feedback.type === "success") {
            router.push("/dc-development/klarifikasi-aanwijzing");
          }
        }}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
      />
    </div>
  );
}
