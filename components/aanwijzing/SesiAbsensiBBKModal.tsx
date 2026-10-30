"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import QRCode from "qrcode";
import {
  QrCode,
  RefreshCw,
  Clock,
  MapPin,
  CheckCircle2,
  Users,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  Power,
  Loader2,
  X,
  FileCheck2,
  Maximize2,
  Minimize2,
  Search,
  UserX,
  Save,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import {
  formatDistance,
  reverseGeocodeCoords,
  getIpLocationFallback,
  checkTanggalPelaksanaanHariH,
} from "@/lib/geolocation";
import { cn } from "@/lib/utils";

interface PesertaAbsen {
  id: number;
  vendor_id: number;
  nama_perusahaan: string;
  email: string;
  status_konfirmasi: string;
  status_kehadiran_aktual: string;
  absen_at?: string | null;
  absen_lat?: number | null;
  absen_long?: number | null;
  absen_distance_meter?: number | null;
  absen_metode?: string | null;
  catatan_absen?: string | null;
}

export interface SesiAbsensiBBKModalProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  aanwijzingId: number | null;
  nomorUndangan?: string;
  namaProyek?: string;
  lokasiProyek?: string;
  tanggalPelaksanaan?: string | Date | null;
  onRefreshParent?: () => void;
}

export function SesiAbsensiBBKModal({
  open,
  isOpen,
  onOpenChange,
  onClose,
  aanwijzingId,
  nomorUndangan,
  namaProyek,
  lokasiProyek,
  tanggalPelaksanaan,
  onRefreshParent,
}: SesiAbsensiBBKModalProps) {
  const effectiveOpen = open !== undefined ? open : !!isOpen;

  const handleClose = useCallback(() => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  }, [onOpenChange, onClose]);
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [sessionLat, setSessionLat] = useState<number | null>(null);
  const [sessionLong, setSessionLong] = useState<number | null>(null);
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState<string | Date | null>(tanggalPelaksanaan || null);
  const [pesertaList, setPesertaList] = useState<PesertaAbsen[]>([]);

  // Rolling QR Token states
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [currentToken, setCurrentToken] = useState<string>("");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [loadingToken, setLoadingToken] = useState<boolean>(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "getting" | "ready" | "denied">("idle");

  // Lokasi Fisik Real-Time Koordinator (Kecamatan & Kabupaten/Kota)
  const [detectedKecamatan, setDetectedKecamatan] = useState<string>("");
  const [detectedKabupaten, setDetectedKabupaten] = useState<string>("");
  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; long: number } | null>(null);
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);
  const [locationVerified, setLocationVerified] = useState<boolean>(false);
  const [updatingLocation, setUpdatingLocation] = useState<boolean>(false);

  // Mobile Layout, Fullscreen & Filter States
  const [mobileTab, setMobileTab] = useState<"QR" | "ATTENDEES">("QR");
  const [isFullscreenQr, setIsFullscreenQr] = useState<boolean>(false);
  const [attendeeFilter, setAttendeeFilter] = useState<"ALL" | "HADIR" | "TIDAK_HADIR" | "BELUM">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Manual Verify Dialog State (Mark as HADIR_AKTUAL)
  const [manualVerifyVendor, setManualVerifyVendor] = useState<PesertaAbsen | null>(null);
  const [manualCatatan, setManualCatatan] = useState<string>("");
  const [submittingManual, setSubmittingManual] = useState<boolean>(false);

  // Mark Tidak Hadir Dialog State (Mark as TIDAK_HADIR)
  const [tidakHadirVendor, setTidakHadirVendor] = useState<PesertaAbsen | null>(null);
  const [tidakHadirCatatan, setTidakHadirCatatan] = useState<string>("");
  const [submittingTidakHadir, setSubmittingTidakHadir] = useState<boolean>(false);

  // Stop Session Dialog
  const [confirmStopOpen, setConfirmStopOpen] = useState<boolean>(false);
  const [stoppingSession, setStoppingSession] = useState<boolean>(false);

  // Finish / Simpan Sesi Absensi State
  const [confirmFinishOpen, setConfirmFinishOpen] = useState<boolean>(false);
  const [submittingFinish, setSubmittingFinish] = useState<boolean>(false);

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

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollAttendeesRef = useRef<NodeJS.Timeout | null>(null);

  // Deteksi Lokasi Fisik Real-time Koordinator Otomatis dari Sensor GPS / Jaringan
  const detectCurrentLocation = useCallback(async () => {
    setDetectingLocation(true);
    let resolved = false;

    const processCoords = async (lat: number, long: number) => {
      if (resolved) return;
      resolved = true;
      setDetectedCoords({ lat, long });
      try {
        const geo = await reverseGeocodeCoords(lat, long);
        if (geo.kecamatan) {
          setDetectedKecamatan(geo.kecamatan);
        }
        if (geo.kabupatenKota) {
          setDetectedKabupaten(geo.kabupatenKota);
        }
        setLocationVerified(true);

        // Auto sinkronisasi ke server database jika sesi aktif
        if (aanwijzingId && sessionActive) {
          const fullParts = [];
          if (geo.kecamatan) fullParts.push(geo.kecamatan);
          if (geo.kabupatenKota) fullParts.push(geo.kabupatenKota);
          const autoAddress = fullParts.join(", ");

          fetch(`/api/dc-development/aanwijzing/${aanwijzingId}/absen/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "UPDATE_LOCATION",
              lat,
              long,
              address: autoAddress,
            }),
          })
            .then((res) => res.json())
            .then((d) => {
              if (d.success) {
                setSessionLat(d.session_lat);
                setSessionLong(d.session_long);
                setSessionAddress(d.session_address);
              }
            })
            .catch((err) => console.warn("Auto sync location error:", err));
        }
      } catch (e) {
        console.warn("Reverse geocode failed:", e);
      } finally {
        setDetectingLocation(false);
      }
    };

    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          processCoords(pos.coords.latitude, pos.coords.longitude);
        },
        async (err) => {
          console.warn("Browser GPS fallback ke IP Geolocation:", err.message);
          const ipLoc = await getIpLocationFallback();
          if (ipLoc) {
            processCoords(ipLoc.latitude, ipLoc.longitude);
          } else {
            setDetectingLocation(false);
          }
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
      );
    } else {
      const ipLoc = await getIpLocationFallback();
      if (ipLoc) {
        processCoords(ipLoc.latitude, ipLoc.longitude);
      } else {
        setDetectingLocation(false);
      }
    }
  }, [aanwijzingId, sessionActive]);

  // Initial auto-detection saat modal dibuka
  useEffect(() => {
    if (!effectiveOpen) return;
    detectCurrentLocation();
  }, [effectiveOpen, detectCurrentLocation]);

  // Sinkronisasi targetDate jika prop tanggalPelaksanaan berganti
  useEffect(() => {
    if (tanggalPelaksanaan) {
      setTargetDate(tanggalPelaksanaan);
    }
  }, [tanggalPelaksanaan]);

  // 1. Fetch Session Status & Attendees
  const fetchSessionData = useCallback(async () => {
    if (!aanwijzingId) return;
    try {
      const res = await fetch(`/api/dc-development/aanwijzing/${aanwijzingId}/absen/session`);
      if (res.ok) {
        const data = await res.json();
        setSessionActive(Boolean(data.session_active));
        setSessionStartedAt(data.session_started_at);
        setSessionLat(data.session_lat);
        setSessionLong(data.session_long);
        setSessionAddress(data.session_address);
        if (data.tanggal_pelaksanaan) {
          setTargetDate(data.tanggal_pelaksanaan);
        }
        if (Array.isArray(data.peserta)) {
          // Kontraktor yang telah konfirmasi TIDAK_HADIR tidak boleh masuk ke daftar absensi Hari-H
          setPesertaList(data.peserta.filter((p: PesertaAbsen) => p.status_konfirmasi !== "TIDAK_HADIR"));
        }
      }
    } catch (err) {
      console.error("Gagal mengambil status sesi absensi:", err);
    }
  }, [aanwijzingId]);

  // 2. Fetch Rolling Token
  const fetchNewToken = useCallback(async () => {
    if (!aanwijzingId) return;
    setLoadingToken(true);
    setQrError(null);
    try {
      const res = await fetch(`/api/dc-development/aanwijzing/${aanwijzingId}/absen/token`);
      const data = await res.json();
      if (res.ok && data.token) {
        setCurrentToken(data.token);
        setSecondsRemaining(data.expiresInSeconds || 60);

        // Generate high-resolution sharp QR Code with level M (fast & reliable)
        const url = await QRCode.toDataURL(data.token, {
          width: 320,
          margin: 1.5,
          color: {
            dark: "#0F172A",
            light: "#FFFFFF",
          },
          errorCorrectionLevel: "M",
        });
        setQrDataUrl(url);
        setQrError(null);
      } else {
        console.warn("Gagal mengambil token absensi:", res.status, data.message);
        setQrError(data.message || "Gagal memuat token absensi dari server.");
      }
    } catch (err: any) {
      console.error("Gagal mendapatkan rolling token:", err);
      setQrError(err?.message || "Koneksi terganggu saat memuat QR Code.");
    } finally {
      setLoadingToken(false);
    }
  }, [aanwijzingId]);

  // 3. Start Session with Geolocation GPS & Kecamatan/Kabupaten Koordinator
  const handleStartSession = async () => {
    if (!aanwijzingId) return;

    // Validasi Hari-H Tanggal Pelaksanaan Rapat
    const effectiveDate = targetDate || tanggalPelaksanaan;
    const dateCheck = checkTanggalPelaksanaanHariH(effectiveDate);

    if (!dateCheck.isHariH) {
      if (dateCheck.status === "BELUM_WAKTUNYA") {
        setFeedback({
          open: true,
          type: "error",
          title: "Belum Waktu Pelaksanaan Rapat",
          message: `Sesi absensi kehadiran belum dapat dibuka. Rapat Aanwijzing dijadwalkan pada ${dateCheck.formattedTargetDate} (belum masuk Hari-H pelaksanaan).`,
        });
        return;
      } else if (dateCheck.status === "SUDAH_LEWAT") {
        setFeedback({
          open: true,
          type: "error",
          title: "Jadwal Pelaksanaan Telah Lewat",
          message: `Sesi absensi kehadiran tidak dapat dibuka karena jadwal rapat Aanwijzing telah lewat pada ${dateCheck.formattedTargetDate}.`,
        });
        return;
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Jadwal Belum Ditentukan",
          message: dateCheck.message || "Tanggal pelaksanaan rapat Aanwijzing belum valid atau belum ditentukan.",
        });
        return;
      }
    }

    setLocationStatus("getting");

    const fullLocParts = [];
    if (detectedKecamatan.trim()) fullLocParts.push(detectedKecamatan.trim());
    if (detectedKabupaten.trim()) fullLocParts.push(detectedKabupaten.trim());

    const finalAddress =
      fullLocParts.length > 0
        ? fullLocParts.join(", ")
        : sessionAddress || "Lokasi Fisik Koordinator";

    const finalLat = detectedCoords?.lat ?? sessionLat ?? null;
    const finalLong = detectedCoords?.long ?? sessionLong ?? null;

    try {
      const res = await fetch(`/api/dc-development/aanwijzing/${aanwijzingId}/absen/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "START",
          lat: finalLat,
          long: finalLong,
          address: finalAddress,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSessionActive(true);
        setSessionLat(data.session_lat);
        setSessionLong(data.session_long);
        setSessionAddress(data.session_address || finalAddress);
        setSessionStartedAt(data.session_started_at);
        setLocationStatus("ready");
        await fetchNewToken();
        await fetchSessionData();
        onRefreshParent?.();
      } else {
        setLocationStatus("idle");
        const isBelum = data.status === "BELUM_WAKTUNYA";
        const isLewat = data.status === "SUDAH_LEWAT";
        setFeedback({
          open: true,
          type: "error",
          title: isBelum
            ? "Belum Waktu Pelaksanaan Rapat"
            : isLewat
            ? "Jadwal Pelaksanaan Telah Lewat"
            : "Gagal Membuka Sesi",
          message: data.message || data.error || "Terjadi kesalahan saat memulai sesi absensi.",
        });
      }
    } catch (err: any) {
      setLocationStatus("idle");
      setFeedback({
        open: true,
        type: "error",
        title: "Gagal Membuka Sesi",
        message: err?.message || "Koneksi ke server gagal.",
      });
    }
  };

  // 3b. Update Lokasi Fisik Terlampir Sesi yang Sedang Aktif
  const handleUpdateActiveLocation = async () => {
    if (!aanwijzingId) return;
    setUpdatingLocation(true);
    try {
      const fullLocParts = [];
      if (detectedKecamatan.trim()) fullLocParts.push(detectedKecamatan.trim());
      if (detectedKabupaten.trim()) fullLocParts.push(detectedKabupaten.trim());
      const finalAddress = fullLocParts.length > 0 ? fullLocParts.join(", ") : sessionAddress || lokasiProyek || "Lokasi DC Cabang";

      const finalLat = detectedCoords?.lat ?? sessionLat;
      const finalLong = detectedCoords?.long ?? sessionLong;

      const res = await fetch(`/api/dc-development/aanwijzing/${aanwijzingId}/absen/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_LOCATION",
          lat: finalLat,
          long: finalLong,
          address: finalAddress,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSessionLat(data.session_lat);
        setSessionLong(data.session_long);
        setSessionAddress(data.session_address || finalAddress);
        setFeedback({
          open: true,
          type: "success",
          title: "Lokasi Berhasil Diperbarui",
          message: `Lokasi fisik koordinator telah diperbarui ke: ${finalAddress}`,
        });
        await fetchSessionData();
        onRefreshParent?.();
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Memperbarui Lokasi",
          message: data.message || "Terjadi kesalahan saat memperbarui lokasi.",
        });
      }
    } catch (err: any) {
      setFeedback({
        open: true,
        type: "error",
        title: "Gagal Memperbarui Lokasi",
        message: err?.message || "Koneksi ke server gagal.",
      });
    } finally {
      setUpdatingLocation(false);
    }
  };

  // 4. Stop Session
  const handleStopSession = async () => {
    if (!aanwijzingId) return;
    setStoppingSession(true);
    try {
      const res = await fetch(`/api/dc-development/aanwijzing/${aanwijzingId}/absen/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "STOP" }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSessionActive(false);
        setConfirmStopOpen(false);
        setFeedback({
          open: true,
          type: "success",
          title: "Sesi Absensi Ditutup",
          message: "Sesi absensi rapat Aanwijzing telah berhasil ditutup.",
        });
        await fetchSessionData();
        onRefreshParent?.();
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Menutup Sesi",
          message: data.message || "Terjadi kesalahan saat menutup sesi.",
        });
      }
    } catch (err: any) {
      setFeedback({
        open: true,
        type: "error",
        title: "Gagal Menutup Sesi",
        message: err?.message || "Koneksi ke server gagal.",
      });
    } finally {
      setStoppingSession(false);
    }
  };

  // 5. Submit Manual Verification
  const handleManualVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aanwijzingId || !manualVerifyVendor) return;

    if (!manualCatatan.trim()) {
      setFeedback({
        open: true,
        type: "error",
        title: "Catatan Wajib Diisi",
        message: "Silakan tuliskan alasan verifikasi manual (kendala teknis perangkat rekanan).",
      });
      return;
    }

    setSubmittingManual(true);
    try {
      const res = await fetch(`/api/dc-development/aanwijzing/${aanwijzingId}/absen/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: manualVerifyVendor.vendor_id,
          catatan: manualCatatan.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setManualVerifyVendor(null);
        setManualCatatan("");
        setFeedback({
          open: true,
          type: "success",
          title: "Verifikasi Manual Berhasil",
          message: data.message || "Kehadiran rekanan telah tercatat secara manual.",
        });
        await fetchSessionData();
        onRefreshParent?.();
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Verifikasi Manual",
          message: data.message || "Terjadi kesalahan saat memverifikasi rekanan.",
        });
      }
    } catch (err: any) {
      setFeedback({
        open: true,
        type: "error",
        title: "Gagal Verifikasi",
        message: err?.message || "Koneksi terganggu.",
      });
    } finally {
      setSubmittingManual(false);
    }
  };

  // 6. Submit Konfirmasi Tidak Hadir Hari-H
  const handleTidakHadirSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aanwijzingId || !tidakHadirVendor) return;

    if (!tidakHadirCatatan.trim()) {
      setFeedback({
        open: true,
        type: "error",
        title: "Catatan Wajib Diisi",
        message: "Silakan isi catatan alasan ketidakhadiran rekanan pada rapat Hari-H.",
      });
      return;
    }

    setSubmittingTidakHadir(true);
    try {
      const res = await fetch(`/api/dc-development/aanwijzing/${aanwijzingId}/absen/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: tidakHadirVendor.vendor_id,
          catatan: tidakHadirCatatan.trim(),
          action: "TIDAK_HADIR",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTidakHadirVendor(null);
        setTidakHadirCatatan("");
        setFeedback({
          open: true,
          type: "success",
          title: "Ketidakhadiran Dicatat",
          message: data.message || "Status ketidakhadiran rekanan berhasil dikonfirmasi.",
        });
        await fetchSessionData();
        onRefreshParent?.();
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Menyimpan",
          message: data.message || "Terjadi kesalahan saat mencatat ketidakhadiran.",
        });
      }
    } catch (err: any) {
      setFeedback({
        open: true,
        type: "error",
        title: "Gagal Menyimpan",
        message: err?.message || "Koneksi terganggu.",
      });
    } finally {
      setSubmittingTidakHadir(false);
    }
  };

  // 7. Simpan & Selesaikan Sesi Absensi (Finish / Selesai)
  const handleFinishSession = async () => {
    if (!aanwijzingId) return;

    // Hentikan polling background dan countdown agar koneksi tidak berebut saat proses simpan
    if (pollAttendeesRef.current) clearInterval(pollAttendeesRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    setSubmittingFinish(true);
    try {
      const res = await fetch(`/api/dc-development/aanwijzing/${aanwijzingId}/absen/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        setConfirmFinishOpen(false);
        const nextStep = data.data?.next_step;
        setFeedback({
          open: true,
          type: "success",
          title:
            nextStep === "LANJUT_PROSES"
              ? "Sesi Absensi Selesai (Quorum Terpenuhi)"
              : "Dialihkan ke Approval DC Manager",
          message:
            data.message ||
            "Sesi absensi berhasil disimpan dan diselesaikan ke tahap selanjutnya.",
        });
        await fetchSessionData();
        onRefreshParent?.();
        // Tutup modal setelah selesai
        setTimeout(() => {
          handleClose();
        }, 1800);
      } else {
        setFeedback({
          open: true,
          type: "error",
          title: "Gagal Menyelesaikan Sesi",
          message: data.message || "Terjadi kesalahan saat menyelesaikan sesi absensi.",
        });
      }
    } catch (err: any) {
      setFeedback({
        open: true,
        type: "error",
        title: "Gagal Menyelesaikan Sesi",
        message: err?.message || "Koneksi terganggu.",
      });
    } finally {
      setSubmittingFinish(false);
    }
  };

  // Countdown timer 60s & auto token refresh
  useEffect(() => {
    if (!effectiveOpen || !sessionActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          fetchNewToken();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [effectiveOpen, sessionActive, fetchNewToken]);

  // Polling attendees every 5 seconds when session is active
  useEffect(() => {
    if (!effectiveOpen) return;

    fetchSessionData();

    if (sessionActive) {
      fetchNewToken();
      pollAttendeesRef.current = setInterval(() => {
        fetchSessionData();
      }, 5000);
    }

    return () => {
      if (pollAttendeesRef.current) clearInterval(pollAttendeesRef.current);
    };
  }, [effectiveOpen, sessionActive, fetchSessionData, fetchNewToken]);

  // Calculations - Kontraktor yang konfirmasi TIDAK_HADIR tidak boleh masuk ke daftar absensi Hari-H
  const eligiblePesertaList = useMemo(() => {
    return pesertaList.filter((p) => p.status_konfirmasi !== "TIDAK_HADIR");
  }, [pesertaList]);

  const hadirCount = eligiblePesertaList.filter((p) => p.status_kehadiran_aktual === "HADIR_AKTUAL").length;
  const tidakHadirCount = eligiblePesertaList.filter((p) => p.status_kehadiran_aktual === "TIDAK_HADIR").length;
  const belumAbsenCount = eligiblePesertaList.filter((p) => p.status_kehadiran_aktual === "BELUM_ABSEN").length;
  const totalPeserta = eligiblePesertaList.length;
  const allConfirmed = totalPeserta > 0 && belumAbsenCount === 0;
  const progressPercent = totalPeserta > 0 ? Math.round(((hadirCount + tidakHadirCount) / totalPeserta) * 100) : 0;

  const filteredPesertaList = useMemo(() => {
    return eligiblePesertaList.filter((p) => {
      const matchFilter =
        attendeeFilter === "ALL"
          ? true
          : attendeeFilter === "HADIR"
          ? p.status_kehadiran_aktual === "HADIR_AKTUAL"
          : attendeeFilter === "TIDAK_HADIR"
          ? p.status_kehadiran_aktual === "TIDAK_HADIR"
          : p.status_kehadiran_aktual === "BELUM_ABSEN";

      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        p.nama_perusahaan.toLowerCase().includes(query) ||
        p.email.toLowerCase().includes(query);

      return matchFilter && matchSearch;
    });
  }, [eligiblePesertaList, attendeeFilter, searchQuery]);

  return (
    <>
      <Dialog open={effectiveOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="w-full max-w-none lg:max-w-4xl h-[100dvh] lg:h-auto lg:max-h-[92vh] p-0 rounded-none lg:rounded-2xl border-0 lg:border border-slate-200/90 shadow-2xl bg-white overflow-hidden flex flex-col z-[60] [&>button:last-child]:hidden">
          {/* Header Modal Sesuai Standar SPARTA */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4.5 bg-white border-b border-slate-200/80 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-50 border border-orange-200/80 text-[#E65F2B] flex items-center justify-center shrink-0 mt-0.5">
                  <QrCode className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#E65F2B]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border",
                        sessionActive
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200/80"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          sessionActive ? "bg-emerald-500 animate-ping" : "bg-slate-400"
                        )}
                      />
                      {sessionActive ? "SESI AKTIF" : "SESI NONAKTIF"}
                    </span>
                    {nomorUndangan && (
                      <span className="text-[11px] sm:text-xs font-mono font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/70">
                        {nomorUndangan}
                      </span>
                    )}
                  </div>
                  <DialogTitle className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 tracking-tight leading-tight">
                    Sesi Absensi Hari-H Aanwijzing
                  </DialogTitle>
                  {namaProyek && (
                    <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                      {namaProyek}
                    </p>
                  )}
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

            {/* Sub-Header Location Strip */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <MapPin className="w-3.5 h-3.5 text-[#E65F2B] shrink-0" />
                <span className="truncate">
                  {detectedKecamatan && detectedKabupaten
                    ? `${detectedKecamatan}, ${detectedKabupaten}`
                    : detectingLocation
                    ? "Membaca Satelit GPS..."
                    : sessionAddress || "Sensor lokasi"}
                </span>
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    detectedCoords ? "bg-emerald-500" : "bg-amber-400"
                  )}
                />
              </div>

              <button
                type="button"
                onClick={async () => {
                  await detectCurrentLocation();
                  if (sessionActive) {
                    await handleUpdateActiveLocation();
                  }
                }}
                disabled={detectingLocation || updatingLocation}
                className="text-[10px] font-semibold text-[#E65F2B] hover:text-[#d04f1f] hover:underline cursor-pointer inline-flex items-center gap-1 shrink-0"
              >
                <RefreshCw className={cn("w-3 h-3", (detectingLocation || updatingLocation) && "animate-spin")} />
                <span>GPS Refresh</span>
              </button>
            </div>
          </div>

          <DialogDescription className="sr-only">
            Sesi absensi kehadiran Hari-H rapat Aanwijzing dengan Dynamic Rolling QR Code dan validasi lokasi GPS.
          </DialogDescription>

          {/* Mobile Segmented Switcher (Hanya tampil di mobile < lg saat sesi aktif) */}
          {sessionActive && (
            <div className="lg:hidden px-4 py-2 bg-slate-100/90 border-b border-slate-200 shrink-0">
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/80 rounded-xl">
                <button
                  type="button"
                  onClick={() => setMobileTab("QR")}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    mobileTab === "QR"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <QrCode className="w-4 h-4 text-[#E65F2B]" />
                  <span>Tampilkan QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileTab("ATTENDEES")}
                  className={cn(
                    "flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    mobileTab === "ATTENDEES"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Users className="w-4 h-4 text-[#E65F2B]" />
                  <span>Rekap Kehadiran</span>
                  <span className="text-[10px] bg-orange-100 text-[#E65F2B] font-extrabold px-1.5 py-0.2 rounded-full">
                    {hadirCount}/{totalPeserta}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Body Content Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 min-h-0">
            {!sessionActive ? (
              /* Session Not Active State */
              <div className="text-center py-6 sm:py-8 px-4 max-w-xl mx-auto space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#E65F2B] mx-auto flex items-center justify-center border border-orange-100 shadow-sm">
                  <Power className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">
                    Buka Sesi Absensi Kehadiran Fisik
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Sistem otomatis membaca lokasi fisik koordinator ruang rapat dari sensor GPS dan menyajikan Dynamic Rolling QR Code setiap 60 detik.
                  </p>
                </div>

                {/* Box Lokasi Fisik Terbaca Otomatis dari GPS */}
                <div className="p-4 bg-slate-50/90 border border-slate-200/90 rounded-2xl text-left space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#E65F2B]" />
                      Lokasi Fisik Koordinator (Sensor GPS)
                    </div>
                    <button
                      type="button"
                      onClick={() => detectCurrentLocation()}
                      disabled={detectingLocation}
                      className="text-[11px] font-semibold text-[#E65F2B] hover:text-[#d04f1f] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={cn("w-3 h-3", detectingLocation && "animate-spin")} />
                      <span>{detectingLocation ? "Mendeteksi..." : "Deteksi Ulang GPS"}</span>
                    </button>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/90 space-y-2 text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-medium text-slate-500">Kecamatan:</span>
                      <span className="font-bold text-slate-800 text-right">
                        {detectedKecamatan ? (
                          detectedKecamatan
                        ) : detectingLocation ? (
                          <span className="inline-flex items-center text-slate-400 font-normal">
                            <Loader2 className="w-3 h-3 animate-spin mr-1 text-[#E65F2B]" />
                            Membaca satelit...
                          </span>
                        ) : (
                          "Mencari sinyal GPS..."
                        )}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-medium text-slate-500">Kabupaten/Kota:</span>
                      <span className="font-bold text-slate-800 text-right">
                        {detectedKabupaten ? (
                          detectedKabupaten
                        ) : detectingLocation ? (
                          <span className="inline-flex items-center text-slate-400 font-normal">
                            <Loader2 className="w-3 h-3 animate-spin mr-1 text-[#E65F2B]" />
                            Membaca satelit...
                          </span>
                        ) : (
                          "Mencari sinyal GPS..."
                        )}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-slate-100 text-[10px]">
                      <span className="text-slate-400 font-medium">Titik Koordinat:</span>
                      <span className="font-mono text-slate-600">
                        {detectedCoords
                          ? `${detectedCoords.lat.toFixed(5)}, ${detectedCoords.long.toFixed(5)}`
                          : "Menghubungkan satelit GPS..."}
                      </span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    *Lokasi ini terbaca otomatis dari perangkat koordinator dan menjadi batas acuan kehadiran rekanan (toleransi radius 200m).
                  </p>
                </div>

                {sessionStartedAt && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-left text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      Sesi ini sebelumnya pernah dibuka. Membuka kembali sesi akan memperbarui lokasi GPS dan waktu aktif terbaru Anda, serta{" "}
                      <strong>tidak menghapus data rekanan yang telah hadir ({hadirCount} rekanan tercatat)</strong>.
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleStartSession}
                  disabled={locationStatus === "getting" || detectingLocation}
                  className="w-full bg-[#E65F2B] hover:bg-[#d04f1f] text-white rounded-xl h-11 text-xs font-bold shadow-md shadow-orange-500/20 cursor-pointer"
                >
                  {locationStatus === "getting" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Membuka Sesi &amp; Menampilkan QR Code...
                    </>
                  ) : (
                    <>
                      <Power className="w-4 h-4 mr-2" />
                      {sessionStartedAt ? "Buka Kembali Sesi Absensi Hari-H" : "Mulai Sesi Absensi Hari-H Sekarang"}
                    </>
                  )}
                </Button>
              </div>
            ) : (
              /* Active Session Content (Grid di Desktop, Tabbed di Mobile) */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
                {/* Left Panel: Rolling QR Code & 60s Countdown */}
                <div
                  className={cn(
                    "lg:col-span-6 flex flex-col items-center justify-between p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-4",
                    mobileTab === "QR" ? "flex" : "hidden lg:flex"
                  )}
                >
                  {/* Top Bar Action */}
                  <div className="w-full flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Dynamic Rolling QR (Anti-Cheating)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsFullscreenQr(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs cursor-pointer"
                        title="Tampilkan QR Layar Penuh (Kiosk / Proyektor)"
                      >
                        <Maximize2 className="w-3 h-3 text-slate-500" />
                        <span className="hidden sm:inline">Layar Penuh</span>
                      </button>
                      <button
                        type="button"
                        onClick={fetchNewToken}
                        disabled={loadingToken}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E65F2B] hover:text-[#d04f1f] cursor-pointer"
                      >
                        <RefreshCw className={cn("w-3 h-3", loadingToken && "animate-spin")} />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {/* QR Image Canvas Container */}
                  <div className="relative p-4 bg-white rounded-2xl border-2 border-slate-200/90 shadow-sm flex items-center justify-center min-h-[260px] w-full max-w-sm">
                    {qrDataUrl ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={qrDataUrl}
                          alt="QR Absensi Aanwijzing"
                          className="w-56 h-56 sm:w-60 sm:h-60 md:w-64 md:h-64 object-contain rounded-lg shadow-2xs"
                        />
                      </div>
                    ) : qrError ? (
                      <div className="w-56 h-56 flex flex-col items-center justify-center text-center p-4">
                        <AlertTriangle className="w-10 h-10 text-rose-500 mb-2" />
                        <p className="text-xs font-bold text-rose-700 mb-1">Gagal Menghasilkan QR Code</p>
                        <p className="text-[11px] text-slate-500 leading-tight mb-3">{qrError}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={fetchNewToken}
                          disabled={loadingToken}
                          className="h-8 text-xs rounded-xl border-slate-300 hover:bg-slate-50 text-[#E65F2B] font-semibold"
                        >
                          <RefreshCw className={cn("w-3 h-3 mr-1.5", loadingToken && "animate-spin")} />
                          Muat Ulang QR
                        </Button>
                      </div>
                    ) : (
                      <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin mb-2 text-[#E65F2B]" />
                        <span className="text-xs font-semibold text-slate-700">Membuat QR Code...</span>
                        <span className="text-[10px] text-slate-400 mt-1">Mengambil rolling token 60s</span>
                      </div>
                    )}
                  </div>

                  {/* 60 Seconds Timer Progress */}
                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Berganti otomatis dalam:
                      </span>
                      <span
                        className={cn(
                          "font-mono font-bold text-sm",
                          secondsRemaining <= 10
                            ? "text-rose-600 animate-pulse"
                            : secondsRemaining <= 20
                            ? "text-amber-600"
                            : "text-emerald-600"
                        )}
                      >
                        {secondsRemaining}s
                      </span>
                    </div>

                    {/* Dynamic Color Progress Bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-1000 ease-linear rounded-full",
                          secondsRemaining <= 10
                            ? "bg-rose-500"
                            : secondsRemaining <= 20
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        )}
                        style={{ width: `${(secondsRemaining / 60) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Coordinates & Room Location Card */}
                  <div className="w-full p-3.5 bg-white rounded-xl border border-slate-200/90 text-xs shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-[#E65F2B]" />
                        Titik Acuan Koordinator:
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {detectingLocation ? "Membaca GPS..." : "Sinyal GPS Aktif"}
                      </span>
                    </div>

                    <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/70 space-y-1.5 text-[11px]">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-slate-500 font-medium shrink-0">Kecamatan:</span>
                        <span className="font-semibold text-slate-800 text-right truncate">
                          {detectedKecamatan || "-"}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-slate-500 font-medium shrink-0">Kabupaten/Kota:</span>
                        <span className="font-semibold text-slate-800 text-right truncate">
                          {detectedKabupaten || "-"}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-slate-200/60 text-[10px]">
                        <span className="text-slate-400 font-medium shrink-0">Titik Koordinat:</span>
                        <span className="font-mono text-slate-600 text-right">
                          {detectedCoords
                            ? `${detectedCoords.lat.toFixed(5)}, ${detectedCoords.long.toFixed(5)}`
                            : sessionLat && sessionLong
                            ? `${sessionLat.toFixed(5)}, ${sessionLong.toFixed(5)}`
                            : "Mencari GPS..."}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <p className="text-[10px] text-slate-400">
                        Toleransi kehadiran rekanan: radius 200m
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          await detectCurrentLocation();
                          await handleUpdateActiveLocation();
                        }}
                        disabled={updatingLocation || detectingLocation}
                        className="text-[10px] font-semibold text-[#E65F2B] hover:text-[#d04f1f] hover:underline cursor-pointer inline-flex items-center gap-1"
                      >
                        <RefreshCw className={cn("w-2.5 h-2.5", (updatingLocation || detectingLocation) && "animate-spin")} />
                        Perbarui Lokasi GPS
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Panel: Live Attendees Rekapan */}
                <div
                  className={cn(
                    "lg:col-span-6 flex flex-col justify-between space-y-3",
                    mobileTab === "ATTENDEES" ? "flex" : "hidden lg:flex"
                  )}
                >
                  {/* Summary Metric Header */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-orange-50/60 border border-orange-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#E65F2B]" />
                        Kehadiran Rekanan Aktual
                      </span>
                      <span className="text-xs font-bold text-[#E65F2B]">
                        {hadirCount} / {totalPeserta} Rekanan ({progressPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-orange-200/60 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#E65F2B] h-full rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Filter & Search Controls */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Cari nama rekanan / email..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#E65F2B]"
                        />
                      </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs custom-scrollbar">
                      <button
                        type="button"
                        onClick={() => setAttendeeFilter("ALL")}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer",
                          attendeeFilter === "ALL"
                            ? "bg-slate-900 text-white shadow-2xs"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        Semua ({totalPeserta})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendeeFilter("HADIR")}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1",
                          attendeeFilter === "HADIR"
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                        )}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Hadir ({hadirCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendeeFilter("TIDAK_HADIR")}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1",
                          attendeeFilter === "TIDAK_HADIR"
                            ? "bg-rose-600 text-white shadow-2xs"
                            : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                        )}
                      >
                        <UserX className="w-3 h-3" />
                        Tidak Hadir ({tidakHadirCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttendeeFilter("BELUM")}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1",
                          attendeeFilter === "BELUM"
                            ? "bg-amber-600 text-white shadow-2xs"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                        )}
                      >
                        <Clock className="w-3 h-3" />
                        Belum ({belumAbsenCount})
                      </button>
                    </div>
                  </div>

                  {/* Attendee Scrollable List */}
                  <div className="space-y-2 max-h-[300px] sm:max-h-[340px] overflow-y-auto pr-1">
                    {filteredPesertaList.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        {searchQuery ? "Tidak ada rekanan yang cocok dengan pencarian." : "Belum ada data rekanan pada filter ini."}
                      </div>
                    ) : (
                      filteredPesertaList.map((peserta) => {
                        const isHadir = peserta.status_kehadiran_aktual === "HADIR_AKTUAL";
                        const isTidakHadir = peserta.status_kehadiran_aktual === "TIDAK_HADIR";

                        return (
                          <div
                            key={peserta.id}
                            className={cn(
                              "p-3 rounded-xl border transition-all flex items-start justify-between gap-3",
                              isHadir
                                ? "bg-emerald-50/50 border-emerald-200/90"
                                : isTidakHadir
                                ? "bg-rose-50/40 border-rose-200/90"
                                : "bg-white border-slate-200 hover:border-slate-300"
                            )}
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-800 break-words leading-tight">
                                  {peserta.nama_perusahaan}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate">{peserta.email}</p>

                              {isHadir && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-slate-500">
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                                    <Clock className="w-3 h-3 text-emerald-600" />
                                    {peserta.absen_at
                                      ? new Date(peserta.absen_at).toLocaleTimeString("id-ID", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      : "-"}{" "}
                                    WIB
                                  </span>

                                  {peserta.absen_distance_meter !== null &&
                                    peserta.absen_distance_meter !== undefined && (
                                      <span className="inline-flex items-center gap-1 text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                        <MapPin className="w-2.5 h-2.5 text-[#E65F2B]" />
                                        Jarak: {formatDistance(peserta.absen_distance_meter)}
                                      </span>
                                    )}

                                  {peserta.catatan_absen &&
                                    peserta.absen_metode === "QR_SCAN_GPS" && (
                                      <span
                                        className="inline-flex items-center gap-1 text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[170px]"
                                        title={peserta.catatan_absen}
                                      >
                                        <MapPin className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                        {peserta.catatan_absen}
                                      </span>
                                    )}

                                  {peserta.absen_metode === "VERIFIKASI_MANUAL_BBK" && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[9px]">
                                      Manual BBK
                                    </span>
                                  )}
                                </div>
                              )}

                              {isTidakHadir && (
                                <div className="pt-1 text-[10px] text-rose-700">
                                  <span className="font-semibold">Alasan Tidak Hadir:</span>{" "}
                                  <span className="italic">{peserta.catatan_absen || "Tidak hadir di lokasi rapat"}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                              {isHadir ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Hadir Fisik
                                </span>
                              ) : isTidakHadir ? (
                                <div className="flex flex-col items-end gap-1">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    <UserX className="w-3 h-3 text-rose-600" />
                                    Tidak Hadir
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setManualVerifyVendor(peserta);
                                      setManualCatatan("");
                                    }}
                                    className="text-[10px] font-semibold text-emerald-600 hover:underline cursor-pointer"
                                  >
                                    Ubah Jadi Hadir
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col items-end gap-1">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    Belum Absen
                                  </span>
                                  <div className="flex items-center gap-2 pt-0.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setManualVerifyVendor(peserta);
                                        setManualCatatan("");
                                      }}
                                      className="text-[10px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                                    >
                                      Verifikasi Hadir
                                    </button>
                                    <span className="text-slate-300 text-[10px]">•</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTidakHadirVendor(peserta);
                                        setTidakHadirCatatan("");
                                      }}
                                      className="text-[10px] font-semibold text-rose-600 hover:underline cursor-pointer"
                                    >
                                      Konfirmasi Tidak Hadir
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Readiness Banner sebelum simpan */}
                  <div className="pt-1">
                    {!allConfirmed ? (
                      <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-[11px] text-amber-800 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>
                          Masih ada <strong>{belumAbsenCount} rekanan</strong> yang belum dikonfirmasi. Konfirmasi seluruh rekanan (Hadir / Tidak Hadir) untuk dapat menyimpan sesi.
                        </span>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200/80 text-[11px] text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          Seluruh <strong>{totalPeserta} rekanan</strong> telah terkonfirmasi ({hadirCount} Hadir, {tidakHadirCount} Tidak Hadir). Klik tombol simpan di bawah untuk melanjutkan proses.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmStopOpen(true)}
                      className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold h-9 px-3 cursor-pointer"
                    >
                      <Power className="w-3.5 h-3.5 mr-1 text-rose-600" />
                      Tutup Sesi
                    </Button>

                    <Button
                      type="button"
                      onClick={() => setConfirmFinishOpen(true)}
                      disabled={!allConfirmed || submittingFinish}
                      className={cn(
                        "rounded-xl text-white text-xs font-bold h-9 px-4 cursor-pointer shadow-sm transition-all inline-flex items-center gap-1.5",
                        allConfirmed
                          ? "bg-[#E65F2B] hover:bg-[#d04f1f] shadow-orange-500/20"
                          : "bg-slate-300 text-slate-500 cursor-not-allowed opacity-70"
                      )}
                      title={
                        !allConfirmed
                          ? "Konfirmasi seluruh rekanan (Hadir atau Tidak Hadir) terlebih dahulu"
                          : "Simpan dan lanjutkan ke proses selanjutnya"
                      }
                    >
                      {submittingFinish ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          Menyimpan...
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          Simpan &amp; Lanjutkan Proses
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen QR Presentation Overlay (Kiosk Mode) */}
      {isFullscreenQr && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-between p-6 sm:p-10 animate-in fade-in duration-200">
          <div className="w-full flex items-center justify-between max-w-xl">
            <div>
              <span className="text-xs font-bold text-[#E65F2B] uppercase tracking-wider">
                Presensi Hari-H Aanwijzing
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {namaProyek || "Rapat Aanwijzing"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreenQr(false)}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Keluar dari Layar Penuh"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center space-y-4 my-auto">
            <div className="p-5 sm:p-8 bg-white rounded-3xl border-4 border-slate-200 shadow-2xl">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="QR Fullscreen"
                  className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 object-contain"
                />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-slate-100 px-4 py-2 rounded-full">
              <Clock className="w-4 h-4 text-[#E65F2B]" />
              <span>Berganti dalam:</span>
              <span
                className={cn(
                  "font-mono",
                  secondsRemaining <= 10 ? "text-rose-600 animate-pulse" : "text-emerald-600"
                )}
              >
                {secondsRemaining}s
              </span>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400">
            Arahkan kamera smartphone ke QR Code di atas • Radius toleransi 200m
          </div>
        </div>
      )}

      {/* Manual Verification Dialog */}
      <Dialog open={Boolean(manualVerifyVendor)} onOpenChange={(open) => !open && setManualVerifyVendor(null)}>
        <DialogContent
          overlayClassName="z-[70] bg-black/60 backdrop-blur-[1px]"
          className="max-w-md p-0 rounded-2xl border-slate-200/80 shadow-2xl bg-white overflow-hidden z-[75] [&>button:last-child]:hidden"
        >
          <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Verifikasi Kehadiran Manual
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                {manualVerifyVendor?.nama_perusahaan}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setManualVerifyVendor(null)}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer shrink-0 -mr-2"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleManualVerifySubmit} className="px-6 py-5 space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                Gunakan fitur ini hanya jika rekanan telah hadir fisik di ruang rapat namun mengalami kendala kamera atau izin browser saat memindai QR Code.
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Alasan Verifikasi Manual <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={manualCatatan}
                onChange={(e) => setManualCatatan(e.target.value)}
                placeholder="Contoh: Perangkat rekanan kendala browser kamera, terkonfirmasi hadir fisik di ruangan."
                className="w-full p-3 text-xs rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E65F2B]/20 focus:border-[#E65F2B]"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setManualVerifyVendor(null)}
                disabled={submittingManual}
                className="rounded-xl border-slate-200 text-xs font-semibold h-9 px-3"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submittingManual}
                className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white rounded-xl text-xs font-bold h-9 px-4 cursor-pointer"
              >
                {submittingManual ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                    Konfirmasi Hadir Manual
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Stop Session Dialog */}
      <Dialog open={confirmStopOpen} onOpenChange={setConfirmStopOpen}>
        <DialogContent
          overlayClassName="z-[70] bg-black/60 backdrop-blur-[1px]"
          className="max-w-sm p-0 rounded-2xl border-slate-200/80 shadow-2xl bg-white overflow-hidden z-[75] [&>button:last-child]:hidden"
        >
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Tutup Sesi Absensi?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                QR Code akan dinonaktifkan dan rekanan tidak dapat melakukan pemindaian lagi. Anda dapat membuka kembali sesi jika diperlukan.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmStopOpen(false)}
                disabled={stoppingSession}
                className="rounded-xl border-slate-200 text-xs font-semibold h-9 px-4"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleStopSession}
                disabled={stoppingSession}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold h-9 px-4 cursor-pointer"
              >
                {stoppingSession ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Menutup...
                  </>
                ) : (
                  "Ya, Tutup Sesi"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark Rekanan Tidak Hadir Dialog */}
      <Dialog
        open={Boolean(tidakHadirVendor)}
        onOpenChange={(open) => !open && setTidakHadirVendor(null)}
      >
        <DialogContent
          overlayClassName="z-[70] bg-black/60 backdrop-blur-[1px]"
          className="max-w-md p-0 rounded-2xl border-slate-200/80 shadow-2xl bg-white overflow-hidden z-[75] [&>button:last-child]:hidden"
        >
          <div className="px-6 py-4.5 border-b border-slate-100 bg-rose-50/50 flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Konfirmasi Ketidakhadiran Rekanan
              </DialogTitle>
              <p className="text-xs text-rose-700 font-medium mt-0.5">
                {tidakHadirVendor?.nama_perusahaan}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTidakHadirVendor(null)}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-xl transition-colors cursor-pointer shrink-0 -mr-2"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleTidakHadirSubmit} className="px-6 py-5 space-y-4">
            <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                Tandai rekanan ini sebagai <strong>Tidak Hadir (Absen / Batal)</strong> pada rapat Aanwijzing Hari-H. Wajib menyertakan catatan alasan ketidakhadiran untuk rekam jejak audit.
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Catatan Alasan Tidak Hadir <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={tidakHadirCatatan}
                onChange={(e) => setTidakHadirCatatan(e.target.value)}
                placeholder="Contoh: Tidak hadir di lokasi rapat hingga waktu penutupan / konfirmasi via telepon berhalangan karena kendala perjalanan."
                className="w-full p-3 text-xs rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTidakHadirVendor(null)}
                disabled={submittingTidakHadir}
                className="rounded-xl border-slate-200 text-xs font-semibold h-9 px-3"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={submittingTidakHadir}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold h-9 px-4 cursor-pointer"
              >
                {submittingTidakHadir ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <UserX className="w-3.5 h-3.5 mr-1.5" />
                    Tandai Tidak Hadir
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Finish Session Dialog */}
      <Dialog open={confirmFinishOpen} onOpenChange={setConfirmFinishOpen}>
        <DialogContent
          overlayClassName="z-[70] bg-black/60 backdrop-blur-[1px]"
          className="max-w-md p-0 rounded-2xl border-slate-200/80 shadow-2xl bg-white overflow-hidden z-[75] [&>button:last-child]:hidden"
        >
          <div className="p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 text-[#E65F2B] mx-auto flex items-center justify-center">
              <FileCheck2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <DialogTitle className="text-base font-bold text-slate-900">
                Selesaikan Sesi Absensi Aanwijzing?
              </DialogTitle>
              <p className="text-xs text-slate-500 leading-relaxed">
                Hasil absensi akan dikunci dan sistem akan mengevaluasi pemenuhan quorum kehadiran kontraktor.
              </p>
            </div>

            {/* Rekapitulasi Kehadiran */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between font-medium text-slate-600">
                <span>Hadir Fisik Aktual:</span>
                <span className="font-bold text-emerald-700">{hadirCount} Rekanan</span>
              </div>
              <div className="flex items-center justify-between font-medium text-slate-600">
                <span>Dikonfirmasi Tidak Hadir:</span>
                <span className="font-bold text-rose-700">{tidakHadirCount} Rekanan</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between font-bold text-slate-900">
                <span>Total Rekanan Sesi:</span>
                <span>{totalPeserta} Rekanan</span>
              </div>
            </div>

            {/* Info Evaluasi SOP Quorum */}
            {hadirCount >= 3 ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Quorum Terpenuhi (≥3 Rekanan Hadir):</strong>
                  <p className="text-[11px] mt-0.5 text-emerald-700 leading-relaxed">
                    Status Aanwijzing akan diselesaikan (SELESAI) dan berkas berlanjut ke proses pengadaan/tahap berikutnya.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Quorum Tidak Terpenuhi (&lt;3 Rekanan Hadir):</strong>
                  <p className="text-[11px] mt-0.5 text-amber-700 leading-relaxed">
                    Sesuai aturan SOP SPARTA, berkas akan otomatis dialihkan ke <strong>DC Building &amp; Development Manager</strong> untuk persetujuan apakah aanwijzing dapat dilanjutkan atau tidak.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmFinishOpen(false)}
                disabled={submittingFinish}
                className="rounded-xl border-slate-200 text-xs font-semibold h-9 px-4"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleFinishSession}
                disabled={submittingFinish}
                className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white rounded-xl text-xs font-bold h-9 px-4 cursor-pointer shadow-sm shadow-orange-500/20"
              >
                {submittingFinish ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Ya, Simpan &amp; Selesaikan
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Modal */}
      <FeedbackModal
        open={feedback.open}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => {
          setFeedback((prev) => ({ ...prev, open: false }));
          if (
            feedback.type === "success" &&
            (feedback.title.includes("Sesi Absensi Selesai") ||
              feedback.title.includes("Dialihkan"))
          ) {
            handleClose();
          }
        }}
      />
    </>
  );
}
