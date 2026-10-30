"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatRupiah, cn, toTitleCase } from "@/lib/utils";
import { getNextApprovalStatus, getNextFungsiRuangApprovalStatus } from "@/lib/permissions";
import { RevisionDetailItem } from "@/lib/types/renovasi-revision";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  SlidersHorizontal,
  FileCode2,
  Camera,
  Coins,
  ChevronDown,
  ChevronUp,
  Search,
  ExternalLink,
  Check,
  RotateCcw,
  User,
  PenTool,
  FileText,
  Upload
} from "lucide-react";
import { useSession } from "@/context/SessionContext";
import PdfAnnotatorModal from "@/components/renovasi/PdfAnnotatorModal";
import { getApprovalStageInfo, getShortRoleName } from "@/lib/approval-stage";
import { FeedbackModal } from "@/components/ui/feedback-modal";

export type ApprovalActionType = "APPROVE" | "REVISI" | "TOLAK";

export interface ApprovalActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ApprovalActionType | null;
  target: any | null;
  moduleType?: "rab-oe" | "fungsi-ruang" | "tender";
  roleName?: string;
  nextStepLabel?: string;
  onSuccess: (updatedItem?: any) => void;
}

export default function ApprovalActionDialog({
  open,
  onOpenChange,
  action,
  target,
  moduleType = "rab-oe",
  roleName,
  nextStepLabel,
  onSuccess
}: ApprovalActionDialogProps) {
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Full item data if target passed is partial
  const [fullTarget, setFullTarget] = useState<any>(target);

  // Granular Revision States (hanya untuk modul rab-oe)
  const [revParamDurasi, setRevParamDurasi] = useState(false);
  const [revParamDurasiNote, setRevParamDurasiNote] = useState("");

  const [revParamJenis, setRevParamJenis] = useState(false);
  const [revParamJenisNote, setRevParamJenisNote] = useState("");

  // Map of document ID -> { selected: boolean, note: string }
  const [revDrawings, setRevDrawings] = useState<Record<string, { selected: boolean; note: string }>>({});

  // Map of foto ID -> { selected: boolean, note: string }
  const [revPhotos, setRevPhotos] = useState<Record<string, { selected: boolean; note: string }>>({});
  // Checkbox revisi general kelengkapan foto lingkungan
  const [revGeneralPhotos, setRevGeneralPhotos] = useState(false);
  const [revGeneralPhotosNote, setRevGeneralPhotosNote] = useState("");

  // Map of rab item ID -> { selected: boolean, note: string }
  const [revRabItems, setRevRabItems] = useState<Record<string, { selected: boolean; note: string }>>({});

  // Drawing Annotator modal state
  const [activeAnnotatingDoc, setActiveAnnotatingDoc] = useState<any | null>(null);
  const [annotatedDocs, setAnnotatedDocs] = useState<
    Record<
      string,
      {
        count: number;
        lastSaved: string;
        id?: number;
        file_url?: string;
        drive_file_id?: string;
        nama_file?: string;
        nama_label?: string;
      }
    >
  >({});

  const { user } = useSession();
  // Dokumen revisi DWG AutoCAD yang diunggah oleh peninjau (Poin 2)
  const [uploadedDwgDocs, setUploadedDwgDocs] = useState<
    Record<
      string,
      {
        id: number;
        nama_file: string;
        file_url?: string;
        drive_file_id?: string;
        nama_label?: string;
      }
    >
  >({});
  const [uploadingDwgDocId, setUploadingDwgDocId] = useState<string | null>(null);

  // Melacak dokumen coretan & revisi DWG yang baru dibuat dalam sesi dialog ini (untuk rollback jika cancel)
  const [stagedCoretanDocIds, setStagedCoretanDocIds] = useState<number[]>([]);
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Melacak coretan tahap sebelumnya yang telah dibuka/ditinjau (Poin 3)
  const [viewedPriorCoretanIds, setViewedPriorCoretanIds] = useState<number[]>([]);
  const [viewingPriorDoc, setViewingPriorDoc] = useState<any | null>(null);
  const [viewingPriorLayerId, setViewingPriorLayerId] = useState<string | number | undefined>(undefined);

  // Accordion active sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    params: true,
    drawings: true,
    photos: true,
    rab: false
  });

  // Filter search for RAB items in revision dialog
  const [rabSearch, setRabSearch] = useState("");

  // Load and reset states on open
  useEffect(() => {
    if (open) {
      setCatatan("");
      setErrorMessage(null);
      setRevParamDurasi(false);
      setRevParamDurasiNote("");
      setRevParamJenis(false);
      setRevParamJenisNote("");
      setRevDrawings({});
      setRevPhotos({});
      setRevGeneralPhotos(false);
      setRevGeneralPhotosNote("");
      setRevRabItems({});
      setRabSearch("");
      setActiveAnnotatingDoc(null);
      setStagedCoretanDocIds([]);
      setViewedPriorCoretanIds([]);
      setViewingPriorDoc(null);
      setViewingPriorLayerId(undefined);
      setOpenSections({
        params: true,
        drawings: true,
        photos: true,
        rab: false
      });

      setFullTarget(target);

      // Reset state berkas coretan & DWG sesi aktif saat ini
      // Dokumen coretan siklus terdahulu diakses secara historis via priorStageCoretans / layer switcher
      setAnnotatedDocs({});
      setUploadedDwgDocs({});

      // Fetch full target if module is rab-oe and dokumen or item_rab is not present
      if (moduleType === "rab-oe" && target?.id && (!target.dokumen || !target.item_rab)) {
        fetch(`/api/dc-development/renovasi?id=${target.id}`)
          .then((res) => res.json())
          .then((json) => {
            if (json.status === "success" && json.data) {
              setFullTarget(json.data);
            }
          })
          .catch((err) => console.error("Failed to fetch full target:", err));
      }

      // Fetch full target if module is tender and renovasi or nilai_proyek is not fully present
      if (
        moduleType === "tender" &&
        target?.id &&
        (!target.renovasi?.grand_total || target.nilai_proyek === undefined || !target.nomor_tender)
      ) {
        fetch(`/api/dc-development/tender/${target.id}`)
          .then((res) => res.json())
          .then((json) => {
            if (json.status === "success" && json.data) {
              setFullTarget(json.data);
            }
          })
          .catch((err) => console.error("Gagal memuat detail tender untuk modal persetujuan:", err));
      }
    }
  }, [open, action, target, moduleType]);

  if (!target || !action) return null;

  const currentData = fullTarget || target;

  // Next step calculation
  const nextStepRabOe = moduleType === "rab-oe" && action === "APPROVE" ? getNextApprovalStatus(currentData.status) : null;
  const nextStepFungsiRuang = moduleType === "fungsi-ruang" && action === "APPROVE" ? getNextFungsiRuangApprovalStatus(currentData.status) : null;

  // Catatan WAJIB diisi saat REVISI atau TOLAK, dan OPSIONAL saat APPROVE
  const isNotesMandatory = action === "REVISI" || action === "TOLAK";

  // Documents separation (modul rab-oe)
  const allDocs = currentData.dokumen || [];
  const drawingsList = allDocs.filter((d: any) =>
    d.kategori_file?.startsWith("GAMBAR_") || d.kategori_file === "GAMBAR_SIPIL" || d.kategori_file === "GAMBAR_ME"
  );
  const photosList = allDocs.filter((d: any) => d.kategori_file === "FOTO_LINGKUNGAN");
  const rabList = currentData.item_rab || [];

  // Filtered RAB items for search
  const filteredRabList = rabList.filter((r: any) => {
    if (!rabSearch.trim()) return true;
    const q = rabSearch.toLowerCase();
    return (
      (r.deskripsi || "").toLowerCase().includes(q) ||
      (r.kategori_pekerjaan || "").toLowerCase().includes(q) ||
      (r.lingkup || "").toLowerCase().includes(q)
    );
  });

  // Total flagged items count (hanya berlaku jika ada granular selector di rab-oe)
  const flaggedCount = useMemo(() => {
    if (moduleType !== "rab-oe") return 0;
    let count = 0;
    if (revParamDurasi) count++;
    if (revParamJenis) count++;
    if (revGeneralPhotos) count++;
    count += Object.values(revDrawings).filter((d) => d.selected).length;
    count += Object.values(revPhotos).filter((p) => p.selected).length;
    count += Object.values(revRabItems).filter((r) => r.selected).length;
    return count;
  }, [moduleType, revParamDurasi, revParamJenis, revGeneralPhotos, revDrawings, revPhotos, revRabItems]);

  // Deteksi dokumen coretan dari tahap / siklus approval sebelumnya yang wajib ditinjau
  const priorStageCoretans = useMemo(() => {
    if (moduleType !== "rab-oe") return [];
    const allDocs = currentData?.dokumen || [];

    return allDocs.filter((doc: any) => {
      const isCoretan =
        doc.kategori_file?.startsWith("CORETAN") ||
        (doc.nama_file || "").startsWith("Coretan_");
      if (!isCoretan) return false;
      // Jangan masukkan coretan yang baru dibuat di sesi aktif saat ini
      if (stagedCoretanDocIds.includes(doc.id)) return false;
      return true;
    });
  }, [currentData?.dokumen, moduleType, stagedCoretanDocIds]);

  const unviewedPriorCoretans = useMemo(() => {
    return priorStageCoretans.filter((d: any) => !viewedPriorCoretanIds.includes(d.id));
  }, [priorStageCoretans, viewedPriorCoretanIds]);

  // State pop-up alert konfirmasi pembatalan coretan (FeedbackModal)
  const [showRollbackAlertModal, setShowRollbackAlertModal] = useState(false);

  // Pemicu tombol Batal atau tutup modal Dialog:
  // Jika ada coretan baru yang disimpan (staged), tampilkan pop-up alert FeedbackModal terlebih dahulu
  const handleTriggerCancel = () => {
    if (stagedCoretanDocIds.length > 0) {
      setShowRollbackAlertModal(true);
    } else {
      onOpenChange(false);
    }
  };

  // Eksekusi penghapusan rollback dari database saat user mengonfirmasi pembatalan
  const handleConfirmRollback = async () => {
    setShowRollbackAlertModal(false);
    if (stagedCoretanDocIds.length > 0 && currentData?.id) {
      setIsRollingBack(true);
      const idsToDelete = [...stagedCoretanDocIds];
      setStagedCoretanDocIds([]);
      for (const cId of idsToDelete) {
        try {
          await fetch(
            `/api/dc-development/renovasi/${currentData.id}/dokumen/0/coretan-pdf?coretan_id=${cId}`,
            { method: "DELETE" }
          );
        } catch (err) {
          console.warn("Gagal rollback staged coretan dari database:", err);
        }
      }
      setIsRollingBack(false);
    }
    onOpenChange(false);
  };

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Handler untuk mengunggah berkas revisi AutoCAD (.dwg) oleh approver (Poin 2)
  const handleDwgUpload = async (doc: any, file?: File | null) => {
    if (!file || !currentData?.id) return;
    if (!file.name.toLowerCase().endsWith(".dwg")) {
      setErrorMessage("Format berkas harus berekstensi .dwg (AutoCAD)");
      return;
    }

    try {
      setUploadingDwgDocId(String(doc.id));
      setErrorMessage(null);

      const stageInfo = getApprovalStageInfo(currentData.status, roleName);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("user_email", user?.email || "");
      formData.append("user_nama", user?.namaLengkap || user?.email || "Reviewer");
      formData.append("user_role", roleName || user?.role || "APPROVER");
      formData.append("status_aksi", action || "REVISI");
      formData.append("tahap_alur", stageInfo.code);
      formData.append("status_tahap", currentData.status || "");
      formData.append(
        "nama_label",
        `Revisi Berkas DWG (Tahap ${stageInfo.label}) oleh ${user?.namaLengkap || user?.email} (${roleName || user?.role})`
      );

      // Jika sebelumnya sudah mengunggah DWG di sesi ini, kirim ID agar di-update
      const existingDwg = uploadedDwgDocs[String(doc.id)];
      if (existingDwg?.id) {
        formData.append("existing_coretan_id", String(existingDwg.id));
      }

      const res = await fetch(
        `/api/dc-development/renovasi/${currentData.id}/dokumen/${doc.id}/coretan-pdf`,
        {
          method: "POST",
          body: formData,
        }
      );

      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Gagal mengunggah berkas DWG ke Google Drive");
      }

      // 1. Simpan ke uploadedDwgDocs
      setUploadedDwgDocs((prev) => ({
        ...prev,
        [String(doc.id)]: json.data,
      }));

      // 2. Tambahkan ke stagedCoretanDocIds untuk rollback otomatis jika modal dibatalkan
      if (json.data?.id) {
        setStagedCoretanDocIds((prev) =>
          prev.includes(json.data.id) ? prev : [...prev, json.data.id]
        );
      }

      // 3. Pastikan checkbox terpilih & isi catatan otomatis jika belum ada catatan
      setRevDrawings((prev) => ({
        ...prev,
        [String(doc.id)]: {
          selected: true,
          note:
            prev[String(doc.id)]?.note ||
            `Terdapat berkas revisi AutoCAD (DWG) yang diunggah oleh peninjau: ${json.data.nama_file}`,
        },
      }));
    } catch (err: any) {
      console.error("Gagal unggah revisi DWG:", err);
      setErrorMessage(err.message || "Gagal mengunggah berkas DWG ke Google Drive.");
    } finally {
      setUploadingDwgDocId(null);
    }
  };

  const getActionConfig = () => {
    if (moduleType === "tender") {
      switch (action) {
        case "APPROVE":
          return {
            title: "Konfirmasi Persetujuan Tender",
            description: "Pengajuan usulan rekanan tender ini akan disetujui dan diteruskan ke tahap proses selanjutnya.",
            icon: CheckCircle2,
            iconBg: "bg-emerald-50 text-emerald-600 border border-emerald-200/80",
            submitText: nextStepLabel ? `Setujui (ke ${nextStepLabel})` : "Setujui (Final Approved)",
            submitBtnClass: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20",
            notePlaceholder: "Tuliskan catatan persetujuan jika diperlukan (opsional)...",
            noteLabel: "Catatan Persetujuan (Opsional)"
          };
        case "REVISI":
          return {
            title: "Instruksi Perbaikan Revisi Tender",
            description: "Tuliskan catatan instruksi perbaikan yang wajib dipenuhi oleh pembuat Pengajuan Proposal Tender.",
            icon: RotateCcw,
            iconBg: "bg-amber-50 text-amber-600 border border-amber-200/80",
            submitText: "Kembalikan Revisi",
            submitBtnClass: "bg-[#E65F2B] hover:bg-[#d45524] text-white shadow-[#E65F2B]/20",
            notePlaceholder: "Tuliskan poin atau catatan instruksi perbaikan yang harus diperbaiki oleh maker (Wajib diisi)...",
            noteLabel: "Catatan Instruksi Perbaikan"
          };
        case "TOLAK":
          return {
            title: "Penolakan Pengajuan Proposal Tender",
            description: "Pengajuan usulan rekanan tender ini akan ditolak dan statusnya akan ditutup.",
            icon: XCircle,
            iconBg: "bg-rose-50 text-rose-600 border border-rose-200/80",
            submitText: "Tolak Pengajuan",
            submitBtnClass: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20",
            notePlaceholder: "Jelaskan alasan penolakan Pengajuan Proposal Tender ini (Wajib diisi)...",
            noteLabel: "Alasan Penolakan"
          };
      }
    }

    if (moduleType === "fungsi-ruang") {
      switch (action) {
        case "APPROVE":
          return {
            title: "Konfirmasi Persetujuan Pengajuan",
            description: "Pengajuan Perubahan Fungsi Ruang ini akan disetujui dan dialihkan ke tahap proses selanjutnya.",
            icon: CheckCircle2,
            iconBg: "bg-emerald-50 text-emerald-600 border border-emerald-200/80",
            submitText: nextStepFungsiRuang?.nextStatus === "APPROVED" ? "Setujui & Terbitkan (Final)" : "Setujui (Approve)",
            submitBtnClass: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20",
            notePlaceholder: "Tuliskan catatan persetujuan jika diperlukan (opsional)...",
            noteLabel: "Catatan Persetujuan (Opsional)"
          };
        case "REVISI":
          return {
            title: "Permintaan Revisi Pengajuan",
            description: "Tuliskan catatan instruksi perbaikan yang wajib dipenuhi oleh pemohon.",
            icon: RotateCcw,
            iconBg: "bg-amber-50 text-amber-600 border border-amber-200/80",
            submitText: "Kembalikan Revisi",
            submitBtnClass: "bg-[#E65F2B] hover:bg-[#d45524] text-white shadow-[#E65F2B]/20",
            notePlaceholder: "Tuliskan poin atau catatan instruksi perbaikan yang harus diperbaiki oleh pemohon (Wajib diisi)...",
            noteLabel: "Catatan Instruksi Perbaikan"
          };
        case "TOLAK":
          return {
            title: "Penolakan Pengajuan",
            description: "Pengajuan ini akan ditolak dan statusnya akan ditutup.",
            icon: XCircle,
            iconBg: "bg-rose-50 text-rose-600 border border-rose-200/80",
            submitText: "Tolak Pengajuan",
            submitBtnClass: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20",
            notePlaceholder: "Jelaskan alasan penolakan pengajuan ini (Wajib diisi)...",
            noteLabel: "Alasan Penolakan"
          };
      }
    }

    // Default: modul rab-oe
    switch (action) {
      case "APPROVE":
        return {
          title: "Konfirmasi Persetujuan Pengajuan",
          description: "Pengajuan ini akan disetujui dan dialihkan ke tahap proses selanjutnya.",
          icon: CheckCircle2,
          iconBg: "bg-emerald-50 text-emerald-600 border border-emerald-200/80",
          submitText: nextStepRabOe?.nextStatus === "APPROVED" ? "Setujui & Terbitkan (Final)" : "Setujui Pengajuan",
          submitBtnClass: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20",
          notePlaceholder: "Tuliskan catatan persetujuan jika diperlukan (Opsional)...",
          noteLabel: "Catatan Persetujuan (Opsional)"
        };
      case "REVISI":
        return {
          title: "Permintaan Revisi Pengajuan",
          description: "Tandai elemen yang wajib diperbaiki dan berikan catatan instruksi untuk pembuat dokumen.",
          icon: AlertCircle,
          iconBg: "bg-amber-50 text-amber-600 border border-amber-200/80",
          submitText: flaggedCount > 0 ? `Kembalikan Revisi (${flaggedCount} Poin Ditandai)` : "Kembalikan Revisi",
          submitBtnClass: "bg-[#E65F2B] hover:bg-[#d45524] text-white shadow-[#E65F2B]/20",
          notePlaceholder: "Tuliskan ringkasan umum instruksi revisi pengajuan (Wajib diisi)...",
          noteLabel: "Catatan Instruksi Perbaikan"
        };
      case "TOLAK":
        return {
          title: "Penolakan Pengajuan Renovasi",
          description: "Pengajuan ini akan ditolak dan statusnya akan ditutup sebagai ditolak.",
          icon: XCircle,
          iconBg: "bg-rose-50 text-rose-600 border border-rose-200/80",
          submitText: "Tolak Pengajuan",
          submitBtnClass: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20",
          notePlaceholder: "Jelaskan alasan penolakan pengajuan renovasi ini (Wajib diisi)...",
          noteLabel: "Alasan Penolakan"
        };
    }
  };

  const config = getActionConfig();
  const IconComponent = config.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedNote = catatan.trim();

    // Validasi catatan: WAJIB jika REVISI atau TOLAK
    if (isNotesMandatory && !trimmedNote) {
      setErrorMessage(
        action === "REVISI"
          ? "Catatan instruksi perbaikan wajib diisi ketika mengembalikan revisi."
          : "Alasan penolakan pengajuan wajib diisi."
      );
      return;
    }

    // Build detail_revisi payload when action === "REVISI" dan module === "rab-oe"
    const detailRevisiPayload: RevisionDetailItem[] = [];

    if (moduleType === "rab-oe" && action === "REVISI") {
      // 1. Parameter: Durasi Pekerjaan (Hari)
      if (revParamDurasi) {
        detailRevisiPayload.push({
          id: "param_durasi_hari",
          category: "PARAMETER",
          fieldOrId: "durasi_hari",
          label: "Durasi Pekerjaan (Hari)",
          catatan: revParamDurasiNote.trim() || "Perlu disesuaikan estimasi durasi hari",
          initialValue: currentData.durasi_hari || 0
        });
      }

      // 1. Parameter: Jenis Renovasi
      if (revParamJenis) {
        detailRevisiPayload.push({
          id: "param_jenis_renovasi",
          category: "PARAMETER",
          fieldOrId: "jenis_renovasi",
          label: "Jenis Renovasi",
          catatan: revParamJenisNote.trim() || "Perlu disesuaikan jenis renovasi",
          initialValue: currentData.jenis_renovasi || ""
        });
      }

      // 2. Gambar Kerja (Sipil & ME)
      Object.entries(revDrawings).forEach(([id, data]) => {
        if (data.selected) {
          const doc = drawingsList.find((d: any) => String(d.id) === id);
          if (doc) {
            const subCat = doc.kategori_file?.includes("SIPIL") ? "SIPIL" : "ME";
            const ext = doc.nama_file?.toLowerCase().endsWith(".dwg") ? "DWG" : "PDF";
            const attachedDwg = uploadedDwgDocs[id];
            const attachedCoretan = annotatedDocs[id];
            detailRevisiPayload.push({
              id: `doc_${doc.id}`,
              category: "GAMBAR",
              fieldOrId: String(doc.id),
              subCategory: `${subCat}_${ext}`,
              label: `${doc.nama_label || doc.nama_file} (${subCat} ${ext})`,
              catatan:
                data.note.trim() ||
                (attachedDwg
                  ? `Terdapat berkas revisi AutoCAD (DWG) dari peninjau: ${attachedDwg.nama_file}`
                  : "Perlu perbaikan gambar teknik dan diunggah ulang"),
              initialValue: doc.nama_file || doc.file_url || String(doc.id),
              file_revisi_id: attachedDwg?.id || attachedCoretan?.id,
              file_revisi_nama: attachedDwg?.nama_file || attachedCoretan?.nama_file,
              file_revisi_url: attachedDwg?.file_url || attachedCoretan?.file_url,
            } as any);
          }
        }
      });

      // 3. Foto Lingkungan & Eksisting
      // A. General Checklist Foto Lingkungan (Kurang/Tidak Lengkap/Perlu Tambahan)
      if (revGeneralPhotos) {
        detailRevisiPayload.push({
          id: "foto_general_lingkungan",
          category: "FOTO",
          fieldOrId: "foto_lingkungan",
          subCategory: "FOTO_LINGKUNGAN_GENERAL",
          label: "Foto Lingkungan & Eksisting (Kelengkapan Dokumen)",
          catatan: revGeneralPhotosNote.trim() || "Dokumentasi foto lingkungan dinilai kurang lengkap atau perlu foto tambahan",
          initialValue: "Kelengkapan Foto Lingkungan"
        });
      }

      // B. Foto Spesifik
      Object.entries(revPhotos).forEach(([id, data]) => {
        if (data.selected) {
          const photo = photosList.find((p: any) => String(p.id) === id);
          if (photo) {
            detailRevisiPayload.push({
              id: `foto_${photo.id}`,
              category: "FOTO",
              fieldOrId: String(photo.id),
              subCategory: "FOTO_LINGKUNGAN",
              label: photo.nama_label || photo.nama_file || `Foto Lingkungan #${photo.id}`,
              catatan: data.note.trim() || "Perlu difoto ulang atau diperbaiki",
              initialValue: photo.nama_file || photo.file_url || String(photo.id)
            });
          }
        }
      });

      // 4. Estimasi Item RAB / OE
      Object.entries(revRabItems).forEach(([id, data]) => {
        if (data.selected) {
          const item = rabList.find((r: any) => String(r.id) === id);
          if (item) {
            detailRevisiPayload.push({
              id: `rab_${item.id}`,
              category: "RAB",
              fieldOrId: String(item.id),
              subCategory: item.lingkup || "SIPIL",
              label: `[${item.lingkup || "SIPIL"}] ${item.deskripsi}`,
              catatan: data.note.trim() || "Perlu penyesuaian volume atau spesifikasi pekerjaan",
              initialValue: {
                deskripsi: item.deskripsi,
                volume: item.volume,
                harga_material: item.harga_material,
                harga_upah: item.harga_upah,
                total_biaya: item.total_biaya
              }
            });
          }
        }
      });
    }

    // Validasi pemblokiran: wajib buka coretan tahap sebelumnya jika ada (Poin 3)
    if (unviewedPriorCoretans.length > 0) {
      setErrorMessage(
        `Terdapat ${unviewedPriorCoretans.length} berkas coretan dari reviewer tahap sebelumnya yang wajib Anda buka dan periksa terlebih dahulu sebelum melakukan persetujuan/revisi.`
      );
      return;
    }

    try {
      setLoading(true);

      const finalCatatan = trimmedNote;

      if (moduleType === "tender") {
        const res = await fetch(`/api/dc-development/tender/${currentData.id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            notes: finalCatatan || undefined,
          }),
        });

        const json = await res.json();
        if (!res.ok || json.status !== "success") {
          throw new Error(json.message || "Gagal memproses persetujuan tender");
        }

        setStagedCoretanDocIds([]);
        onOpenChange(false);
        onSuccess(json.data);
      } else if (moduleType === "fungsi-ruang") {
        const res = await fetch("/api/dc-development/fungsi-ruang/approval", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: currentData.id,
            action,
            catatan: finalCatatan || undefined
          })
        });

        const json = await res.json();
        if (!res.ok || json.status !== "success") {
          throw new Error(json.message || "Gagal memproses persetujuan fungsi ruang");
        }

        setStagedCoretanDocIds([]);
        onOpenChange(false);
        onSuccess(json.data);
      } else {
        // Modul rab-oe
        const res = await fetch("/api/dc-development/renovasi/approval", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: currentData.id,
            action,
            catatan: finalCatatan || undefined,
            detail_revisi: action === "REVISI" && detailRevisiPayload.length > 0 ? detailRevisiPayload : undefined
          })
        });

        const json = await res.json();
        if (!res.ok || json.status !== "success") {
          throw new Error(json.message || "Gagal memproses persetujuan");
        }

        setStagedCoretanDocIds([]);
        onOpenChange(false);
        onSuccess(json.data);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Terjadi kesalahan saat memproses data");
    } finally {
      setLoading(false);
    }
  };

  const isWideModal = moduleType === "rab-oe" && (action === "REVISI" || action === "APPROVE" || action === "TOLAK");

  return (
    <>
      <Dialog
        open={open && !activeAnnotatingDoc && !viewingPriorDoc}
        onOpenChange={(isOpen) => {
          if (!activeAnnotatingDoc && !viewingPriorDoc) {
            if (!isOpen) {
              handleTriggerCancel();
            } else {
              onOpenChange(true);
            }
          }
        }}
      >
        <DialogContent
          className={cn(
            "p-0 overflow-hidden rounded-2xl border-slate-200/80 shadow-2xl flex flex-col max-h-[92vh] z-[60]",
            isWideModal ? "max-w-3xl" : "max-w-lg"
          )}
        >
          {/* Header Dialog */}
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start gap-4 shrink-0 bg-white">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-2xs", config.iconBg)}>
              <IconComponent className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base font-bold text-slate-900 leading-snug">
                  {config.title}
                </DialogTitle>
                {action === "REVISI" && flaggedCount > 0 && (
                  <span className="text-[11px] font-extrabold bg-[#E65F2B] text-white px-2 py-0.5 rounded-full shadow-2xs animate-in zoom-in-95">
                    {flaggedCount} Ditandai
                  </span>
                )}
              </div>
              <DialogDescription className="text-xs text-slate-500 leading-relaxed">
                {config.description}
              </DialogDescription>
            </div>
          </div>

          {/* Content Body - Scrollable */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
            {/* Target Info Card: Tampilan Spesifik Modul */}
            {moduleType === "fungsi-ruang" ? (
              <div className="bg-slate-50/90 rounded-xl p-4 border border-slate-200/70 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Nomor Pengajuan:</span>
                  <span className="font-mono font-bold text-slate-900">{currentData.nomor_pengajuan}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Proyek DC:</span>
                  <span className="font-bold text-slate-800 text-right">
                    {currentData.project?.kode ? `${currentData.project.kode} - ` : ""}
                    {currentData.project?.nama_proyek || "DC"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Cabang / Wilayah:</span>
                  <span className="font-semibold text-slate-700">
                    {currentData.cabang || currentData.project?.cabang || currentData.renovasi?.cabang || "-"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Pemohon:</span>
                  <span className="font-bold text-slate-800">
                    {currentData.nama_pemohon} {currentData.jabatan ? `(${currentData.jabatan})` : ""}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Jenis Pengajuan:</span>
                  <span className="font-bold text-[#E65F2B] px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-[11px]">
                    {currentData.jenis_pengajuan || "-"}
                  </span>
                </div>

                {/* Status Transition Preview */}
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Status Saat Ini:</span>
                  <span className="px-2 py-0.5 rounded-md font-bold bg-slate-200/80 text-slate-700 text-[10px]">
                    {currentData.status}
                  </span>
                </div>

                {action === "APPROVE" && nextStepFungsiRuang && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      Status Setelah Disetujui:
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800 text-[10px]">
                      {nextStepFungsiRuang.nextStatus}
                    </span>
                  </div>
                )}
              </div>
            ) : moduleType === "tender" ? (
              <div className="bg-slate-50/90 rounded-xl p-4 border border-slate-200/70 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Nomor Pengajuan:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {currentData.nomor_tender || currentData.nomor_pengajuan || "-"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Proyek DC:</span>
                  <span className="font-bold text-slate-800 text-right">
                    {currentData.project?.kode ? `${currentData.project.kode} - ` : ""}
                    {currentData.project?.nama_proyek || "-"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Cabang / Wilayah:</span>
                  <span className="font-semibold text-slate-700">
                    {currentData.cabang || currentData.project?.cabang || currentData.renovasi?.cabang || "-"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Total Nilai RAB / OE:</span>
                  <span className="font-mono font-extrabold text-[#E65F2B]">
                    {formatRupiah(
                      Number(
                        currentData.renovasi?.grand_total ??
                        currentData.nilai_proyek ??
                        currentData.grand_total ??
                        0
                      )
                    )}
                  </span>
                </div>

                {/* Status Transition Preview */}
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Status Saat Ini:</span>
                  <span className="px-2 py-0.5 rounded-md font-bold bg-slate-200/80 text-slate-700 text-[10px]">
                    {currentData.status}
                  </span>
                </div>

                {action === "APPROVE" && nextStepLabel && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      Status Setelah Disetujui:
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800 text-[10px]">
                      {nextStepLabel}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50/90 rounded-xl p-4 border border-slate-200/70 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">Nomor Pengajuan:</span>
                  <span className="font-mono font-bold text-slate-900">{currentData.nomor_pengajuan}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Proyek DC:</span>
                  <span className="font-bold text-slate-800 text-right">
                    {currentData.project?.kode ? `${currentData.project.kode} - ` : ""}
                    {currentData.project?.nama_proyek || "-"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Cabang / Wilayah:</span>
                  <span className="font-semibold text-slate-700">
                    {currentData.cabang || currentData.project?.cabang || "-"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Total Nilai RAB / OE:</span>
                  <span className="font-mono font-extrabold text-[#E65F2B]">
                    {formatRupiah(currentData.grand_total || 0)}
                  </span>
                </div>

                {/* Status Transition Preview */}
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Status Saat Ini:</span>
                  <span className="px-2 py-0.5 rounded-md font-bold bg-slate-200/80 text-slate-700 text-[10px]">
                    {currentData.status}
                  </span>
                </div>

                {action === "APPROVE" && nextStepRabOe && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      Status Setelah Disetujui:
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800 text-[10px]">
                      {nextStepRabOe.nextStatus}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Banner Peringatan Wajib Periksa Coretan Reviewer Tahap Sebelumnya (Poin 3) */}
            {moduleType === "rab-oe" && priorStageCoretans.length > 0 && (
              <div
                className={cn(
                  "p-4 rounded-xl border text-xs flex flex-col gap-3 transition-all",
                  unviewedPriorCoretans.length > 0
                    ? "bg-amber-50/80 border-amber-300 text-amber-950 shadow-2xs"
                    : "bg-emerald-50/70 border-emerald-300 text-emerald-950"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                        unviewedPriorCoretans.length > 0
                          ? "bg-amber-500 text-white shadow-2xs animate-pulse"
                          : "bg-emerald-600 text-white"
                      )}
                    >
                      <PenTool className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold uppercase tracking-wider text-[11px]">
                          {unviewedPriorCoretans.length > 0
                            ? `Perhatian: Coretan Tahap Sebelumnya Wajib Diperiksa (${unviewedPriorCoretans.length} Belum Dibuka)`
                            : "Seluruh Coretan Tahap Sebelumnya Telah Ditinjau"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {unviewedPriorCoretans.length > 0 ? (
                          <>
                            Reviewer pada tahap persetujuan sebelumnya memberikan catatan coretan teknis. Anda{" "}
                            <strong>wajib membuka dan memeriksa seluruh lembar coretan</strong> di bawah ini sebelum dapat
                            melakukan tindakan persetujuan atau pengembalian revisi.
                          </>
                        ) : (
                          "Seluruh berkas coretan dari reviewer tahap sebelumnya telah Anda periksa. Tombol tindakan approval sekarang aktif."
                        )}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shrink-0 border",
                      unviewedPriorCoretans.length > 0
                        ? "bg-amber-200 text-amber-900 border-amber-300"
                        : "bg-emerald-200 text-emerald-900 border-emerald-300"
                    )}
                  >
                    {viewedPriorCoretanIds.length}/{priorStageCoretans.length} Ditinjau
                  </span>
                </div>

                {/* Tombol Cepat Buka Lembar Coretan Tahap Sebelumnya */}
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-200/60">
                  {priorStageCoretans.map((pDoc: any, idx: number) => {
                    const isViewed = viewedPriorCoretanIds.includes(pDoc.id);
                    const isSipil =
                      (pDoc.kategori_file || "").includes("SIPIL") ||
                      (pDoc.nama_file || "").toLowerCase().includes("sipil");
                    const matchedBaseDoc = (currentData?.dokumen || []).find((bd: any) => {
                      if (isSipil) {
                        return (
                          bd.kategori_file === "GAMBAR_SIPIL_PDF" ||
                          (bd.kategori_file === "GAMBAR_SIPIL" && bd.nama_file?.endsWith(".pdf"))
                        );
                      } else {
                        return (
                          bd.kategori_file === "GAMBAR_ME_PDF" ||
                          (bd.kategori_file === "GAMBAR_ME" && bd.nama_file?.endsWith(".pdf"))
                        );
                      }
                    });

                    const shortRole = getShortRoleName(pDoc.user_role, pDoc.tahap_alur);
                    const userInitial = (pDoc.user_nama || pDoc.created_by || "Reviewer").split(" ")[0];

                    return (
                      <button
                        key={pDoc.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Tandai sebagai sudah dilihat
                          setViewedPriorCoretanIds((prev) =>
                            prev.includes(pDoc.id) ? prev : [...prev, pDoc.id]
                          );
                          // Buka PdfAnnotatorModal dalam mode baca (layer pDoc.id)
                          setViewingPriorDoc(matchedBaseDoc || pDoc);
                          setViewingPriorLayerId(pDoc.id);
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs",
                          isViewed
                            ? "bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50"
                            : "bg-[#E65F2B] text-white hover:bg-[#d04f1f] ring-2 ring-[#E65F2B]/30 animate-pulse"
                        )}
                        title={`${pDoc.nama_label || pDoc.nama_file}\nOleh: ${pDoc.user_nama || pDoc.created_by}\nTanggal: ${new Date(pDoc.created_at).toLocaleString("id-ID")}`}
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[280px]">
                          {shortRole} • Coretan {idx + 1}
                        </span>
                        <span className="text-[10px] font-mono opacity-80">
                          ({userInitial})
                        </span>
                        {isViewed ? (
                          <span className="text-[10px] text-emerald-600 font-bold ml-1">✓ Ditinjau</span>
                        ) : (
                          <span className="text-[10px] text-amber-200 font-bold ml-1">[Wajib Dibuka]</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Banner Peringatan Wajib Isi Catatan Saat Revisi */}
            {action === "REVISI" && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 flex items-start gap-2.5 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="font-medium">
                  Catatan instruksi perbaikan wajib diisi ketika mengembalikan revisi.
                </span>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 flex items-start gap-2.5 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}



            {/* Granular Revision / Tolak Selector (UNTUK MODUL RAB-OE SAAT REVISI ATAU TOLAK) */}
            {moduleType === "rab-oe" && (action === "REVISI" || action === "TOLAK") && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-[#E65F2B]" />
                      {action === "REVISI"
                        ? "Pilih & Tandai Bagian Spesifik yang Perlu Direvisi (Opsional)"
                        : "Pilih & Tandai Bagian Spesifik yang Ditolak (Opsional)"}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Elemen yang Anda tandai akan memiliki badge peringatan dan wajib diubah minimal satu kali oleh pemohon.
                    </p>
                  </div>
                  {flaggedCount > 0 && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md shrink-0">
                      {flaggedCount} bagian dipilih
                    </span>
                  )}
                </div>

                {/* 1. SEKSI PARAMETER PENGAJUAN */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => toggleSection("params")}
                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[11px]">
                        1
                      </div>
                      <span className="font-bold text-slate-800 text-xs">Parameter Pengajuan Renovasi</span>
                      {(revParamDurasi || revParamJenis) && (
                        <span className="text-[10px] font-bold bg-[#E65F2B] text-white px-1.5 py-0.2 rounded-full">
                          {(revParamDurasi ? 1 : 0) + (revParamJenis ? 1 : 0)}
                        </span>
                      )}
                    </div>
                    {openSections.params ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {openSections.params && (
                    <div className="p-4 space-y-3.5 divide-y divide-slate-100">
                      <div className="space-y-2">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={revParamDurasi}
                            onChange={(e) => setRevParamDurasi(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-800">Durasi Pekerjaan (Hari)</span>
                              <span className="font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                Saat ini: {currentData.durasi_hari || 0} {currentData.satuan_durasi || "Hari"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Tandai jika estimasi hari pengerjaan tidak realistis atau perlu dikurangi/ditambah.
                            </p>
                          </div>
                        </label>
                        {revParamDurasi && (
                          <div className="pl-6.5">
                            <Input
                              placeholder="Catatan spesifik revisi durasi (contoh: Kurangi durasi pengerjaan menjadi 30 hari)..."
                              value={revParamDurasiNote}
                              onChange={(e) => setRevParamDurasiNote(e.target.value)}
                              className="text-xs h-8 rounded-lg border-amber-300 bg-amber-50/40 focus-visible:ring-[#E65F2B]"
                            />
                          </div>
                        )}
                      </div>

                      <div className="pt-3 space-y-2">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={revParamJenis}
                            onChange={(e) => setRevParamJenis(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-800">Jenis Renovasi</span>
                              <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                Saat ini: {currentData.jenis_renovasi || "-"}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Tandai jika klasifikasi jenis renovasi tidak sesuai dengan scope riil.
                            </p>
                          </div>
                        </label>
                        {revParamJenis && (
                          <div className="pl-6.5">
                            <Input
                              placeholder="Catatan spesifik revisi jenis renovasi (contoh: Sesuaikan menjadi Renovasi Berat)..."
                              value={revParamJenisNote}
                              onChange={(e) => setRevParamJenisNote(e.target.value)}
                              className="text-xs h-8 rounded-lg border-amber-300 bg-amber-50/40 focus-visible:ring-[#E65F2B]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. SEKSI GAMBAR KERJA */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => toggleSection("drawings")}
                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-[11px]">
                        2
                      </div>
                      <span className="font-bold text-slate-800 text-xs">Gambar Kerja (Sipil & ME)</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        ({drawingsList.length} berkas terlampir)
                      </span>
                      {Object.values(revDrawings).filter((d) => d.selected).length > 0 && (
                        <span className="text-[10px] font-bold bg-[#E65F2B] text-white px-1.5 py-0.2 rounded-full">
                          {Object.values(revDrawings).filter((d) => d.selected).length}
                        </span>
                      )}
                    </div>
                    {openSections.drawings ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {openSections.drawings && (
                    <div className="p-4 space-y-3">
                      {drawingsList.length === 0 ? (
                        <p className="text-slate-400 italic text-[11px] text-center py-2">
                          Tidak ada berkas gambar teknis terlampir.
                        </p>
                      ) : (
                        drawingsList.map((doc: any) => {
                          const isSipil = doc.kategori_file?.includes("SIPIL");
                          const isDwg = doc.nama_file?.toLowerCase().endsWith(".dwg");
                          const badgeType = `${isSipil ? "Sipil" : "ME"} ${isDwg ? "AutoCAD (DWG)" : "PDF"}`;
                          const isSelected = Boolean(revDrawings[String(doc.id)]?.selected);
                          const noteVal = revDrawings[String(doc.id)]?.note || "";

                          return (
                            <div
                              key={doc.id}
                              className={cn(
                                "p-3 rounded-xl border transition-all space-y-2",
                                isSelected
                                  ? "bg-amber-50/50 border-amber-300 ring-1 ring-amber-300/40"
                                  : "bg-slate-50/40 border-slate-200"
                              )}
                            >
                              <label className="flex items-start gap-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setRevDrawings((prev) => ({
                                      ...prev,
                                      [String(doc.id)]: {
                                        selected: checked,
                                        note: checked ? prev[String(doc.id)]?.note || "" : ""
                                      }
                                    }));
                                  }}
                                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FileCode2 className="w-4 h-4 text-blue-500 shrink-0" />
                                      <span className="font-bold text-slate-800 truncate" title={doc.nama_file}>
                                        {doc.nama_label || doc.nama_file}
                                      </span>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">
                                      {badgeType}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500 flex-wrap">
                                    <span className="truncate max-w-[180px]">{doc.nama_file}</span>
                                    {doc.file_url && (
                                      <a
                                        href={doc.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-blue-600 hover:underline flex items-center gap-0.5 shrink-0"
                                      >
                                        Buka <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                    {/* Aksi Spesifik Gambar Kerja: Hanya muncul saat checkbox dokumen DICENTANG */}
                                    {isSelected && !isDwg && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveAnnotatingDoc(doc);
                                          }}
                                          className={cn(
                                            "inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-lg border transition-all cursor-pointer shrink-0 ml-auto",
                                            Boolean(annotatedDocs[String(doc.id)])
                                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                              : "bg-orange-50 text-[#E65F2B] border-orange-200/90 hover:bg-orange-100/80 hover:text-[#d04f1f]"
                                          )}
                                        >
                                          <PenTool className="w-3 h-3" />
                                          <span>
                                            {Boolean(annotatedDocs[String(doc.id)])
                                              ? "Edit Coretan PDF"
                                              : "Coret / Anotasi Gambar PDF"}
                                          </span>
                                        </button>
                                        {Boolean(annotatedDocs[String(doc.id)]) && (
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                              Tersimpan di Google Drive
                                            </span>
                                            {annotatedDocs[String(doc.id)]?.file_url && (
                                              <a
                                                href={annotatedDocs[String(doc.id)].file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md transition-colors"
                                              >
                                                <span>Buka Coretan</span>
                                                <ExternalLink className="w-3 h-3" />
                                              </a>
                                            )}
                                          </div>
                                        )}
                                      </>
                                    )}

                                    {/* Aksi Unggah Berkas DWG Baru Versi Approver: Hanya muncul saat checkbox dicentang */}
                                    {isSelected && isDwg && (
                                      <>
                                        {!uploadedDwgDocs[String(doc.id)] ? (
                                          <label
                                            onClick={(e) => e.stopPropagation()}
                                            className={cn(
                                              "inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-lg border transition-all cursor-pointer shrink-0 ml-auto shadow-2xs",
                                              uploadingDwgDocId === String(doc.id)
                                                ? "bg-slate-100 text-slate-500 border-slate-300 cursor-not-allowed"
                                                : "bg-blue-50 text-blue-700 border-blue-200/90 hover:bg-blue-100/80 hover:text-blue-800"
                                            )}
                                          >
                                            {uploadingDwgDocId === String(doc.id) ? (
                                              <>
                                                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                                                <span>Mengunggah DWG...</span>
                                              </>
                                            ) : (
                                              <>
                                                <Upload className="w-3 h-3 text-blue-600" />
                                                <span>Unggah Revisi DWG (AutoCAD)</span>
                                              </>
                                            )}
                                            <input
                                              type="file"
                                              accept=".dwg"
                                              className="hidden"
                                              disabled={uploadingDwgDocId === String(doc.id)}
                                              onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) handleDwgUpload(doc, f);
                                              }}
                                            />
                                          </label>
                                        ) : (
                                          <div className="flex items-center gap-1.5 shrink-0 ml-auto flex-wrap">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                              Revisi DWG Tersimpan
                                            </span>
                                            {uploadedDwgDocs[String(doc.id)]?.file_url && (
                                              <a
                                                href={uploadedDwgDocs[String(doc.id)].file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md transition-colors"
                                              >
                                                <span>Buka DWG</span>
                                                <ExternalLink className="w-3 h-3" />
                                              </a>
                                            )}
                                            <label
                                              onClick={(e) => e.stopPropagation()}
                                              className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md cursor-pointer transition-colors shadow-2xs"
                                            >
                                              <span>Ganti Berkas</span>
                                              <input
                                                type="file"
                                                accept=".dwg"
                                                className="hidden"
                                                disabled={uploadingDwgDocId === String(doc.id)}
                                                onChange={(e) => {
                                                  const f = e.target.files?.[0];
                                                  if (f) handleDwgUpload(doc, f);
                                                }}
                                              />
                                            </label>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </label>

                              {isSelected && (
                                <div className="pl-6.5 pt-1">
                                  <Input
                                    placeholder={`Catatan spesifik revisi berkas ${badgeType} ini...`}
                                    value={noteVal}
                                    onChange={(e) =>
                                      setRevDrawings((prev) => ({
                                        ...prev,
                                        [String(doc.id)]: {
                                          selected: true,
                                          note: e.target.value
                                        }
                                      }))
                                    }
                                    className="text-xs h-8 rounded-lg border-amber-300 bg-white focus-visible:ring-[#E65F2B]"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* 3. SEKSI FOTO LINGKUNGAN */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => toggleSection("photos")}
                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-[11px]">
                        3
                      </div>
                      <span className="font-bold text-slate-800 text-xs">Foto Lingkungan & Eksisting</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        ({photosList.length} foto terlampir)
                      </span>
                      {(Object.values(revPhotos).filter((p) => p.selected).length + (revGeneralPhotos ? 1 : 0)) > 0 && (
                        <span className="text-[10px] font-bold bg-[#E65F2B] text-white px-1.5 py-0.2 rounded-full">
                          {Object.values(revPhotos).filter((p) => p.selected).length + (revGeneralPhotos ? 1 : 0)}
                        </span>
                      )}
                    </div>
                    {openSections.photos ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {openSections.photos && (
                    <div className="p-4 space-y-3">
                      {/* Checkbox Revisi General Kelengkapan Foto Lingkungan */}
                      <div
                        className={cn(
                          "p-3 rounded-xl border transition-all space-y-2",
                          revGeneralPhotos
                            ? "bg-amber-50/60 border-amber-300 ring-1 ring-amber-300/40"
                            : "bg-slate-50/50 border-dashed border-amber-300/80 hover:bg-amber-50/30"
                        )}
                      >
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={revGeneralPhotos}
                            onChange={(e) => {
                              setRevGeneralPhotos(e.target.checked);
                              if (!e.target.checked) setRevGeneralPhotosNote("");
                            }}
                            className="mt-0.5 w-4 h-4 rounded border-amber-400 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer shrink-0"
                          />
                          <div>
                            <span className="font-bold text-slate-800 text-xs block">
                              Tandai Revisi Kelengkapan Foto Lingkungan &amp; Eksisting (General)
                            </span>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                              Centang opsi ini jika dokumentasi foto eksisting secara umum dinilai kurang lengkap, sudut pandang kurang memadai, atau wajib melampirkan foto tambahan di lapangan.
                            </p>
                          </div>
                        </label>
                        {revGeneralPhotos && (
                          <div className="pl-6.5 pt-1">
                            <Input
                              placeholder="Catatan spesifik kelengkapan foto (contoh: Lampirkan foto tampak depan, loading dock, dan panel listrik)..."
                              value={revGeneralPhotosNote}
                              onChange={(e) => setRevGeneralPhotosNote(e.target.value)}
                              className="text-xs h-8 rounded-lg border-amber-300 bg-white focus-visible:ring-[#E65F2B]"
                            />
                          </div>
                        )}
                      </div>

                      {photosList.length === 0 ? (
                        <p className="text-slate-400 italic text-[11px] text-center py-2">
                          Tidak ada foto lingkungan terlampir.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {photosList.map((photo: any, idx: number) => {
                            const isSelected = Boolean(revPhotos[String(photo.id)]?.selected);
                            const noteVal = revPhotos[String(photo.id)]?.note || "";

                            return (
                              <div
                                key={photo.id}
                                className={cn(
                                  "p-3 rounded-xl border transition-all space-y-2.5 flex flex-col justify-between",
                                  isSelected
                                    ? "bg-amber-50/50 border-amber-300 ring-1 ring-amber-300/40"
                                    : "bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs"
                                )}
                              >
                                <div className="flex items-start gap-2.5">
                                  <input
                                    type="checkbox"
                                    id={`photo-check-${photo.id}`}
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setRevPhotos((prev) => ({
                                        ...prev,
                                        [String(photo.id)]: {
                                          selected: checked,
                                          note: checked ? prev[String(photo.id)]?.note || "" : ""
                                        }
                                      }));
                                    }}
                                    className="mt-1 w-4 h-4 rounded border-slate-300 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer shrink-0"
                                  />

                                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
                                    <Camera className="w-4 h-4" />
                                  </div>

                                  <label htmlFor={`photo-check-${photo.id}`} className="flex-1 min-w-0 cursor-pointer">
                                    <span
                                      className="font-bold text-slate-800 text-xs block truncate"
                                      title={photo.nama_label || photo.nama_file}
                                    >
                                      {photo.nama_label || `Foto #${idx + 1}`}
                                    </span>
                                    <span className="text-[10px] text-slate-500 truncate block mt-0.5">
                                      {photo.nama_file}
                                    </span>
                                  </label>
                                </div>

                                {photo.file_url && (
                                  <a
                                    href={photo.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-2.5 rounded-lg bg-slate-50 hover:bg-[#E65F2B] text-slate-700 hover:text-white border border-slate-200 hover:border-[#E65F2B] text-[11px] font-semibold transition-all group cursor-pointer"
                                  >
                                    <span>Buka di Google Drive</span>
                                    <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                  </a>
                                )}

                                {isSelected && (
                                  <div className="pt-0.5">
                                    <Input
                                      placeholder="Catatan revisi foto ini..."
                                      value={noteVal}
                                      onChange={(e) =>
                                        setRevPhotos((prev) => ({
                                          ...prev,
                                          [String(photo.id)]: {
                                            selected: true,
                                            note: e.target.value
                                          }
                                        }))
                                      }
                                      className="text-[11px] h-7.5 rounded-lg border-amber-300 bg-white focus-visible:ring-[#E65F2B]"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. SEKSI RINCIAN ITEM ESTIMASI RAB / OE */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => toggleSection("rab")}
                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-[11px]">
                        4
                      </div>
                      <span className="font-bold text-slate-800 text-xs">Rincian Estimasi Item RAB / OE</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        ({rabList.length} item total)
                      </span>
                      {Object.values(revRabItems).filter((r) => r.selected).length > 0 && (
                        <span className="text-[10px] font-bold bg-[#E65F2B] text-white px-1.5 py-0.2 rounded-full">
                          {Object.values(revRabItems).filter((r) => r.selected).length}
                        </span>
                      )}
                    </div>
                    {openSections.rab ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {openSections.rab && (
                    <div className="p-4 space-y-3">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                        <Input
                          value={rabSearch}
                          onChange={(e) => setRabSearch(e.target.value)}
                          placeholder="Cari item RAB berdasarkan nama pekerjaan atau kategori..."
                          className="pl-8 text-xs h-8 rounded-lg border-slate-200"
                        />
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                        {filteredRabList.length === 0 ? (
                          <p className="text-slate-400 italic text-[11px] text-center py-3">
                            Tidak ada item RAB yang cocok dengan pencarian.
                          </p>
                        ) : (
                          filteredRabList.map((item: any) => {
                            const isSelected = Boolean(revRabItems[String(item.id)]?.selected);
                            const noteVal = revRabItems[String(item.id)]?.note || "";
                            const total = item.total_biaya || (item.volume * (item.harga_material + item.harga_upah)) || 0;

                            return (
                              <div
                                key={item.id}
                                className={cn(
                                  "pt-2 pb-2 space-y-1.5 rounded-lg px-2 transition-colors",
                                  isSelected ? "bg-amber-50/60 ring-1 ring-amber-300" : ""
                                )}
                              >
                                <label className="flex items-start gap-2.5 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setRevRabItems((prev) => ({
                                        ...prev,
                                        [String(item.id)]: {
                                          selected: checked,
                                          note: checked ? prev[String(item.id)]?.note || "" : ""
                                        }
                                      }));
                                    }}
                                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#E65F2B] focus:ring-[#E65F2B] cursor-pointer"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span
                                          className={cn(
                                            "text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0",
                                            item.lingkup === "ME"
                                              ? "bg-purple-100 text-purple-700"
                                              : "bg-blue-100 text-blue-700"
                                          )}
                                        >
                                          {item.lingkup || "SIPIL"}
                                        </span>
                                        <span className="font-bold text-slate-800 truncate text-xs" title={item.deskripsi}>
                                          {item.deskripsi}
                                        </span>
                                      </div>
                                      <span className="font-mono font-bold text-slate-700 text-xs shrink-0">
                                        {formatRupiah(total)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
                                      <span>Kategori: {item.kategori_pekerjaan || "Umum"}</span>
                                      <span className="font-mono">Volume: {item.volume}</span>
                                    </div>
                                  </div>
                                </label>

                                {isSelected && (
                                  <div className="pl-6.5 pt-1">
                                    <Input
                                      placeholder="Catatan revisi item RAB ini..."
                                      value={noteVal}
                                      onChange={(e) =>
                                        setRevRabItems((prev) => ({
                                          ...prev,
                                          [String(item.id)]: {
                                            selected: true,
                                            note: e.target.value
                                          }
                                        }))
                                      }
                                      className="text-xs h-7.5 rounded-lg border-amber-300 bg-white focus-visible:ring-[#E65F2B]"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Form Input Catatan (Hanya Muncul di Modal Konfirmasi Ini) */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {config.noteLabel}
                </label>
                <span
                  className={cn(
                    "text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded",
                    isNotesMandatory
                      ? "bg-rose-100 text-rose-700 border border-rose-200"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                  )}
                >
                  {isNotesMandatory ? "Wajib Diisi" : "Opsional"}
                </span>
              </div>
              <Textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                onBlur={(e) => setCatatan(toTitleCase(e.target.value))}
                placeholder={config.notePlaceholder}
                rows={action === "REVISI" ? 3 : 4}
                className="rounded-xl border-slate-200 text-xs focus-visible:ring-[#E65F2B]/30"
                required={isNotesMandatory}
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 shrink-0">
              <div>
                {unviewedPriorCoretans.length > 0 && (
                  <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    Wajib buka {unviewedPriorCoretans.length} berkas coretan tahap sebelumnya sebelum persetujuan.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTriggerCancel}
                  disabled={loading || isRollingBack}
                  className="rounded-xl text-xs h-9 px-4 border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  {isRollingBack ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Membatalkan...
                    </>
                  ) : (
                    "Batal"
                  )}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    loading ||
                    isRollingBack ||
                    (isNotesMandatory && !catatan.trim()) ||
                    unviewedPriorCoretans.length > 0
                  }
                  className={cn(
                    "rounded-xl text-xs h-9 px-4 font-bold shadow-md cursor-pointer transition-all",
                    config.submitBtnClass
                  )}
                  title={
                    unviewedPriorCoretans.length > 0
                      ? "Buka seluruh coretan tahap sebelumnya terlebih dahulu"
                      : undefined
                  }
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    config.submitText
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Kanvas Coretan Anotasi PDF (Mode Gambar / Edit Approver Aktif) */}
      {activeAnnotatingDoc && currentData?.id && (
        <PdfAnnotatorModal
          open={Boolean(activeAnnotatingDoc)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setActiveAnnotatingDoc(null);
          }}
          doc={activeAnnotatingDoc}
          renovasiId={currentData.id}
          isReadOnly={false}
          currentAction={action || "REVISI"}
          existingCoretanDocId={annotatedDocs[String(activeAnnotatingDoc.id)]?.id}
          currentApprovalStatus={currentData.status}
          approvalStageRole={roleName}
          onSaveSuccess={(savedDoc: any) => {
            // Melacak ID berkas coretan baru untuk rollback jika modal dibatalkan (Poin 1)
            if (savedDoc?.id) {
              setStagedCoretanDocIds((prev) =>
                prev.includes(savedDoc.id) ? prev : [...prev, savedDoc.id]
              );
            }

            setAnnotatedDocs((prev) => ({
              ...prev,
              [String(activeAnnotatingDoc.id)]: {
                id: savedDoc?.id,
                file_url: savedDoc?.file_url,
                drive_file_id: savedDoc?.drive_file_id,
                nama_file: savedDoc?.nama_file,
                nama_label: savedDoc?.nama_label,
                count: 1,
                lastSaved: new Date().toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              },
            }));

            // Jika mode REVISI, otomatis aktifkan checkbox dokumen ini
            if (action === "REVISI") {
              setRevDrawings((prev) => ({
                ...prev,
                [String(activeAnnotatingDoc.id)]: {
                  selected: true,
                  note:
                    prev[String(activeAnnotatingDoc.id)]?.note,
                },
              }));
            }
          }}
        />
      )}

      {/* Modal Kanvas Coretan Anotasi PDF (Mode Baca untuk Review Coretan Tahap Sebelumnya - Poin 3) */}
      {viewingPriorDoc && currentData?.id && (
        <PdfAnnotatorModal
          open={Boolean(viewingPriorDoc)}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setViewingPriorDoc(null);
              setViewingPriorLayerId(undefined);
            }
          }}
          doc={viewingPriorDoc}
          renovasiId={currentData.id}
          isReadOnly={true}
          initialLayerId={viewingPriorLayerId}
          currentApprovalStatus={currentData.status}
        />
      )}

      {/* Pop-up Alert FeedbackModal saat Approver Menutup Dialog dengan Coretan Baru yang Belum Disubmit */}
      <FeedbackModal
        open={showRollbackAlertModal}
        type="error"
        title="Coretan Akan Dihapus"
        message={`Anda telah menambahkan ${stagedCoretanDocIds.length} berkas coretan gambar kerja baru. Jika Anda menutup proses persetujuan ini tanpa menekan tombol ${action === "REVISI" ? "Kembalikan Revisi" : "Setujui Pengajuan"
          }, maka berkas coretan tersebut akan otomatis dihapus dari database.\n\nApakah Anda yakin ingin membatalkan?`}
        cancelText="Kembali ke Persetujuan"
        actionText="Ya, Tutup & Hapus Coretan"
        onClose={() => setShowRollbackAlertModal(false)}
        onConfirm={handleConfirmRollback}
      />
    </>
  );
}
