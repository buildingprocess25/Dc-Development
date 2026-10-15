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

  // Form Fields
  const [namaPemohon, setNamaPemohon] = useState("");
  const [emailPemohon, setEmailPemohon] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [divisi, setDivisi] = useState("");
  const [departemen, setDepartemen] = useState("");
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

  // Deteksi perubahan minimal satu field untuk validasi revisi
  const changedFields = useMemo(() => {
    if (!submission) return [];
    const changes: string[] = [];

    const norm = (val: any) => (val || "").trim();
    const normEmail = (val: any) => (val || "").trim().toLowerCase();

    if (norm(namaPemohon) !== norm(submission.nama_pemohon)) changes.push("Nama Pemohon");
    if (normEmail(emailPemohon) !== normEmail(submission.email_pemohon)) changes.push("Email Pemohon");
    if (norm(jabatan) !== norm(submission.jabatan)) changes.push("Jabatan");
    if (norm(divisi) !== norm(submission.divisi)) changes.push("Divisi");
    if (norm(departemen) !== norm(submission.departemen)) changes.push("Departemen");
    if (norm(jenisPengajuan) !== norm(submission.jenis_pengajuan)) changes.push("Jenis Pengajuan");
    if (norm(alasanPengajuan) !== norm(submission.alasan_pengajuan)) changes.push("Alasan Pengajuan");

    return changes;
  }, [
    submission,
    namaPemohon,
    emailPemohon,
    jabatan,
    divisi,
    departemen,
    jenisPengajuan,
    alasanPengajuan,
  ]);

  const hasChanges = changedFields.length > 0;

  // Fetch Existing Submission Data
  useEffect(() => {
    if (!submissionId) return;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        const res = await fetch(`/api/dc-development/fungsi-ruang/${submissionId}`);
        const json = await res.json();

        if (!res.ok || json.status !== "success") {
          throw new Error(json.message || "Gagal mengambil data pengajuan");
        }

        const data = json.data;
        setSubmission(data);
        setNamaPemohon(data.nama_pemohon || "");
        setEmailPemohon(data.email_pemohon || "");
        setJabatan(data.jabatan || "");
        setDivisi(data.divisi || "");
        setDepartemen(data.departemen || "");
        setJenisPengajuan(data.jenis_pengajuan || "");
        setAlasanPengajuan(data.alasan_pengajuan || "");
      } catch (err: any) {
        setErrorMsg(err.message || "Terjadi kesalahan saat memuat data.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
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

  const handleNamaBlur = () => {
    if (namaPemohon) setNamaPemohon(toTitleCase(namaPemohon));
  };

  const handleEmailBlur = () => {
    if (emailPemohon) setEmailPemohon(emailPemohon.trim().toLowerCase());
  };

  const handleJabatanBlur = () => {
    if (jabatan) setJabatan(toTitleCase(jabatan));
  };

  const handleDivisiBlur = () => {
    if (divisi) setDivisi(toTitleCase(divisi));
  };

  const handleDepartemenBlur = () => {
    if (departemen) setDepartemen(toTitleCase(departemen));
  };

  const handleAlasanBlur = () => {
    if (alasanPengajuan) setAlasanPengajuan(toTitleCase(alasanPengajuan));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!namaPemohon.trim() || !emailPemohon.trim() || !jabatan.trim() || !divisi.trim() || !departemen.trim()) {
      setErrorMsg("Seluruh data identitas pemohon wajib diisi.");
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
        nama_pemohon: toTitleCase(namaPemohon),
        email_pemohon: emailPemohon.trim().toLowerCase(),
        jabatan: toTitleCase(jabatan),
        divisi: toTitleCase(divisi),
        departemen: toTitleCase(departemen),
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

          {/* Section 2: Identitas Pemohon */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-4 h-4 text-[#E65F2B]" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                2. Identitas Pemohon
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                  Nama Pemohon <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="Nama Pemohon"
                  value={namaPemohon}
                  onChange={(e) => setNamaPemohon(e.target.value)}
                  onBlur={handleNamaBlur}
                  disabled={isSubmitting}
                  className="h-10 text-xs rounded-xl border-slate-200 focus-visible:ring-[#E65F2B]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                  Email Pemohon <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="email"
                  placeholder="budi.santoso@sat.co.id"
                  value={emailPemohon}
                  onChange={(e) => setEmailPemohon(e.target.value.toLowerCase())}
                  onBlur={handleEmailBlur}
                  disabled={isSubmitting}
                  className="h-10 text-xs rounded-xl border-slate-200 focus-visible:ring-[#E65F2B] font-mono lowercase"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                  Jabatan <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="Jabatan Pemohon"
                  value={jabatan}
                  onChange={(e) => setJabatan(e.target.value)}
                  onBlur={handleJabatanBlur}
                  disabled={isSubmitting}
                  className="h-10 text-xs rounded-xl border-slate-200 focus-visible:ring-[#E65F2B]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                  Divisi <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="Divisi"
                  value={divisi}
                  onChange={(e) => setDivisi(e.target.value)}
                  onBlur={handleDivisiBlur}
                  disabled={isSubmitting}
                  className="h-10 text-xs rounded-xl border-slate-200 focus-visible:ring-[#E65F2B]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5 uppercase tracking-wide">
                  Departemen <span className="text-rose-500">*</span>
                </label>
                <Input
                  placeholder="Departemen"
                  value={departemen}
                  onChange={(e) => setDepartemen(e.target.value)}
                  onBlur={handleDepartemenBlur}
                  disabled={isSubmitting}
                  className="h-10 text-xs rounded-xl border-slate-200 focus-visible:ring-[#E65F2B]"
                />
              </div>
            </div>
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
