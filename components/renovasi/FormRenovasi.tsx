"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Calendar,
  Layers,
  FileText,
  Upload,
  Camera,
  Trash2,
  Plus,
  Info,
  CheckCircle2,
  Clock,
  MapPin,
  Maximize2,
  HardHat,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ExternalLink,
  ShieldAlert,
  Loader2,
  ArrowLeft,
  Save,
  Send,
  Eye,
  Image as ImageIcon,
  ClipboardCheck,
  Lock,
  FileCode2,
  AlertCircle,
  MessageSquare,
  RotateCcw,
  Check,
  Sparkles
} from "lucide-react";
import {
  RevisionPinpointBadge,
  RevisionInstructionBanner
} from "@/components/approval";
import ApprovalNotesHistoryModal from "@/components/approval/ApprovalNotesHistoryModal";
import { getRevisionNotes } from "@/lib/approval-notes";
import { RevisionDetailItem, normalizeRevisionDetails } from "@/lib/types/renovasi-revision";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { SearchableSelectInput } from "@/components/ui/searchable-select";
import { CreatableSelectInput } from "@/components/ui/creatable-select";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import CameraWatermarkModal, { CapturedPhoto } from "./CameraWatermarkModal";
import UploadFotoLingkunganModal from "./UploadFotoLingkunganModal";
import ReviewRenovasiModal from "./ReviewRenovasiModal";
import { RabItemSelector } from "./RabItemSelector";
import { CurrencyInput, formatRupiahNumber } from "@/components/ui/currency-input";
import { formatRupiah, cn, toTitleCase } from "@/lib/utils";
import { useSession } from "@/context/SessionContext";
import { getIndukFromCabang, getUserCoverageBranches, isBranchAccessible } from "@/lib/branches";
import { canManageRenovasi, canEditRenovasiSubmission } from "@/lib/permissions";

interface ProjectItem {
  id: number;
  kode: string;
  nama_proyek: string;
  cabang: string;
  tipe: string;
  dc_induk?: string | null;
  total_luas_bangunan?: number | null;
  luas_lahan?: number | null;
  tanggal_go?: string | null;
  inisial?: string | null;
  daya_listrik?: string | null;
  kapasitas_toko?: number | null;
  active_renovasi?: {
    id: number;
    nomor_pengajuan: string;
    status: string;
    created_by: string;
    created_at: string;
  } | null;
}

interface UploadedDoc {
  id: string;
  nama_file: string;
  nama_label?: string;
  file_url: string;
  preview_url?: string;
  drive_file_id?: string;
  kategori_file:
  | "GAMBAR_SIPIL_PDF"
  | "GAMBAR_SIPIL_DWG"
  | "GAMBAR_ME_PDF"
  | "GAMBAR_ME_DWG"
  | "GAMBAR_SIPIL"
  | "GAMBAR_ME"
  | "FOTO_LINGKUNGAN";
  latitude?: number | null;
  longitude?: number | null;
  timestamp_watermark?: string | null;
  lokasi_wilayah?: string | null;
  uploading?: boolean;
}

interface RabItem {
  id: string;
  dbId?: number;
  lingkup: "SIPIL" | "ME";
  kategori_pekerjaan: string;
  master_item_id: number | null;
  deskripsi: string;
  harga_material: number;
  harga_upah: number;
  volume: number;
  catatan: string;
  is_custom: boolean;
}

// Komponen RevisionPinpointBadge dan RevisionInstructionBanner diimpor secara modular dari @/components/approval

// Fungsi komputasi snapshot formulir untuk mendeteksi apakah terdapat perubahan data
function computeFormSnapshot(data: {
  selectedProjectId: string;
  jenisRenovasi: string;
  lingkupPekerjaan: string;
  durasiHari: number | "";
  catatanPengajuan: string;
  docsSipilPdf: UploadedDoc[];
  docsSipilDwg: UploadedDoc[];
  docsMePdf: UploadedDoc[];
  docsMeDwg: UploadedDoc[];
  fotosLingkungan: UploadedDoc[];
  rabItems: RabItem[];
}) {
  const normDocs = (docs: UploadedDoc[]) =>
    docs
      .map((d) => ({
        name: d.nama_file || "",
        label: d.nama_label || "",
        driveId: d.drive_file_id || "",
        url: d.file_url || ""
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

  const normRab = (data.rabItems || [])
    .filter((r) => (r.deskripsi || "").trim() || r.master_item_id || Number(r.volume) > 0)
    .map((r) => ({
      lingkup: (r.lingkup || "SIPIL").toUpperCase(),
      kategori: r.kategori_pekerjaan || "",
      master_id: r.master_item_id ? Number(r.master_item_id) : null,
      deskripsi: (r.deskripsi || "").trim().toLowerCase(),
      volume: Number(r.volume) || 0,
      mat: Number(r.harga_material) || 0,
      upah: Number(r.harga_upah) || 0,
      catatan: (r.catatan || "").trim().toLowerCase()
    }))
    .sort((a, b) => {
      const cmpL = a.lingkup.localeCompare(b.lingkup);
      if (cmpL !== 0) return cmpL;
      const cmpK = a.kategori.localeCompare(b.kategori);
      if (cmpK !== 0) return cmpK;
      return a.deskripsi.localeCompare(b.deskripsi);
    });

  return JSON.stringify({
    project_id: String(data.selectedProjectId || ""),
    jenis_renovasi: (data.jenisRenovasi || "").trim().toLowerCase(),
    lingkup_pekerjaan: (data.lingkupPekerjaan || "").trim().toLowerCase(),
    durasi_hari: Number(data.durasiHari) || 0,
    catatan_pengajuan: (data.catatanPengajuan || "").trim().toLowerCase(),
    sipil_pdf: normDocs(data.docsSipilPdf),
    sipil_dwg: normDocs(data.docsSipilDwg),
    me_pdf: normDocs(data.docsMePdf),
    me_dwg: normDocs(data.docsMeDwg),
    fotos: normDocs(data.fotosLingkungan),
    rab: normRab
  });
}

export default function FormRenovasi() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftIdParam = searchParams.get("draft_id");
  const [existingDraftId, setExistingDraftId] = useState<number | null>(
    draftIdParam ? Number(draftIdParam) : null
  );
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [backModalOpen, setBackModalOpen] = useState(false);

  // Handler Eksekusi Hapus / Batalkan Form
  const handleExecuteDelete = async () => {
    try {
      setIsSubmitting(true);
      if (existingDraftId) {
        const res = await fetch(`/api/dc-development/renovasi?id=${existingDraftId}`, {
          method: "DELETE"
        });
        const json = await res.json();
        if (!res.ok || json.status !== "success") {
          throw new Error(json.message || "Gagal menghapus draft");
        }
      }

      // Reset seluruh state form
      setSelectedProjectId("");
      setJenisRenovasi("");
      setDurasiHari("");
      setCatatanPengajuan("");
      setDocsSipilPdf([]);
      setDocsSipilDwg([]);
      setDocsMePdf([]);
      setDocsMeDwg([]);
      setFotosLingkungan([]);
      setRabItems([]);
      setCollapsedCategories({});
      setCancelModalOpen(false);
      setBackModalOpen(false);

      router.push("/dc-development/renovasi");
    } catch (err: any) {
      console.error("Cancel/Delete error:", err);
      setFeedback({
        open: true,
        type: "error",
        title: "Gagal Menghapus",
        message: err.message || "Terjadi kesalahan saat menghapus data."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Master Data State
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [jenisRenovasiList, setJenisRenovasiList] = useState<string[]>([]);
  const [customItemHistory, setCustomItemHistory] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: number; lingkup: string; nama: string }[]>([]);
  const [masterItems, setMasterItems] = useState<any[]>([]);

  // Form Header State
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [jenisRenovasi, setJenisRenovasi] = useState<string>("");
  const [lingkupPekerjaan, setLingkupPekerjaan] = useState<string>("Sipil + ME");
  const [durasiHari, setDurasiHari] = useState<number | "">("");
  const [catatanPengajuan, setCatatanPengajuan] = useState<string>("");

  // Documents & Photos State
  const [docsSipilPdf, setDocsSipilPdf] = useState<UploadedDoc[]>([]);
  const [docsSipilDwg, setDocsSipilDwg] = useState<UploadedDoc[]>([]);
  const [docsMePdf, setDocsMePdf] = useState<UploadedDoc[]>([]);
  const [docsMeDwg, setDocsMeDwg] = useState<UploadedDoc[]>([]);
  const [fotosLingkungan, setFotosLingkungan] = useState<UploadedDoc[]>([]);

  // RAB Items State
  const [activeRabTab, setActiveRabTab] = useState<"SIPIL" | "ME">("SIPIL");
  const [rabItems, setRabItems] = useState<RabItem[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (kategori: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [kategori]: !prev[kategori]
    }));
  };

  const handleExpandAllCategories = () => {
    setCollapsedCategories({});
  };

  const handleCollapseAllCategories = (categoryNames: string[]) => {
    const collapsed: Record<string, boolean> = {};
    categoryNames.forEach((cat) => {
      collapsed[cat] = true;
    });
    setCollapsedCategories(collapsed);
  };

  // Modal & Processing State
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [uploadFotoModalOpen, setUploadFotoModalOpen] = useState(false);
  const [pendingFotoFiles, setPendingFotoFiles] = useState<File[]>([]);
  const [isUploadingFotos, setIsUploadingFotos] = useState(false);
  const [fotoUploadProgress, setFotoUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    open: boolean;
    type: "success" | "error";
    title: string;
    message: string;
    onOk?: () => void;
  }>({
    open: false,
    type: "success",
    title: "",
    message: ""
  });

  const [loadedDraft, setLoadedDraft] = useState<any | null>(null);
  const [revisionNotesModalOpen, setRevisionNotesModalOpen] = useState(false);
  const [flaggedRevisionItems, setFlaggedRevisionItems] = useState<RevisionDetailItem[]>([]);
  const [initialRevisionSnapshot, setInitialRevisionSnapshot] = useState<{
    durasiHari: number | "";
    jenisRenovasi: string;
    sipilPdfFileName: string;
    sipilDwgFileName: string;
    mePdfFileName: string;
    meDwgFileName: string;
    fotos: Array<{ id: string; name: string; label?: string; url: string }>;
    rabItems: Array<{ dbId?: number; id: string; volume: number; mat: number; upah: number; desc: string }>;
  } | null>(null);

  const revisionNotesList = useMemo(() => {
    return getRevisionNotes(loadedDraft?.catatan_pengajuan, loadedDraft?.created_by, loadedDraft?.created_at);
  }, [loadedDraft?.catatan_pengajuan, loadedDraft?.created_by, loadedDraft?.created_at]);
  const fileInputSipilPdfRef = useRef<HTMLInputElement>(null);
  const fileInputSipilDwgRef = useRef<HTMLInputElement>(null);
  const fileInputMePdfRef = useRef<HTMLInputElement>(null);
  const fileInputMeDwgRef = useRef<HTMLInputElement>(null);
  const fileInputFotoRef = useRef<HTMLInputElement>(null);
  const initialSnapshotRef = useRef<string | null>(null);

  // Load Master Data
  useEffect(() => {
    const fetchMaster = async () => {
      try {
        setLoadingMaster(true);
        const res = await fetch("/api/dc-development/renovasi/master-data");
        const json = await res.json();
        if (json.status === "success") {
          setProjects(json.data.projects || []);
          if (json.data.jenisRenovasiOptions) {
            setJenisRenovasiList(json.data.jenisRenovasiOptions);
          } else if (json.data.presets) {
            setJenisRenovasiList(json.data.presets.map((p: any) => p.nama));
          }
          setCategories(json.data.categories || []);
          setMasterItems(json.data.masterItems || []);
          setCustomItemHistory(json.data.customItemHistory || []);
        }
      } catch (err) {
        console.error("Gagal memuat master data renovasi:", err);
      } finally {
        setLoadingMaster(false);
      }
    };
    fetchMaster();
  }, []);

  // Jika membuka draft yang sudah tersimpan sebelumnya, muat data draft ke formulir
  useEffect(() => {
    if (!existingDraftId) return;

    const fetchDraftData = async () => {
      try {
        const res = await fetch(`/api/dc-development/renovasi?id=${existingDraftId}`);
        const json = await res.json();
        if (json.status === "success" && json.data) {
          const draft = Array.isArray(json.data)
            ? json.data.find((d: any) => d.id === existingDraftId)
            : json.data;
          if (draft) {
            setLoadedDraft(draft);

            // Validasi otorisasi akun: Koordinator hanya bisa merevisi jika akun pembuat sama (kecuali Admin)
            if (user && !canEditRenovasiSubmission(user, draft)) {
              setFeedback({
                open: true,
                type: "error",
                title: "Akses Edit Ditolak",
                message: `Pengajuan ini dibuat oleh akun ${draft.created_by}. Hanya akun pembuat yang sama atau Admin yang berhak melakukan revisi/perubahan.`,
                onOk: () => {
                  router.push("/dc-development/renovasi");
                }
              });
              return;
            }

            setSelectedProjectId(String(draft.project_id || ""));
            setJenisRenovasi(draft.jenis_renovasi || "");
            setLingkupPekerjaan(draft.lingkup_pekerjaan || "Sipil + ME");
            setDurasiHari(draft.durasi_hari || "");
            setCatatanPengajuan(draft.catatan_pengajuan || "");

            let sipilPdf: UploadedDoc[] = [];
            let sipilDwg: UploadedDoc[] = [];
            let mePdf: UploadedDoc[] = [];
            let meDwg: UploadedDoc[] = [];
            let fotos: UploadedDoc[] = [];

            if (draft.dokumen && Array.isArray(draft.dokumen)) {
              draft.dokumen.forEach((d: any) => {
                const isPdf = d.nama_file?.toLowerCase().endsWith(".pdf");
                const isDwg =
                  d.nama_file?.toLowerCase().endsWith(".dwg") ||
                  d.nama_file?.toLowerCase().endsWith(".dxf");

                if (
                  d.kategori_file === "GAMBAR_SIPIL_PDF" ||
                  (d.kategori_file === "GAMBAR_SIPIL" && isPdf)
                ) {
                  sipilPdf.push({
                    id: String(d.id),
                    nama_file: d.nama_file,
                    file_url: d.file_url || "",
                    drive_file_id: d.drive_file_id,
                    kategori_file: "GAMBAR_SIPIL_PDF",
                    uploading: false
                  });
                } else if (
                  d.kategori_file === "GAMBAR_SIPIL_DWG" ||
                  (d.kategori_file === "GAMBAR_SIPIL" && isDwg)
                ) {
                  sipilDwg.push({
                    id: String(d.id),
                    nama_file: d.nama_file,
                    file_url: d.file_url || "",
                    drive_file_id: d.drive_file_id,
                    kategori_file: "GAMBAR_SIPIL_DWG",
                    uploading: false
                  });
                } else if (
                  d.kategori_file === "GAMBAR_ME_PDF" ||
                  (d.kategori_file === "GAMBAR_ME" && isPdf)
                ) {
                  mePdf.push({
                    id: String(d.id),
                    nama_file: d.nama_file,
                    file_url: d.file_url || "",
                    drive_file_id: d.drive_file_id,
                    kategori_file: "GAMBAR_ME_PDF",
                    uploading: false
                  });
                } else if (
                  d.kategori_file === "GAMBAR_ME_DWG" ||
                  (d.kategori_file === "GAMBAR_ME" && isDwg)
                ) {
                  meDwg.push({
                    id: String(d.id),
                    nama_file: d.nama_file,
                    file_url: d.file_url || "",
                    drive_file_id: d.drive_file_id,
                    kategori_file: "GAMBAR_ME_DWG",
                    uploading: false
                  });
                }
              });

              fotos = draft.dokumen
                .filter((d: any) => d.kategori_file === "FOTO_LINGKUNGAN")
                .map((d: any) => ({
                  id: String(d.id),
                  nama_file: d.nama_file,
                  nama_label: d.nama_label,
                  file_url: d.file_url || "",
                  preview_url: d.drive_file_id ? `https://lh3.googleusercontent.com/d/${d.drive_file_id}` : (d.file_url || ""),
                  drive_file_id: d.drive_file_id,
                  kategori_file: "FOTO_LINGKUNGAN" as const,
                  latitude: d.latitude,
                  longitude: d.longitude,
                  timestamp_watermark: d.timestamp_watermark,
                  uploading: false
                }));

              setDocsSipilPdf(sipilPdf);
              setDocsSipilDwg(sipilDwg);
              setDocsMePdf(mePdf);
              setDocsMeDwg(meDwg);
              setFotosLingkungan(fotos);
            }

            let loadedItems: RabItem[] = [];
            if (draft.item_rab && Array.isArray(draft.item_rab)) {
              loadedItems = draft.item_rab.map((it: any) => ({
                id: `item-${it.id || Date.now()}-${Math.random()}`,
                dbId: it.id ? Number(it.id) : undefined,
                lingkup: (it.lingkup || "SIPIL").toUpperCase() as "SIPIL" | "ME",
                kategori_pekerjaan: it.kategori_pekerjaan || "Umum",
                master_item_id: it.master_item_id ? Number(it.master_item_id) : null,
                deskripsi: it.deskripsi || "",
                harga_material: it.harga_material || 0,
                harga_upah: it.harga_upah || 0,
                volume: it.volume || 0,
                catatan: it.catatan || "",
                is_custom: Boolean(it.is_custom)
              }));
              setRabItems(loadedItems);
            }

            // Normalisasi poin rincian revisi jika pengajuan berstatus REVISI
            const granularRevisi = normalizeRevisionDetails(draft.detail_revisi);
            setFlaggedRevisionItems(granularRevisi);
            setInitialRevisionSnapshot({
              durasiHari: draft.durasi_hari || "",
              jenisRenovasi: draft.jenis_renovasi || "",
              sipilPdfFileName: sipilPdf[0]?.nama_file || "",
              sipilDwgFileName: sipilDwg[0]?.nama_file || "",
              mePdfFileName: mePdf[0]?.nama_file || "",
              meDwgFileName: meDwg[0]?.nama_file || "",
              fotos: fotos.map((f: any) => ({
                id: String(f.id),
                name: f.nama_file,
                label: f.nama_label,
                url: f.file_url
              })),
              rabItems: loadedItems.map((r: any) => ({
                dbId: r.dbId,
                id: r.id,
                volume: r.volume,
                mat: r.harga_material,
                upah: r.harga_upah,
                desc: r.deskripsi
              }))
            });

            // Simpan snapshot data awal untuk mendeteksi apakah ada perubahan pada formulir (wajib untuk status REVISI)
            initialSnapshotRef.current = computeFormSnapshot({
              selectedProjectId: String(draft.project_id || ""),
              jenisRenovasi: draft.jenis_renovasi || "",
              lingkupPekerjaan: draft.lingkup_pekerjaan || "Sipil + ME",
              durasiHari: draft.durasi_hari || "",
              catatanPengajuan: draft.catatan_pengajuan || "",
              docsSipilPdf: sipilPdf,
              docsSipilDwg: sipilDwg,
              docsMePdf: mePdf,
              docsMeDwg: meDwg,
              fotosLingkungan: fotos,
              rabItems: loadedItems
            });
          }
        }
      } catch (err) {
        console.error("Gagal memuat draft:", err);
      }
    };

    fetchDraftData();
  }, [existingDraftId]);

  // Cek apakah ada minimal satu perubahan dari data awal yang dimuat (legacy general checker)
  const checkHasChanges = useCallback(() => {
    if (!initialSnapshotRef.current) return true;
    const currentSnap = computeFormSnapshot({
      selectedProjectId,
      jenisRenovasi,
      lingkupPekerjaan,
      durasiHari,
      catatanPengajuan,
      docsSipilPdf,
      docsSipilDwg,
      docsMePdf,
      docsMeDwg,
      fotosLingkungan,
      rabItems
    });
    return currentSnap !== initialSnapshotRef.current;
  }, [
    selectedProjectId,
    jenisRenovasi,
    lingkupPekerjaan,
    durasiHari,
    catatanPengajuan,
    docsSipilPdf,
    docsSipilDwg,
    docsMePdf,
    docsMeDwg,
    fotosLingkungan,
    rabItems
  ]);

  // Evaluasi apakah suatu item revisi spesifik telah diubah minimal satu kali
  const isRevisionItemModified = useCallback(
    (item: RevisionDetailItem): boolean => {
      if (item.category === "PARAMETER") {
        if (item.fieldOrId === "durasi_hari") {
          const init = initialRevisionSnapshot?.durasiHari ?? item.initialValue;
          return Number(durasiHari) > 0 && Number(durasiHari) !== Number(init);
        }
        if (item.fieldOrId === "jenis_renovasi") {
          const init = initialRevisionSnapshot?.jenisRenovasi ?? item.initialValue;
          return (
            jenisRenovasi.trim().length > 0 &&
            jenisRenovasi.trim().toLowerCase() !== String(init || "").trim().toLowerCase()
          );
        }
      }

      if (item.category === "GAMBAR") {
        const sub = (item.subCategory || "").toUpperCase();
        if (sub.includes("SIPIL_PDF") || (sub.includes("SIPIL") && sub.includes("PDF"))) {
          return (
            (docsSipilPdf.length === 0 && Boolean(initialRevisionSnapshot?.sipilPdfFileName)) ||
            (docsSipilPdf.length > 0 && docsSipilPdf[0].nama_file !== initialRevisionSnapshot?.sipilPdfFileName)
          );
        }
        if (sub.includes("SIPIL_DWG") || (sub.includes("SIPIL") && sub.includes("DWG"))) {
          return (
            (docsSipilDwg.length === 0 && Boolean(initialRevisionSnapshot?.sipilDwgFileName)) ||
            (docsSipilDwg.length > 0 && docsSipilDwg[0].nama_file !== initialRevisionSnapshot?.sipilDwgFileName)
          );
        }
        if (sub.includes("ME_PDF") || (sub.includes("ME") && sub.includes("PDF"))) {
          return (
            (docsMePdf.length === 0 && Boolean(initialRevisionSnapshot?.mePdfFileName)) ||
            (docsMePdf.length > 0 && docsMePdf[0].nama_file !== initialRevisionSnapshot?.mePdfFileName)
          );
        }
        if (sub.includes("ME_DWG") || (sub.includes("ME") && sub.includes("DWG"))) {
          return (
            (docsMeDwg.length === 0 && Boolean(initialRevisionSnapshot?.meDwgFileName)) ||
            (docsMeDwg.length > 0 && docsMeDwg[0].nama_file !== initialRevisionSnapshot?.meDwgFileName)
          );
        }
        return ![...docsSipilPdf, ...docsSipilDwg, ...docsMePdf, ...docsMeDwg].some(
          (d) => d.id === item.fieldOrId
        );
      }

      if (item.category === "FOTO") {
        const currentPhoto = fotosLingkungan.find((f) => f.id === item.fieldOrId);
        if (!currentPhoto) return true; // Foto telah dihapus
        const initPhoto = initialRevisionSnapshot?.fotos?.find((f) => f.id === item.fieldOrId);
        if (initPhoto && currentPhoto.nama_label && currentPhoto.nama_label !== initPhoto.label) return true;
        if (initPhoto && currentPhoto.nama_file !== initPhoto.name) return true;
        return false;
      }

      if (item.category === "RAB") {
        const matched = rabItems.find(
          (r) =>
            String(r.dbId) === item.fieldOrId ||
            r.id === item.fieldOrId ||
            (r.deskripsi &&
              item.initialValue?.deskripsi &&
              r.deskripsi.trim().toLowerCase() === item.initialValue.deskripsi.trim().toLowerCase())
        );
        if (!matched) return true; // Baris RAB telah dihapus
        const init = item.initialValue;
        if (!init) return true;
        const volDiff = Number(matched.volume) !== Number(init.volume);
        const matDiff = Number(matched.harga_material) !== Number(init.harga_material);
        const upahDiff = Number(matched.harga_upah) !== Number(init.harga_upah);
        const descDiff =
          matched.deskripsi.trim().toLowerCase() !== String(init.deskripsi || "").trim().toLowerCase();
        return volDiff || matDiff || upahDiff || descDiff;
      }

      return false;
    },
    [
      durasiHari,
      jenisRenovasi,
      docsSipilPdf,
      docsSipilDwg,
      docsMePdf,
      docsMeDwg,
      fotosLingkungan,
      rabItems,
      initialRevisionSnapshot
    ]
  );

  // Evaluasi seluruh status perubahan poin revisi
  const flaggedItemsEvaluation = useMemo(() => {
    if (flaggedRevisionItems.length === 0) {
      return {
        items: [] as Array<{ item: RevisionDetailItem; isModified: boolean }>,
        totalCount: 0,
        modifiedCount: 0,
        allModified: true,
        unmodifiedItems: [] as RevisionDetailItem[]
      };
    }

    const evaluated = flaggedRevisionItems.map((item) => {
      const modified = isRevisionItemModified(item);
      return { item, isModified: modified };
    });

    const modifiedCount = evaluated.filter((e) => e.isModified).length;
    const unmodified = evaluated.filter((e) => !e.isModified).map((e) => e.item);

    return {
      items: evaluated,
      totalCount: flaggedRevisionItems.length,
      modifiedCount,
      allModified: unmodified.length === 0,
      unmodifiedItems: unmodified
    };
  }, [flaggedRevisionItems, isRevisionItemModified]);

  // Helper pencarian item revisi spesifik per field/dokumen/foto/RAB
  const flaggedDurasi = useMemo(
    () => flaggedRevisionItems.find((f) => f.category === "PARAMETER" && f.fieldOrId === "durasi_hari"),
    [flaggedRevisionItems]
  );
  const isDurasiModified = useMemo(
    () => (flaggedDurasi ? isRevisionItemModified(flaggedDurasi) : true),
    [flaggedDurasi, isRevisionItemModified]
  );

  const flaggedJenis = useMemo(
    () => flaggedRevisionItems.find((f) => f.category === "PARAMETER" && f.fieldOrId === "jenis_renovasi"),
    [flaggedRevisionItems]
  );
  const isJenisModified = useMemo(
    () => (flaggedJenis ? isRevisionItemModified(flaggedJenis) : true),
    [flaggedJenis, isRevisionItemModified]
  );

  const flaggedSipilPdf = useMemo(
    () =>
      flaggedRevisionItems.find(
        (f) =>
          f.category === "GAMBAR" &&
          (f.subCategory?.includes("SIPIL_PDF") ||
            (f.subCategory?.includes("SIPIL") && f.subCategory?.includes("PDF")))
      ),
    [flaggedRevisionItems]
  );
  const isSipilPdfModified = useMemo(
    () => (flaggedSipilPdf ? isRevisionItemModified(flaggedSipilPdf) : true),
    [flaggedSipilPdf, isRevisionItemModified]
  );

  const flaggedSipilDwg = useMemo(
    () =>
      flaggedRevisionItems.find(
        (f) =>
          f.category === "GAMBAR" &&
          (f.subCategory?.includes("SIPIL_DWG") ||
            (f.subCategory?.includes("SIPIL") && f.subCategory?.includes("DWG")))
      ),
    [flaggedRevisionItems]
  );
  const isSipilDwgModified = useMemo(
    () => (flaggedSipilDwg ? isRevisionItemModified(flaggedSipilDwg) : true),
    [flaggedSipilDwg, isRevisionItemModified]
  );

  const flaggedMePdf = useMemo(
    () =>
      flaggedRevisionItems.find(
        (f) =>
          f.category === "GAMBAR" &&
          (f.subCategory?.includes("ME_PDF") ||
            (f.subCategory?.includes("ME") && f.subCategory?.includes("PDF")))
      ),
    [flaggedRevisionItems]
  );
  const isMePdfModified = useMemo(
    () => (flaggedMePdf ? isRevisionItemModified(flaggedMePdf) : true),
    [flaggedMePdf, isRevisionItemModified]
  );

  const flaggedMeDwg = useMemo(
    () =>
      flaggedRevisionItems.find(
        (f) =>
          f.category === "GAMBAR" &&
          (f.subCategory?.includes("ME_DWG") ||
            (f.subCategory?.includes("ME") && f.subCategory?.includes("DWG")))
      ),
    [flaggedRevisionItems]
  );
  const isMeDwgModified = useMemo(
    () => (flaggedMeDwg ? isRevisionItemModified(flaggedMeDwg) : true),
    [flaggedMeDwg, isRevisionItemModified]
  );

  const { user } = useSession();
  const canEdit = useMemo(() => canManageRenovasi(user?.role), [user?.role]);
  // Daftar cabang coverage user (HANYA role DC ADMIN yang bernilai null / akses bebas)
  const userCoverageBranches = useMemo(() => getUserCoverageBranches(user), [user]);

  // Filter projects berdasarkan coverage cabang
  const accessibleProjects = useMemo(() => {
    if (userCoverageBranches === null) return projects;
    return projects.filter((p) => {
      const pc = (p.cabang || "").toUpperCase();
      return isBranchAccessible(pc, userCoverageBranches);
    });
  }, [projects, userCoverageBranches]);

  // Selected Project Details
  const selectedProject = useMemo(() => {
    return projects.find((p) => String(p.id) === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // Cek apakah proyek terpilih terkunci karena memiliki renovasi aktif (kecuali draf sendiri)
  const isProjectLocked = useMemo(() => {
    if (!selectedProject || !selectedProject.active_renovasi) return false;
    if (existingDraftId && selectedProject.active_renovasi.id === existingDraftId) {
      return false;
    }
    return true;
  }, [selectedProject, existingDraftId]);

  // ID proyek yang terkunci untuk SearchableSelectInput disabledIds
  const lockedProjectIds = useMemo(() => {
    return accessibleProjects
      .filter((p) => {
        if (!p.active_renovasi) return false;
        if (existingDraftId && p.active_renovasi.id === existingDraftId) return false;
        return true;
      })
      .map((p) => String(p.id));
  }, [accessibleProjects, existingDraftId]);

  // Options for Dropdowns
  const projectOptions = useMemo(() => {
    return accessibleProjects.map((p) => {
      const isLocked =
        p.active_renovasi &&
        (!existingDraftId || p.active_renovasi.id !== existingDraftId);

      const statusTag = isLocked
        ? ` — [🔒 TERKUNCI: ${p.active_renovasi?.status}]`
        : "";

      return {
        value: String(p.id),
        label: `${p.kode} - ${p.nama_proyek} (${p.tipe || "DC"} • ${p.cabang || "CABANG"})${statusTag}`
      };
    });
  }, [accessibleProjects, existingDraftId]);

  const presetOptions = useMemo(() => {
    return jenisRenovasiList.map((nama) => ({
      value: toTitleCase(nama),
      label: toTitleCase(nama)
    }));
  }, [jenisRenovasiList]);

  // Kategori dinamis dari database mh_kategori_pekerjaan
  const dbSipilCategories = useMemo(() => {
    const list = categories
      .filter((c) => (c.lingkup || "").toUpperCase() === "SIPIL")
      .map((c) => c.nama);
    return list.length > 0
      ? Array.from(new Set(list))
      : ["Pekerjaan Persiapan", "Pekerjaan Struktur", "Pekerjaan Arsitektur"];
  }, [categories]);

  const dbMeCategories = useMemo(() => {
    const list = categories
      .filter((c) => (c.lingkup || "").toUpperCase() === "ME")
      .map((c) => c.nama);
    return list.length > 0
      ? Array.from(new Set(list))
      : ["Pekerjaan Elektrikal", "Pekerjaan Plumbing"];
  }, [categories]);

  // Inisialisasi otomatis jika kategori database selesai dimuat setelah proyek dipilih
  useEffect(() => {
    if (!existingDraftId && selectedProjectId && rabItems.length === 0 && categories.length > 0) {
      const initialItems: RabItem[] = [];
      dbSipilCategories.forEach((cat) => {
        initialItems.push({
          id: `init-sipil-${cat}`,
          lingkup: "SIPIL",
          kategori_pekerjaan: cat,
          master_item_id: null,
          deskripsi: "",
          harga_material: 0,
          harga_upah: 0,
          volume: 0,
          catatan: "",
          is_custom: false
        });
      });
      dbMeCategories.forEach((cat) => {
        initialItems.push({
          id: `init-me-${cat}`,
          lingkup: "ME",
          kategori_pekerjaan: cat,
          master_item_id: null,
          deskripsi: "",
          harga_material: 0,
          harga_upah: 0,
          volume: 0,
          catatan: "",
          is_custom: false
        });
      });
      setRabItems(initialItems);
    }
  }, [categories, selectedProjectId, dbSipilCategories, dbMeCategories]);

  // Handle Project Selection & Default RAB Categories
  const handleProjectChange = (val: string) => {
    setSelectedProjectId(val);
    if (val && rabItems.length === 0) {
      const initialItems: RabItem[] = [];
      dbSipilCategories.forEach((cat) => {
        initialItems.push({
          id: `init-sipil-${cat}`,
          lingkup: "SIPIL",
          kategori_pekerjaan: cat,
          master_item_id: null,
          deskripsi: "",
          harga_material: 0,
          harga_upah: 0,
          volume: 0,
          catatan: "",
          is_custom: false
        });
      });
      dbMeCategories.forEach((cat) => {
        initialItems.push({
          id: `init-me-${cat}`,
          lingkup: "ME",
          kategori_pekerjaan: cat,
          master_item_id: null,
          deskripsi: "",
          harga_material: 0,
          harga_upah: 0,
          volume: 0,
          catatan: "",
          is_custom: false
        });
      });
      setRabItems(initialItems);
    }
  };

  // Upload File to Google Drive
  const uploadFileToDrive = async (
    file: File,
    subFolder: "Gambar Sipil" | "Gambar ME" | "Foto Lingkungan",
    customName?: string
  ): Promise<any> => {
    const formData = new FormData();
    // Sanitasi nama berkas ke ASCII standar agar tidak memicu bug Content-Disposition pada multipart parser
    const safeAsciiName = (file.name || "file").replace(/[^\x20-\x7E]/g, "_");
    formData.append("file", file, safeAsciiName);
    formData.append("cabang", selectedProject?.cabang || "CABANG");
    formData.append("kode", selectedProject?.kode || "XXX");
    formData.append("nama_proyek", selectedProject?.nama_proyek || "PROYEK");
    if (selectedProject?.inisial) formData.append("inisial", selectedProject.inisial);
    formData.append("nomor_pengajuan", "DRAFT");
    formData.append("sub_folder", subFolder);
    if (customName && customName.trim()) {
      formData.append("custom_name", customName.trim());
    }

    const res = await fetch("/api/dc-development/renovasi/upload", {
      method: "POST",
      body: formData
    });
    const json = await res.json();
    if (!res.ok || json.status !== "success") {
      throw new Error(json.message || "Gagal upload file ke Google Drive");
    }
    return json.data;
  };

  // Upload Handler untuk Gambar Sipil & Gambar ME (Masing-masing tepat 1 berkas per kategori)
  const handleUploadGambarTeknis = async (
    files: FileList | null,
    kategori: "GAMBAR_SIPIL_PDF" | "GAMBAR_SIPIL_DWG" | "GAMBAR_ME_PDF" | "GAMBAR_ME_DWG"
  ) => {
    if (!files || files.length === 0) return;
    if (!selectedProject) {
      setFeedback({
        open: true,
        type: "error",
        title: "Pilih Proyek Dahulu",
        message: "Silakan pilih proyek sebelum mengunggah gambar teknis."
      });
      return;
    }

    const file = files[0];
    if (!file) return;

    const fileNameLower = file.name.toLowerCase();
    const isPdfSlot = kategori === "GAMBAR_SIPIL_PDF" || kategori === "GAMBAR_ME_PDF";
    const isDwgSlot = kategori === "GAMBAR_SIPIL_DWG" || kategori === "GAMBAR_ME_DWG";

    // Validasi ketat format berkas: PDF hanya terima .pdf, DWG hanya terima .dwg / .dxf
    if (isPdfSlot && !fileNameLower.endsWith(".pdf")) {
      setFeedback({
        open: true,
        type: "error",
        title: "Format Berkas Tidak Sesuai",
        message: `Slot ini hanya menerima dokumen PDF (.pdf). Berkas "${file.name}" ditolak.`
      });
      return;
    }

    if (isDwgSlot && !fileNameLower.endsWith(".dwg") && !fileNameLower.endsWith(".dxf")) {
      setFeedback({
        open: true,
        type: "error",
        title: "Format Berkas Tidak Sesuai",
        message: `Slot ini hanya menerima berkas AutoCAD (.dwg). Berkas "${file.name}" ditolak.`
      });
      return;
    }

    const subFolder =
      kategori === "GAMBAR_SIPIL_PDF" || kategori === "GAMBAR_SIPIL_DWG"
        ? "Gambar Sipil"
        : "Gambar ME";

    const tempId = `temp-${Date.now()}`;
    const tempDoc: UploadedDoc = {
      id: tempId,
      nama_file: file.name,
      file_url: "",
      kategori_file: kategori,
      uploading: true
    };

    const setTargetDocs = (updater: (prev: UploadedDoc[]) => UploadedDoc[]) => {
      if (kategori === "GAMBAR_SIPIL_PDF") setDocsSipilPdf(updater);
      else if (kategori === "GAMBAR_SIPIL_DWG") setDocsSipilDwg(updater);
      else if (kategori === "GAMBAR_ME_PDF") setDocsMePdf(updater);
      else if (kategori === "GAMBAR_ME_DWG") setDocsMeDwg(updater);
    };

    setTargetDocs(() => [tempDoc]);

    try {
      const driveData = await uploadFileToDrive(file, subFolder);
      const updatedDoc: UploadedDoc = {
        id: tempId,
        nama_file: driveData.file_name,
        file_url: driveData.file_url,
        drive_file_id: driveData.drive_file_id,
        kategori_file: kategori,
        uploading: false
      };
      setTargetDocs(() => [updatedDoc]);
    } catch (err: any) {
      console.error("Upload error:", err);
      setTargetDocs(() => []);
      setFeedback({
        open: true,
        type: "error",
        title: "Upload Gagal",
        message: err.message || "Gagal mengunggah file ke Google Drive"
      });
    }
  };

  // Pemilihan file foto lingkungan (Membuka modal penamaan sebelum diupload ke Drive)
  const handleSelectFotoFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!selectedProject) {
      setFeedback({
        open: true,
        type: "error",
        title: "Pilih Proyek Dahulu",
        message: "Silakan pilih proyek sebelum mengunggah foto lingkungan."
      });
      return;
    }

    const fileList = Array.from(files);
    setPendingFotoFiles(fileList);
    setUploadFotoModalOpen(true);

    if (fileInputFotoRef.current) {
      fileInputFotoRef.current.value = "";
    }
  };

  // Konfirmasi Upload dari Modal Penamaan Foto Lingkungan
  const handleConfirmUploadFotos = async (items: { file: File; name: string }[]) => {
    setIsUploadingFotos(true);
    setFotoUploadProgress({ current: 0, total: items.length });

    const newDocs: UploadedDoc[] = [];

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setFotoUploadProgress({ current: i + 1, total: items.length });

        const driveData = await uploadFileToDrive(item.file, "Foto Lingkungan", item.name);
        const tempId = `foto-${Date.now()}-${i}-${Math.random()}`;

        newDocs.push({
          id: tempId,
          nama_file: driveData.file_name,
          nama_label: item.name,
          file_url: driveData.file_url,
          drive_file_id: driveData.drive_file_id,
          kategori_file: "FOTO_LINGKUNGAN",
          uploading: false
        });
      }

      setFotosLingkungan((prev) => [...prev, ...newDocs]);
      setUploadFotoModalOpen(false);
      setPendingFotoFiles([]);
    } catch (err: any) {
      if (newDocs.length > 0) {
        setFotosLingkungan((prev) => [...prev, ...newDocs]);
      }
      setFeedback({
        open: true,
        type: "error",
        title: "Upload Foto Gagal",
        message: err.message || "Gagal mengunggah foto ke Google Drive"
      });
      throw err;
    } finally {
      setIsUploadingFotos(false);
      setFotoUploadProgress(null);
    }
  };

  // Callback dari Kamera Modal (dengan Watermark GPS & Waktu)
  const handlePhotoCaptured = async (photo: CapturedPhoto) => {
    if (!selectedProject) return;

    const tempId = `temp-cam-${Date.now()}`;
    const tempDoc: UploadedDoc = {
      id: tempId,
      nama_file: photo.file.name,
      nama_label: toTitleCase(photo.nama_label || "Foto Lingkungan"),
      file_url: "",
      preview_url: photo.previewUrl,
      kategori_file: "FOTO_LINGKUNGAN",
      latitude: photo.latitude,
      longitude: photo.longitude,
      timestamp_watermark: photo.timestamp.toISOString(),
      lokasi_wilayah: photo.lokasi_wilayah,
      uploading: true
    };

    setFotosLingkungan((prev) => [...prev, tempDoc]);

    try {
      const driveData = await uploadFileToDrive(photo.file, "Foto Lingkungan", photo.nama_label);
      setFotosLingkungan((prev) =>
        prev.map((d) =>
          d.id === tempId
            ? {
              ...d,
              nama_file: driveData.file_name,
              file_url: driveData.file_url,
              drive_file_id: driveData.drive_file_id,
              uploading: false
            }
            : d
        )
      );
    } catch (err: any) {
      setFotosLingkungan((prev) => prev.filter((d) => d.id !== tempId));
      setFeedback({
        open: true,
        type: "error",
        title: "Upload Foto Kamera Gagal",
        message: err.message || "Gagal mengunggah foto ke Google Drive"
      });
    }
  };

  // Helper List Item Dropdown yang disesuaikan persis dengan Kategori Pekerjaan (Master Item + Riwayat Inputan Bebas)
  // Hanya menampilkan item yang SUDAH MEMILIKI HARGA untuk cabang proyek yang sedang dipilih
  const getMasterItemOptions = useCallback(
    (kategori: string) => {
      const normCat = (kategori || "").trim().toLowerCase();
      const projBranch = (selectedProject?.cabang || "").trim().toLowerCase();
      const currentBranchUpper = (selectedProject?.cabang || "").trim().toUpperCase();

      // 1. Opsi dari mh_master_item (hanya yang memiliki harga > 0 di cabang proyek ini)
      const masterOpts = masterItems
        .filter((m) => {
          const scopeMatch = (m.lingkup || "SIPIL").toUpperCase() === activeRabTab;
          const catMatch = (m.kategori_pekerjaan || "").trim().toLowerCase() === normCat;
          if (!scopeMatch || !catMatch || !projBranch) return false;

          const branchPrice = m.item_cabang?.find(
            (c: any) =>
              (c.cabang?.trim().toLowerCase() === projBranch ||
                c.coverage_cabang?.trim().toLowerCase() === projBranch) &&
              (Number(c.total_material || 0) > 0 || Number(c.total_upah || 0) > 0)
          );
          return Boolean(branchPrice);
        })
        .map((m) => {
          const branchPrice = m.item_cabang?.find(
            (c: any) =>
              (c.cabang?.trim().toLowerCase() === projBranch ||
                c.coverage_cabang?.trim().toLowerCase() === projBranch) &&
              (Number(c.total_material || 0) > 0 || Number(c.total_upah || 0) > 0)
          );
          return {
            value: `master-${m.id}`,
            label: m.deskripsi_otomatis || m.item_material || "Tanpa Deskripsi",
            source: "master" as const,
            masterItem: m,
            masterItemId: m.id,
            recommendedMaterial: branchPrice ? Number(branchPrice.total_material || 0) : 0,
            recommendedUpah: branchPrice ? Number(branchPrice.total_upah || 0) : 0,
            kategori_pekerjaan: m.kategori_pekerjaan,
            lingkup: m.lingkup || "SIPIL"
          };
        });

      const masterLabelSet = new Set(masterOpts.map((o) => o.label.trim().toLowerCase()));

      // 2. Opsi dari customItemHistory (riwayat inputan bebas yang memiliki harga di cabang proyek ini)
      const historyOpts = customItemHistory
        .filter((h) => {
          const scopeMatch = (h.lingkup || "SIPIL").toUpperCase() === activeRabTab;
          const catMatch = (h.kategori_pekerjaan || "").trim().toLowerCase() === normCat;
          const notInMaster = !masterLabelSet.has((h.deskripsi || "").trim().toLowerCase());
          if (!scopeMatch || !catMatch || !notInMaster || !currentBranchUpper) return false;

          const bPrice = h.branch_prices ? h.branch_prices[currentBranchUpper] : null;
          return Boolean(bPrice && (Number(bPrice.material || 0) > 0 || Number(bPrice.upah || 0) > 0));
        })
        .map((h, idx) => {
          const bPrice = currentBranchUpper && h.branch_prices ? h.branch_prices[currentBranchUpper] : null;
          const recMat = bPrice ? bPrice.material : 0;
          const recUpah = bPrice ? bPrice.upah : 0;

          return {
            value: `history-${idx}-${h.deskripsi}`,
            label: h.deskripsi,
            source: "history" as const,
            masterItemId: undefined,
            recommendedMaterial: recMat,
            recommendedUpah: recUpah,
            kategori_pekerjaan: h.kategori_pekerjaan,
            lingkup: h.lingkup
          };
        });

      return [...masterOpts, ...historyOpts];
    },
    [masterItems, customItemHistory, activeRabTab, selectedProject?.cabang]
  );

  // Helper Mendapatkan Harga Rekomendasi dari Master Item atau Riwayat Bebas untuk cabang terpilih
  const getMasterPriceRecommendation = useCallback(
    (masterItemId: number | null, deskripsi?: string, kategori?: string) => {
      const projBranch = (selectedProject?.cabang || "").trim().toLowerCase();
      const currentBranchUpper = (selectedProject?.cabang || "").trim().toUpperCase();
      if (!projBranch) return null;

      // 1. Cek master item (baik lewat ID maupun pencocokan nama deskripsi)
      const masterItem = masterItemId
        ? masterItems.find((m) => Number(m.id) === Number(masterItemId))
        : deskripsi
        ? masterItems.find(
            (m) =>
              (m.deskripsi_otomatis || "").trim().toLowerCase() === deskripsi.trim().toLowerCase() ||
              (m.item_material || "").trim().toLowerCase() === deskripsi.trim().toLowerCase()
          )
        : null;

      if (masterItem) {
        // Ambil harga cabang proyek jika ada dan harganya > 0
        const branchPrice = masterItem.item_cabang?.find(
          (c: any) =>
            (c.cabang?.trim().toLowerCase() === projBranch ||
              c.coverage_cabang?.trim().toLowerCase() === projBranch) &&
            (Number(c.total_material || 0) > 0 || Number(c.total_upah || 0) > 0)
        );

        if (branchPrice) {
          return {
            material: Number(branchPrice.total_material || 0),
            upah: Number(branchPrice.total_upah || 0),
            source: "master" as const
          };
        }
        return null;
      }

      // 2. Cek apakah ada di customItemHistory berdasarkan deskripsi & kategori untuk cabang proyek
      if (deskripsi && deskripsi.trim()) {
        const normDesc = deskripsi.trim().toLowerCase();
        const normCat = (kategori || "").trim().toLowerCase();

        const historyItem = customItemHistory.find((h) => {
          const catMatch = !normCat || (h.kategori_pekerjaan || "").trim().toLowerCase() === normCat;
          return catMatch && (h.deskripsi || "").trim().toLowerCase() === normDesc;
        });

        if (historyItem && historyItem.branch_prices) {
          const bPrice = historyItem.branch_prices[currentBranchUpper];
          if (bPrice && (Number(bPrice.material || 0) > 0 || Number(bPrice.upah || 0) > 0)) {
            return {
              material: Number(bPrice.material || 0),
              upah: Number(bPrice.upah || 0),
              source: "history" as const
            };
          }
        }
      }

      return null;
    },
    [masterItems, customItemHistory, selectedProject?.cabang]
  );

  // Handler Pemilihan Opsi Item di Row (Master Item maupun Riwayat Bebas)
  const handleSelectMasterItem = (rowId: string, val: string, option?: any) => {
    if (!option) {
      // Fallback legacy jika dipanggil hanya dengan ID master
      const masterId = Number(val);
      const itemData = masterItems.find((m) => m.id === masterId);
      if (!itemData) return;
      setRabItems((prev) =>
        prev.map((row) =>
          row.id === rowId
            ? {
                ...row,
                master_item_id: masterId,
                deskripsi: itemData.deskripsi_otomatis || itemData.item_material || "",
                harga_material: 0,
                harga_upah: 0,
                is_custom: false
              }
            : row
        )
      );
      return;
    }

    if (option.source === "history") {
      setRabItems((prev) =>
        prev.map((row) =>
          row.id === rowId
            ? {
                ...row,
                master_item_id: null,
                deskripsi: option.label,
                harga_material: 0,
                harga_upah: 0,
                is_custom: true
              }
            : row
        )
      );
    } else {
      // Master item
      const masterId = option.masterItemId || Number(val.replace("master-", ""));
      setRabItems((prev) =>
        prev.map((row) =>
          row.id === rowId
            ? {
                ...row,
                master_item_id: masterId,
                deskripsi: option.label,
                harga_material: 0,
                harga_upah: 0,
                is_custom: false
              }
            : row
        )
      );
    }
  };

  // Handler Pengaturan Custom/Manual Item di Row (Input Bebas Otomatis)
  const handleSetCustomRabItem = (rowId: string, customDeskripsi: string) => {
    setRabItems((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
            ...row,
            master_item_id: null,
            deskripsi: customDeskripsi,
            is_custom: true
          }
          : row
      )
    );
  };

  // Handler Update Baris RAB
  const handleUpdateRabRow = (rowId: string, field: keyof RabItem, value: any) => {
    setRabItems((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  // Tambah Baris Item Baru di Kategori Tertentu
  const handleAddRabRow = (kategori: string) => {
    // Pastikan kategori dalam kondisi terbuka saat menambah item
    setCollapsedCategories((prev) => ({ ...prev, [kategori]: false }));

    const newRow: RabItem = {
      id: `row-${Date.now()}-${Math.random()}`,
      lingkup: activeRabTab,
      kategori_pekerjaan: kategori,
      master_item_id: null,
      deskripsi: "",
      harga_material: 0,
      harga_upah: 0,
      volume: 0,
      catatan: "",
      is_custom: false
    };
    setRabItems((prev) => [...prev, newRow]);
  };

  // Hapus Baris RAB
  const handleDeleteRabRow = (rowId: string) => {
    setRabItems((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Kalkulasi Total Biaya & Pajak / Pembulatan
  const { totalSipil, totalMe, totalSebelumPpn, nilaiPpn, nilaiPembulatan, grandTotal } = useMemo(() => {
    let sipil = 0;
    let me = 0;

    rabItems.forEach((row) => {
      const vol = Number(row.volume) || 0;
      const mat = Number(row.harga_material) || 0;
      const wge = Number(row.harga_upah) || 0;
      const tot = (mat + wge) * vol;

      if (row.lingkup === "ME") {
        me += tot;
      } else {
        sipil += tot;
      }
    });

    const sebelumPpn = sipil + me;
    const ppn = sebelumPpn > 0 ? Math.round(sebelumPpn * 0.11) : 0;
    const plusPpn = sebelumPpn + ppn;
    const finalGrandTotal = plusPpn > 0 ? Math.ceil(plusPpn / 1000) * 1000 : 0;
    const pembulatan = finalGrandTotal > 0 ? finalGrandTotal - plusPpn : 0;

    return {
      totalSipil: sipil,
      totalMe: me,
      totalSebelumPpn: sebelumPpn,
      nilaiPpn: ppn,
      nilaiPembulatan: pembulatan,
      grandTotal: finalGrandTotal
    };
  }, [rabItems]);

  // List Kategori Aktif berdasarkan tab SIPIL atau ME
  const activeCategories = useMemo(() => {
    return activeRabTab === "SIPIL" ? dbSipilCategories : dbMeCategories;
  }, [activeRabTab, dbSipilCategories, dbMeCategories]);

  // Kelompokkan RAB Item untuk Scope Aktif Berdasarkan Kategori Resmi
  const groupedActiveRabItems = useMemo(() => {
    const currentScopeItems = rabItems.filter((r) => r.lingkup === activeRabTab);
    const groups: Record<string, RabItem[]> = {};

    // Selalu inisialisasi semua kategori resmi dari database
    activeCategories.forEach((cat) => {
      groups[cat] = [];
    });

    currentScopeItems.forEach((item) => {
      const cat = item.kategori_pekerjaan || "Umum";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    return groups;
  }, [rabItems, activeRabTab, activeCategories]);

  // Submit Handler (Draft atau Ajukan)
  const handleSubmit = async (targetStatus: "DRAFT" | "MENUNGGU APPROVAL B&M MANAGER") => {
    // Validasi otorisasi revisi/edit pengajuan
    if (loadedDraft && !canEditRenovasiSubmission(user, loadedDraft)) {
      setFeedback({
        open: true,
        type: "error",
        title: "Akses Edit Ditolak",
        message: `Pengajuan ini dibuat oleh akun ${loadedDraft.created_by}. Hanya akun pembuat yang sama atau Admin yang berhak melakukan revisi/perubahan.`
      });
      return;
    }

    if (!selectedProjectId) {
      setFeedback({
        open: true,
        type: "error",
        title: "Proyek Wajib Dipilih",
        message: "Silakan pilih Proyek Bangunan DC terlebih dahulu pada Bagian 1."
      });
      return;
    }

    if (!jenisRenovasi.trim()) {
      setFeedback({
        open: true,
        type: "error",
        title: "Jenis Renovasi Wajib Diisi",
        message: "Silakan pilih atau ketik Jenis Renovasi pada Bagian 2 (Parameter Pengajuan Renovasi)."
      });
      return;
    }

    const isRevision = loadedDraft?.status === "REVISI";

    // Validasi minimal 1 perubahan khusus jika pengajuan berstatus REVISI
    if (targetStatus === "MENUNGGU APPROVAL B&M MANAGER" && isRevision) {
      if (flaggedRevisionItems.length > 0) {
        if (!flaggedItemsEvaluation.allModified) {
          const unmodList = flaggedItemsEvaluation.unmodifiedItems
            .map((u, i) => `${i + 1}. ${u.label}: "${u.catatan}"`)
            .join("\n");
          setFeedback({
            open: true,
            type: "error",
            title: "Poin Revisi Belum Lengkap Diperbaiki",
            message: `Terdapat ${flaggedItemsEvaluation.unmodifiedItems.length} bagian yang ditandai revisi oleh peninjau namun belum diubah:\n\n${unmodList}\n\nSeluruh bagian yang ditandai revisi wajib diubah minimal satu kali sebelum dapat diajukan ulang.`
          });
          return;
        }
      } else {
        if (!checkHasChanges()) {
          setFeedback({
            open: true,
            type: "error",
            title: "Wajib Melakukan Perubahan",
            message: "Pengajuan ini berstatus REVISI. Anda wajib melakukan minimal satu perubahan pada formulir (parameter proyek, dokumen gambar, foto lingkungan, atau rincian item RAB) sebelum dapat mengajukan ulang revisi ini."
          });
          return;
        }
      }
    }

    if (targetStatus === "MENUNGGU APPROVAL B&M MANAGER") {
      // 1. Durasi Pekerjaan (minimal 1 hari)
      if (!durasiHari || Number(durasiHari) <= 0) {
        setFeedback({
          open: true,
          type: "error",
          title: "Durasi Pekerjaan Wajib Diisi",
          message: "Silakan masukkan estimasi Durasi Pekerjaan (minimal 1 hari) pada Bagian 2."
        });
        return;
      }

      // 2. Gambar Kerja Sipil (PDF & DWG)
      if (docsSipilPdf.length === 0) {
        setFeedback({
          open: true,
          type: "error",
          title: "Gambar Kerja Sipil (PDF) Wajib Diunggah",
          message: "Silakan unggah Gambar Kerja Sipil berformat PDF (.pdf) pada Bagian 3 (Gambar Teknis)."
        });
        return;
      }

      if (docsSipilDwg.length === 0) {
        setFeedback({
          open: true,
          type: "error",
          title: "Gambar Kerja Sipil (AutoCAD) Wajib Diunggah",
          message: "Silakan unggah Gambar Kerja Sipil berformat AutoCAD (.dwg) pada Bagian 3 (Gambar Teknis)."
        });
        return;
      }

      // 3. Gambar Kerja ME (PDF & DWG)
      if (docsMePdf.length === 0) {
        setFeedback({
          open: true,
          type: "error",
          title: "Gambar Kerja ME (PDF) Wajib Diunggah",
          message: "Silakan unggah Gambar Kerja ME berformat PDF (.pdf) pada Bagian 3 (Gambar Teknis)."
        });
        return;
      }

      if (docsMeDwg.length === 0) {
        setFeedback({
          open: true,
          type: "error",
          title: "Gambar Kerja ME (AutoCAD) Wajib Diunggah",
          message: "Silakan unggah Gambar Kerja ME berformat AutoCAD (.dwg) pada Bagian 3 (Gambar Teknis)."
        });
        return;
      }

      // 4. Foto Lingkungan Eksisting (minimal 1 foto)
      if (fotosLingkungan.length === 0) {
        setFeedback({
          open: true,
          type: "error",
          title: "Foto Lingkungan Eksisting Wajib Diisi",
          message: "Silakan ambil foto dengan kamera watermark atau unggah minimal 1 Foto Lingkungan Eksisting pada Bagian 4."
        });
        return;
      }

      // 5. Item Sipil (minimal 1 item dengan volume > 0)
      const sipilItemsWithContent = rabItems.filter(
        (r) => r.lingkup === "SIPIL" && (r.deskripsi.trim() || r.master_item_id)
      );
      const validSipilItems = sipilItemsWithContent.filter((r) => Number(r.volume) > 0);

      if (validSipilItems.length === 0) {
        if (sipilItemsWithContent.length > 0) {
          setFeedback({
            open: true,
            type: "error",
            title: "Volume Item Sipil Wajib Diisi",
            message: "Item pekerjaan Sipil sudah dimasukkan, namun volume pekerjaan masih 0. Harap isi volume lebih dari 0 pada Bagian 5 (RAB/OE)."
          });
        } else {
          setFeedback({
            open: true,
            type: "error",
            title: "Item Pekerjaan Sipil Wajib Diisi",
            message: "Silakan masukkan minimal 1 item pekerjaan Sipil beserta volumenya (> 0) pada Bagian 5 (RAB/OE)."
          });
        }
        return;
      }

      // 6. Item ME (minimal 1 item dengan volume > 0)
      const meItemsWithContent = rabItems.filter(
        (r) => r.lingkup === "ME" && (r.deskripsi.trim() || r.master_item_id)
      );
      const validMeItems = meItemsWithContent.filter((r) => Number(r.volume) > 0);

      if (validMeItems.length === 0) {
        if (meItemsWithContent.length > 0) {
          setFeedback({
            open: true,
            type: "error",
            title: "Volume Item ME Wajib Diisi",
            message: "Item pekerjaan ME sudah dimasukkan, namun volume pekerjaan masih 0. Harap isi volume lebih dari 0 pada Bagian 5 (RAB/OE)."
          });
        } else {
          setFeedback({
            open: true,
            type: "error",
            title: "Item Pekerjaan ME Wajib Diisi",
            message: "Silakan masukkan minimal 1 item pekerjaan ME beserta volumenya (> 0) pada Bagian 5 (RAB/OE)."
          });
        }
        return;
      }

    }

    // Cek apakah ada berkas atau foto lingkungan yang masih dalam proses upload ke Google Drive
    const isUploadingDocs = [
      ...docsSipilPdf,
      ...docsSipilDwg,
      ...docsMePdf,
      ...docsMeDwg,
      ...fotosLingkungan
    ].some((d) => d.uploading);
    if (isUploadingDocs) {
      setFeedback({
        open: true,
        type: "error",
        title: "Unggah Berkas Sedang Berlangsung",
        message: "Harap tunggu beberapa saat sampai foto lingkungan dan gambar teknis selesai diunggah ke Google Drive sebelum menyimpan."
      });
      return;
    }

    // Filter baris RAB yang valid (memiliki deskripsi atau master item)
    const validItems = rabItems.filter((r) => r.deskripsi.trim() || r.master_item_id);

    try {
      setIsSubmitting(true);

      const allDocs = [
        ...docsSipilPdf,
        ...docsSipilDwg,
        ...docsMePdf,
        ...docsMeDwg,
        ...fotosLingkungan
      ].map((d) => ({
        kategori_file: d.kategori_file,
        nama_file: d.nama_file,
        nama_label: d.nama_label
          ? toTitleCase(d.nama_label)
          : (d.kategori_file === "FOTO_LINGKUNGAN" && d.nama_file
            ? toTitleCase(d.nama_file.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " "))
            : null),
        file_url: d.file_url,
        drive_file_id: d.drive_file_id || null,
        latitude: d.latitude || null,
        longitude: d.longitude || null,
        timestamp_watermark: d.timestamp_watermark || null
      }));

      // Jika status awal REVISI dan user menyimpan sebagai draft, status tetap REVISI
      const finalStatus = targetStatus === "DRAFT" && isRevision ? "REVISI" : targetStatus;

      const payload = {
        ...(existingDraftId ? { id: existingDraftId } : {}),
        project_id: Number(selectedProjectId),
        jenis_renovasi: toTitleCase(jenisRenovasi),
        lingkup_pekerjaan: lingkupPekerjaan,
        durasi_hari: Number(durasiHari) || 0,
        satuan_durasi: "Hari",
        catatan_pengajuan: catatanPengajuan ? toTitleCase(catatanPengajuan) : "",
        status: finalStatus,
        total_biaya_sipil: totalSipil,
        total_biaya_me: totalMe,
        total_sebelum_ppn: totalSebelumPpn,
        nilai_ppn: nilaiPpn,
        nilai_pembulatan: nilaiPembulatan,
        grand_total: grandTotal,
        dokumen: allDocs,
        items: validItems.map((r) => ({
          ...r,
          catatan: r.catatan ? toTitleCase(r.catatan) : ""
        }))
      };

      const res = await fetch("/api/dc-development/renovasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Gagal menyimpan pengajuan renovasi");
      }

      setFeedback({
        open: true,
        type: "success",
        title:
          targetStatus === "DRAFT"
            ? isRevision
              ? "Perubahan Revisi Disimpan"
              : "Draft Tersimpan"
            : isRevision
              ? "Revisi Berhasil Diajukan"
              : "Pengajuan Berhasil Dikirim",
        message:
          targetStatus === "DRAFT"
            ? isRevision
              ? `Perubahan revisi untuk pengajuan ${json.data.nomor_pengajuan} berhasil disimpan. Status tetap REVISI.`
              : `Pengajuan ${json.data.nomor_pengajuan} berhasil disimpan sebagai Draft.`
            : isRevision
              ? `Pengajuan revisi ${json.data.nomor_pengajuan} berhasil diajukan ulang dan menunggu Approval Branch Building & Maintenance Manager.`
              : `Pengajuan ${json.data.nomor_pengajuan} berhasil dikirim dan menunggu Approval Branch Building & Maintenance Manager.`,
        onOk: () => {
          router.push("/dc-development/renovasi");
        }
      });
    } catch (err: any) {
      console.error("Submit error:", err);
      setFeedback({
        open: true,
        type: "error",
        title: "Gagal Menyimpan",
        message: err.message || "Terjadi kesalahan saat menyimpan pengajuan."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Quick Jump untuk navigasi mulus ke elemen form yang ditandai peninjau
  const handleJumpToItem = useCallback((item: RevisionDetailItem) => {
    let elementId = "";
    if (item.category === "PARAMETER") {
      if (item.fieldOrId === "durasi_hari") elementId = "field-durasi-hari";
      else if (item.fieldOrId === "jenis_renovasi") elementId = "field-jenis-renovasi";
      else elementId = "section-parameter";
    } else if (item.category === "GAMBAR") {
      if (item.subCategory?.includes("SIPIL_PDF")) elementId = "field-gambar-sipil-pdf";
      else if (item.subCategory?.includes("SIPIL_DWG")) elementId = "field-gambar-sipil-dwg";
      else if (item.subCategory?.includes("ME_PDF")) elementId = "field-gambar-me-pdf";
      else if (item.subCategory?.includes("ME_DWG")) elementId = "field-gambar-me-dwg";
      else elementId = "section-gambar-kerja";
    } else if (item.category === "FOTO") {
      elementId = "section-foto-lingkungan";
    } else if (item.category === "RAB") {
      elementId = "section-rab";
    }

    if (elementId) {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-4", "ring-[#E65F2B]/40", "rounded-xl", "transition-all", "duration-500");
        setTimeout(() => {
          el.classList.remove("ring-4", "ring-[#E65F2B]/40");
        }, 2200);
      }
    }
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col w-full h-full overflow-hidden">
      {/* SCROLLABLE FORM CONTENT */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 md:p-5 lg:p-6">
        <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-6 animate-in fade-in duration-300">
          {/* Top Header & Breadcrumb */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 lg:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setBackModalOpen(true)}
                className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                title="Kembali ke daftar renovasi"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold tracking-wider text-[#E65F2B] uppercase bg-[#E65F2B]/10 px-2 py-0.5 rounded-md">
                    {loadedDraft?.status === "REVISI"
                      ? "Formulir Revisi Pengajuan"
                      : canEdit
                        ? "Proses Form Input (Maker)"
                        : "Mode Peninjau (Read Only)"}
                  </span>
                  <span className="text-xs text-slate-400">&bull;</span>
                  <span className="text-xs text-slate-500 font-medium">{user?.role || "Branch Building Koordinator"}</span>
                </div>
                <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                  {loadedDraft?.status === "REVISI"
                    ? "Revisi Pengajuan Renovasi Bangunan DC"
                    : "Pengajuan Renovasi Bangunan DC"}
                </h1>
              </div>
            </div>
          </div>

          {/* Banner Peringatan Status REVISI */}
          {loadedDraft?.status === "REVISI" && (
            <RevisionInstructionBanner
              nomorPengajuan={loadedDraft.nomor_pengajuan}
              instructionNotes={revisionNotesList}
              flaggedItems={flaggedItemsEvaluation.items}
              totalCount={flaggedItemsEvaluation.totalCount}
              modifiedCount={flaggedItemsEvaluation.modifiedCount}
              allModified={flaggedItemsEvaluation.allModified}
              onViewAllNotesModal={() => setRevisionNotesModalOpen(true)}
              onJumpToItem={handleJumpToItem}
            />
          )}

          {!canEdit && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-950 text-xs shadow-2xs">
              <Eye className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <p className="font-bold text-slate-900">Mode Peninjau (Read Only)</p>
                <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
                  Akun Anda ({user?.role || "Peninjau"}) hanya memiliki hak akses peninjauan. Pembuatan dan perubahan data pengajuan renovasi hanya dapat dilakukan oleh <strong>Branch Building Koordinator</strong> dan <strong>Admin</strong>.
                </p>
              </div>
            </div>
          )}

          {/* SECTION 1: PEMILIHAN PROYEK & IDENTITAS PROYEK */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#E65F2B]/10 text-[#E65F2B] flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Pilih Proyek & Identitas Bangunan
              </h2>
            </div>

            <div className="p-5 lg:p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Pilih Proyek DC / Warehouse / Depo <span className="text-rose-500">*</span>
                </label>
                <SearchableSelectInput
                  value={selectedProjectId}
                  onChange={handleProjectChange}
                  options={projectOptions}
                  disabledIds={lockedProjectIds}
                  placeholder="Cari kode proyek, nama DC, cabang, tipe..."
                />
                <p className="text-[11px] text-slate-500">
                  *Mencakup seluruh jenis properti: DC Induk, Warehouse, Depo, Bulky, Store-Hub, Gudang Anak.
                </p>
              </div>

              {/* Banner Peringatan: Proyek Sedang Memiliki Renovasi Berjalan */}
              {isProjectLocked && selectedProject?.active_renovasi && (
                <div className="bg-amber-50/80 border border-amber-300 rounded-2xl p-4.5 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300 shadow-xs">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                          Pengajuan Renovasi Terkunci
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300/80 uppercase">
                          {selectedProject.active_renovasi.status}
                        </span>
                        <span className="text-[11px] font-mono font-medium text-slate-600 bg-white/80 px-2 py-0.5 rounded border border-amber-200">
                          {selectedProject.active_renovasi.nomor_pengajuan}
                        </span>
                      </div>
                      <p className="text-xs text-amber-900/90 leading-relaxed">
                        Proyek DC ini saat ini sedang memiliki pengajuan renovasi aktif yang belum berstatus <strong>SELESAI</strong>. Pengajuan baru tidak dapat dibuat untuk DC ini hingga renovasi sebelumnya dinyatakan selesai.
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-amber-800/80">
                        <span>Diajukan oleh: <b>{selectedProject.active_renovasi.created_by}</b></span>
                        <span>&bull;</span>
                        <span>
                          {new Date(selectedProject.active_renovasi.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 w-full md:w-auto flex items-center justify-end">
                    {selectedProject.active_renovasi.status === "DRAFT" || selectedProject.active_renovasi.status === "REVISI" ? (
                      <Button
                        type="button"
                        onClick={() => router.push(`/dc-development/renovasi/tambah?draftId=${selectedProject.active_renovasi?.id}`)}
                        className="w-full md:w-auto bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs h-9 px-4 font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Lanjutkan Draft Ini</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => router.push("/dc-development/renovasi")}
                        variant="outline"
                        className="w-full md:w-auto border-amber-300 text-amber-950 hover:bg-amber-100/70 rounded-xl text-xs h-9 px-4 font-bold cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Lihat di Daftar Renovasi</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Tampilan Identitas Proyek Terpilih */}
              {selectedProject ? (
                <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 lg:p-5 mt-2 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                      <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                        {selectedProject.kode} &bull; {selectedProject.nama_proyek}
                      </h3>
                      {selectedProject.inisial && (
                        <span className="text-xs font-semibold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                          ({selectedProject.inisial})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-orange-100 text-orange-800 border border-orange-200 uppercase">
                        {selectedProject.tipe || "DC"}
                      </span>
                      <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-200/80 text-slate-700 uppercase">
                        Cabang {selectedProject.cabang}
                      </span>
                    </div>
                  </div>

                  {/* Grid Spesifikasi Proyek */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div className="bg-white p-3 rounded-lg border border-slate-200/60">
                      <span className="text-slate-400 font-medium block mb-1">Total Luas Bangunan</span>
                      <span className="text-slate-800 font-bold text-sm">
                        {selectedProject.total_luas_bangunan
                          ? `${selectedProject.total_luas_bangunan.toLocaleString("id-ID")} m²`
                          : "-"}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200/60">
                      <span className="text-slate-400 font-medium block mb-1">Luas Lahan</span>
                      <span className="text-slate-800 font-bold text-sm">
                        {selectedProject.luas_lahan
                          ? `${selectedProject.luas_lahan.toLocaleString("id-ID")} m²`
                          : "-"}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200/60">
                      <span className="text-slate-400 font-medium block mb-1">DC Induk</span>
                      <span className="text-slate-800 font-bold text-sm">
                        {selectedProject.dc_induk || "DC INDUK"}
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200/60">
                      <span className="text-slate-400 font-medium block mb-1">Tanggal GO</span>
                      <span className="text-slate-800 font-bold text-sm">
                        {selectedProject.tanggal_go
                          ? new Date(selectedProject.tanggal_go).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                  Pilih proyek di atas untuk menampilkan data identitas bangunan secara otomatis.
                </div>
              )}
            </div>
          </section>

          {/* SECTION 2: PARAMETER PENGAJUAN RENOVASI */}
          <section id="section-parameter" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden scroll-mt-6">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#E65F2B]/10 text-[#E65F2B] flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Parameter Pengajuan Renovasi
              </h2>
            </div>

            <div className="p-5 lg:p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Jenis Renovasi */}
              <div id="field-jenis-renovasi" className="flex flex-col gap-1.5 p-1 rounded-xl transition-all">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Jenis Renovasi <span className="text-rose-500">*</span>
                  </label>
                  {flaggedJenis && (
                    <RevisionPinpointBadge
                      catatan={flaggedJenis.catatan}
                      isModified={isJenisModified}
                      label="Revisi Jenis Renovasi"
                    />
                  )}
                </div>
                <CreatableSelectInput
                  value={jenisRenovasi}
                  onChange={(val) => setJenisRenovasi(toTitleCase(val))}
                  options={presetOptions}
                  formatAs="titleCase"
                  placeholder="Pilih atau ketik jenis renovasi baru..."
                />
                <span className="text-[11px] text-slate-500">
                  *Ketik bebas jika ada jenis baru, otomatis disimpan jadi rekomendasi.
                </span>
              </div>

              {/* Lingkup Pekerjaan */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Lingkup Pekerjaan
                </label>
                <div className="h-11 rounded-xl border border-orange-200 bg-orange-50/60 px-4 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#E65F2B]" />
                    <span className="text-xs font-bold text-[#E65F2B]">
                      Sipil + ME
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-orange-100 shadow-2xs">
                    Standar Penawaran RAB/OE
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  *Mencakup seluruh estimasi pekerjaan Sipil dan Mechanical-Electrical.
                </span>
              </div>

              {/* Durasi Pekerjaan */}
              <div id="field-durasi-hari" className="flex flex-col gap-1.5 p-1 rounded-xl transition-all">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Durasi Pekerjaan <span className="text-rose-500">*</span>
                  </label>
                  {flaggedDurasi && (
                    <RevisionPinpointBadge
                      catatan={flaggedDurasi.catatan}
                      isModified={isDurasiModified}
                      label="Revisi Durasi Pekerjaan"
                    />
                  )}
                </div>
                <NumberInput
                  value={durasiHari}
                  onChange={(val) => setDurasiHari(val)}
                  placeholder="Contoh: 45"
                  suffix="Hari"
                  className="h-11 text-xs font-bold text-slate-800"
                  containerClassName="h-11"
                  min={1}
                />
                <span className="text-[11px] text-slate-500">
                  *Estimasi total hari pengerjaan di lapangan.
                </span>
              </div>

              {/* Catatan Bebas Pengajuan */}
              <div className="md:col-span-3 flex flex-col gap-1.5 pt-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Catatan / Latar Belakang Pengajuan (Opsional)
                </label>
                <Input
                  value={catatanPengajuan}
                  onChange={(e) => setCatatanPengajuan(e.target.value)}
                  onBlur={(e) => setCatatanPengajuan(toTitleCase(e.target.value))}
                  placeholder="Contoh: Renovasi perluasan loading dock sisi timur guna mengakomodasi penambahan 5 armada tronton..."
                  className="h-11 border-slate-200 text-sm"
                />
              </div>
            </div>
          </section>

          {/* SECTION 3: UPLOAD GAMBAR TEKNIS (SIPIL & ME) */}
          <section id="section-gambar-kerja" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden scroll-mt-6">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#E65F2B]/10 text-[#E65F2B] flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    Gambar Teknis (Sipil & ME)
                  </h2>
                  <span className="text-[11px] text-slate-500">
                    Wajib melampirkan 4 berkas gambar kerja teknis: Sipil (PDF &amp; DWG) serta ME (PDF &amp; DWG).
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200/80 text-[11px] font-semibold">
                  <FileText className="w-3 h-3 text-rose-500" /> PDF (.pdf)
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[11px] font-semibold">
                  <FileCode2 className="w-3 h-3 text-indigo-600" /> AutoCAD (.dwg)
                </span>
              </div>
            </div>

            <div className="p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* KOLOM 1: GAMBAR KERJA ARSITEKTUR & SIPIL (PDF & DWG) */}
              <div className="flex flex-col gap-4 p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-slate-50/30">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                      <FileCode2 className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Gambar Arsitektur &amp; Sipil
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                    {[docsSipilPdf.length > 0, docsSipilDwg.length > 0].filter(Boolean).length}/2 Berkas Terunggah
                  </span>
                </div>

                {/* Slot 1: Sipil PDF */}
                <div id="field-gambar-sipil-pdf" className="flex flex-col gap-2 p-1 rounded-xl transition-all">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                      <FileText className="w-3.5 h-3.5 text-rose-500" />
                      <span>Gambar Sipil (PDF)</span>
                      <span className="text-rose-500">*</span>
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded border border-rose-200">
                        PDF
                      </span>
                      {flaggedSipilPdf && (
                        <RevisionPinpointBadge
                          catatan={flaggedSipilPdf.catatan}
                          isModified={isSipilPdfModified}
                          label="Revisi Gambar Sipil (PDF)"
                        />
                      )}
                    </label>
                    {docsSipilPdf.length > 0 ? (
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Terunggah
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400">
                        Hanya berkas .pdf
                      </span>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputSipilPdfRef}
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      handleUploadGambarTeknis(e.target.files, "GAMBAR_SIPIL_PDF");
                      e.target.value = "";
                    }}
                    className="hidden"
                  />

                  {docsSipilPdf.length === 0 ? (
                    <div
                      onClick={() => fileInputSipilPdfRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleUploadGambarTeknis(e.dataTransfer.files, "GAMBAR_SIPIL_PDF");
                      }}
                      className="border-2 border-dashed border-slate-200 hover:border-rose-400 rounded-xl p-4 text-center cursor-pointer transition-all duration-200 bg-white hover:bg-rose-50/20 flex flex-col items-center justify-center gap-1.5 group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200/80 group-hover:bg-rose-100 flex items-center justify-center text-rose-500 transition-colors shadow-2xs">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700 group-hover:text-rose-600 transition-colors">
                          Pilih atau seret berkas <span className="text-rose-600">PDF Sipil</span>
                        </p>
                        <span className="text-[10px] text-slate-400">Hanya format PDF (.pdf) &bull; Maks. 1 berkas</span>
                      </div>
                    </div>
                  ) : docsSipilPdf[0].uploading ? (
                    <div className="border border-orange-200 bg-orange-50/50 rounded-xl p-4 flex items-center justify-center gap-3 animate-pulse">
                      <Loader2 className="w-5 h-5 text-[#E65F2B] animate-spin shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-800">Mengunggah ke Google Drive...</span>
                        <span className="text-[11px] text-slate-500 truncate max-w-xs">{docsSipilPdf[0].nama_file}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="group relative border border-slate-200 hover:border-rose-400 bg-white hover:bg-rose-50/10 rounded-xl p-3.5 transition-all duration-200 shadow-2xs hover:shadow-sm flex items-center justify-between gap-3">
                      <a
                        href={docsSipilPdf[0].file_url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 min-w-0 flex-1 group/link cursor-pointer"
                        title="Klik untuk membuka dokumen di Google Drive"
                      >
                        <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 text-rose-600 group-hover/link:bg-rose-500 group-hover/link:text-white transition-all duration-200 shadow-2xs">
                          <FileText className="w-4.5 h-4.5" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 group-hover/link:text-rose-600 transition-colors truncate">
                              {docsSipilPdf[0].nama_file}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover/link:text-rose-600 shrink-0 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> Tersimpan di Drive
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 group-hover/link:text-rose-600 transition-colors">
                              Klik untuk melihat ↗
                            </span>
                          </div>
                        </div>
                      </a>

                      <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-slate-100">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            fileInputSipilPdfRef.current?.click();
                          }}
                          className="h-7.5 px-2 text-xs font-semibold text-slate-700 border-slate-200 hover:border-rose-400 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1"
                          title="Ganti Berkas PDF"
                        >
                          <Upload className="w-3 h-3" />
                          <span className="hidden sm:inline">Ganti</span>
                        </Button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDocsSipilPdf([]);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Berkas"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Slot 2: Sipil DWG */}
                <div id="field-gambar-sipil-dwg" className="flex flex-col gap-2 p-1 rounded-xl transition-all">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                      <FileCode2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Gambar Sipil (AutoCAD DWG)</span>
                      <span className="text-rose-500">*</span>
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded border border-indigo-200">
                        DWG
                      </span>
                      {flaggedSipilDwg && (
                        <RevisionPinpointBadge
                          catatan={flaggedSipilDwg.catatan}
                          isModified={isSipilDwgModified}
                          label="Revisi Gambar Sipil (DWG)"
                        />
                      )}
                    </label>
                    {docsSipilDwg.length > 0 ? (
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Terunggah
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400">
                        Hanya berkas .dwg
                      </span>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputSipilDwgRef}
                    accept=".dwg,.dxf"
                    onChange={(e) => {
                      handleUploadGambarTeknis(e.target.files, "GAMBAR_SIPIL_DWG");
                      e.target.value = "";
                    }}
                    className="hidden"
                  />

                  {docsSipilDwg.length === 0 ? (
                    <div
                      onClick={() => fileInputSipilDwgRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleUploadGambarTeknis(e.dataTransfer.files, "GAMBAR_SIPIL_DWG");
                      }}
                      className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 text-center cursor-pointer transition-all duration-200 bg-white hover:bg-indigo-50/20 flex flex-col items-center justify-center gap-1.5 group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200/80 group-hover:bg-indigo-100 flex items-center justify-center text-indigo-600 transition-colors shadow-2xs">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                          Pilih atau seret berkas <span className="text-indigo-600">AutoCAD DWG Sipil</span>
                        </p>
                        <span className="text-[10px] text-slate-400">Hanya format AutoCAD (.dwg) &bull; Maks. 1 berkas</span>
                      </div>
                    </div>
                  ) : docsSipilDwg[0].uploading ? (
                    <div className="border border-orange-200 bg-orange-50/50 rounded-xl p-4 flex items-center justify-center gap-3 animate-pulse">
                      <Loader2 className="w-5 h-5 text-[#E65F2B] animate-spin shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-800">Mengunggah ke Google Drive...</span>
                        <span className="text-[11px] text-slate-500 truncate max-w-xs">{docsSipilDwg[0].nama_file}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="group relative border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/10 rounded-xl p-3.5 transition-all duration-200 shadow-2xs hover:shadow-sm flex items-center justify-between gap-3">
                      <a
                        href={docsSipilDwg[0].file_url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 min-w-0 flex-1 group/link cursor-pointer"
                        title="Klik untuk membuka dokumen di Google Drive"
                      >
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0 text-indigo-600 group-hover/link:bg-indigo-600 group-hover/link:text-white transition-all duration-200 shadow-2xs">
                          <FileCode2 className="w-4.5 h-4.5" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 group-hover/link:text-indigo-600 transition-colors truncate">
                              {docsSipilDwg[0].nama_file}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover/link:text-indigo-600 shrink-0 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> Tersimpan di Drive
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 group-hover/link:text-indigo-600 transition-colors">
                              Klik untuk melihat ↗
                            </span>
                          </div>
                        </div>
                      </a>

                      <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-slate-100">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            fileInputSipilDwgRef.current?.click();
                          }}
                          className="h-7.5 px-2 text-xs font-semibold text-slate-700 border-slate-200 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1"
                          title="Ganti Berkas DWG"
                        >
                          <Upload className="w-3 h-3" />
                          <span className="hidden sm:inline">Ganti</span>
                        </Button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDocsSipilDwg([]);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Berkas"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* KOLOM 2: GAMBAR KERJA MEKANIKAL & ELEKTRIKAL (PDF & DWG) */}
              <div className="flex flex-col gap-4 p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-slate-50/30">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <FileCode2 className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Gambar Mekanikal &amp; Elektrikal (ME)
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                    {[docsMePdf.length > 0, docsMeDwg.length > 0].filter(Boolean).length}/2 Berkas Terunggah
                  </span>
                </div>

                {/* Slot 3: ME PDF */}
                <div id="field-gambar-me-pdf" className="flex flex-col gap-2 p-1 rounded-xl transition-all">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                      <FileText className="w-3.5 h-3.5 text-rose-500" />
                      <span>Gambar ME (PDF)</span>
                      <span className="text-rose-500">*</span>
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded border border-rose-200">
                        PDF
                      </span>
                      {flaggedMePdf && (
                        <RevisionPinpointBadge
                          catatan={flaggedMePdf.catatan}
                          isModified={isMePdfModified}
                          label="Revisi Gambar ME (PDF)"
                        />
                      )}
                    </label>
                    {docsMePdf.length > 0 ? (
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Terunggah
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400">
                        Hanya berkas .pdf
                      </span>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputMePdfRef}
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      handleUploadGambarTeknis(e.target.files, "GAMBAR_ME_PDF");
                      e.target.value = "";
                    }}
                    className="hidden"
                  />

                  {docsMePdf.length === 0 ? (
                    <div
                      onClick={() => fileInputMePdfRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleUploadGambarTeknis(e.dataTransfer.files, "GAMBAR_ME_PDF");
                      }}
                      className="border-2 border-dashed border-slate-200 hover:border-rose-400 rounded-xl p-4 text-center cursor-pointer transition-all duration-200 bg-white hover:bg-rose-50/20 flex flex-col items-center justify-center gap-1.5 group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200/80 group-hover:bg-rose-100 flex items-center justify-center text-rose-500 transition-colors shadow-2xs">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700 group-hover:text-rose-600 transition-colors">
                          Pilih atau seret berkas <span className="text-rose-600">PDF ME</span>
                        </p>
                        <span className="text-[10px] text-slate-400">Hanya format PDF (.pdf) &bull; Maks. 1 berkas</span>
                      </div>
                    </div>
                  ) : docsMePdf[0].uploading ? (
                    <div className="border border-orange-200 bg-orange-50/50 rounded-xl p-4 flex items-center justify-center gap-3 animate-pulse">
                      <Loader2 className="w-5 h-5 text-[#E65F2B] animate-spin shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-800">Mengunggah ke Google Drive...</span>
                        <span className="text-[11px] text-slate-500 truncate max-w-xs">{docsMePdf[0].nama_file}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="group relative border border-slate-200 hover:border-rose-400 bg-white hover:bg-rose-50/10 rounded-xl p-3.5 transition-all duration-200 shadow-2xs hover:shadow-sm flex items-center justify-between gap-3">
                      <a
                        href={docsMePdf[0].file_url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 min-w-0 flex-1 group/link cursor-pointer"
                        title="Klik untuk membuka dokumen di Google Drive"
                      >
                        <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 text-rose-600 group-hover/link:bg-rose-500 group-hover/link:text-white transition-all duration-200 shadow-2xs">
                          <FileText className="w-4.5 h-4.5" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 group-hover/link:text-rose-600 transition-colors truncate">
                              {docsMePdf[0].nama_file}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover/link:text-rose-600 shrink-0 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> Tersimpan di Drive
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 group-hover/link:text-rose-600 transition-colors">
                              Klik untuk melihat ↗
                            </span>
                          </div>
                        </div>
                      </a>

                      <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-slate-100">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            fileInputMePdfRef.current?.click();
                          }}
                          className="h-7.5 px-2 text-xs font-semibold text-slate-700 border-slate-200 hover:border-rose-400 hover:text-rose-600 hover:bg-rose-50/50 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1"
                          title="Ganti Berkas PDF"
                        >
                          <Upload className="w-3 h-3" />
                          <span className="hidden sm:inline">Ganti</span>
                        </Button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDocsMePdf([]);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Berkas"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Slot 4: ME DWG */}
                <div id="field-gambar-me-dwg" className="flex flex-col gap-2 p-1 rounded-xl transition-all">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                      <FileCode2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Gambar ME (AutoCAD DWG)</span>
                      <span className="text-rose-500">*</span>
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded border border-indigo-200">
                        DWG
                      </span>
                      {flaggedMeDwg && (
                        <RevisionPinpointBadge
                          catatan={flaggedMeDwg.catatan}
                          isModified={isMeDwgModified}
                          label="Revisi Gambar ME (DWG)"
                        />
                      )}
                    </label>
                    {docsMeDwg.length > 0 ? (
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Terunggah
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400">
                        Hanya berkas .dwg
                      </span>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputMeDwgRef}
                    accept=".dwg,.dxf"
                    onChange={(e) => {
                      handleUploadGambarTeknis(e.target.files, "GAMBAR_ME_DWG");
                      e.target.value = "";
                    }}
                    className="hidden"
                  />

                  {docsMeDwg.length === 0 ? (
                    <div
                      onClick={() => fileInputMeDwgRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleUploadGambarTeknis(e.dataTransfer.files, "GAMBAR_ME_DWG");
                      }}
                      className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-4 text-center cursor-pointer transition-all duration-200 bg-white hover:bg-indigo-50/20 flex flex-col items-center justify-center gap-1.5 group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200/80 group-hover:bg-indigo-100 flex items-center justify-center text-indigo-600 transition-colors shadow-2xs">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                          Pilih atau seret berkas <span className="text-indigo-600">AutoCAD DWG ME</span>
                        </p>
                        <span className="text-[10px] text-slate-400">Hanya format AutoCAD (.dwg) &bull; Maks. 1 berkas</span>
                      </div>
                    </div>
                  ) : docsMeDwg[0].uploading ? (
                    <div className="border border-orange-200 bg-orange-50/50 rounded-xl p-4 flex items-center justify-center gap-3 animate-pulse">
                      <Loader2 className="w-5 h-5 text-[#E65F2B] animate-spin shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-slate-800">Mengunggah ke Google Drive...</span>
                        <span className="text-[11px] text-slate-500 truncate max-w-xs">{docsMeDwg[0].nama_file}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="group relative border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/10 rounded-xl p-3.5 transition-all duration-200 shadow-2xs hover:shadow-sm flex items-center justify-between gap-3">
                      <a
                        href={docsMeDwg[0].file_url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 min-w-0 flex-1 group/link cursor-pointer"
                        title="Klik untuk membuka dokumen di Google Drive"
                      >
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0 text-indigo-600 group-hover/link:bg-indigo-600 group-hover/link:text-white transition-all duration-200 shadow-2xs">
                          <FileCode2 className="w-4.5 h-4.5" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 group-hover/link:text-indigo-600 transition-colors truncate">
                              {docsMeDwg[0].nama_file}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover/link:text-indigo-600 shrink-0 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> Tersimpan di Drive
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 group-hover/link:text-indigo-600 transition-colors">
                              Klik untuk melihat ↗
                            </span>
                          </div>
                        </div>
                      </a>

                      <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-slate-100">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            fileInputMeDwgRef.current?.click();
                          }}
                          className="h-7.5 px-2 text-xs font-semibold text-slate-700 border-slate-200 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1"
                          title="Ganti Berkas DWG"
                        >
                          <Upload className="w-3 h-3" />
                          <span className="hidden sm:inline">Ganti</span>
                        </Button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDocsMeDwg([]);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Berkas"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: FOTO LINGKUNGAN (UPLOAD / KAMERA LIVE + WATERMARK) */}
          <section id="section-foto-lingkungan" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden scroll-mt-6">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#E65F2B]/10 text-[#E65F2B] flex items-center justify-center font-bold text-xs">
                  4
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1">
                    Foto Lingkungan &amp; Eksisting <span className="text-rose-500">*</span>
                  </h2>
                  <span className="text-[11px] text-slate-500">
                    Wajib minimal 1 foto (kamera watermark / unggah file). Mendukung foto tanpa batas.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputFotoRef}
                  multiple
                  accept="image/*"
                  onChange={(e) => handleSelectFotoFiles(e.target.files)}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputFotoRef.current?.click()}
                  className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-9 rounded-xl font-semibold"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" /> Unggah File Foto
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (!selectedProject) {
                      setFeedback({
                        open: true,
                        type: "error",
                        title: "Pilih Proyek Dahulu",
                        message: "Silakan pilih proyek sebelum mengambil foto kamera."
                      });
                      return;
                    }
                    setCameraModalOpen(true);
                  }}
                  className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs h-9 rounded-xl font-semibold shadow-xs"
                >
                  <Camera className="w-3.5 h-3.5 mr-1.5" /> Kamera
                </Button>
              </div>
            </div>

            <div className="p-5 lg:p-6">
              {fotosLingkungan.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center flex flex-col items-center justify-center gap-2">
                  <Camera className="w-8 h-8 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">Belum ada foto lingkungan</p>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Klik tombol "Kamera" untuk mengambil foto langsung di lapangan dengan cetakan GPS & tanggal jam otomatis, atau "Unggah File Foto".
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fotosLingkungan.map((foto, index) => {
                    const rawName = foto.nama_label?.trim()
                      ? foto.nama_label
                      : (foto.nama_file ? foto.nama_file.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ") : `Foto Lingkungan #${index + 1}`);
                    const displayName = toTitleCase(rawName);

                    const flaggedFoto = flaggedRevisionItems.find(
                      (f) =>
                        f.category === "FOTO" &&
                        (f.fieldOrId === String(foto.id) ||
                          f.fieldOrId === foto.nama_file ||
                          f.initialValue === foto.nama_file)
                    );
                    const isFotoMod = flaggedFoto ? isRevisionItemModified(flaggedFoto) : true;

                    return (
                      <div
                        key={foto.id}
                        className={cn(
                          "group relative bg-white border rounded-2xl p-3.5 flex flex-col justify-between gap-3 shadow-2xs hover:shadow-xs transition-all duration-200",
                          flaggedFoto && !isFotoMod
                            ? "border-amber-300 ring-2 ring-amber-300/40 bg-amber-50/15"
                            : "border-slate-200 hover:border-slate-300"
                        )}
                      >
                        {/* Header Item: Nomor Foto, GPS Chip, Tombol Hapus */}
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                              Foto #{index + 1}
                            </span>
                            {flaggedFoto && (
                              <RevisionPinpointBadge
                                catatan={flaggedFoto.catatan}
                                isModified={isFotoMod}
                                label={`Revisi Foto #${index + 1}`}
                              />
                            )}
                            {(foto.lokasi_wilayah || (foto.latitude && foto.longitude)) && (
                              <span
                                className="text-[10px] text-slate-500 font-mono flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60 truncate"
                                title={foto.lokasi_wilayah || `${foto.latitude}, ${foto.longitude}`}
                              >
                                <MapPin className="w-2.5 h-2.5 text-[#E65F2B] shrink-0" />
                                <span className="truncate">
                                  {foto.lokasi_wilayah ||
                                    `${foto.latitude?.toFixed(4)}, ${foto.longitude?.toFixed(4)}`}
                                </span>
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setFotosLingkungan((prev) => prev.filter((f) => f.id !== foto.id))
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                            title="Hapus foto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Komponen Tautan Drive Langsung (Sesuai Permintaan User) */}
                        {foto.file_url ? (
                          <a
                            href={foto.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="group/link flex items-center gap-3 p-2.5 rounded-xl border border-slate-200/90 hover:border-[#E65F2B] bg-slate-50/60 hover:bg-orange-50/25 transition-all cursor-pointer"
                            title="Klik untuk membuka dokumen di Google Drive"
                          >
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 text-[#E65F2B] group-hover/link:bg-[#E65F2B] group-hover/link:text-white transition-all shadow-2xs">
                              <ImageIcon className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-900 group-hover/link:text-[#E65F2B] transition-colors truncate">
                                  {displayName}
                                </span>
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover/link:text-[#E65F2B] shrink-0 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Tersimpan di Drive
                                </span>
                                <span className="text-[10px] font-medium text-slate-400 group-hover/link:text-[#E65F2B] transition-colors">
                                  Klik untuk melihat ↗
                                </span>
                              </div>
                            </div>
                          </a>
                        ) : (
                          <div className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50 text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin text-[#E65F2B] shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-slate-800 truncate">
                                {displayName}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Sedang mengunggah ke Google Drive...
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Input Label / Nama Keterangan Foto */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                            <span>Nama / Keterangan Foto #{index + 1}</span>
                            {foto.file_url && (
                              <span className="text-[9px] text-[#E65F2B] font-semibold lowercase">
                                (terhubung ke drive)
                              </span>
                            )}
                          </label>
                          <Input
                            value={foto.nama_label || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFotosLingkungan((prev) =>
                                prev.map((f) =>
                                  f.id === foto.id ? { ...f, nama_label: val } : f
                                )
                              );
                            }}
                            onBlur={(e) => {
                              const val = toTitleCase(e.target.value);
                              setFotosLingkungan((prev) =>
                                prev.map((f) =>
                                  f.id === foto.id ? { ...f, nama_label: val } : f
                                )
                              );
                            }}
                            placeholder="Contoh: Tampak Depan Loading Dock"
                            className="h-8.5 text-xs border-slate-200 font-medium focus-visible:ring-[#E65F2B]"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* SECTION 5: RINCIAN ITEM RAB / OE (SIPIL & ME) */}
          <section id="section-rab" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden scroll-mt-6">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#E65F2B]/10 text-[#E65F2B] flex items-center justify-center font-bold text-xs">
                  5
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1">
                    Rincian Estimasi Item RAB / OE <span className="text-rose-500">*</span>
                  </h2>
                  <span className="text-[11px] text-slate-500">
                    Wajib minimal 1 item Sipil dan 1 item ME dengan volume &gt; 0 untuk pengajuan renovasi.
                  </span>
                </div>
              </div>

              {/* Tab Switcher & Dropdown Aksi Buka/Tutup */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs rounded-xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <span>Buka / Tutup</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36 bg-white p-1 rounded-xl shadow-xl border border-slate-200 z-50">
                    <DropdownMenuItem
                      onClick={handleExpandAllCategories}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg cursor-pointer hover:bg-slate-100 text-slate-700 font-medium transition-colors"
                    >
                      <ChevronsDown className="w-3.5 h-3.5 text-[#E65F2B]" />
                      <span>Buka Semua</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleCollapseAllCategories(Object.keys(groupedActiveRabItems))}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg cursor-pointer hover:bg-slate-100 text-slate-700 font-medium transition-colors"
                    >
                      <ChevronsUp className="w-3.5 h-3.5 text-slate-400" />
                      <span>Tutup Semua</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Tab Switcher Sipil vs ME */}
                <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActiveRabTab("SIPIL")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeRabTab === "SIPIL"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    <span>Item Pekerjaan Sipil <span className="text-rose-500">*</span></span>
                    <span className="font-normal opacity-80">({formatRupiah(totalSipil)})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRabTab("ME")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeRabTab === "ME"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    <span>Item Pekerjaan ME <span className="text-rose-500">*</span></span>
                    <span className="font-normal opacity-80">({formatRupiah(totalMe)})</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5 lg:p-6 flex flex-col gap-6">
              {/* Loop Per Kategori Pekerjaan */}
              {Object.keys(groupedActiveRabItems).length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center flex flex-col items-center justify-center gap-3">
                  <HardHat className="w-8 h-8 text-slate-300" />
                  <p className="text-xs font-semibold text-slate-600">
                    Memuat daftar kategori pekerjaan {activeRabTab}...
                  </p>
                </div>
              ) : (
                Object.entries(groupedActiveRabItems).map(([kategori, items]) => {
                  // Master items yang difilter khusus untuk kategori pekerjaan ini
                  const categoryOptions = getMasterItemOptions(kategori);

                  // Subtotal kategori
                  const catTotal = items.reduce(
                    (sum, it) => sum + (Number(it.harga_material) + Number(it.harga_upah)) * Number(it.volume),
                    0
                  );

                  const isCollapsed = !!collapsedCategories[kategori];

                  return (
                    <div
                      key={kategori}
                      className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40 w-full max-w-full transition-all"
                    >
                      {/* Header Kategori - Bisa di klik untuk Buka / Tutup */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleCategory(kategori)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleCategory(kategori);
                          }
                        }}
                        className={cn(
                          "px-4 py-2.5 bg-slate-100 hover:bg-slate-200/70 flex items-center justify-between cursor-pointer select-none transition-colors group",
                          !isCollapsed && "border-b border-slate-200"
                        )}
                        title={isCollapsed ? "Klik untuk membuka kategori" : "Klik untuk menutup kategori"}
                      >
                        <div className="flex items-center gap-2.5">
                          <ChevronDown
                            className={cn(
                              "w-4 h-4 transition-transform duration-200",
                              isCollapsed ? "-rotate-90 text-slate-400 group-hover:text-slate-600" : "rotate-0 text-[#E65F2B]"
                            )}
                          />
                          <span className="w-2 h-2 rounded-full bg-[#E65F2B]" />
                          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                            {kategori}
                          </h3>
                          <span className="text-[11px] text-slate-400 font-medium ml-1">
                            ({items.length} item)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                          <span className="text-slate-400 font-normal">Subtotal:</span>
                          <span className="text-[#E65F2B] font-extrabold">{formatRupiah(catTotal)}</span>
                        </div>
                      </div>

                      {/* Daftar Items di Kategori ini (Hanya tampil jika TIDAK collapsed) */}
                      {!isCollapsed && (
                        <div className="p-3 sm:p-4 flex flex-col gap-3 bg-slate-50/50 w-full max-w-full">
                          {items.length === 0 ? (
                            <div className="py-6 px-4 border border-dashed border-slate-200 rounded-xl bg-white text-center flex flex-col items-center justify-center gap-1">
                              <p className="text-xs text-slate-400 font-medium">Belum ada item di {kategori}</p>
                            </div>
                          ) : (
                            items.map((row, idx) => {
                              const matVol = (Number(row.harga_material) || 0) * (Number(row.volume) || 0);
                              const wgeVol = (Number(row.harga_upah) || 0) * (Number(row.volume) || 0);
                              const totalItem = matVol + wgeVol;

                              const rec = getMasterPriceRecommendation(row.master_item_id, row.deskripsi, kategori);
                              const hasRec = Boolean(rec && (rec.material > 0 || rec.upah > 0));
                              const isMaster = rec?.source === "master" || (!row.is_custom && Boolean(row.master_item_id));
                              const recMat = rec ? rec.material : 0;
                              const recUpah = rec ? rec.upah : 0;
                              const recLabel = isMaster ? "Master" : "Riwayat";
                              const isMatCustomized = hasRec && recMat > 0 && Number(row.harga_material) !== recMat;
                              const isUpahCustomized = hasRec && recUpah > 0 && Number(row.harga_upah) !== recUpah;

                              const flaggedRab = flaggedRevisionItems.find(
                                (f) =>
                                  f.category === "RAB" &&
                                  (String(row.dbId) === f.fieldOrId ||
                                    row.id === f.fieldOrId ||
                                    (row.deskripsi &&
                                      f.initialValue?.deskripsi &&
                                      row.deskripsi.trim().toLowerCase() === f.initialValue.deskripsi.trim().toLowerCase()))
                              );
                              const isRabMod = flaggedRab ? isRevisionItemModified(flaggedRab) : true;

                              return (
                                <div
                                  key={row.id}
                                  className={`p-3 sm:p-3.5 bg-white rounded-xl border shadow-2xs flex flex-col gap-2.5 transition-all hover:shadow-xs w-full max-w-full overflow-hidden ${flaggedRab && !isRabMod
                                      ? "border-amber-300 ring-2 ring-amber-300/40 bg-amber-50/15"
                                      : flaggedRab && isRabMod
                                        ? "border-emerald-300/80 bg-emerald-50/10"
                                        : "border-slate-200/90 hover:border-slate-300"
                                    }`}
                                >
                                  {/* Baris 1: Nomor, Selector Item, Subtotal Item, Tombol Hapus */}
                                  <div className="flex items-center gap-2.5 w-full max-w-full overflow-hidden">
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center">
                                        {idx + 1}
                                      </span>
                                      {flaggedRab && (
                                        <RevisionPinpointBadge
                                          catatan={flaggedRab.catatan}
                                          isModified={isRabMod}
                                          label="Revisi Item RAB"
                                        />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                      <RabItemSelector
                                        masterItemId={row.master_item_id}
                                        deskripsi={row.deskripsi}
                                        isCustom={row.is_custom}
                                        options={categoryOptions}
                                        onSelectMasterItem={(val, opt) => handleSelectMasterItem(row.id, val, opt)}
                                        onSetCustomItem={(customText) => handleSetCustomRabItem(row.id, customText)}
                                      />
                                    </div>
                                    <div className="text-right shrink-0 min-w-[110px]">
                                      <span className="text-[10px] text-slate-400 font-medium block">Total Item</span>
                                      <span className="font-extrabold text-slate-900 text-xs sm:text-sm whitespace-nowrap">
                                        {formatRupiah(totalItem)}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRabRow(row.id)}
                                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
                                      title="Hapus Baris"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {/* Baris 2: Harga Material, Harga Upah, Volume, Catatan */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                                    {/* Kolom 1: Harga Material (Selalu dapat diedit, rekomendasi ditampilkan) */}
                                    <div>
                                      <div className="flex items-center justify-between gap-1 mb-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                          Harga Material
                                        </label>
                                        {recMat > 0 ? (
                                          Number(row.harga_material || 0) === 0 ? (
                                            <button
                                              type="button"
                                              onClick={() => handleUpdateRabRow(row.id, "harga_material", recMat)}
                                              className="text-[9px] font-semibold px-1.5 py-0.2 rounded border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 flex items-center gap-0.5 cursor-pointer transition-colors"
                                              title={`Klik untuk mengisi rekomendasi (${formatRupiah(recMat)})`}
                                            >
                                              <Sparkles className="w-2.5 h-2.5 shrink-0" />
                                              Rekomendasi
                                            </button>
                                          ) : isMatCustomized ? (
                                            <span
                                              className="text-[9px] font-semibold px-1.5 py-0.2 rounded border bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-0.5 select-none"
                                              title={`Harga telah disesuaikan dari rekomendasi (${formatRupiah(recMat)})`}
                                            >
                                              <Sparkles className="w-2.5 h-2.5 shrink-0" />
                                              Disesuaikan
                                            </span>
                                          ) : (
                                            <span
                                              className="text-[9px] font-semibold px-1.5 py-0.2 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-0.5 select-none"
                                              title={`Sesuai rekomendasi (${formatRupiah(recMat)})`}
                                            >
                                              <Check className="w-2.5 h-2.5 shrink-0" />
                                              Pas
                                            </span>
                                          )
                                        ) : null}
                                      </div>
                                      <CurrencyInput
                                        disabled={false}
                                        value={row.harga_material || 0}
                                        onChange={(val) => handleUpdateRabRow(row.id, "harga_material", val)}
                                        placeholder={recMat > 0 ? formatRupiahNumber(recMat) : "0"}
                                        className={cn(
                                          "transition-all",
                                          isMatCustomized && Number(row.harga_material || 0) > 0 && "border-amber-300 ring-1 ring-amber-300/30"
                                        )}
                                      />
                                      <div className="flex items-center justify-between mt-1 text-[10px] min-h-[16px]">
                                        {recMat > 0 ? (
                                          <>
                                            <span className="text-slate-400 font-medium truncate" title={`Rekomendasi ${recLabel}: ${formatRupiah(recMat)}`}>
                                              {recLabel}: <span className="font-mono text-slate-600 font-semibold">{formatRupiah(recMat)}</span>
                                            </span>
                                            {Number(row.harga_material || 0) === 0 ? (
                                              <button
                                                type="button"
                                                onClick={() => handleUpdateRabRow(row.id, "harga_material", recMat)}
                                                className="text-[9px] font-bold text-[#E65F2B] hover:text-[#d04e1c] bg-orange-50 hover:bg-orange-100 px-1.5 py-0.5 rounded border border-orange-200 flex items-center gap-0.5 shrink-0 cursor-pointer transition-colors"
                                                title="Terapkan harga rekomendasi"
                                              >
                                                <Sparkles className="w-2.5 h-2.5" />
                                                <span>Terapkan</span>
                                              </button>
                                            ) : isMatCustomized ? (
                                              <button
                                                type="button"
                                                onClick={() => handleUpdateRabRow(row.id, "harga_material", recMat)}
                                                className="text-[9px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 shrink-0 cursor-pointer transition-colors"
                                                title={`Kembalikan ke harga rekomendasi ${recLabel}`}
                                              >
                                                <RotateCcw className="w-2.5 h-2.5" />
                                                <span>Reset</span>
                                              </button>
                                            ) : (
                                              <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-0.5 shrink-0">
                                                <Check className="w-2.5 h-2.5" /> Pas
                                              </span>
                                            )}
                                          </>
                                        ) : null}
                                      </div>
                                      {row.volume > 0 && (
                                        <span className="text-[10px] text-slate-500 font-medium block text-right mt-0.5 font-mono">
                                          Sub: {formatRupiah(matVol)}
                                        </span>
                                      )}
                                    </div>

                                    {/* Kolom 2: Harga Upah (Selalu dapat diedit, rekomendasi ditampilkan) */}
                                    <div>
                                      <div className="flex items-center justify-between gap-1 mb-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                          Harga Upah
                                        </label>
                                        {recUpah > 0 ? (
                                          Number(row.harga_upah || 0) === 0 ? (
                                            <button
                                              type="button"
                                              onClick={() => handleUpdateRabRow(row.id, "harga_upah", recUpah)}
                                              className="text-[9px] font-semibold px-1.5 py-0.2 rounded border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 flex items-center gap-0.5 cursor-pointer transition-colors"
                                              title={`Klik untuk mengisi rekomendasi (${formatRupiah(recUpah)})`}
                                            >
                                              <Sparkles className="w-2.5 h-2.5 shrink-0" />
                                              Rekomendasi
                                            </button>
                                          ) : isUpahCustomized ? (
                                            <span
                                              className="text-[9px] font-semibold px-1.5 py-0.2 rounded border bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-0.5 select-none"
                                              title={`Harga telah disesuaikan dari rekomendasi (${formatRupiah(recUpah)})`}
                                            >
                                              <Sparkles className="w-2.5 h-2.5 shrink-0" />
                                              Disesuaikan
                                            </span>
                                          ) : (
                                            <span
                                              className="text-[9px] font-semibold px-1.5 py-0.2 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-0.5 select-none"
                                              title={`Sesuai rekomendasi (${formatRupiah(recUpah)})`}
                                            >
                                              <Check className="w-2.5 h-2.5 shrink-0" />
                                              Pas
                                            </span>
                                          )
                                        ) : null}
                                      </div>
                                      <CurrencyInput
                                        disabled={false}
                                        value={row.harga_upah || 0}
                                        onChange={(val) => handleUpdateRabRow(row.id, "harga_upah", val)}
                                        placeholder={recUpah > 0 ? formatRupiahNumber(recUpah) : "0"}
                                        className={cn(
                                          "transition-all",
                                          isUpahCustomized && Number(row.harga_upah || 0) > 0 && "border-amber-300 ring-1 ring-amber-300/30"
                                        )}
                                      />
                                      <div className="flex items-center justify-between mt-1 text-[10px] min-h-[16px]">
                                        {recUpah > 0 ? (
                                          <>
                                            <span className="text-slate-400 font-medium truncate" title={`Rekomendasi ${recLabel}: ${formatRupiah(recUpah)}`}>
                                              {recLabel}: <span className="font-mono text-slate-600 font-semibold">{formatRupiah(recUpah)}</span>
                                            </span>
                                            {Number(row.harga_upah || 0) === 0 ? (
                                              <button
                                                type="button"
                                                onClick={() => handleUpdateRabRow(row.id, "harga_upah", recUpah)}
                                                className="text-[9px] font-bold text-[#E65F2B] hover:text-[#d04e1c] bg-orange-50 hover:bg-orange-100 px-1.5 py-0.5 rounded border border-orange-200 flex items-center gap-0.5 shrink-0 cursor-pointer transition-colors"
                                                title="Terapkan harga rekomendasi"
                                              >
                                                <Sparkles className="w-2.5 h-2.5" />
                                                <span>Terapkan</span>
                                              </button>
                                            ) : isUpahCustomized ? (
                                              <button
                                                type="button"
                                                onClick={() => handleUpdateRabRow(row.id, "harga_upah", recUpah)}
                                                className="text-[9px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5 shrink-0 cursor-pointer transition-colors"
                                                title={`Kembalikan ke harga rekomendasi ${recLabel}`}
                                              >
                                                <RotateCcw className="w-2.5 h-2.5" />
                                                <span>Reset</span>
                                              </button>
                                            ) : (
                                              <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-0.5 shrink-0">
                                                <Check className="w-2.5 h-2.5" /> Pas
                                              </span>
                                            )}
                                          </>
                                        ) : null}
                                      </div>
                                      {row.volume > 0 && (
                                        <span className="text-[10px] text-slate-500 font-medium block text-right mt-0.5 font-mono">
                                          Sub: {formatRupiah(wgeVol)}
                                        </span>
                                      )}
                                    </div>

                                    <div>
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                        Volume
                                      </label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={row.volume || ""}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        onChange={(e) =>
                                          handleUpdateRabRow(
                                            row.id,
                                            "volume",
                                            parseFloat(e.target.value) || 0
                                          )
                                        }
                                        placeholder="0"
                                        className="h-8 text-xs text-center font-bold text-slate-900 border-slate-200 focus:border-[#E65F2B] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                        Catatan Spesifikasi
                                      </label>
                                      <Input
                                        value={row.catatan}
                                        onChange={(e) =>
                                          handleUpdateRabRow(row.id, "catatan", e.target.value)
                                        }
                                        onBlur={(e) =>
                                          handleUpdateRabRow(row.id, "catatan", toTitleCase(e.target.value))
                                        }
                                        placeholder="Keterangan..."
                                        className="h-8 text-xs border-slate-200 placeholder:text-slate-400"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}

                          {/* Tombol Tambah Item di bawah item terakhir */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddRabRow(kategori)}
                            className="w-full h-9 rounded-xl border-dashed border-slate-300 hover:border-[#E65F2B] hover:text-[#E65F2B] hover:bg-[#E65F2B]/5 text-xs text-slate-600 font-semibold transition-all mt-1"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1.5" /> Tambah Item di {kategori}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {/* DOCKED SOLID BOTTOM BAR (SECARA FISIK BERADA DI DASAR FRAME, 100% TIDAK PERNAH TEMBUS KONTEN DI BAWAHNYA) */}
      <div className="shrink-0 bg-white border-t border-slate-200/90 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] py-3 px-4 sm:px-6 z-20 w-full">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
              <span className="text-slate-400 text-[11px] font-medium">Subtotal Sipil:</span>
              <span className="font-bold text-slate-800 font-mono">{formatRupiah(totalSipil)}</span>
              <span className="text-slate-300 mx-1">•</span>
              <span className="text-slate-400 text-[11px] font-medium">Subtotal ME:</span>
              <span className="font-bold text-slate-800 font-mono">{formatRupiah(totalMe)}</span>
              <span className="text-slate-300 mx-1">•</span>
              <span className="text-slate-400 text-[11px] font-medium">PPN 11%:</span>
              <span className="font-bold text-slate-800 font-mono">{formatRupiah(nilaiPpn)}</span>
              <span className="text-slate-300 mx-1">•</span>
              <span className="text-slate-400 text-[11px] font-medium">Pembulatan:</span>
              <span className="font-bold text-slate-800 font-mono">{formatRupiah(nilaiPembulatan)}</span>
            </div>
            <div className="flex items-center gap-2 bg-orange-50 px-3.5 py-1.5 rounded-xl border border-orange-200/80">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">GRAND TOTAL:</span>
              <span className="font-extrabold text-[#E65F2B] text-base sm:text-lg font-mono">
                {formatRupiah(grandTotal)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {canEdit ? (
              <>
                {/* Tombol Batal / Hapus Pengisian */}
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => setCancelModalOpen(true)}
                  className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 rounded-xl text-xs h-10 px-3.5 font-semibold transition-colors cursor-pointer"
                  title="Batalkan pengisian dan kosongkan seluruh data"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  {existingDraftId ? "Hapus Draft" : "Batal / Hapus"}
                </Button>

                {isProjectLocked && (
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shrink-0">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    Proyek Terkunci (Ada Renovasi Aktif)
                  </span>
                )}

                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting || isProjectLocked}
                  onClick={() => handleSubmit("DRAFT")}
                  className="border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs h-10 px-4 font-semibold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  {loadedDraft?.status === "REVISI" ? "Simpan Draf Revisi" : "Simpan Draft"}
                </Button>
                <Button
                  type="button"
                  disabled={isSubmitting || !selectedProjectId || isProjectLocked}
                  onClick={() => {
                    if (isProjectLocked) {
                      setFeedback({
                        open: true,
                        type: "error",
                        title: "Proyek Sedang Terkunci",
                        message: "Proyek DC ini sedang memiliki pengajuan renovasi aktif yang belum berstatus SELESAI. Anda tidak dapat mengajukan renovasi baru."
                      });
                      return;
                    }
                    if (!selectedProjectId) {
                      setFeedback({
                        open: true,
                        type: "error",
                        title: "Pilih Proyek DC Terlebih Dahulu",
                        message: "Silakan pilih Proyek DC sebelum melakukan review pengajuan."
                      });
                      return;
                    }
                    if (loadedDraft?.status === "REVISI") {
                      if (flaggedRevisionItems.length > 0) {
                        if (!flaggedItemsEvaluation.allModified) {
                          const unmodList = flaggedItemsEvaluation.unmodifiedItems
                            .map((u, i) => `${i + 1}. ${u.label}: "${u.catatan}"`)
                            .join("\n");
                          setFeedback({
                            open: true,
                            type: "error",
                            title: "Poin Revisi Belum Lengkap Diperbaiki",
                            message: `Terdapat ${flaggedItemsEvaluation.unmodifiedItems.length} bagian yang ditandai revisi oleh peninjau namun belum diubah:\n\n${unmodList}\n\nSeluruh bagian yang ditandai revisi wajib diubah minimal satu kali sebelum dapat diajukan ulang.`
                          });
                          return;
                        }
                      } else if (!checkHasChanges()) {
                        setFeedback({
                          open: true,
                          type: "error",
                          title: "Wajib Melakukan Perubahan",
                          message: "Untuk mengajukan ulang revisi ini, Anda wajib melakukan minimal satu perubahan pada data pengajuan (parameter proyek, durasi, dokumen gambar teknik, foto lingkungan, atau rincian item RAB)."
                        });
                        return;
                      }
                    }
                    setReviewModalOpen(true);
                  }}
                  className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white rounded-xl text-xs h-10 px-5 font-bold shadow-md shadow-[#E65F2B]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isProjectLocked ? "Proyek DC sedang terkunci" : "Review dan periksa seluruh kelengkapan isian sebelum diajukan"}
                >
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  {loadedDraft?.status === "REVISI" ? "Review Revisi" : "Review Pengajuan"}
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mode Peninjau (Read Only)</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dc-development/renovasi")}
                  className="border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs h-10 px-4 font-semibold"
                >
                  Kembali ke Daftar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Batal / Hapus */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md p-6 rounded-2xl bg-white border border-slate-200 text-center flex flex-col items-center z-50">
          <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mb-4 shadow-sm">
            <Trash2 className="w-7 h-7" />
          </div>
          <DialogTitle className="text-lg font-extrabold text-slate-900 mb-2">
            {existingDraftId ? "Hapus Draft Pengajuan?" : "Batalkan & Hapus Data Formulir?"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-medium leading-relaxed mb-6">
            {existingDraftId
              ? "Draft pengajuan ini beserta seluruh rincian item RAB, dokumen gambar sipil/ME, foto lingkungan, dan catatan akan dihapus permanen dari database."
              : "Seluruh data yang telah dipilih atau diisi (proyek, jenis renovasi, durasi, dokumen gambar teknik, foto lingkungan, catatan, dan item RAB) akan otomatis dihapus dan dikosongkan."}
          </DialogDescription>
          <div className="flex items-center gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setCancelModalOpen(false)}
              className="flex-1 h-10 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Lanjutkan Pengisian
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleExecuteDelete}
              className="flex-1 h-10 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Ya, Hapus Data
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Konfirmasi Tombol Back: Pilihan Simpan Draft atau Hapus */}
      <Dialog open={backModalOpen} onOpenChange={setBackModalOpen}>
        <DialogContent className="sm:max-w-md p-6 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50">
          <div className="flex items-center gap-3.5 mb-2">
            <div className="w-11 h-11 rounded-xl bg-[#E65F2B]/10 border border-[#E65F2B]/20 text-[#E65F2B] flex items-center justify-center shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                Keluar dari Pengajuan?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium">
                Pilih apakah kamu ingin menyimpan data ini sebagai draft atau menghapusnya:
              </DialogDescription>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 my-4">
            {/* Opsi 1: Simpan sebagai Draft */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={async () => {
                setBackModalOpen(false);
                await handleSubmit("DRAFT");
              }}
              className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 hover:border-emerald-300 transition-all text-left flex items-start gap-3.5 group cursor-pointer shadow-2xs"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Save className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-950 group-hover:text-emerald-700">
                    {loadedDraft?.status === "REVISI" ? "Simpan Draf Revisi" : "Simpan sebagai Draft"}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                    Simpan
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800/80 mt-0.5 leading-snug">
                  {loadedDraft?.status === "REVISI"
                    ? "Simpan perubahan revisi saat ini tanpa mengubah status (status tetap REVISI)."
                    : "Simpan semua isian, gambar, foto, dan item RAB agar dapat dilanjutkan kapan saja."}
                </p>
              </div>
            </button>

            {/* Opsi 2: Hapus Data / Batalkan */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleExecuteDelete}
              className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-50 hover:border-rose-300 transition-all text-left flex items-start gap-3.5 group cursor-pointer shadow-2xs"
            >
              <div className="w-9 h-9 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-950 group-hover:text-rose-700">
                    {existingDraftId ? "Hapus Draft Permanen" : "Hapus & Buang Isian"}
                  </span>
                  <span className="text-[10px] font-semibold text-rose-600 bg-rose-100/70 px-2 py-0.5 rounded-full">
                    Hapus
                  </span>
                </div>
                <p className="text-[11px] text-rose-800/80 mt-0.5 leading-snug">
                  {existingDraftId
                    ? "Hapus draft ini beserta dokumen dan seluruh item RAB dari database."
                    : "Kosongkan seluruh isian formulir dan keluar tanpa menyimpan apa pun."}
                </p>
              </div>
            </button>
          </div>

          {/* Tombol Lanjutkan Pengisian (Batal Keluar) */}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setBackModalOpen(false)}
              className="text-xs h-9 px-4 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Lanjutkan Pengisian
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Kamera Watermark */}
      <CameraWatermarkModal
        open={cameraModalOpen}
        onOpenChange={setCameraModalOpen}
        projectName={selectedProject?.nama_proyek || "DC Development"}
        branchName={selectedProject?.cabang || "Cabang"}
        onPhotoCaptured={handlePhotoCaptured}
      />

      {/* Modal Review Pengajuan */}
      <ReviewRenovasiModal
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        selectedProject={selectedProject}
        jenisRenovasi={toTitleCase(jenisRenovasi)}
        lingkupPekerjaan={lingkupPekerjaan}
        durasiHari={durasiHari}
        catatanPengajuan={catatanPengajuan ? toTitleCase(catatanPengajuan) : ""}
        docsSipil={[...docsSipilPdf, ...docsSipilDwg]}
        docsMe={[...docsMePdf, ...docsMeDwg]}
        fotosLingkungan={fotosLingkungan}
        rabItems={rabItems.map((r) => ({
          ...r,
          catatan: r.catatan ? toTitleCase(r.catatan) : ""
        }))}
        totalSipil={totalSipil}
        totalMe={totalMe}
        totalSebelumPpn={totalSebelumPpn}
        nilaiPpn={nilaiPpn}
        nilaiPembulatan={nilaiPembulatan}
        grandTotal={grandTotal}
        isSubmitting={isSubmitting}
        isRevision={loadedDraft?.status === "REVISI"}
        onBackToEdit={() => setReviewModalOpen(false)}
        onConfirmSubmit={async () => {
          setReviewModalOpen(false);
          await handleSubmit("MENUNGGU APPROVAL B&M MANAGER");
        }}
      />

      {/* Modal Penamaan Foto Lingkungan Sebelum Upload ke Drive */}
      <UploadFotoLingkunganModal
        open={uploadFotoModalOpen}
        onOpenChange={(open) => {
          if (!isUploadingFotos) {
            setUploadFotoModalOpen(open);
            if (!open) setPendingFotoFiles([]);
          }
        }}
        files={pendingFotoFiles}
        isUploading={isUploadingFotos}
        uploadProgress={fotoUploadProgress}
        onConfirmUpload={handleConfirmUploadFotos}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        open={feedback.open}
        onClose={() => {
          setFeedback((prev) => ({ ...prev, open: false }));
          if (feedback.onOk) feedback.onOk();
        }}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
      />

      {/* Modal Riwayat Catatan Revisi Lengkap */}
      <ApprovalNotesHistoryModal
        open={revisionNotesModalOpen}
        onOpenChange={setRevisionNotesModalOpen}
        renovasi={loadedDraft}
        mode="revisi"
      />
    </div>
  );
}
