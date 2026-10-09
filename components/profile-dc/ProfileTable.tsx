import React from "react";
import { Eye, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DcProfile {
  id: number;
  kode: string;
  nama_proyek: string;
  dc_induk: string | null;
  tipe: string;
  cabang: string;
  luas_lahan?: number | null;
  total_luas_bangunan?: number | null;
}

interface ProfileTableProps {
  profiles: DcProfile[];
  allProfiles?: DcProfile[];
  loading: boolean;
  error: string | null;
  onView: (profile: DcProfile) => void;
  onEdit: (profile: DcProfile) => void;
}

export function ProfileTable({ profiles, allProfiles = [], loading, error, onView, onEdit }: ProfileTableProps) {
  const getDcIndukName = (kode: string) => {
    const p = allProfiles.find(x => x.kode === kode);
    return p ? p.nama_proyek : kode;
  };
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Memuat data Profile DC...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex flex-col items-center max-w-sm text-center">
          <p className="text-red-600 font-bold mb-2">Gagal Memuat Data</p>
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!profiles.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <p className="text-slate-400 font-medium">Tidak ada data Profile DC ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto bg-white rounded-3xl">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="text-[10px] text-slate-500 bg-slate-50/80 backdrop-blur-md uppercase tracking-widest font-black sticky top-0 z-10 shadow-sm">
          <tr>
            <th scope="col" className="px-4 py-3.5 w-14 whitespace-nowrap">No</th>
            <th scope="col" className="px-4 py-3.5 w-24 whitespace-nowrap">Kode</th>
            <th scope="col" className="px-4 py-3.5 w-[35%] min-w-[200px]">Nama Proyek</th>
            <th scope="col" className="px-4 py-3.5 w-40 whitespace-nowrap">Tipe</th>
            <th scope="col" className="px-4 py-3.5 w-[15%] min-w-[150px]">DC Induk</th>
            <th scope="col" className="px-4 py-3.5 w-32 whitespace-nowrap">Luas (m²)</th>
            <th scope="col" className="px-4 py-3.5 text-right w-24 whitespace-nowrap">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {profiles.map((prof, index) => (
            <tr key={prof.id} className="hover:bg-slate-50/80 transition-colors duration-150">
              <td className="px-4 py-3 font-bold text-slate-400">{index + 1}</td>
              <td className="px-4 py-3 font-bold text-slate-800">{prof.kode}</td>
              <td className="px-4 py-3 font-bold text-slate-800">{prof.nama_proyek}</td>
              <td className="px-4 py-3">
                <div className="flex justify-start">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide whitespace-nowrap">
                    {prof.tipe}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                {prof.tipe === "DC" ? (
                  <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[11px] uppercase tracking-wide border border-emerald-100 whitespace-nowrap">DC Induk</span>
                ) : prof.dc_induk ? (
                  <span className="font-bold text-slate-800 uppercase">{getDcIndukName(prof.dc_induk)}</span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600 font-medium">
                {prof.total_luas_bangunan ? prof.total_luas_bangunan.toLocaleString('id-ID') : '-'}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onView(prof)}
                    className="h-8 w-8 p-0 rounded-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-transparent shadow-none"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(prof)}
                    className="h-8 w-8 p-0 rounded-full text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-transparent shadow-none"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
