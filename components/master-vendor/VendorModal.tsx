"use client";

import React, { useState, useEffect } from "react";
import { Building2, Mail, Phone, MapPin, UserCheck, ShieldCheck, Award, Briefcase, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StringListInput } from "./StringListInput";
import { ALL_INDUK_CABANG } from "@/lib/branches";

interface VendorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorData?: any | null;
  onSuccess: (savedVendor: any, isEdit: boolean) => void;
  onError: (errorMessage: string) => void;
}

export function VendorModal({
  open,
  onOpenChange,
  vendorData,
  onSuccess,
  onError,
}: VendorModalProps) {
  const isEdit = Boolean(vendorData?.id);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    nama_perusahaan: "",
    alamat: "",
    nomor_telepon: "",
    email: "",
    golongan: "BESAR",
    jenis: "KONTRAKTOR",
    cabang: "HEAD OFFICE",
    coverage_cabang: "",
    pengalaman: [] as string[],
    sertifikat: [] as string[],
    sertifikasi_iso: [] as string[],
  });

  // Sync formData when vendorData or open state changes
  useEffect(() => {
    if (vendorData) {
      setFormData({
        nama_perusahaan: vendorData.nama_perusahaan || "",
        alamat: vendorData.alamat || "",
        nomor_telepon: vendorData.nomor_telepon || "",
        email: vendorData.email || "",
        golongan: vendorData.golongan || "BESAR",
        jenis: vendorData.jenis || "KONTRAKTOR",
        cabang: vendorData.cabang || "HEAD OFFICE",
        coverage_cabang: vendorData.coverage_cabang || "",
        pengalaman: Array.isArray(vendorData.pengalaman) ? vendorData.pengalaman : [],
        sertifikat: Array.isArray(vendorData.sertifikat) ? vendorData.sertifikat : [],
        sertifikasi_iso: Array.isArray(vendorData.sertifikasi_iso) ? vendorData.sertifikasi_iso : [],
      });
    } else {
      setFormData({
        nama_perusahaan: "",
        alamat: "",
        nomor_telepon: "",
        email: "",
        golongan: "BESAR",
        jenis: "KONTRAKTOR",
        cabang: "HEAD OFFICE",
        coverage_cabang: "",
        pengalaman: [],
        sertifikat: [],
        sertifikasi_iso: [],
      });
    }
  }, [vendorData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nama_perusahaan.trim()) {
      onError("Nama perusahaan wajib diisi.");
      return;
    }
    if (!formData.alamat.trim()) {
      onError("Alamat perusahaan wajib diisi.");
      return;
    }
    if (!formData.nomor_telepon.trim()) {
      onError("Nomor telepon wajib diisi.");
      return;
    }
    if (!formData.email.trim()) {
      onError("Email perusahaan wajib diisi.");
      return;
    }

    try {
      setLoading(true);
      const url = isEdit
        ? `/api/dc-development/master-vendor/${vendorData.id}`
        : "/api/dc-development/master-vendor";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (json.status === "success") {
        onSuccess(json.data, isEdit);
        onOpenChange(false);
      } else {
        onError(json.message || "Gagal menyimpan data vendor.");
      }
    } catch (err: any) {
      console.error(err);
      onError(err.message || "Terjadi kesalahan sistem saat menyimpan vendor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border border-slate-200/80 shadow-xl bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E65F2B] to-[#cf4d1a] flex items-center justify-center text-white shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {isEdit ? "Edit Rekanan Vendor" : "Tambah Rekanan Vendor Baru"}
              </h2>
              <p className="text-xs text-slate-500">
                Master data kontraktor utama dan konsultan perencana/pengawas SPARTA
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Bagian 1: Identitas & Klasifikasi */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Building2 className="w-4 h-4 text-[#E65F2B]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                1. Profil & Klasifikasi Perusahaan
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700">
                  Nama Perusahaan (PT / CV) <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={formData.nama_perusahaan}
                  onChange={(e) => setFormData({ ...formData, nama_perusahaan: e.target.value })}
                  placeholder="Contoh: PT. Rekajasa CM / PT. Total Bangun Persada"
                  className="h-9.5 text-xs rounded-xl border-slate-200 focus:border-[#E65F2B]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Jenis Rekanan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.jenis}
                  onChange={(e) => setFormData({ ...formData, jenis: e.target.value })}
                  className="w-full h-9.5 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#E65F2B] focus:ring-1 focus:ring-[#E65F2B]/20"
                >
                  <option value="KONTRAKTOR">KONTRAKTOR (Main Contractor)</option>
                  <option value="KONSULTAN PENGAWAS">KONSULTAN PENGAWAS (MK)</option>
                  <option value="KONSULTAN PERENCANA">KONSULTAN PERENCANA</option>
                  <option value="KONSULTAN PERENCANA & PENGAWAS">KONSULTAN PERENCANA &amp; PENGAWAS</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Golongan Kualifikasi <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.golongan}
                  onChange={(e) => setFormData({ ...formData, golongan: e.target.value })}
                  className="w-full h-9.5 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#E65F2B] focus:ring-1 focus:ring-[#E65F2B]/20"
                >
                  <option value="BESAR">BESAR (Kualifikasi Besar / &gt; Rp 1 Miliar)</option>
                  <option value="MENENGAH">MENENGAH (Kualifikasi Menengah)</option>
                </select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700">
                  Alamat Lengkap Perusahaan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={formData.alamat}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  rows={2}
                  placeholder="Jl. Kalibata Timur II No.27, RT 002 RW 008, Pancoran, Jakarta Selatan"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#E65F2B] focus:ring-1 focus:ring-[#E65F2B]/20"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Nomor Telepon Kantor / PIC <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <Input
                    value={formData.nomor_telepon}
                    onChange={(e) => setFormData({ ...formData, nomor_telepon: e.target.value })}
                    placeholder="021-79188888 / 08123456789"
                    className="h-9.5 text-xs pl-9 rounded-xl border-slate-200 focus:border-[#E65F2B]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Email Resmi Perusahaan <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="kontak@perusahaan.co.id"
                    className="h-9.5 text-xs pl-9 rounded-xl border-slate-200 focus:border-[#E65F2B]"
                    required
                  />
                </div>
              </div>

              {/* Cabang & Coverage Cabang */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Cabang Domisili Utama <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <select
                    value={formData.cabang}
                    onChange={(e) => setFormData({ ...formData, cabang: e.target.value })}
                    className="w-full h-9.5 pl-9 pr-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-[#E65F2B] focus:ring-1 focus:ring-[#E65F2B]/20"
                    required
                  >
                    <option value="HEAD OFFICE">HEAD OFFICE (Nasional / Kantor Pusat)</option>
                    {ALL_INDUK_CABANG.filter((c) => c !== "HEAD OFFICE").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Cakupan Wilayah Operasional (Coverage Cabang)
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <Input
                    value={formData.coverage_cabang}
                    onChange={(e) => setFormData({ ...formData, coverage_cabang: e.target.value })}
                    placeholder="Contoh: BALI, LOMBOK, JEMBER (Kosongkan jika Nasional)"
                    className="h-9.5 text-xs pl-9 rounded-xl border-slate-200 focus:border-[#E65F2B]"
                  />
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <div className="flex items-start space-x-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-600 text-[11px] leading-relaxed">
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800">Integrasi Akun PIC Rekanan: </span>
                    Akun PIC terhubung secara dinamis dari menu <strong>Manajemen User</strong> berdasarkan kesamaan <em>Nama PT</em>, <em>Role</em> (<strong>KONTRAKTOR</strong>, <strong>KONSULTAN PENGAWAS</strong>, atau <strong>KONSULTAN PERENCANA</strong>), serta <em>Cabang</em> operasional.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bagian 2: Portofolio, Sertifikat & ISO */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Award className="w-4 h-4 text-[#E65F2B]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                2. Portofolio, Sertifikat Badan Usaha & ISO
              </h3>
            </div>

            {/* Riwayat Pengalaman Proyek */}
            <StringListInput
              label="Riwayat Pengalaman Proyek Masa Lalu"
              description="Daftar proyek gudang, gedung perkantoran, atau hotel yang pernah dikerjakan (contoh: Proyek Warehouse DC Cilacap, SAT - 2021)."
              placeholder="Contoh: Proyek Pembangunan DC Pontianak, SAT - 2020"
              items={formData.pengalaman}
              onChange={(items) => setFormData({ ...formData, pengalaman: items })}
              badgeColor="orange"
            />

            {/* Sertifikat Badan Usaha & Keahlian */}
            <StringListInput
              label="Sertifikat Badan Usaha (SBU) & Sertifikat Keahlian (SKA)"
              description="Daftar kualifikasi SBU resmi yang dimiliki (contoh: Jasa Pengawas Konstruksi RE201 Bangunan Gedung, KL403 Manajemen Proyek)."
              placeholder="Contoh: Jasa Pengawas Pekerjaan Konstruksi Bangunan Gedung RE201"
              items={formData.sertifikat}
              onChange={(items) => setFormData({ ...formData, sertifikat: items })}
              badgeColor="blue"
            />

            {/* Sertifikasi ISO */}
            <StringListInput
              label="Sertifikasi Standar Manajemen (ISO)"
              description="Daftar sertifikasi ISO aktif yang dimiliki (contoh: ISO 45001:2018 Management Construction, ISO 9001:2015)."
              placeholder="Contoh: ISO 45001:2018 Management Construction"
              items={formData.sertifikasi_iso}
              onChange={(items) => setFormData({ ...formData, sertifikasi_iso: items })}
              badgeColor="emerald"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-slate-100 sticky bottom-0 bg-white">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-9.5 px-4 text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-9.5 px-5 text-xs rounded-xl bg-[#E65F2B] hover:bg-[#d04f1f] text-white shadow-xs transition-all flex items-center space-x-1.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isEdit ? "Simpan Perubahan" : "Simpan Rekanan Vendor"}</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
