"use client";

import React from "react";
import { Building2, Mail, Phone, MapPin, UserCheck, ShieldCheck, Award, Briefcase, X, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DetailVendorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: any | null;
  onEdit?: (vendor: any) => void;
}

export function DetailVendorModal({
  open,
  onOpenChange,
  vendor,
  onEdit,
}: DetailVendorModalProps) {
  if (!vendor) return null;

  const pengalaman: string[] = Array.isArray(vendor.pengalaman) ? vendor.pengalaman : [];
  const sertifikat: string[] = Array.isArray(vendor.sertifikat) ? vendor.sertifikat : [];
  const sertifikasiIso: string[] = Array.isArray(vendor.sertifikasi_iso) ? vendor.sertifikasi_iso : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-w-5xl lg:max-w-5xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl border border-slate-200/80 shadow-2xl bg-white [&>button:last-child]:hidden">
        {/* Header (Solid bg-white, non-transparent, tidak tembus saat scroll) */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200/80 bg-white shrink-0 z-20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E65F2B] to-[#cf4d1a] flex items-center justify-center text-white shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-800 tracking-tight">
                  {vendor.nama_perusahaan}
                </h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    vendor.golongan === "BESAR"
                      ? "bg-purple-100 text-purple-700 border border-purple-200"
                      : "bg-blue-100 text-blue-700 border border-blue-200"
                  }`}
                >
                  {vendor.golongan}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {vendor.jenis || "KONTRAKTOR"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content (Scrollable Body) */}
        <div className="p-6 md:p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar bg-white">
          {/* Card Info Kontak & Legalitas (3 Kolom Responsif) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/70">
            <div className="flex items-start space-x-2.5">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Alamat Perusahaan</p>
                <p className="text-xs text-slate-700 font-medium leading-relaxed">{vendor.alamat || "-"}</p>
              </div>
            </div>

            <div className="flex items-start space-x-2.5">
              <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Nomor Telepon</p>
                <p className="text-xs text-slate-700 font-medium">{vendor.nomor_telepon || "-"}</p>
              </div>
            </div>

            <div className="flex items-start space-x-2.5">
              <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Email Resmi</p>
                <p className="text-xs text-slate-700 font-medium">{vendor.email || "-"}</p>
              </div>
            </div>

            <div className="flex items-start space-x-2.5">
              <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Cabang Domisili</p>
                <p className="text-xs text-slate-700 font-semibold">{vendor.cabang || "HEAD OFFICE"}</p>
              </div>
            </div>

            <div className="flex items-start space-x-2.5">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Cakupan Wilayah (Coverage Cabang)</p>
                <p className="text-xs text-slate-700 font-medium">
                  {vendor.coverage_cabang || "Seluruh Cabang"}
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2.5">
              <UserCheck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">
                  Akun PIC Rekanan (Manajemen User)
                </p>
                {vendor.pic_users && vendor.pic_users.length > 0 ? (
                  <div className="space-y-1 mt-0.5">
                    {vendor.pic_users.map((pic: any) => (
                      <p key={pic.id} className="text-xs text-slate-700 font-medium leading-tight">
                        {pic.nama} ({pic.email}) — <span className="font-semibold text-emerald-700">{pic.role}</span> [{pic.cabang}]
                      </p>
                    ))}
                  </div>
                ) : vendor.pic_user ? (
                  <p className="text-xs text-slate-700 font-medium">
                    {vendor.pic_user.nama} ({vendor.pic_user.email}) — <span className="font-semibold text-emerald-700">{vendor.pic_user.role}</span> [{vendor.pic_user.cabang}]
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic">Belum ada user rekanan dengan PT ini</p>
                )}
              </div>
            </div>
          </div>

          {/* Section: Riwayat Pengalaman */}
          <div className="space-y-2.5">
            <div className="flex items-center space-x-2 text-slate-800">
              <Briefcase className="w-4 h-4 text-[#E65F2B]" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                Riwayat Pengalaman Proyek ({pengalaman.length})
              </h3>
            </div>
            {pengalaman.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {pengalaman.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start space-x-2 p-2.5 rounded-xl bg-orange-50/50 border border-orange-100 text-xs text-slate-700 font-medium"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#E65F2B] mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-1">Belum ada data pengalaman proyek.</p>
            )}
          </div>

          {/* Section: SBU / SKA & ISO (2 Kolom Responsif) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Section: SBU / SKA */}
            <div className="space-y-2.5 p-4 rounded-xl bg-slate-50/50 border border-slate-200/70">
              <div className="flex items-center space-x-2 text-slate-800">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Sertifikat Badan Usaha & SKA ({sertifikat.length})
                </h3>
              </div>
              {sertifikat.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {sertifikat.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200/70"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-1">Belum ada data sertifikat badan usaha.</p>
              )}
            </div>

            {/* Section: ISO */}
            <div className="space-y-2.5 p-4 rounded-xl bg-slate-50/50 border border-slate-200/70">
              <div className="flex items-center space-x-2 text-slate-800">
                <Award className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Sertifikasi Standar ISO ({sertifikasiIso.length})
                </h3>
              </div>
              {sertifikasiIso.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {sertifikasiIso.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/70"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-1">Belum ada data sertifikasi ISO.</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer (Solid bg-slate-50/90, non-transparent, pinned at bottom) */}
        <div className="flex items-center justify-end space-x-2 px-6 py-3.5 border-t border-slate-200/80 bg-slate-50/90 shrink-0 z-20">
          {onEdit && (
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onEdit(vendor);
              }}
              className="h-9.5 px-4 text-xs rounded-xl bg-slate-800 hover:bg-slate-900 text-white cursor-pointer"
            >
              Edit Vendor
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9.5 px-4 text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
