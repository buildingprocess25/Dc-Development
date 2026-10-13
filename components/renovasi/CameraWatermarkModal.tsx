"use client";

import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertModal } from "@/components/ui/alert-modal";
import { Camera, RefreshCw, Check, X, MapPin, Clock, AlertCircle } from "lucide-react";
import { toTitleCase } from "@/lib/utils";

export interface CapturedPhoto {
  file: File;
  previewUrl: string;
  latitude: number | null;
  longitude: number | null;
  timestamp: Date;
  nama_label: string;
  kecamatan?: string;
  kabupaten?: string;
  lokasi_wilayah?: string;
}

interface CameraWatermarkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName?: string;
  branchName?: string;
  onPhotoCaptured: (photo: CapturedPhoto) => void;
}

export default function CameraWatermarkModal({
  open,
  onOpenChange,
  projectName = "DC Development",
  branchName = "Cabang",
  onPhotoCaptured
}: CameraWatermarkModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [namaLabel, setNamaLabel] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [addressInfo, setAddressInfo] = useState<{
    kecamatan: string;
    kabupaten: string;
    provinsi: string;
    formattedText: string;
    loading: boolean;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasCameraError, setHasCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    open: boolean;
    type: "warning" | "error" | "success";
    title: string;
    message: string;
  }>({
    open: false,
    type: "warning",
    title: "",
    message: ""
  });

  // Mulai Geolocation & Reverse Geocode saat modal terbuka
  useEffect(() => {
    if (open) {
      if (typeof window !== "undefined" && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setLocation({ lat, lng });
            setLocationError(null);

            setAddressInfo({
              kecamatan: "",
              kabupaten: "",
              provinsi: "",
              formattedText: "Mencari wilayah (Kecamatan, Kabupaten)...",
              loading: true
            });

            try {
              const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
              if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) {
                  setAddressInfo({
                    kecamatan: json.data.kecamatan || "",
                    kabupaten: json.data.kabupaten || "",
                    provinsi: json.data.provinsi || "",
                    formattedText: json.data.formattedText || "",
                    loading: false
                  });
                  return;
                }
              }
            } catch (err) {
              console.warn("Geocoding fetch warning:", err);
            }

            // Fallback jika API geocode tidak merespons
            setAddressInfo({
              kecamatan: "",
              kabupaten: "",
              provinsi: "",
              formattedText: `${projectName.toUpperCase()} • ${branchName.toUpperCase()}`,
              loading: false
            });
          },
          (err) => {
            console.warn("Geolocation warning:", err.message);
            setLocationError("Lokasi GPS tidak diizinkan / tidak tersedia");
            setAddressInfo(null);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    }
  }, [open]);

  // Mulai Kamera
  const startCamera = async (mode: "environment" | "user") => {
    try {
      setHasCameraError(null);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      const isPermission =
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError" ||
        err.message?.toLowerCase().includes("permission") ||
        err.message?.toLowerCase().includes("denied") ||
        err.message?.toLowerCase().includes("dismissed");

      if (isPermission) {
        setHasCameraError("Izin kamera belum diberikan atau ditutup oleh browser.");
        setAlertConfig({
          open: true,
          type: "warning",
          title: "Butuh Izin Akses Kamera",
          message:
            "Aplikasi membutuhkan izin akses kamera untuk mengambil foto dokumentasi lingkungan proyek. Silakan klik ikon gembok / kamera di sebelah kiri bilah URL browser Anda untuk mengaktifkan izin, kemudian coba lagi."
        });
      } else {
        setHasCameraError(err.message || "Tidak dapat mengakses kamera");
        setAlertConfig({
          open: true,
          type: "error",
          title: "Kamera Tidak Tersedia",
          message:
            err.message || "Tidak dapat menemukan perangkat kamera yang aktif pada perangkat Anda."
        });
      }
    }
  };

  useEffect(() => {
    if (open && !capturedImage) {
      startCamera(facingMode);
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [open, facingMode]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setCapturedBlob(null);
    setNamaLabel("");
    setAddressInfo(null);
    onOpenChange(false);
  };

  // Switch Depan / Belakang
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Ambil Foto & Gambar Watermark ke Canvas
  const handleCapture = () => {
    if (!videoRef.current) return;
    setIsProcessing(true);

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      setIsProcessing(false);
      return;
    }

    // Gambar frame video
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Siapkan teks Watermark
    const captureTime = new Date();
    const dateStr = captureTime.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "medium"
    }) + " WIB";

    const locText = location
      ? `LAT: ${location.lat.toFixed(6)}, LNG: ${location.lng.toFixed(6)}`
      : "GPS: LOKASI TIDAK TERSEDIA";

    // Gunakan lokasi riil wilayah (Kecamatan & Kabupaten) dari reverse geocoding
    const displayLocation = addressInfo?.formattedText
      ? addressInfo.formattedText
      : (location ? `LAT: ${location.lat.toFixed(6)}, LNG: ${location.lng.toFixed(6)}` : `${projectName.toUpperCase()} • ${branchName.toUpperCase()}`);

    // Dimensi strip banner watermark
    const bannerHeight = Math.max(70, Math.floor(canvas.height * 0.12));
    const bannerY = canvas.height - bannerHeight;

    // Background semi-transparent hitam pekat
    ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
    ctx.fillRect(0, bannerY, canvas.width, bannerHeight);

    // Garis aksen oranye khas Alfamart di atas strip
    ctx.fillStyle = "#E65F2B";
    ctx.fillRect(0, bannerY, canvas.width, 4);

    // Font setting
    const fontSizeTitle = Math.max(14, Math.floor(bannerHeight * 0.28));
    const fontSizeSub = Math.max(12, Math.floor(bannerHeight * 0.24));

    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${fontSizeTitle}px sans-serif`;
    ctx.fillText(`📍 ${displayLocation}`, 20, bannerY + fontSizeTitle + 14);

    ctx.font = `normal ${fontSizeSub}px monospace`;
    ctx.fillStyle = "#CBD5E1";
    ctx.fillText(`🌐 ${locText}   |   ⏰ ${dateStr}`, 20, bannerY + fontSizeTitle + fontSizeSub + 24);

    // Convert ke DataURL & Blob
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedBlob(blob);
        setCapturedImage(dataUrl);
        stopCamera();
      }
      setIsProcessing(false);
    }, "image/jpeg", 0.9);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedBlob(null);
    setNamaLabel("");
    startCamera(facingMode);
  };

  const handleConfirm = () => {
    if (!capturedBlob || !capturedImage) return;

    const labelClean = toTitleCase(
      namaLabel.trim() || `Foto Lingkungan - ${new Date().toLocaleTimeString("id-ID")}`
    );
    const filename = `foto-lingkungan-${Date.now()}.jpg`;
    const photoFile = new File([capturedBlob], filename, { type: "image/jpeg" });

    onPhotoCaptured({
      file: photoFile,
      previewUrl: capturedImage,
      latitude: location ? location.lat : null,
      longitude: location ? location.lng : null,
      timestamp: new Date(),
      nama_label: labelClean,
      kecamatan: addressInfo?.kecamatan,
      kabupaten: addressInfo?.kabupaten,
      lokasi_wilayah: addressInfo?.formattedText
    });

    handleClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-slate-900 border-slate-800 text-white shadow-2xl [&>button]:hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#E65F2B]" />
            <DialogTitle className="text-sm font-bold text-white uppercase tracking-wider">
              Kamera Lapangan & Watermark GPS
            </DialogTitle>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <DialogDescription className="sr-only">
          Ambil foto lingkungan renovasi langsung dengan kamera dan watermark otomatis koordinat GPS dan waktu.
        </DialogDescription>

        {/* Video / Preview Viewport */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          {hasCameraError ? (
            <div className="flex flex-col items-center justify-center p-6 text-center text-amber-400 max-w-sm mx-auto">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                <AlertCircle className="w-7 h-7 text-amber-500" />
              </div>
              <p className="text-sm font-bold text-white mb-1">Izin Kamera Diperlukan</p>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                {hasCameraError}
                <br />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Silakan izinkan akses kamera pada ikon gembok di bilah URL browser Anda.
                </span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs h-9 px-4 rounded-xl"
                >
                  Tutup
                </Button>
                <Button
                  onClick={() => startCamera(facingMode)}
                  className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs h-9 px-4 rounded-xl font-semibold shadow-md shadow-[#E65F2B]/20"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Minta Izin & Coba Lagi
                </Button>
              </div>
            </div>
          ) : capturedImage ? (
            <img
              src={capturedImage}
              alt="Hasil Foto"
              className="w-full h-full object-contain"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Watermark Overlay Live Preview di Kamera */}
              <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 backdrop-blur-xs border-t-2 border-[#E65F2B] px-4 py-2.5 flex flex-col gap-1 text-[11px] select-none pointer-events-none">
                <div className="flex items-center gap-1.5 font-bold text-white truncate">
                  <MapPin className="w-3.5 h-3.5 text-[#E65F2B] shrink-0" />
                  <span className="truncate">
                    {addressInfo?.loading ? (
                      <span className="text-amber-400 font-medium animate-pulse">
                        Mencari wilayah (Kecamatan, Kabupaten)...
                      </span>
                    ) : addressInfo?.formattedText ? (
                      <span>{addressInfo.formattedText}</span>
                    ) : location ? (
                      `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                    ) : (
                      `${projectName} • ${branchName}`
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300 font-mono text-[10px]">
                  <span>
                    {location
                      ? `LAT: ${location.lat.toFixed(6)}, LNG: ${location.lng.toFixed(6)}`
                      : locationError || "Mencari lokasi GPS..."}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> Real-time WIB
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Controls */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col gap-3">
          {capturedImage ? (
            <div className="flex flex-col gap-3 animate-in fade-in duration-200">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">
                  Nama / Keterangan Foto <span className="text-rose-400">*</span>
                </label>
                <Input
                  value={namaLabel}
                  onChange={(e) => setNamaLabel(e.target.value)}
                  onBlur={(e) => setNamaLabel(toTitleCase(e.target.value))}
                  placeholder="Contoh: Kondisi Atap Bocor / Dinding Retak"
                  className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 h-10 text-sm focus-visible:ring-[#E65F2B]"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRetake}
                  className="bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs h-10 px-4"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" /> Foto Ulang
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!namaLabel.trim()}
                  className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-semibold text-xs h-10 px-6 shadow-md transition-all disabled:opacity-50"
                >
                  <Check className="w-4 h-4 mr-2" /> Gunakan Foto Ini
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={handleToggleFacingMode}
                className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs h-10 px-3"
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Putar Kamera
              </Button>

              <button
                type="button"
                onClick={handleCapture}
                disabled={isProcessing || !!hasCameraError}
                className="w-14 h-14 rounded-full bg-white hover:bg-slate-200 p-1 flex items-center justify-center shadow-lg transition-transform active:scale-95 disabled:opacity-50"
              >
                <div className="w-11 h-11 rounded-full border-2 border-slate-950 bg-[#E65F2B]" />
              </button>

              <div className="w-24 text-right">
                <span className="text-[10px] text-slate-400">Tekan tombol untuk ambil foto</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Alert Modal Pop-up Butuh Izin Akses Kamera */}
    <AlertModal
      open={alertConfig.open}
      onOpenChange={(isOpen) => setAlertConfig((prev) => ({ ...prev, open: isOpen }))}
      type={alertConfig.type}
      title={alertConfig.title}
      message={alertConfig.message}
      confirmText="Oke, Mengerti"
    />
    </>
  );
}
