"use client";

import React, { useState, useRef } from "react";
import {
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2,
  ExternalLink,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  RefreshCw,
  RotateCcw,
  Undo2,
  X,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CameraWatermarkModal, { CapturedPhoto } from "@/components/renovasi/CameraWatermarkModal";
import UploadFotoLingkunganModal from "@/components/renovasi/UploadFotoLingkunganModal";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { RevisionPinpointBadge } from "@/components/approval/RevisionPinpointBadge";
import { KlarifikasiDokumenItem } from "./FormGambarTeknisKlarifikasiCard";
import { toTitleCase, cn } from "@/lib/utils";

interface FormFotoLingkunganKlarifikasiCardProps {
  rabFotoList: any[]; // Foto eksisting dari Penawaran RAB/OE
  klarifikasiFotoList: KlarifikasiDokumenItem[]; // Foto aktif di klarifikasi
  onChangeFotos: (updater: (prev: KlarifikasiDokumenItem[]) => KlarifikasiDokumenItem[]) => void;
  projectInfo: {
    cabang?: string;
    kode?: string;
    nama_proyek?: string;
    inisial?: string | null;
    nomor_undangan?: string;
  };
  pinpoint?: { isFlagged: boolean; catatan: string; isModified: boolean };
}

export function FormFotoLingkunganKlarifikasiCard({
  rabFotoList = [],
  klarifikasiFotoList = [],
  onChangeFotos,
  projectInfo,
  pinpoint,
}: FormFotoLingkunganKlarifikasiCardProps) {
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  // State untuk fitur Ganti / Upload Ulang Foto RAB ke Kolom 2
  const [activeReplaceTarget, setActiveReplaceTarget] = useState<any | null>(null);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);

  // Feedback Modal Visual Pop-Up
  const [feedback, setFeedback] = useState<{
    open: boolean;
    type: "success" | "error" | "warning";
    title: string;
    message: string;
  }>({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle ketika user memilih file baru via batch upload
  const handleSelectFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    setPendingUploadFiles(arr);
    setUploadModalOpen(true);
  };

  // Handler konfirmasi upload foto batch dari UploadFotoLingkunganModal (Optimistic UI)
  const handleConfirmBatchUpload = async (items: { file: File; name: string }[]) => {
    // 1. Tutup modal upload segera agar user langsung kembali ke halaman formulir
    setUploadModalOpen(false);
    setIsUploadingBatch(true);
    setUploadProgress({ current: 0, total: items.length });

    // 2. Buat entri optimis untuk setiap file agar LANGSUNG MUNCUL di Kolom 2 seketika
    const optimisticDocs: (KlarifikasiDokumenItem & { tempId: string; fileObj: File })[] = items.map((item, idx) => {
      const tempId = `opt-batch-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
      const previewUrl = URL.createObjectURL(item.file);
      return {
        id: tempId,
        tempId,
        kategori_file: "FOTO_LINGKUNGAN",
        nama_file: item.name,
        nama_label: item.name,
        localPreviewUrl: previewUrl,
        uploading: true,
        sumber: "BARU",
        timestamp_watermark: new Date().toISOString(),
        fileObj: item.file,
      };
    });

    onChangeFotos((prev) => [...prev, ...optimisticDocs]);

    let successCount = 0;
    const errors: string[] = [];

    // 3. Eksekusi upload ke Google Drive satu per satu di background
    for (let i = 0; i < optimisticDocs.length; i++) {
      const optItem = optimisticDocs[i];
      setUploadProgress({ current: i + 1, total: optimisticDocs.length });

      try {
        const formData = new FormData();
        formData.append("file", optItem.fileObj);
        formData.append("cabang", projectInfo.cabang || "TANPA CABANG");
        formData.append("kode", projectInfo.kode || "XXX");
        formData.append("nama_proyek", projectInfo.nama_proyek || "PROYEK");
        if (projectInfo.inisial) formData.append("inisial", projectInfo.inisial);
        formData.append("nomor_undangan", projectInfo.nomor_undangan || "DRAFT");
        formData.append("sub_folder", "Foto Lingkungan");
        formData.append("custom_name", optItem.nama_label || optItem.nama_file);

        const res = await fetch("/api/dc-development/klarifikasi-aanwijzing/upload", {
          method: "POST",
          body: formData,
        });

        const json = await res.json();
        if (json.status === "success" && json.data) {
          successCount++;
          // Update item optimis dengan data resmi dari Google Drive
          onChangeFotos((prev) =>
            prev.map((p) =>
              p.id === optItem.tempId
                ? {
                    ...p,
                    file_url: json.data.file_url,
                    drive_file_id: json.data.drive_file_id,
                    mime_type: json.data.mime_type,
                    uploading: false,
                  }
                : p
            )
          );
        } else {
          errors.push(optItem.nama_label || optItem.nama_file);
          // Hapus item yang gagal dari daftar
          onChangeFotos((prev) => prev.filter((p) => p.id !== optItem.tempId));
        }
      } catch (err: any) {
        errors.push(optItem.nama_label || optItem.nama_file);
        onChangeFotos((prev) => prev.filter((p) => p.id !== optItem.tempId));
      }
    }

    setIsUploadingBatch(false);
    setUploadProgress(null);

    // 4. Munculkan FeedbackModal setelah proses sinkronisasi Google Drive selesai
    if (successCount > 0 && errors.length === 0) {
      setFeedback({
        open: true,
        type: "success",
        title: "Foto Berhasil Ditambahkan",
        message: `Sebanyak ${successCount} foto lingkungan berhasil diunggah dan disinkronkan ke Google Drive.`,
      });
    } else if (successCount > 0 && errors.length > 0) {
      setFeedback({
        open: true,
        type: "warning",
        title: "Sebagian Foto Berhasil",
        message: `${successCount} foto berhasil diunggah, namun ${errors.length} foto gagal disinkronkan (${errors.join(", ")}).`,
      });
    } else if (errors.length > 0) {
      setFeedback({
        open: true,
        type: "error",
        title: "Gagal Mengunggah Foto",
        message: "Seluruh berkas foto gagal diunggah ke Google Drive. Harap periksa koneksi internet Anda.",
      });
    }
  };

  // Handler kamera GPS watermark (baik untuk foto baru maupun foto pengganti revisi)
  const handlePhotoCaptured = async (photo: CapturedPhoto) => {
    // 1. Tutup kamera modal segera agar user langsung kembali ke halaman klarifikasi
    setCameraModalOpen(false);

    const isReplacing = Boolean(activeReplaceTarget);
    const target = activeReplaceTarget;
    setActiveReplaceTarget(null);

    const tempId = `opt-cam-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const previewUrl = URL.createObjectURL(photo.file);

    if (isReplacing && target) {
      // Kasus Penggantian Foto RAB: masukkan segera ke Kolom 2 sebagai "REVISI" (Optimistic)
      const targetName = target.nama_label || target.nama_file?.replace(/\.[^/.]+$/, "") || "Foto RAB";

      const optimisticItem: KlarifikasiDokumenItem = {
        id: tempId,
        kategori_file: "FOTO_LINGKUNGAN",
        nama_file: photo.nama_label,
        nama_label: `Revisi - ${photo.nama_label}`,
        localPreviewUrl: previewUrl,
        uploading: true,
        sumber: "REVISI",
        catatan: `Foto revisi pengganti untuk eksisting RAB: "${targetName}"`,
        revisi_dari_url: target.file_url,
        revisi_dari_nama: targetName,
        revisi_dari_id: target.id,
        latitude: photo.latitude,
        longitude: photo.longitude,
        lokasi_wilayah: photo.lokasi_wilayah,
        timestamp_watermark: photo.timestamp,
      };

      // Hapus foto target dari antrean aktif dan masukkan kartu pengganti optimis di Kolom 2
      onChangeFotos((prev) => {
        const filtered = prev.filter(
          (p) =>
            !(
              p.kategori_file === "FOTO_LINGKUNGAN" &&
              (p.file_url === target.file_url ||
                (p.id && target.id && String(p.id) === String(target.id)) ||
                p.nama_file === target.nama_file)
            )
        );
        return [...filtered, optimisticItem];
      });

      // Upload ke Google Drive secara asinkron di background
      try {
        const formData = new FormData();
        formData.append("file", photo.file);
        formData.append("cabang", projectInfo.cabang || "TANPA CABANG");
        formData.append("kode", projectInfo.kode || "XXX");
        formData.append("nama_proyek", projectInfo.nama_proyek || "PROYEK");
        if (projectInfo.inisial) formData.append("inisial", projectInfo.inisial);
        formData.append("nomor_undangan", projectInfo.nomor_undangan || "DRAFT");
        formData.append("sub_folder", "Foto Lingkungan");
        formData.append("custom_name", photo.nama_label);

        const res = await fetch("/api/dc-development/klarifikasi-aanwijzing/upload", {
          method: "POST",
          body: formData,
        });

        const json = await res.json();
        if (json.status === "success" && json.data) {
          onChangeFotos((prev) =>
            prev.map((p) =>
              p.id === tempId
                ? {
                    ...p,
                    file_url: json.data.file_url,
                    drive_file_id: json.data.drive_file_id,
                    mime_type: json.data.mime_type,
                    uploading: false,
                  }
                : p
            )
          );

          setFeedback({
            open: true,
            type: "success",
            title: "Foto Berhasil Diganti",
            message: `Foto pengganti "${photo.nama_label}" telah berhasil diunggah ke Google Drive dan ditempatkan pada Kolom 2 (Status: REVISI).`,
          });
        } else {
          throw new Error(json.message || "Gagal mengunggah foto kamera.");
        }
      } catch (err: any) {
        // Kembalikan foto RAB asli jika gagal
        onChangeFotos((prev) => {
          const filtered = prev.filter((p) => p.id !== tempId);
          return [
            ...filtered,
            {
              id: target.id || `rab-${Date.now()}`,
              kategori_file: "FOTO_LINGKUNGAN",
              nama_file: target.nama_file,
              nama_label: target.nama_label || target.nama_file,
              file_url: target.file_url,
              drive_file_id: target.drive_file_id,
              mime_type: target.mime_type,
              latitude: target.latitude,
              longitude: target.longitude,
              lokasi_wilayah: target.lokasi_wilayah,
              timestamp_watermark: target.timestamp_watermark,
              sumber: "DARI_RAB",
            },
          ];
        });

        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Mengunggah Foto",
          message: err.message || "Terjadi kesalahan saat mengunggah foto kamera ke Google Drive.",
        });
      }
    } else {
      // Kasus Foto Baru murni di Kolom 2
      const optimisticItem: KlarifikasiDokumenItem = {
        id: tempId,
        kategori_file: "FOTO_LINGKUNGAN",
        nama_file: photo.nama_label,
        nama_label: photo.nama_label,
        localPreviewUrl: previewUrl,
        uploading: true,
        sumber: "BARU",
        latitude: photo.latitude,
        longitude: photo.longitude,
        lokasi_wilayah: photo.lokasi_wilayah,
        timestamp_watermark: photo.timestamp,
      };

      onChangeFotos((prev) => [...prev, optimisticItem]);

      try {
        const formData = new FormData();
        formData.append("file", photo.file);
        formData.append("cabang", projectInfo.cabang || "TANPA CABANG");
        formData.append("kode", projectInfo.kode || "XXX");
        formData.append("nama_proyek", projectInfo.nama_proyek || "PROYEK");
        if (projectInfo.inisial) formData.append("inisial", projectInfo.inisial);
        formData.append("nomor_undangan", projectInfo.nomor_undangan || "DRAFT");
        formData.append("sub_folder", "Foto Lingkungan");
        formData.append("custom_name", photo.nama_label);

        const res = await fetch("/api/dc-development/klarifikasi-aanwijzing/upload", {
          method: "POST",
          body: formData,
        });

        const json = await res.json();
        if (json.status === "success" && json.data) {
          onChangeFotos((prev) =>
            prev.map((p) =>
              p.id === tempId
                ? {
                    ...p,
                    file_url: json.data.file_url,
                    drive_file_id: json.data.drive_file_id,
                    mime_type: json.data.mime_type,
                    uploading: false,
                  }
                : p
            )
          );

          setFeedback({
            open: true,
            type: "success",
            title: "Foto Berhasil Ditambahkan",
            message: `Foto "${photo.nama_label}" berhasil disimpan ke Google Drive dengan cetakan GPS & waktu.`,
          });
        } else {
          throw new Error(json.message || "Gagal mengunggah foto.");
        }
      } catch (err: any) {
        onChangeFotos((prev) => prev.filter((p) => p.id !== tempId));
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Mengunggah Foto",
          message: err.message || "Terjadi kesalahan saat mengunggah foto ke Google Drive.",
        });
      }
    }
  };

  // Handler eksekusi upload file pengganti dari disk/komputer (Optimistic UI)
  const handleExecuteReplaceFile = async (file: File, target: any) => {
    if (!target) return;

    const targetName = target.nama_label || target.nama_file?.replace(/\.[^/.]+$/, "") || "Foto RAB";
    const tempId = `opt-disk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const previewUrl = URL.createObjectURL(file);

    // 1. Buat kartu optimis langsung di Kolom 2 seketika
    const optimisticItem: KlarifikasiDokumenItem = {
      id: tempId,
      kategori_file: "FOTO_LINGKUNGAN",
      nama_file: file.name,
      nama_label: `Revisi - ${targetName}`,
      file_url: null,
      localPreviewUrl: previewUrl,
      uploading: true,
      timestamp_watermark: new Date().toISOString(),
      sumber: "REVISI",
      catatan: `Foto revisi pengganti untuk eksisting RAB: "${targetName}"`,
      revisi_dari_url: target.file_url,
      revisi_dari_nama: targetName,
      revisi_dari_id: target.id,
    };

    // Hapus dari antrean Kolom 1 dan tambahkan ke Kolom 2 secara optimis
    onChangeFotos((prev) => {
      const filtered = prev.filter(
        (p) =>
          !(
            p.kategori_file === "FOTO_LINGKUNGAN" &&
            (p.file_url === target.file_url ||
              (p.id && target.id && String(p.id) === String(target.id)) ||
              p.nama_file === target.nama_file)
          )
      );
      return [...filtered, optimisticItem];
    });

    // 2. Eksekusi upload ke Google Drive di background
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("cabang", projectInfo.cabang || "TANPA CABANG");
      formData.append("kode", projectInfo.kode || "XXX");
      formData.append("nama_proyek", projectInfo.nama_proyek || "PROYEK");
      if (projectInfo.inisial) formData.append("inisial", projectInfo.inisial);
      formData.append("nomor_undangan", projectInfo.nomor_undangan || "DRAFT");
      formData.append("sub_folder", "Foto Lingkungan");
      formData.append("custom_name", `Revisi - ${targetName}`);

      const res = await fetch("/api/dc-development/klarifikasi-aanwijzing/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.status === "success" && json.data) {
        onChangeFotos((prev) =>
          prev.map((p) =>
            p.id === tempId
              ? {
                  ...p,
                  file_url: json.data.file_url,
                  drive_file_id: json.data.drive_file_id,
                  mime_type: json.data.mime_type,
                  uploading: false,
                }
              : p
          )
        );

        setFeedback({
          open: true,
          type: "success",
          title: "Foto Berhasil Diganti",
          message: `Foto pengganti "${targetName}" telah berhasil diunggah ke Google Drive dan ditempatkan pada Kolom 2 (Status: REVISI).`,
        });
      } else {
        throw new Error(json.message || "Gagal mengunggah berkas foto pengganti.");
      }
    } catch (err: any) {
      // Kembalikan foto RAB asli jika gagal
      onChangeFotos((prev) => {
        const filtered = prev.filter((p) => p.id !== tempId);
        return [
          ...filtered,
          {
            id: target.id || `rab-${Date.now()}`,
            kategori_file: "FOTO_LINGKUNGAN",
            nama_file: target.nama_file,
            nama_label: target.nama_label || target.nama_file,
            file_url: target.file_url,
            drive_file_id: target.drive_file_id,
            mime_type: target.mime_type,
            latitude: target.latitude,
            longitude: target.longitude,
            lokasi_wilayah: target.lokasi_wilayah,
            timestamp_watermark: target.timestamp_watermark,
            sumber: "DARI_RAB",
          },
        ];
      });

      setFeedback({
        open: true,
        type: "error",
        title: "Gagal Mengunggah Foto",
        message: err.message || "Terjadi kesalahan saat mengunggah berkas foto pengganti ke Google Drive.",
      });
    }
  };

  // Batalkan penggantian foto dan kembalikan foto asli RAB ke antrean klarifikasi
  const handleRevertPhotoToRab = (rabFoto: any) => {
    const displayName =
      rabFoto.nama_label ||
      rabFoto.nama_file?.replace(/\.[^/.]+$/, "") ||
      "Foto RAB";

    onChangeFotos((prev) => {
      // 1. Hapus item revisi penggantinya dari klarifikasi
      const filtered = prev.filter(
        (p) =>
          !(
            p.kategori_file === "FOTO_LINGKUNGAN" &&
            p.sumber === "REVISI" &&
            (p.revisi_dari_url === rabFoto.file_url ||
              (p.revisi_dari_id && rabFoto.id && String(p.revisi_dari_id) === String(rabFoto.id)) ||
              p.revisi_dari_nama === displayName)
          )
      );

      // 2. Kembalikan item asli RAB ke dalam klarifikasi dengan sumber DARI_RAB
      const restoredRabItem: KlarifikasiDokumenItem = {
        id: rabFoto.id || `rab-${Date.now()}`,
        kategori_file: "FOTO_LINGKUNGAN",
        nama_file: rabFoto.nama_file,
        nama_label: rabFoto.nama_label || rabFoto.nama_file,
        file_url: rabFoto.file_url,
        drive_file_id: rabFoto.drive_file_id,
        mime_type: rabFoto.mime_type,
        latitude: rabFoto.latitude,
        longitude: rabFoto.longitude,
        lokasi_wilayah: rabFoto.lokasi_wilayah,
        timestamp_watermark: rabFoto.timestamp_watermark,
        sumber: "DARI_RAB",
      };

      return [...filtered, restoredRabItem];
    });

    setFeedback({
      open: true,
      type: "success",
      title: "Penggantian Dibatalkan",
      message: `Foto "${displayName}" telah dikembalikan sesuai dokumen asli Penawaran RAB/OE.`,
    });
  };

  // Hapus foto RAB dari Berita Acara Klarifikasi (TIDAK menyentuh atau menghapus database RAB penawaran!)
  const handleDeleteRabPhotoFromKlarifikasi = (rabFoto: any) => {
    const displayName =
      rabFoto.nama_label ||
      rabFoto.nama_file?.replace(/\.[^/.]+$/, "") ||
      "Foto RAB";

    onChangeFotos((prev) =>
      prev.filter(
        (p) =>
          !(
            p.kategori_file === "FOTO_LINGKUNGAN" &&
            (p.file_url === rabFoto.file_url ||
              p.nama_file === rabFoto.nama_file ||
              (p.id && rabFoto.id && String(p.id) === String(rabFoto.id)) ||
              (p.revisi_dari_url && p.revisi_dari_url === rabFoto.file_url) ||
              (p.revisi_dari_id && rabFoto.id && String(p.revisi_dari_id) === String(rabFoto.id)) ||
              (p.revisi_dari_nama && p.revisi_dari_nama === displayName))
          )
      )
    );
  };

  // Pulihkan foto RAB yang sebelumnya dihapus dari Berita Acara Klarifikasi
  const handleRestoreDeletedRabPhoto = (rabFoto: any) => {
    const displayName =
      rabFoto.nama_label ||
      rabFoto.nama_file?.replace(/\.[^/.]+$/, "") ||
      "Foto RAB";

    onChangeFotos((prev) => {
      const exists = prev.some(
        (p) =>
          p.kategori_file === "FOTO_LINGKUNGAN" &&
          (p.file_url === rabFoto.file_url ||
            p.nama_file === rabFoto.nama_file ||
            (p.id && rabFoto.id && String(p.id) === String(rabFoto.id)))
      );
      if (exists) return prev;

      const restoredRabItem: KlarifikasiDokumenItem = {
        id: rabFoto.id || `rab-${Date.now()}`,
        kategori_file: "FOTO_LINGKUNGAN",
        nama_file: rabFoto.nama_file,
        nama_label: rabFoto.nama_label || rabFoto.nama_file,
        file_url: rabFoto.file_url,
        drive_file_id: rabFoto.drive_file_id,
        mime_type: rabFoto.mime_type,
        latitude: rabFoto.latitude,
        longitude: rabFoto.longitude,
        lokasi_wilayah: rabFoto.lokasi_wilayah,
        timestamp_watermark: rabFoto.timestamp_watermark,
        sumber: "DARI_RAB",
      };

      return [...prev, restoredRabItem];
    });

    setFeedback({
      open: true,
      type: "success",
      title: "Foto Berhasil Dipulihkan",
      message: `Foto "${displayName}" telah dimasukkan kembali ke dalam Berita Acara Klarifikasi.`,
    });
  };

  // Hapus foto baru atau foto revisi dari Kolom 2
  const handleRemoveBaruPhoto = (fotoItem: KlarifikasiDokumenItem) => {
    onChangeFotos((prev) => {
      const filtered = prev.filter((p) => {
        if (p.kategori_file !== "FOTO_LINGKUNGAN") return true;
        if (fotoItem.id && p.id) {
          return String(p.id) !== String(fotoItem.id);
        }
        return p.file_url !== fotoItem.file_url && p.nama_file !== fotoItem.nama_file;
      });

      // Jika foto yang dihapus adalah foto REVISI yang menggantikan foto RAB, pulihkan kembali foto RAB aslinya
      if (fotoItem.sumber === "REVISI" && (fotoItem.revisi_dari_url || fotoItem.revisi_dari_id)) {
        const originalRab = rabFotoList.find(
          (r: any) =>
            r.file_url === fotoItem.revisi_dari_url ||
            (r.id && fotoItem.revisi_dari_id && String(r.id) === String(fotoItem.revisi_dari_id)) ||
            (fotoItem.revisi_dari_nama && (r.nama_label === fotoItem.revisi_dari_nama || r.nama_file === fotoItem.revisi_dari_nama))
        );

        if (originalRab) {
          const restoredRab: KlarifikasiDokumenItem = {
            id: originalRab.id || `rab-${Date.now()}`,
            kategori_file: "FOTO_LINGKUNGAN",
            nama_file: originalRab.nama_file,
            nama_label: originalRab.nama_label || originalRab.nama_file,
            file_url: originalRab.file_url,
            drive_file_id: originalRab.drive_file_id,
            mime_type: originalRab.mime_type,
            latitude: originalRab.latitude,
            longitude: originalRab.longitude,
            lokasi_wilayah: originalRab.lokasi_wilayah,
            timestamp_watermark: originalRab.timestamp_watermark,
            sumber: "DARI_RAB",
          };
          return [...filtered, restoredRab];
        }
      }

      return filtered;
    });
  };

  // Pisahkan foto eksisting acuan RAB (Kolom 1)
  const rabFotos = (
    rabFotoList.length > 0
      ? rabFotoList
      : klarifikasiFotoList.filter((f) => f.sumber === "DARI_RAB")
  ).filter((f) => f.kategori_file === "FOTO_LINGKUNGAN");

  // Foto Tambahan / Revisi untuk Kolom 2 (hanya yang bersumber BARU atau REVISI)
  const baruFotos = klarifikasiFotoList.filter(
    (f) =>
      f.kategori_file === "FOTO_LINGKUNGAN" &&
      (f.sumber === "BARU" || f.sumber === "REVISI")
  );

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border p-5 space-y-4 shadow-xs transition-all duration-200",
        pinpoint?.isFlagged && !pinpoint.isModified
          ? "border-amber-400 ring-2 ring-amber-300/40 bg-amber-50/10"
          : "border-slate-200/80 hover:border-slate-300"
      )}
    >
      {/* Header Card */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/70 text-[#E65F2B] flex items-center justify-center shrink-0">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Foto Lingkungan &amp; Eksisting Lapangan
              </h3>
              {pinpoint?.isFlagged && (
                <RevisionPinpointBadge
                  catatan={pinpoint.catatan}
                  isModified={pinpoint.isModified}
                  label="Revisi Foto Lapangan"
                />
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Komparasi berdampingan: Foto eksisting penawaran RAB/OE di Kolom 1 dan foto tambahan / revisi klarifikasi baru di Kolom 2.
            </p>
          </div>
        </div>
      </div>

      {/* DUA KOLOM / DUA BAGIAN TERPISAH */}
      <div className="space-y-4">
        {/* BAGIAN 1: FOTO DOKUMENTASI EKSISTING DARI PENAWARAN RAB/OE (BASELINE) */}
        <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                1
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Kolom 1: Berkas Foto Eksisting Penawaran RAB/OE
                </h4>
                <p className="text-[10px] text-slate-400">
                  Foto acuan dari penawaran RAB/OE. Anda dapat mengganti (upload ulang) atau mengecualikan foto dari berita acara tanpa mengubah berkas asli RAB.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
              {rabFotos.length} Foto Acuan RAB
            </span>
          </div>

          {rabFotos.length === 0 ? (
            <div className="p-6 border border-dashed border-slate-200 bg-white rounded-xl text-center text-xs text-slate-400 italic">
              Tidak ada dokumentasi foto lingkungan pada berkas penawaran RAB/OE.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rabFotos.map((foto, index) => {
                const rawName =
                  foto.nama_label?.trim() ||
                  (foto.nama_file
                    ? foto.nama_file.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ")
                    : `Foto #${index + 1}`);
                const displayName = toTitleCase(rawName);

                // Cek apakah foto ini diganti oleh revisi baru di klarifikasi
                const replacedBy = klarifikasiFotoList.find(
                  (k) =>
                    k.kategori_file === "FOTO_LINGKUNGAN" &&
                    k.sumber === "REVISI" &&
                    ((k.revisi_dari_url && k.revisi_dari_url === foto.file_url) ||
                      (k.revisi_dari_id && foto.id && String(k.revisi_dari_id) === String(foto.id)) ||
                      (k.revisi_dari_nama && k.revisi_dari_nama === displayName))
                );

                // Cek apakah foto ini aktif di berita acara klarifikasi
                const isIncluded = klarifikasiFotoList.some(
                  (k) =>
                    k.kategori_file === "FOTO_LINGKUNGAN" &&
                    (k.file_url === foto.file_url ||
                      (k.id && foto.id && String(k.id) === String(foto.id)) ||
                      k.nama_file === foto.nama_file)
                );

                const isReplaced = Boolean(replacedBy);
                const isReplacingNow = replacedBy?.uploading === true;
                const isExcluded = !isReplaced && !isIncluded;
                const isActive = !isReplaced && isIncluded;

                return (
                  <div
                    key={`rab_card_${foto.id ?? "item"}_${index}_${foto.nama_file || ""}_${foto.file_url || ""}`}
                    className={cn(
                      "rounded-xl p-3 flex flex-col justify-between gap-2.5 transition-all shadow-2xs border",
                      isReplaced
                        ? "bg-amber-50/40 border-amber-300 ring-1 ring-amber-200/60"
                        : isExcluded
                        ? "bg-slate-100/70 border-slate-300 opacity-80"
                        : "bg-white border-slate-200"
                    )}
                  >
                    <div>
                      {/* Top Bar Status */}
                      <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          RAB #{index + 1}
                        </span>

                        {isReplacingNow ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 animate-pulse">
                            <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-600" />
                            Sedang Diganti...
                          </span>
                        ) : isReplaced ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                            Diganti di Kolom 2
                          </span>
                        ) : isExcluded ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                            Dihapus dari Berita Acara
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Aktif Sesuai RAB
                          </span>
                        )}
                      </div>

                      {/* Info Foto */}
                      <div className="space-y-1 min-w-0 pt-2">
                        <div
                          className={cn(
                            "text-xs font-bold truncate",
                            isExcluded ? "text-slate-400 line-through" : "text-slate-800"
                          )}
                          title={displayName}
                        >
                          {displayName}
                        </div>

                        {(foto.lokasi_wilayah || (foto.latitude && foto.longitude)) && (
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-[#E65F2B] shrink-0" />
                            <span className="truncate">
                              {foto.lokasi_wilayah || `${foto.latitude?.toFixed(4)}, ${foto.longitude?.toFixed(4)}`}
                            </span>
                          </div>
                        )}

                        {foto.timestamp_watermark && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{new Date(foto.timestamp_watermark).toLocaleString("id-ID")}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-100">
                      {foto.file_url && (
                        <a
                          href={foto.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                          <span>Buka Foto Asli RAB</span>
                        </a>
                      )}

                      {/* Tombol aksi sesuai status */}
                      {isReplaced ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isReplacingNow}
                          onClick={() => handleRevertPhotoToRab(foto)}
                          className="w-full h-7 rounded-lg text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300 cursor-pointer disabled:opacity-50"
                        >
                          <Undo2 className="w-3 h-3 mr-1" /> Batal Ganti (Kembali ke Asli)
                        </Button>
                      ) : isExcluded ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreDeletedRabPhoto(foto)}
                          className="w-full h-7 rounded-lg text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" /> Pulihkan ke Berita Acara
                        </Button>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setActiveReplaceTarget(foto);
                              setReplaceDialogOpen(true);
                            }}
                            className="h-7 rounded-lg text-[10px] font-bold text-slate-700 hover:text-[#E65F2B] hover:bg-orange-50 border-slate-200 hover:border-orange-200 cursor-pointer"
                            title="Ganti / upload foto baru untuk menggantikan foto RAB ini di Kolom 2"
                          >
                            <RefreshCw className="w-3 h-3 mr-1 text-[#E65F2B]" /> Ganti Foto
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRabPhotoFromKlarifikasi(foto)}
                            className="h-7 rounded-lg text-[10px] font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Keluarkan foto ini dari berita acara klarifikasi"
                          >
                            <Trash2 className="w-3 h-3 mr-1 text-rose-500" /> Hapus
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* BAGIAN 2: FOTO DOKUMENTASI LAPANGAN TAMBAHAN KLARIFIKASI AANWIJZING (KOLOM 2) */}
        <div className="space-y-3 bg-white p-4 rounded-2xl border border-orange-200/80 shadow-2xs">
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-orange-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-[#E65F2B] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                2
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Kolom 2: Berkas Foto Tambahan / Revisi Klarifikasi Aanwijzing
                </h4>
                <p className="text-[10px] text-slate-400">
                  Dokumentasi foto baru lapangan atau foto revisi pengganti yang disepakati saat aanwijzing.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isUploadingBatch && uploadProgress && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-[11px] font-bold text-[#E65F2B] animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Mengunggah {uploadProgress.current}/{uploadProgress.total}...</span>
                </div>
              )}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-[#E65F2B] border border-orange-200">
                {baruFotos.length} Foto Klarifikasi
              </span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  handleSelectFiles(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="border-slate-300 text-slate-700 hover:bg-slate-50 text-[11px] h-8 rounded-lg font-bold cursor-pointer"
              >
                <Upload className="w-3 h-3 mr-1" /> Unggah Foto
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setActiveReplaceTarget(null);
                  setCameraModalOpen(true);
                }}
                className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-[11px] h-8 rounded-lg font-bold shadow-xs cursor-pointer"
              >
                <Camera className="w-3 h-3 mr-1" /> Kamera GPS
              </Button>
            </div>
          </div>

          {baruFotos.length === 0 ? (
            <div className="p-8 border-2 border-dashed border-orange-200/70 bg-orange-50/20 rounded-xl text-center flex flex-col items-center justify-center gap-2">
              <Camera className="w-7 h-7 text-[#E65F2B]/60" />
              <p className="text-xs font-bold text-slate-700">Belum ada foto tambahan / revisi klarifikasi</p>
              <p className="text-[11px] text-slate-400 max-w-sm">
                Gunakan &ldquo;Kamera GPS&rdquo; untuk mengambil foto langsung di lapangan dengan cetakan GPS &amp; waktu otomatis, &ldquo;Unggah Foto&rdquo;, atau klik &ldquo;Ganti Foto&rdquo; pada Kolom 1.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {baruFotos.map((foto, index) => {
                const rawName =
                  foto.nama_label?.trim() ||
                  (foto.nama_file
                    ? foto.nama_file.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ")
                    : `Foto Baru #${index + 1}`);
                const displayName = toTitleCase(rawName);
                const isRevision = foto.sumber === "REVISI";
                const isCurrentlyUploading = foto.uploading === true;
                const imageSrc = foto.localPreviewUrl || foto.file_url;

                return (
                  <div
                    key={`baru_card_${foto.id ?? "item"}_${index}_${foto.nama_file || ""}_${foto.file_url || ""}`}
                    className={cn(
                      "bg-white border rounded-xl p-3 flex flex-col justify-between gap-2.5 shadow-2xs hover:shadow-xs transition-all relative overflow-hidden",
                      isCurrentlyUploading
                        ? "border-orange-400 ring-2 ring-orange-300/40 bg-orange-50/20"
                        : "border-orange-200/90"
                    )}
                  >
                    <div>
                      {/* Top Bar Status */}
                      <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-800 bg-orange-50 px-2 py-0.5 rounded text-[#E65F2B]">
                            Klarifikasi #{index + 1}
                          </span>
                          {isCurrentlyUploading ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-900 border border-orange-300 flex items-center gap-1 animate-pulse">
                              <Loader2 className="w-2.5 h-2.5 animate-spin text-[#E65F2B]" />
                              Mengunggah ke Drive...
                            </span>
                          ) : isRevision ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              Foto Revisi
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Foto Baru
                            </span>
                          )}
                        </div>

                        {!isCurrentlyUploading && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBaruPhoto(foto)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus foto klarifikasi ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Thumbnail Preview jika tersedia */}
                      {imageSrc && (
                        <div className="relative h-28 w-full mt-2 rounded-lg overflow-hidden bg-slate-100 border border-slate-200/80">
                          <img
                            src={imageSrc}
                            alt={displayName}
                            className={cn(
                              "w-full h-full object-cover transition-opacity",
                              isCurrentlyUploading ? "opacity-60" : "opacity-100"
                            )}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                          {isCurrentlyUploading && (
                            <div className="absolute inset-0 bg-slate-900/30 flex flex-col items-center justify-center gap-1 text-white text-[10px] font-bold">
                              <Loader2 className="w-5 h-5 animate-spin text-white" />
                              <span>Menyimpan ke Drive...</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Info Detail */}
                      <div className="space-y-1 min-w-0 pt-2">
                        <div className="text-xs font-bold text-slate-900 truncate" title={displayName}>
                          {displayName}
                        </div>

                        {foto.revisi_dari_nama && (
                          <div className="text-[10px] text-amber-800 bg-amber-50/80 p-1 rounded border border-amber-200 truncate">
                            Pengganti untuk: <span className="font-semibold">{foto.revisi_dari_nama}</span>
                          </div>
                        )}

                        {(foto.lokasi_wilayah || (foto.latitude && foto.longitude)) && (
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-[#E65F2B] shrink-0" />
                            <span className="truncate">
                              {foto.lokasi_wilayah || `${foto.latitude?.toFixed(4)}, ${foto.longitude?.toFixed(4)}`}
                            </span>
                          </div>
                        )}

                        {foto.timestamp_watermark && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{new Date(foto.timestamp_watermark).toLocaleString("id-ID")}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-1 border-t border-slate-100">
                      {isCurrentlyUploading ? (
                        <div className="w-full p-1.5 rounded-lg border border-orange-200 bg-orange-50 text-[10px] text-orange-800 font-bold flex items-center justify-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin text-[#E65F2B]" />
                          <span>Menyinkronkan ke Google Drive...</span>
                        </div>
                      ) : foto.file_url ? (
                        <a
                          href={foto.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full inline-flex items-center justify-center gap-1.5 p-1.5 rounded-lg bg-orange-50 hover:bg-[#E65F2B] text-[#E65F2B] hover:text-white border border-orange-200 text-[11px] font-bold transition-all shadow-2xs"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Buka Foto di Drive</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Input File Tersembunyi untuk Eksekusi Penggantian Foto Tunggal */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && activeReplaceTarget) {
            // Tutup pop-up segera dan proses upload
            const target = activeReplaceTarget;
            setReplaceDialogOpen(false);
            setActiveReplaceTarget(null);
            handleExecuteReplaceFile(f, target);
          }
          e.target.value = "";
        }}
        className="hidden"
      />

      {/* Modal Dialog: Opsi Ganti / Upload Ulang Foto RAB */}
      {replaceDialogOpen && activeReplaceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 text-[#E65F2B] flex items-center justify-center shrink-0">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Ganti Foto Eksisting RAB
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Pilih metode untuk mengambil / mengunggah foto pengganti di Kolom 2.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReplaceDialogOpen(false);
                  setActiveReplaceTarget(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Foto Target:</span>
              <p className="font-bold text-slate-800">
                {activeReplaceTarget.nama_label || activeReplaceTarget.nama_file || "Foto RAB"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Button
                type="button"
                onClick={() => {
                  setReplaceDialogOpen(false);
                  setCameraModalOpen(true);
                }}
                className="h-16 flex flex-col items-center justify-center gap-1.5 bg-[#E65F2B] hover:bg-[#d04f1f] text-white rounded-xl shadow-xs cursor-pointer font-bold text-xs"
              >
                <Camera className="w-5 h-5" />
                <span>Ambil Kamera GPS</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  replaceFileInputRef.current?.click();
                }}
                className="h-16 flex flex-col items-center justify-center gap-1.5 border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl cursor-pointer font-bold text-xs"
              >
                <Upload className="w-5 h-5 text-slate-600" />
                <span>Pilih Berkas dari Disk</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reusable: Upload Foto Lingkungan dari Disk (Batch) */}
      <UploadFotoLingkunganModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        files={pendingUploadFiles}
        isUploading={false}
        uploadProgress={null}
        onConfirmUpload={handleConfirmBatchUpload}
      />

      {/* Modal Reusable: Kamera GPS Watermark */}
      <CameraWatermarkModal
        open={cameraModalOpen}
        onOpenChange={(open) => {
          setCameraModalOpen(open);
          if (!open) {
            setActiveReplaceTarget(null);
          }
        }}
        projectName={projectInfo.nama_proyek || "DC Development"}
        branchName={projectInfo.cabang || "Cabang"}
        onPhotoCaptured={handlePhotoCaptured}
      />

      {/* Feedback Modal Standar SPARTA */}
      <FeedbackModal
        open={feedback.open}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
