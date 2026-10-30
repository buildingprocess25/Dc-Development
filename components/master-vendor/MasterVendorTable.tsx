"use client";

import React from "react";
import {
  Building2,
  Phone,
  Mail,
  UserCheck,
  Eye,
  Edit3,
  Trash2,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MasterVendorTableProps {
  vendors: any[];
  loading: boolean;
  branchFilter: string;
  onOpenDetail: (vendor: any) => void;
  onOpenEdit: (vendor: any) => void;
  onDeleteTarget: (vendor: any) => void;
  onOpenAdd?: () => void;
}

export function MasterVendorTable({
  vendors,
  loading,
  branchFilter,
  onOpenDetail,
  onOpenEdit,
  onDeleteTarget,
  onOpenAdd,
}: MasterVendorTableProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 z-10 shadow-2xs">
            <tr>
              <th className="py-3 px-4 w-12 text-center bg-slate-50">No</th>
              <th className="py-3 px-4 min-w-[200px] bg-slate-50">Rekanan Vendor</th>
              <th className="py-3 px-4 min-w-[130px] bg-slate-50">Cabang &amp; Wilayah</th>
              <th className="py-3 px-4 min-w-[130px] bg-slate-50">Jenis &amp; Peran</th>
              <th className="py-3 px-4 min-w-[100px] bg-slate-50">Golongan</th>
              <th className="py-3 px-4 min-w-[170px] bg-slate-50">Kontak &amp; Alamat</th>
              <th className="py-3 px-4 min-w-[140px] bg-slate-50">PIC Akun Login</th>
              <th className="py-3 px-4 min-w-[120px] bg-slate-50">Legalitas &amp; Portofolio</th>
              <th className="py-3 px-4 w-28 text-center bg-slate-50">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-14 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#E65F2B]" />
                    <span className="text-xs">Memuat database rekanan vendor...</span>
                  </div>
                </td>
              </tr>
            ) : vendors.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-14 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Building2 className="w-8 h-8 opacity-40" />
                    <p className="text-xs font-semibold text-slate-700">Belum ada rekanan vendor yang sesuai</p>
                    <p className="text-[11px] text-slate-400">
                      {branchFilter !== "all"
                        ? `Tidak ada rekanan vendor terdaftar untuk cabang ${branchFilter}.`
                        : "Klik tombol Tambah Rekanan untuk mendaftarkan kontraktor/konsultan baru."}
                    </p>
                    {onOpenAdd && (
                      <Button
                        onClick={onOpenAdd}
                        className="mt-2 bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs font-semibold h-8.5 px-3.5 rounded-xl cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Tambah Rekanan Vendor
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              vendors.map((vendor, idx) => {
                const pengalamanCount = Array.isArray(vendor.pengalaman) ? vendor.pengalaman.length : 0;
                const sertifikatCount = Array.isArray(vendor.sertifikat) ? vendor.sertifikat.length : 0;
                const isoCount = Array.isArray(vendor.sertifikasi_iso) ? vendor.sertifikasi_iso.length : 0;

                return (
                  <tr key={vendor.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 text-center font-medium text-slate-400 text-xs">
                      {idx + 1}
                    </td>

                    {/* Nama & Alamat */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                        <span>{vendor.nama_perusahaan}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {vendor.alamat}
                      </p>
                    </td>

                    {/* Cabang & Coverage */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-800 text-[11px]">
                          {vendor.cabang || "HEAD OFFICE"}
                        </span>
                      </div>
                      {vendor.coverage_cabang ? (
                        <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5" title={`Coverage: ${vendor.coverage_cabang}`}>
                          Area: {vendor.coverage_cabang}
                        </p>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-medium">
                          Nasional
                        </span>
                      )}
                    </td>

                    {/* Jenis & Peran */}
                    <td className="py-3.5 px-4">
                      {vendor.jenis === "KONTRAKTOR" ? (
                        <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-md bg-orange-50 text-orange-800 border border-orange-200">
                          KONTRAKTOR
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                          {vendor.jenis}
                        </span>
                      )}
                    </td>

                    {/* Golongan */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          vendor.golongan === "BESAR"
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {vendor.golongan}
                      </span>
                    </td>

                    {/* Kontak */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5 text-slate-600 text-[11px]">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{vendor.nomor_telepon}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[140px]">{vendor.email}</span>
                      </div>
                    </td>

                    {/* PIC Akun */}
                    <td className="py-3.5 px-4">
                      {vendor.pic_user ? (
                        <div className="flex items-center space-x-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800 text-[11px]">
                              {vendor.pic_user.nama}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {vendor.pic_user.role} ({vendor.pic_user.cabang})
                            </span>
                            {vendor.pic_users && vendor.pic_users.length > 1 && (
                              <span className="text-[9px] text-emerald-700 font-bold">
                                +{vendor.pic_users.length - 1} personil PIC
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Belum terhubung
                        </span>
                      )}
                    </td>

                    {/* Portofolio & Legalitas */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 bg-orange-50 text-orange-700 rounded border border-orange-100"
                          title={`${pengalamanCount} riwayat pengalaman proyek`}
                        >
                          {pengalamanCount} Proyek
                        </span>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100"
                          title={`${sertifikatCount} sertifikat badan usaha/keahlian`}
                        >
                          {sertifikatCount} SBU
                        </span>
                        {isoCount > 0 && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100"
                            title={`${isoCount} sertifikasi ISO`}
                          >
                            {isoCount} ISO
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Aksi */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenDetail(vendor)}
                          className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
                          title="Lihat Detail Profil"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenEdit(vendor)}
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                          title="Edit Rekanan"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteTarget(vendor)}
                          className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Hapus Rekanan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info Rekanan */}
      <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-200/80 text-[11px] font-medium text-slate-500 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <span>
          Menampilkan <strong className="text-slate-800">{vendors.length}</strong> rekanan vendor
          {branchFilter !== "all" && (
            <span> untuk cabang <strong className="text-[#E65F2B]">{branchFilter}</strong></span>
          )}
        </span>
        <span className="text-[10px] text-slate-400">
          Gunakan scroll vertikal &amp; horizontal untuk meninjau seluruh data
        </span>
      </div>
    </div>
  );
}
