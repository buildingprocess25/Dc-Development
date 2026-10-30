"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Camera,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { formatDistance, reverseGeocodeCoords, getIpLocationFallback } from "@/lib/geolocation";
import { cn } from "@/lib/utils";

export interface ScannerKehadiranKontraktorModalProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  aanwijzingId: number | null;
  nomorUndangan?: string;
  namaProyek?: string;
  onSuccess?: () => void;
}

export function ScannerKehadiranKontraktorModal({
  open,
  isOpen,
  onOpenChange,
  onClose,
  aanwijzingId,
  nomorUndangan,
  namaProyek,
  onSuccess,
}: ScannerKehadiranKontraktorModalProps) {
  const effectiveOpen = open !== undefined ? open : !!isOpen;

  const handleClose = useCallback(() => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  }, [onOpenChange, onClose]);
  const [scannerActive, setScannerActive] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [scanSuccess, setScanSuccess] = useState<boolean>(false);
  const [resultData, setResultData] = useState<{
    nama_perusahaan?: string;
    absen_at?: string;
    absen_distance_meter?: number | null;
    absen_address?: string | null;
  } | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat?: number; long?: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"getting" | "ready" | "error">("getting");

  // Lokasi Fisik Terbaca Otomatis dari GPS (Kecamatan & Kabupaten/Kota)
  const [detectedKecamatan, setDetectedKecamatan] = useState<string>("");
  const [detectedKabupaten, setDetectedKabupaten] = useState<string>("");
  const [detectingAddress, setDetectingAddress] = useState<boolean>(false);
  const detectedAddressRef = useRef<string>("");

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

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isVerifyingRef = useRef<boolean>(false);
  const isTransitioningRef = useRef<boolean>(false);
  const shouldStopRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(false);
  const gpsCoordinatesRef = useRef<{ lat?: number; long?: number } | null>(null);
  const onSuccessRef = useRef<(() => void) | undefined>(onSuccess);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  // 1. Get Device GPS Location & Reverse Geocoding Otomatis
  const requestGps = useCallback(() => {
    setGpsStatus("getting");
    setDetectingAddress(true);

    const handleCoordsSuccess = async (lat: number, long: number) => {
      const coords = { lat, long };
      gpsCoordinatesRef.current = coords;
      setGpsCoordinates(coords);
      setGpsStatus("ready");

      try {
        const geo = await reverseGeocodeCoords(lat, long);
        if (geo.kecamatan) setDetectedKecamatan(geo.kecamatan);
        if (geo.kabupatenKota) setDetectedKabupaten(geo.kabupatenKota);
        const full = [geo.kecamatan, geo.kabupatenKota].filter(Boolean).join(", ");
        if (full) detectedAddressRef.current = full;
      } catch (e) {
        console.warn("Reverse geocode kontraktor error:", e);
      } finally {
        setDetectingAddress(false);
      }
    };

    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsStatus("error");
      setDetectingAddress(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleCoordsSuccess(pos.coords.latitude, pos.coords.longitude);
      },
      async (err) => {
        console.warn("GPS error, fallback to IP:", err.message);
        try {
          const ipLoc = await getIpLocationFallback();
          if (ipLoc) {
            await handleCoordsSuccess(ipLoc.latitude, ipLoc.longitude);
            return;
          }
        } catch {
          // fallback failed
        }
        setGpsStatus("error");
        setDetectingAddress(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, []);

  // Stop camera helper
  const stopCamera = useCallback(async () => {
    shouldStopRef.current = true;
    if (isTransitioningRef.current) {
      // Akan dieksekusi di blok finally dari startCamera setelah transisi selesai
      return;
    }

    isTransitioningRef.current = true;
    try {
      const qr = html5QrCodeRef.current;
      if (qr) {
        if (qr.isScanning) {
          await qr.stop();
        }
        try {
          qr.clear();
        } catch {
          // ignore clear error
        }
      }
      html5QrCodeRef.current = null;
    } catch (e: any) {
      console.warn("Error stopping camera:", e?.message || e);
    } finally {
      isTransitioningRef.current = false;
      setScannerActive(false);
    }
  }, []);

  // 2. Start Camera Scanner
  const startCamera = useCallback(async () => {
    // Hindari pemanggilan ganda jika sedang transisi
    if (isTransitioningRef.current) {
      return;
    }

    const scannerElement = document.getElementById("qr-reader-container");
    if (!scannerElement) return;

    // Jika scanner sudah aktif dan sedang memindai, tidak perlu restart
    if (html5QrCodeRef.current?.isScanning) {
      setScannerActive(true);
      return;
    }

    isTransitioningRef.current = true;
    shouldStopRef.current = false;
    setCameraError(null);

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader-container");
      }

      const qr = html5QrCodeRef.current;

      await qr.start(
        { facingMode: "environment" },
        {
          fps: 10,
        },
        async (decodedText) => {
          if (isVerifyingRef.current) return;
          isVerifyingRef.current = true;
          setVerifying(true);

          try {
            // Stop scanning while verifying
            if (qr.isScanning) {
              await qr.stop();
              setScannerActive(false);
            }

            // Send payload to verify API menggunakan koordinat GPS dan alamat fisik terdeteksi
            const currentGps = gpsCoordinatesRef.current;
            const fullContractorAddress =
              detectedAddressRef.current ||
              [detectedKecamatan, detectedKabupaten].filter(Boolean).join(", ");

            const res = await fetch(`/api/dc-development/aanwijzing/${aanwijzingId}/absen/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: decodedText.trim(),
                lat: currentGps?.lat,
                long: currentGps?.long,
                address: fullContractorAddress || null,
              }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
              setScanSuccess(true);
              setResultData(data.data);
              onSuccessRef.current?.();
            } else {
              setFeedback({
                open: true,
                type: "error",
                title: "Verifikasi Gagal",
                message: data.message || "QR Code tidak valid atau telah kedaluwarsa.",
              });
            }
          } catch (err: any) {
            setFeedback({
              open: true,
              type: "error",
              title: "Verifikasi Gagal",
              message: err?.message || "Koneksi ke server terganggu.",
            });
          } finally {
            setVerifying(false);
            isVerifyingRef.current = false;
          }
        },
        () => {
          // ignore scan frame errors
        }
      );

      setScannerActive(true);
    } catch (err: any) {
      const errStr = String(err?.message || err);
      if (errStr.includes("already under transition")) {
        console.warn("Camera transition skipped:", errStr);
      } else {
        console.error("Gagal memulai kamera:", err);
        setCameraError(
          "Tidak dapat mengakses kamera. Pastikan Anda telah memberikan izin akses kamera pada peramban/browser perangkat ini."
        );
      }
      setScannerActive(false);
    } finally {
      isTransitioningRef.current = false;

      // Jika user sudah menutup modal saat kamera masih proses start, hentikan segera
      if (shouldStopRef.current && html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          html5QrCodeRef.current.clear();
        } catch (e) {
          console.warn("Cleanup camera after start error:", e);
        }
        html5QrCodeRef.current = null;
        setScannerActive(false);
      }
    }
  }, [aanwijzingId]);

  // Trigger camera & GPS on modal open
  useEffect(() => {
    isMountedRef.current = true;
    if (effectiveOpen) {
      setScanSuccess(false);
      setResultData(null);
      setCameraError(null);
      isVerifyingRef.current = false;
      requestGps();

      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          startCamera();
        }
      }, 350);

      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [effectiveOpen, startCamera, stopCamera, requestGps]);

  return (
    <>
      <Dialog open={effectiveOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="w-[95vw] sm:w-full max-w-md p-0 rounded-2xl border border-slate-200/90 shadow-2xl bg-white overflow-hidden flex flex-col max-h-[92vh] z-[60] [&>button:last-child]:hidden">
          {/* Header Modal Sesuai Standar SPARTA */}
          <div className="px-5 py-4 border-b border-slate-200/80 bg-white flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 text-[#E65F2B] flex items-center justify-center shrink-0">
                <Camera className="w-5 h-5 text-[#E65F2B]" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                  Presensi Kehadiran Aanwijzing
                </DialogTitle>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate max-w-[200px] sm:max-w-xs">
                  {nomorUndangan} {namaProyek ? `• ${namaProyek}` : ""}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer shrink-0 -mr-1"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/50">
            {scanSuccess && resultData ? (
              /* Success View: Kartu Bukti Presensi Bersih & Elegan */
              <div className="py-4 text-center space-y-4 animate-in fade-in duration-300">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center border-2 border-emerald-200">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">
                    Presensi Berhasil Diverifikasi!
                  </h3>
                  <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                    <strong className="text-slate-900">{resultData.nama_perusahaan}</strong> tercatat hadir fisik pada rapat Aanwijzing ini.
                  </p>
                </div>

                {/* Data Presensi Card */}
                <div className="p-4 bg-white border border-slate-200 rounded-xl text-left text-xs space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="text-slate-500 font-medium">Waktu Presensi:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {resultData.absen_at
                        ? new Date(resultData.absen_at).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })
                        : "-"}{" "}
                      WIB
                    </span>
                  </div>

                  {resultData.absen_distance_meter !== null &&
                    resultData.absen_distance_meter !== undefined && (
                      <div className="flex items-start justify-between gap-2 pt-2 border-t border-slate-100">
                        <span className="text-slate-500 font-medium">Jarak ke Penyelenggara:</span>
                        <div className="text-right">
                          <span className="font-bold text-emerald-700">
                            {formatDistance(resultData.absen_distance_meter)}
                          </span>
                          <span className="block text-[10px] text-emerald-600 font-semibold">
                            ✓ Dalam radius batas wajar (≤200m)
                          </span>
                        </div>
                      </div>
                    )}

                  {(detectedKecamatan || detectedKabupaten) && (
                    <div className="flex items-start justify-between gap-2 pt-2 border-t border-slate-100">
                      <span className="text-slate-500 font-medium shrink-0">Lokasi Presensi:</span>
                      <span className="font-semibold text-slate-800 text-right leading-relaxed break-words max-w-[200px]">
                        {[detectedKecamatan, detectedKabupaten].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <span>Metode Validasi:</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Dynamic QR + Validasi GPS
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleClose}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 text-xs font-bold shadow-sm cursor-pointer"
                >
                  Selesai &amp; Tutup
                </Button>
              </div>
            ) : (
              /* Scanner Active View: Clean Enterprise Layout with Centered Camera Box */
              <div className="space-y-3.5">
                {/* 1. Card Lokasi Terbaca Otomatis (GPS) */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#E65F2B]" />
                      Lokasi Anda Terdeteksi (GPS)
                    </span>
                    <div className="flex items-center gap-2">
                      {gpsStatus === "ready" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          GPS Terhubung
                        </span>
                      ) : gpsStatus === "getting" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                          <Loader2 className="w-3 h-3 animate-spin text-[#E65F2B]" />
                          Mencari GPS...
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-rose-600 font-medium">
                          Izin GPS Belum Aktif
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={requestGps}
                        disabled={gpsStatus === "getting" || detectingAddress}
                        className="text-[11px] font-semibold text-[#E65F2B] hover:text-[#d04f1f] inline-flex items-center gap-1 cursor-pointer"
                        title="Deteksi Ulang GPS"
                      >
                        <RefreshCw className={cn("w-3 h-3", (detectingAddress || gpsStatus === "getting") && "animate-spin")} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="text-slate-500 text-[11px]">Wilayah:</span>
                    <span className="font-semibold text-slate-800 text-right truncate max-w-[220px]">
                      {detectedKecamatan
                        ? `${detectedKecamatan}, ${detectedKabupaten || ""}`
                        : detectingAddress
                        ? "Membaca satelit GPS..."
                        : "-"}
                    </span>
                  </div>
                </div>

                {/* 2. Jendela Kamera Persegi yang Rapi & Terpusat (Bukan Fullscreen Hitam) */}
                <div className="space-y-2">
                  <div className="relative w-full aspect-square max-w-[280px] sm:max-w-[300px] mx-auto rounded-2xl overflow-hidden border-2 border-slate-300 shadow-sm bg-black flex items-center justify-center">
                    {/* HTML5 QR Code Container */}
                    <div id="qr-reader-container" className="w-full h-full relative" />

                    {/* CSS Override HTML5-QRCode agar video pas di tengah 100% tanpa offset */}
                    <style
                      dangerouslySetInnerHTML={{
                        __html: `
                          #qr-reader-container {
                            width: 100% !important;
                            height: 100% !important;
                            position: relative !important;
                            overflow: hidden !important;
                            display: flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            background: #000 !important;
                            border: none !important;
                            padding: 0 !important;
                            margin: 0 !important;
                          }
                          #qr-reader-container video {
                            width: 100% !important;
                            height: 100% !important;
                            min-width: 100% !important;
                            min-height: 100% !important;
                            object-fit: cover !important;
                            position: absolute !important;
                            top: 0 !important;
                            left: 0 !important;
                            right: 0 !important;
                            bottom: 0 !important;
                            margin: auto !important;
                            display: block !important;
                          }
                          #qr-reader-container canvas {
                            display: none !important;
                          }
                          #qr-shaded-region {
                            display: none !important;
                          }
                        `,
                      }}
                    />

                    {/* Viewfinder Minimalist Corner Brackets (Sudut Pandu Bersih) */}
                    {scannerActive && !verifying && !cameraError && (
                      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
                        <div className="w-full h-full relative">
                          <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-lg shadow-sm" />
                          <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-lg shadow-sm" />
                          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-lg shadow-sm" />
                          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-lg shadow-sm" />
                        </div>
                      </div>
                    )}

                    {/* Verifying Overlay */}
                    {verifying && (
                      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2 z-20">
                        <Loader2 className="w-8 h-8 animate-spin text-[#E65F2B]" />
                        <span className="text-xs font-semibold">
                          Memverifikasi Kehadiran...
                        </span>
                      </div>
                    )}

                    {/* Camera Error View */}
                    {cameraError && (
                      <div className="p-4 text-center text-white space-y-2 z-10">
                        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
                        <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
                        <Button
                          type="button"
                          onClick={startCamera}
                          className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white rounded-xl text-xs h-8 px-3 font-bold cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1" />
                          Coba Lagi
                        </Button>
                      </div>
                    )}
                  </div>

                  <p className="text-center text-xs font-medium text-slate-600">
                    Arahkan kamera ke QR Code di layar koordinator
                  </p>
                </div>

                {/* 3. Catatan Panduan & SOP */}
                <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                  <ScanLine className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    QR Code berganti otomatis setiap 60 detik. Pastikan Anda berada di lokasi rapat dengan batas toleransi radius maksimal 200m.
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Modal for errors */}
      <FeedbackModal
        open={feedback.open}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => {
          setFeedback((prev) => ({ ...prev, open: false }));
          // Restart camera if error occurred so user can retry scanning
          if (!scanSuccess) {
            startCamera();
          }
        }}
        className="z-[80]"
      />
    </>
  );
}
