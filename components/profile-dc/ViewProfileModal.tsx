import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, MapPin, Layers, Settings2, Ruler, CalendarRange } from "lucide-react";

interface ViewProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: any | null;
}

export function ViewProfileModal({ open, onOpenChange, profile }: ViewProfileModalProps) {
  if (!profile) return null;

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "2-digit", month: "long", year: "numeric",
    });
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return null;
    return num.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  };

  const formatPercent = (num: number | null | undefined) => {
    if (num === null || num === undefined) return null;
    return (num * 100).toFixed(2).replace(/\.00$/, "") + "%";
  };

  const renderItem = (label: string, value: string | React.ReactNode, suffix = "") => {
    if (!value) return null;
    return (
      <div className="flex flex-col gap-1.5 mb-6">
        <span className="text-[13px] font-medium text-[#878787]">{label}</span>
        <span className="text-[15px] font-semibold text-[#111111]">{value} {suffix}</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] w-full p-0 overflow-hidden bg-white rounded-[24px] border border-[#EAEAEA] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] [&>button]:hidden">
        
        {/* Custom Close Button */}
        <div className="absolute top-6 right-6 z-20">
          <button onClick={() => onOpenChange(false)} className="w-8 h-8 bg-white border border-[#EAEAEA] hover:bg-[#F7F7F7] text-[#666666] rounded-full flex items-center justify-center transition-all shadow-sm">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-10 lg:p-14 max-h-[85vh] overflow-y-auto custom-scrollbar">
          
          {/* HEADER */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 bg-[#F5F5F5] text-[#111111] text-[11px] font-bold tracking-wider uppercase rounded-full">
                {profile.tipe}
              </span>
              {profile.dc_induk && (
                <span className="text-[#878787] text-[12px] font-medium flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Induk: {profile.dc_induk}
                </span>
              )}
            </div>
            
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-[#111111] mb-4">
              {profile.nama_proyek}
            </h1>
            
            <div className="flex items-center gap-6 text-[#666666] text-[14px] font-medium">
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#A1A1A1]" /> Cabang {profile.cabang}
              </span>
              <span className="flex items-center gap-2">
                ID: {profile.kode} {profile.inisial ? `(${profile.inisial})` : ''}
              </span>
            </div>
          </div>

          <div className="w-full h-px bg-[#EAEAEA] mb-12"></div>

          {/* CONTENT GRID */}
          <div className="flex flex-col gap-12">
            
            {/* SECTION 1: IDENTITAS & OPERASIONAL */}
            <div className="w-full">
              <h3 className="text-[12px] font-bold tracking-widest text-[#111111] uppercase mb-6 flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-[#A1A1A1]" /> Operasional
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {renderItem("Kapasitas Toko", formatNumber(profile.kapasitas_toko), "Toko")}
                {renderItem("Tanggal GO", formatDate(profile.tanggal_go))}
                {renderItem("Masa Sewa Dimulai", formatDate(profile.masa_sewa_start))}
                {renderItem("Masa Sewa Berakhir", formatDate(profile.masa_sewa_finish))}
              </div>
            </div>

            <div className="w-full h-px bg-[#F5F5F5]"></div>

            {/* SECTION 2: METRIK LUASAN */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[12px] font-bold tracking-widest text-[#111111] uppercase flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-[#A1A1A1]" /> Metrik Luasan
                </h3>
                {profile.kdb_persen && (
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] font-semibold text-[#878787] uppercase tracking-wider">KDB</span>
                    <span className="text-sm font-extrabold text-[#111111]">{formatPercent(profile.kdb_persen)}</span>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {renderItem("Total Luas Bangunan", formatNumber(profile.total_luas_bangunan), "m²")}
                {renderItem("Luas Lahan Utama", formatNumber(profile.luas_lahan), "m²")}
                {renderItem("Tapak Terbangun", formatNumber(profile.luas_tapak_terbangun), "m²")}
                {renderItem("Sisa Lahan Kosong", formatNumber(profile.sisa_lahan), "m²")}
              </div>
            </div>

            <div className="w-full h-px bg-[#F5F5F5]"></div>

            {/* SECTION 3: DETAIL FASILITAS */}
            <div className="w-full">
              <h3 className="text-[12px] font-bold tracking-widest text-[#111111] uppercase mb-6 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#A1A1A1]" /> Detail Fasilitas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {renderItem("Warehouse Area", formatNumber(profile.luas_warehouse), "m²")}
                {renderItem("Mezanine", formatNumber(profile.luas_mezanine), "m²")}
                {renderItem("Office Lantai 1", formatNumber(profile.luas_office_lt1), "m²")}
                {renderItem("Office Lantai 2", formatNumber(profile.luas_office_lt2), "m²")}
                {renderItem("Bangunan Penunjang", formatNumber(profile.luas_bangunan_penunjang), "m²")}
                {renderItem("Area Parkir", formatNumber(profile.luas_area_parkir), "m²")}
                {renderItem("Cold Storage", formatNumber(profile.luas_cold_storage), "m²")}
              </div>
            </div>

            <div className="w-full h-px bg-[#F5F5F5]"></div>

            {/* SECTION 4: INFRASTRUKTUR & SPEK */}
            <div className="w-full">
              <h3 className="text-[12px] font-bold tracking-widest text-[#111111] uppercase mb-6 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[#A1A1A1]" /> Infrastruktur & Lainnya
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {renderItem("Main Kontraktor", profile.main_kontraktor)}
                {renderItem("Daya Listrik", profile.daya_listrik)}
                {renderItem("Kapasitas Genset", profile.genset)}
                {renderItem("Sumber Air", profile.sumber_air)}
              </div>

              {(profile.spek_lantai_tonase || profile.spek_lantai_tebal || profile.spek_lantai_mutu_beton) && (
                <div>
                  <h3 className="text-[11px] font-bold tracking-widest text-[#878787] uppercase mb-4">
                    Spesifikasi Lantai
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {renderItem("Kapasitas Tonase", profile.spek_lantai_tonase, "Ton")}
                    {renderItem("Tebal Lantai", profile.spek_lantai_tebal, "cm")}
                    {renderItem("Mutu Beton", profile.spek_lantai_mutu_beton)}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
