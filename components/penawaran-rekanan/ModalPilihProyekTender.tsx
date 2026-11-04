"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Scale,
  X,
  ArrowRight,
  Loader2,
  MapPin,
  Building2,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelectInput } from "@/components/ui/searchable-select";

interface ReadyProject {
  klarifikasi_id: number;
  nomor_klarifikasi: string;
  project_id: number;
  nama_proyek: string;
  kode_proyek: string;
  cabang: string;
  alamat_lokasi: string;
  durasi_hari_akhir: number;
  tanggal_tender?: string;
  window_status?: "MENUNGGU_JADWAL" | "DIBUKA" | "TERLEWAT";
  is_eliminated?: boolean;
  can_input_now?: boolean;
  vendor_id?: number | null;
  vendor_nama?: string | null;
  existing_penawaran_id?: number | null;
  existing_nomor_penawaran?: string | null;
  existing_status?: string | null;
  is_already_submitted: boolean;
}

interface ModalPilihProyekProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ModalPilihProyekTender({
  isOpen,
  onClose,
}: ModalPilihProyekProps) {
  const router = useRouter();
  const [readyProjects, setReadyProjects] = useState<ReadyProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedKlarifikasiId, setSelectedKlarifikasiId] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedKlarifikasiId("");
      setErrorMsg(null);
      fetchReadyProjects();
    }
  }, [isOpen]);

  const fetchReadyProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dc-development/penawaran-rekanan/ready-projects");
      const json = await res.json();
      if (json.status === "success") {
        setReadyProjects(json.data || []);
      } else {
        setErrorMsg(json.message || "Gagal memuat daftar paket tender");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const selectedProject = readyProjects.find(
    (p) => String(p.klarifikasi_id) === selectedKlarifikasiId
  );

  const selectOptions = readyProjects.map((p) => {
    let tag = "";
    if (p.is_eliminated) {
      tag = " — [🚫 TERELIMINASI]";
    } else if (p.window_status === "MENUNGGU_JADWAL") {
      tag = ` — [🔒 TENDER: ${p.tanggal_tender || "-"}]`;
    } else if (p.existing_status === "DRAFT") {
      tag = " — [📝 DRAF ADA]";
    } else if (p.is_already_submitted) {
      tag = ` — [✓ DIAJUKAN: ${p.existing_status}]`;
    } else if (p.window_status === "DIBUKA") {
      tag = " — [🟢 TENDER HARI INI]";
    }

    return {
      value: String(p.klarifikasi_id),
      label: `[${p.kode_proyek}] ${p.nama_proyek} (${p.cabang}) — No: ${p.nomor_klarifikasi}${tag}`,
    };
  });

  const handleStartPenawaran = async () => {
    if (!selectedProject) return;

    // Jika rekanan tereliminasi dan belum submit resmi, tolak akses
    if (selectedProject.is_eliminated && !selectedProject.is_already_submitted) {
      setErrorMsg("Batas waktu pelaksanaan tender telah berakhir. Anda dinyatakan tereliminasi dari lelang ini.");
      return;
    }

    // Jika tender belum dibuka
    if (selectedProject.window_status === "MENUNGGU_JADWAL") {
      setErrorMsg(`Pelaksanaan tender belum dibuka. Jadwal pengisian penawaran adalah pada tanggal ${selectedProject.tanggal_tender}.`);
      return;
    }

    // Jika sudah ada draf, langsung arahkan ke draf tersebut
    if (selectedProject.existing_penawaran_id && selectedProject.existing_status === "DRAFT") {
      onClose();
      router.push(`/dc-development/penawaran-rekanan/${selectedProject.existing_penawaran_id}`);
      return;
    }

    // Jika sudah diajukan resmi, arahkan ke review
    if (selectedProject.existing_penawaran_id && selectedProject.is_already_submitted) {
      onClose();
      router.push(`/dc-development/penawaran-rekanan/${selectedProject.existing_penawaran_id}/review-penawaran`);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const res = await fetch("/api/dc-development/penawaran-rekanan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          klarifikasi_id: selectedProject.klarifikasi_id,
          vendor_id: selectedProject.vendor_id || undefined,
        }),
      });

      const json = await res.json();
      if (json.status === "success" && json.data?.id) {
        onClose();
        router.push(`/dc-development/penawaran-rekanan/${json.data.id}`);
      } else {
        setErrorMsg(json.message || "Gagal menginisialisasi penawaran rekanan");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Terjadi kesalahan sistem");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200/90 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#E65F2B]">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E65F2B] bg-orange-100/80 px-2 py-0.5 rounded">
                  SOP SAT/SOP/DCB/003
                </span>
                <span className="text-slate-300 text-xs">•</span>
                <span className="text-xs text-slate-500 font-medium">Tender Bangunan DC</span>
              </div>
              <h3 className="font-bold text-slate-900 text-base mt-0.5">
                Buat Penawaran Rekanan
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Modal */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Pemilihan Proyek */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Pilih Paket Proyek Tender Aanwijzing: <span className="text-rose-500">*</span>
            </label>

            {loading ? (
              <div className="flex items-center space-x-2 py-3 px-3 text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                <Loader2 className="w-4 h-4 animate-spin text-[#E65F2B]" />
                <span>Memeriksa paket tender yang memenuhi kehadiran aktual Anda...</span>
              </div>
            ) : selectOptions.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center space-y-1">
                <p className="text-xs font-semibold text-slate-700">
                  Tidak Ada Paket Tender Siap Diajukan
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-sm mx-auto">
                  Paket tender hanya muncul jika dokumen Klarifikasi Aanwijzing telah disetujui dan akun rekanan Anda tercatat hadir.
                </p>
              </div>
            ) : (
              <SearchableSelectInput
                value={selectedKlarifikasiId}
                onChange={setSelectedKlarifikasiId}
                options={selectOptions}
                placeholder="Ketik nama proyek, cabang, kode DC, atau nomor aanwijzing..."
              />
            )}
          </div>

          {/* Kartu Pratinjau Proyek Terpilih */}
          {selectedProject && (
            <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4.5 space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Kode: {selectedProject.kode_proyek} • Cabang: {selectedProject.cabang}
                  </div>
                  <h4 className="font-bold text-slate-900 text-base mt-0.5">
                    {selectedProject.nama_proyek}
                  </h4>
                </div>
                <span className="text-[11px] font-mono bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-slate-700 font-semibold shadow-2xs">
                  {selectedProject.durasi_hari_akhir} Hari
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1 border-t border-slate-200/60">
                <div className="flex items-center space-x-2 text-slate-600">
                  <FileCheck2 className="w-3.5 h-3.5 text-[#E65F2B] flex-shrink-0" />
                  <span className="truncate">No. BA: {selectedProject.nomor_klarifikasi}</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-600">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span className="truncate">Rekanan: {selectedProject.vendor_nama || "Perusahaan Anda"}</span>
                </div>
              </div>

              {selectedProject.alamat_lokasi && (
                <div className="flex items-start space-x-2 text-[11px] text-slate-500 pt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{selectedProject.alamat_lokasi}</span>
                </div>
              )}

              {/* Status Notice */}
              {selectedProject.is_eliminated && !selectedProject.is_already_submitted ? (
                <div className="bg-rose-50 border border-rose-300 rounded-xl p-3 text-rose-900 text-xs space-y-1">
                  <span className="font-bold flex items-center text-rose-700">
                    <AlertCircle className="w-4 h-4 mr-1 text-rose-600" />
                    Status: TERELIMINASI
                  </span>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    Batas waktu pelaksanaan tender ({selectedProject.tanggal_tender}) telah berakhir dan penawaran resmi tidak diajukan tepat waktu. Anda dinyatakan tereliminasi dari tender lelang ini.
                  </p>
                </div>
              ) : selectedProject.window_status === "MENUNGGU_JADWAL" ? (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-amber-900 text-xs space-y-1">
                  <span className="font-bold flex items-center text-amber-800">
                    <Clock className="w-4 h-4 mr-1 text-amber-600" />
                    Jadwal Tender: {selectedProject.tanggal_tender}
                  </span>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Pengisian penawaran lelang belum dibuka. Rekanan diizinkan mengisi penawaran tepat pada tanggal tersebut (pukul 00:00 s/d 23:59).
                  </p>
                </div>
              ) : selectedProject.existing_status === "DRAFT" ? (
                <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-3 text-amber-800 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold block">Draf Penawaran Sudah Tersedia</span>
                    <span className="text-[11px] text-amber-700">
                      No. Penawaran: {selectedProject.existing_nomor_penawaran}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold bg-amber-200/80 px-2 py-0.5 rounded">
                    DRAFT
                  </span>
                </div>
              ) : selectedProject.is_already_submitted ? (
                <div className="bg-emerald-50 border border-emerald-200/90 rounded-xl p-3 text-emerald-800 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold flex items-center">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      Penawaran Resmi Telah Diajukan
                    </span>
                    <span className="text-[11px] text-emerald-700">
                      No. Penawaran: {selectedProject.existing_nomor_penawaran}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold bg-emerald-200/80 px-2 py-0.5 rounded">
                    {selectedProject.existing_status}
                  </span>
                </div>
              ) : (
                <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-3 text-emerald-950 text-xs space-y-1">
                  <span className="font-bold flex items-center text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Tender Dibuka Hari Ini! (Tanggal: {selectedProject.tanggal_tender})
                  </span>
                  <p className="text-[11px] text-emerald-900/90 leading-relaxed">
                    Volume dan item pekerjaan telah dikonfirmasi dari Berita Acara Klarifikasi. Anda dapat langsung menginput harga satuan (bisa via Excel) dan linimasa Gantt Chart sebelum pukul 23:59.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end space-x-2.5 bg-slate-50/50">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs h-9 px-4 rounded-xl border-slate-300 text-slate-700"
          >
            Batal
          </Button>

          <Button
            type="button"
            disabled={
              !selectedProject ||
              submitting ||
              Boolean(selectedProject.is_eliminated && !selectedProject.is_already_submitted) ||
              selectedProject.window_status === "MENUNGGU_JADWAL"
            }
            onClick={handleStartPenawaran}
            className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs h-9 px-5 rounded-xl font-semibold shadow-xs disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Memproses...
              </>
            ) : selectedProject?.is_eliminated && !selectedProject?.is_already_submitted ? (
              <span>Tereliminasi (Batas Waktu Lewat)</span>
            ) : selectedProject?.window_status === "MENUNGGU_JADWAL" ? (
              <span>Tender Belum Dibuka</span>
            ) : selectedProject?.existing_status === "DRAFT" ? (
              <>
                Lanjutkan Draf Penawaran
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </>
            ) : selectedProject?.is_already_submitted ? (
              <>
                Lihat Berkas Penawaran
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </>
            ) : (
              <>
                Mulai Isi Penawaran
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
