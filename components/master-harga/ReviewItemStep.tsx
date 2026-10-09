import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Save } from 'lucide-react';
import { KoefisienRow } from './TambahItemModal';

interface ReviewItemStepProps {
  spec: any;
  kodePreview: { kode: string; kode_anak: string; abjad_lokasi: string };
  ahsWarning: string | null;
  koefisiens: KoefisienRow[];
  deskripsiOtomatis: string;
  isSaving: boolean;
  onRevisi: () => void;
  onConfirm: () => void;
}

export default function ReviewItemStep({
  spec,
  kodePreview,
  ahsWarning,
  koefisiens,
  deskripsiOtomatis,
  isSaving,
  onRevisi,
  onConfirm
}: ReviewItemStepProps) {
  const isNewCode = ahsWarning?.includes("Kode Induk baru");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 max-h-[70vh] overflow-y-auto px-1 pb-4 custom-scrollbar">
      
      {/* Kode Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Kode Induk Card */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2 relative overflow-hidden group hover:border-orange-200 transition-colors">
          <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 group-hover:bg-orange-400 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-2">Kode Induk</span>
            {ahsWarning && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isNewCode ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
              }`}>
                {isNewCode ? "Induk Baru" : "Eksisting"}
              </span>
            )}
          </div>
          <div className="text-2xl font-extrabold text-slate-900 pl-2">{kodePreview.kode || "-"}</div>
          <p className="text-xs text-slate-500 leading-relaxed pl-2">
            {ahsWarning || "Kode Induk unik berdasarkan pilar spesifikasi dan koefisien AHS."}
          </p>
        </div>

        {/* Kode Anak Card */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2 relative overflow-hidden group hover:border-orange-200 transition-colors">
          <div className="absolute top-0 left-0 w-1 h-full bg-orange-400" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-2">Kode Anak</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Unique ID
            </span>
          </div>
          <div className="text-2xl font-extrabold text-orange-600 pl-2">{kodePreview.kode_anak || "-"}</div>
          <p className="text-xs text-slate-500 leading-relaxed pl-2">
            Kode turunan spesifik yang mengidentifikasi secara unik item ini beserta lokasi penerapannya.
          </p>
        </div>
      </div>

      {/* Specification Details (Receipt Style) */}
      <div className="bg-slate-50 rounded-xl border border-slate-100 p-5 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 mb-3">Detail Spesifikasi</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-6">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kategori Pekerjaan</div>
            <div className="text-sm font-semibold text-slate-900">{spec.kategori_pekerjaan || "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nama Material</div>
            <div className="text-sm font-semibold text-slate-900">{spec.item_material || "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ukuran / Dimensi</div>
            <div className="text-sm font-semibold text-slate-900">{spec.ukuran_dimensi || "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Merk / Brand</div>
            <div className="text-sm font-semibold text-slate-900">{spec.merk_brand || "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Warna / Corak</div>
            <div className="text-sm font-semibold text-slate-900">{spec.warna_corak || "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipe Produk</div>
            <div className="text-sm font-semibold text-slate-900">{spec.tipe_produk || "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ketebalan</div>
            <div className="text-sm font-semibold text-slate-900">{spec.ketebalan || "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Toleransi</div>
            <div className="text-sm font-semibold text-slate-900">{spec.toleransi || "-"}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Permukaan</div>
            <div className="text-sm font-semibold text-slate-900">{spec.finishing_permukaan || "-"}</div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lokasi Penerapan</div>
            <div className="text-sm font-semibold text-slate-900">
              {spec.lokasi_penerapan === "__new__" ? spec.custom_lokasi : spec.lokasi_penerapan || "-"}
            </div>
          </div>
          <div className="col-span-2 md:col-span-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Implementasi</div>
            <div className="text-sm font-semibold text-slate-900">
              {spec.implementasi === "__new__" ? spec.custom_implementasi : spec.implementasi || "-"}
            </div>
          </div>
          {spec.informasi_tambahan && (
            <div className="col-span-2 md:col-span-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Informasi Tambahan</div>
              <div className="text-sm font-semibold text-slate-900">{spec.informasi_tambahan}</div>
            </div>
          )}
        </div>

        <div className="pt-4 mt-4 border-t border-slate-200">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Preview Deskripsi (Auto-Generated)</div>
          <div className="text-sm font-medium text-slate-700 italic border-l-2 border-slate-300 pl-3 py-1">
            {deskripsiOtomatis}
          </div>
        </div>
      </div>

      {/* AHS List */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-bold text-slate-800 px-1">Komponen AHS (Koefisien)</h3>
        {koefisiens.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500">
            Tidak ada komponen AHS yang dimasukkan.
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 font-semibold text-slate-700 text-[10px] uppercase tracking-wider">Tipe</th>
                  <th className="px-5 py-3 font-semibold text-slate-700 text-[10px] uppercase tracking-wider">Komponen</th>
                  <th className="px-5 py-3 font-semibold text-slate-700 text-[10px] uppercase tracking-wider text-right">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {koefisiens.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 w-24">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        k.tipe === "UPAH" ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      }`}>
                        {k.tipe}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-800 leading-tight">
                      {k.nama_komponen}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-slate-600">
                      <span className="font-semibold text-slate-800">{k.volume}</span> <span className="text-slate-400 text-xs ml-1">{k.satuan}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-8">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onRevisi}
          disabled={isSaving}
          className="text-slate-600 border-slate-300 hover:bg-slate-50 font-semibold"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Revisi Data
        </Button>
        <Button 
          type="button" 
          onClick={onConfirm}
          disabled={isSaving}
          className="bg-orange-600 hover:bg-orange-700 text-white min-w-[180px] font-bold h-11"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Menyimpan...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              Konfirmasi & Simpan
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
