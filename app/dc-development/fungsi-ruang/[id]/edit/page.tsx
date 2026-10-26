"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Dashboard from "@/components/dashboard/dashboard";
import {
  Building2,
  User,
  Mail,
  Briefcase,
  Layers,
  MapPin,
  Tag,
  FileText,
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  ShieldAlert,
  SendHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/context/SessionContext";
import { isApprovalAdmin, isSameCreator, canManageFungsiRuang } from "@/lib/permissions";
import { toTitleCase } from "@/lib/utils";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { SearchableSelectInput } from "@/components/ui/searchable-select";

export default function EditFungsiRuangPage() {
  const router = useRouter();
  const params = useParams();
  const submissionId = params?.id as string;
  const { user } = useSession();

  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<any | null>(null);
  const [masterPemohonList, setMasterPemohonList] = useState<any[]>([]);

  // Form Fields
  const [selectedPemohonId, setSelectedPemohonId] = useState<string>("");
  const [jenisPengajuan, setJenisPengajuan] = useState("");
  const [alasanPengajuan, setAlasanPengajuan] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<{
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

  const jenisPengajuanOptions = useMemo(
    () => [
      { value: "Perubahan Fungsi Ruang", label: "Perubahan Fungsi Ruang" },
      { value: "Pengurangan Fungsi Ruang", label: "Pengurangan Fungsi Ruang" },
      { value: "Penambahan Fungsi Ruang", label: "Penambahan Fungsi Ruang" },
      { value: "Perubahan & Penambahan Fungsi Ruang", label: "Perubahan & Penambahan Fungsi Ruang" },
    ],
    []
  );

  const pemohonOptions = useMemo(() => {
    const targetCabang = (submission?.project?.cabang || submission?.renovasi?.cabang || "").toUpperCase();
    const filtered = targetCabang
      ? masterPemohonList.filter((p) => (p.cabang || "").toUpperCase() === targetCabang)
      : masterPemohonList;

    const displayList = filtered.length > 0 ? filtered : masterPemohonList;

    return displayList.map((p) => ({
      value: String(p.id),
      label: `${p.nama_pemohon} — ${p.jabatan} (${p.departemen}${p.cabang ? ` - Cabang ${p.cabang}` : ""})`,
    }));
  }, [masterPemohonList, submission]);

  const selectedPemohon = useMemo(() => {
    if (!selectedPemohonId) return null;
    return masterPemohonList.find((p) => String(p.id) === String(selectedPemohonId)) || null;
  }, [selectedPemohonId, masterPemohonList]);

  // Deteksi perubahan minimal satu field untuk validasi revisi
  const changedFields = useMemo(() => {
    if (!submission) return [];
    const changes: string[] = [];

    const norm = (val: any) => (val || "").trim();

    if (selectedPemohonId && String(selectedPemohonId) !== String(submission.pemohon_id)) {
      changes.push("Identitas Pemohon (Master Data)");
    }
    if (norm(jenisPengajuan) !== norm(submission.jenis_pengajuan)) {
      changes.push("Jenis Pengajuan");
    }
    if (norm(alasanPengajuan) !== norm(submission.alasan_pengajuan)) {
      changes.push("Alasan Pengajuan");
    }

    return changes;
  }, [
    submission,
    selectedPemohonId,
    jenisPengajuan,
    alasanPengajuan,
  ]);

  const hasChanges = changedFields.length > 0;

  // Fetch Existing Submission Data & Master Pemohon
  useEffect(() => {
    if (!submissionId) return;

    const fetchAllData = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const [resDetail, resPemohon] = await Promise.all([
          fetch(`/api/dc-development/fungsi-ruang/${submissionId}`),
          fetch('/api/dc-development/master-pemohon'),
        ]);

        const jsonDetail = await resDetail.json();
        const jsonPemohon = await resPemohon.json();

        if (!resDetail.ok || jsonDetail.status !== "success") {
          throw new Error(jsonDetail.message || "Gagal mengambil data pengajuan");
        }

        const data = jsonDetail.data;
        setSubmission(data);
        setSelectedPemohonId(String(data.pemohon_id || data.pemohon?.id || ""));
        setJenisPengajuan(data.jenis_pengajuan || "");
        setAlasanPengajuan(data.alasan_pengajuan || "");

        if (resPemohon.ok && jsonPemohon.status === "success") {
          setMasterPemohonList(jsonPemohon.data || []);
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Terjadi kesalahan saat memuat data.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [submissionId]);

  // Extract latest revision notes from audit logs
  const latestRevisionLog = useMemo(() => {
    if (!submission?.audit_logs || !Array.isArray(submission.audit_logs)) return null;
    const revLogs = submission.audit_logs.filter((log: any) => log.aksi === "REVISI");
    return revLogs.length > 0 ? revLogs[revLogs.length - 1] : null;
  }, [submission]);

  // Check authorization
  const canEdit = useMemo(() => {
    if (!submission || !user) return false;
    const isMaker = isSameCreator(user, submission.created_by);
    const isAdmin = isApprovalAdmin(user.role);
    return (isMaker || isAdmin) && submission.status === "REVISI";
  }, [submission, user]);

  const handleAlasanBlur = () => {
    if (alasanPengajuan) setAlasanPengajuan(toTitleCase(alasanPengajuan));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedPemohonId) {
      setErrorMsg("Identitas pemohon dari master data wajib dipilih.");
      return;
    }

    if (!jenisPengajuan) {
      setErrorMsg("Jenis pengajuan fungsi ruang wajib dipilih.");
      return;
    }

    if (!alasanPengajuan.trim()) {
      setErrorMsg("Alasan pengajuan fungsi ruang wajib diisi.");
      return;
    }

    if (!hasChanges) {
      setErrorMsg("Pengajuan revisi wajib mengubah minimal satu data atau rincian pengajuan sebelum dapat diajukan ulang.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        pemohon_id: parseInt(selectedPemohonId, 10),
        jenis_pengajuan: jenisPengajuan,
        alasan_pengajuan: toTitleCase(alasanPengajuan),
      };

      const res = await fetch(`/api/dc-development/fungsi-ruang/${submissionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Gagal memperbarui pengajuan");
      }

      setFeedbackModal({
        open: true,
        type: "success",
        title: "Pengajuan Berhasil Diajukan Ulang",
        message: `Perbaikan pengajuan ${submission?.nomor_pengajuan || ""} telah berhasil dikirim ulang ke alur persetujuan.`,
      });
    } catch (err: any) {
      setErrorMsg(err.message);
      setFeedbackModal({
        open: true,
        type: "error",
        title: "Gagal Mengajukan Ulang",
        message: err.message || "Terjadi kesalahan saat menyimpan perubahan.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Dashboard title="Perbaiki Pengajuan Fungsi Ruang">
        <div className="flex-1 flex flex-col items-center justify-center p-16 text-center min-h-[400px]">
          <div className="w-9 h-9 border-3 border-[#E65F2B] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs font-semibold text-slate-500 animate-pulse">Memuat data pengajuan revisi...</p>
        </div>
      </Dashboard>
    );
  }

  if (submission && !canEdit) {
    return (
      <Dashboard title="Perbaiki Pengajuan Fungsi Ruang">
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Pengajuan Tidak Dalam Status Revisi</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
            Pengajuan ini memiliki status <strong>{submission.status}</strong> dan hanya dapat diperbaiki jika berstatus <strong>REVISI</strong> oleh pembuatnya atau Administrator.
          </p>
          <Link href="/dc-development/fungsi-ruang" className="mt-5">
            <Button variant="outline" className="rounded-xl text-xs h-9">
              Kembali ke Daftar Pengajuan
            </Button>
          </Link>
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard title="Perbaiki Pengajuan Fungsi Ruang">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)]">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <Link
            href="/dc-development/fungsi-ruang"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#E65F2B] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Daftar Pengajuan</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-orange-100 text-[#E65F2B]">
              STATUS REVISI
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {submission?.nomor_pengajuan}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto w-full space-y-6">
          {/* Revision Banner Card */}
          {latestRevisionLog && (
            <div className="bg-amber-50/90 border-2 border-amber-300/80 rounded-2xl p-5 sm:p-6 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <h2 className="text-sm font-extrabold text-amber-950 uppercase tracking-wide">
                      Catatan Perbaikan dari Reviewer
                    </h2>
                    <span className="text-[11px] text-amber-800 font-medium">
                      Oleh: <strong>{latestRevisionLog.data_baru?.action_by_name || "Approver"}</strong> ({latestRevisionLog.data_baru?.action_by_role || "Reviewer"})
                    </span>
                  </div>
                  <div className="bg-white/80 p-3.5 rounded-xl border border-amber-200 text-xs text-amber-950 leading-relaxed font-semibold">
                    {latestRevisionLog.data_baru?.catatan || "Mohon periksa dan lengkapi kembali data pengajuan sebelum diajukan ulang."}
                  </div>
                  <p className="text-[11px] text-amber-800 mt-2 font-medium">
                    Silakan perbaiki isian data di bawah ini, lalu klik tombol <strong>"Ajukan Ulang Pengajuan"</strong> untuk mengirim kembali ke antrean persetujuan awal (BM/DBM).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Informasi Proyek (Read-Only) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Building2 className="w-4 h-4 text-[#E65F2B]" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                1. Proyek Renovasi Terkait
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                  Nama Proyek
                </label>
                <Input
                  readOnly
                  value={submission?.project?.nama_proyek || "Proyek DC"}
                  className="bg-slate-50 text-slate-700 font-bold text-xs h-10 rounded-xl border-slate-200 cursor-default focus-visible:ring-0"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                  Tipe Bangunan
                </label>
                <Input
                  readOnly
                  value={submission?.project?.tipe || "DC"}
                  className="bg-slate-50 text-slate-700 font-bold text-xs h-10 rounded-xl border-slate-200 cursor-default focus-visible:ring-0"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-1">
                  Cabang
                </label>
                <Input
                  readOnly
                  value={submission?.project?.cabang || submission?.renovasi?.cabang || "-"}
                  className="bg-slate-50 text-slate-700 font-bold text-xs h-10 rounded-xl border-slate-200 cursor-default focus-visible:ring-0"
                />
              </div>
            </div>

            {submission?.renovasi?.nomor_pengajuan && (
              <p className="text-[11px] text-slate-400">
                Referensi Penawaran RAB/OE: <strong className="text-slate-600">{submission.renovasi.nomor_pengajuan}</strong>
              </p>
            )}
          </div>

          {/* Section 2: Identitas Pemohon (Master Data) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#E65F2B]" />
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  2. Identitas Pemohon (Master Data)
                </h2>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Pilih dari Master Pemohon
              </span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                Pilih Pemohon <span className="text-rose-500">*</span>
              </label>
              <SearchableSelectInput
                value={selectedPemohonId}
                onChange={(val) => setSelectedPemohonId(val)}
                options={pemohonOptions}
                placeholder="Cari nama pemohon, jabatan, atau departemen..."
              />
            </div>

            {/* Detail Profil Pemohon Terpilih */}
            {selectedPemohon && (
              <div className="bg-slate-50/60 border border-slate-200/90 rounded-xl p-4.5 space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Rincian Identitas Pemohon
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Terverifikasi Master
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Nama Pemohon</span>
                    <span className="text-xs font-bold text-slate-900 mt-0.5 block">{selectedPemohon.nama_pemohon}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Email Pemohon</span>
                    <span className="text-xs font-semibold text-slate-800 mt-0.5 block font-mono">{selectedPemohon.email_pemohon}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Jabatan & Cabang</span>
                    <span className="text-xs font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{selectedPemohon.jabatan}</span>
                      {selectedPemohon.cabang && (
                        <span className="text-[10px] font-bold text-orange-800 bg-orange-100/90 border border-orange-200 px-1.5 py-0.2 rounded">
                          Cabang {selectedPemohon.cabang}
                        </span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Divisi</span>
                    <span className="text-xs font-semibold text-slate-800 mt-0.5 block">{selectedPemohon.divisi}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">Departemen</span>
                    <span className="text-xs font-semibold text-slate-800 mt-0.5 block">{selectedPemohon.departemen}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">
                      {selectedPemohon.gm_role || "Approval GM Dept"}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 mt-0.5 block">
                      {selectedPemohon.gm_nama || "-"} <span className="text-[10px] text-slate-400 block font-mono font-normal">{selectedPemohon.gm_email}</span>
                    </span>
                  </div>
                  <div className="sm:col-span-2 md:col-span-3 pt-2 border-t border-slate-200/50">
                    <span className="text-[11px] text-slate-400 block font-medium">
                      {selectedPemohon.direktur_role || "Approval Director Dept"}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 mt-0.5 block">
                      {selectedPemohon.direktur_nama || "-"} <span className="text-[10px] text-slate-400 inline font-mono font-normal">({selectedPemohon.direktur_email})</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Rincian Pengajuan */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Tag className="w-4 h-4 text-[#E65F2B]" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                3. Rincian Pengajuan Fungsi Ruang
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                  Jenis Pengajuan <span className="text-rose-500">*</span>
                </label>
                <SearchableSelectInput
                  value={jenisPengajuan}
                  onChange={(val) => setJenisPengajuan(val)}
                  options={jenisPengajuanOptions}
                  placeholder="Pilih jenis pengajuan fungsi ruang..."
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                  Alasan Pengajuan <span className="text-rose-500">*</span>
                </label>
                <Textarea
                  placeholder="Perbarui alasan pengajuan fungsi ruang sesuai catatan reviewer..."
                  rows={4}
                  value={alasanPengajuan}
                  onChange={(e) => setAlasanPengajuan(e.target.value)}
                  onBlur={handleAlasanBlur}
                  disabled={isSubmitting}
                  className="text-xs rounded-xl border-slate-200 focus-visible:ring-[#E65F2B] leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Indikator Status Perubahan Revisi */}
          {!hasChanges ? (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs shadow-2xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                <strong>Belum ada data yang diubah:</strong> Untuk mengajukan revisi ulang, Anda wajib memperbarui minimal satu data atau rincian pengajuan sesuai catatan reviewer di atas.
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs shadow-2xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>
                <strong>{changedFields.length} Perubahan Terdeteksi:</strong> {changedFields.join(", ")}. Berkas siap diajukan ulang.
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link href="/dc-development/fungsi-ruang">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-xs h-10 px-5 font-semibold"
                disabled={isSubmitting}
              >
                Batal
              </Button>
            </Link>

            <Button
              type="submit"
              className={`font-bold text-xs h-10 px-6 rounded-xl shadow-md transition-all ${
                hasChanges
                  ? "bg-[#E65F2B] hover:bg-[#d04f1f] text-white shadow-[#E65F2B]/20 cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
              }`}
              disabled={isSubmitting || !hasChanges}
            >
              <SendHorizontal className="w-4 h-4 mr-1.5" />
              {isSubmitting ? "Menyimpan & Mengirim..." : "Ajukan Ulang Pengajuan"}
            </Button>
          </div>
        </form>
      </div>

      <FeedbackModal
        open={feedbackModal.open}
        type={feedbackModal.type}
        title={feedbackModal.title}
        message={feedbackModal.message}
        onClose={() => {
          if (feedbackModal.type === "success") {
            router.push("/dc-development/fungsi-ruang");
          } else {
            setFeedbackModal((prev) => ({ ...prev, open: false }));
          }
        }}
      />
    </Dashboard>
  );
}
