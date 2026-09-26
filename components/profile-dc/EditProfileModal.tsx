import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Save, Trash2, Loader2, AlertTriangle, Layers, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { DiscardWarningModal } from "@/components/ui/discard-warning-modal";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: any | null;
  onSuccess: () => void;
}

export function EditProfileModal({ open, onOpenChange, profile, onSuccess }: EditProfileModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [feedback, setFeedback] = useState<{ open: boolean; type: "success" | "error"; title: string; message: string }>({ open: false, type: "success", title: "", message: "" });

  useEffect(() => {
    if (profile) {
      setFormData({ ...profile });
      setConfirmDelete(false);
      setHasChanges(false);
      setShowCloseWarning(false);
    }
  }, [profile, open]);

  if (!profile) return null;

  const handleChange = (field: string, value: any) => {
    setHasChanges(true);
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const parseDateForInput = (dateStr: string | null | undefined) => {
    if (!dateStr) return "";
    return new Date(dateStr).toISOString().split('T')[0];
  };

  const handleDateChange = (field: string, value: string) => {
    if (!value) {
      handleChange(field, null);
    } else {
      handleChange(field, new Date(value).toISOString());
    }
  };

  const handleNumberChange = (field: string, value: string) => {
    if (!value) {
      handleChange(field, null);
    } else {
      handleChange(field, parseFloat(value));
    }
  };

  const disableScroll = (e: React.WheelEvent<HTMLInputElement>) => {
    (e.target as HTMLInputElement).blur();
  };

  const saveChanges = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/dc-development/profile/${profile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') throw new Error(json.message);
      
      setFeedback({ open: true, type: "success", title: "Berhasil Disimpan", message: "Perubahan data profile berhasil disimpan ke database." });
    } catch (err: any) {
      setFeedback({ open: true, type: "error", title: "Gagal Menyimpan", message: err.message || 'Terjadi kesalahan saat menyimpan perubahan.' });
    } finally {
      setSaving(false);
    }
  };

  const deleteProfile = async () => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/dc-development/profile/${profile.id}`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') throw new Error(json.message);
      
      setFeedback({ open: true, type: "success", title: "Berhasil Dihapus", message: "Data profile berhasil dihapus secara permanen." });
    } catch (err: any) {
      setFeedback({ open: true, type: "error", title: "Gagal Menghapus", message: err.message || 'Terjadi kesalahan saat menghapus data.' });
    } finally {
      setDeleting(false);
    }
  };

  const renderInput = (label: string, field: string, type: "text" | "number" | "date" = "text") => (
    <div className="space-y-1.5 mb-4">
      <label className="text-[12px] font-bold text-[#878787] uppercase tracking-wider">{label}</label>
      <Input 
        type={type}
        value={
          type === 'date' 
            ? parseDateForInput(formData[field]) 
            : formData[field] === null || formData[field] === undefined ? "" : formData[field]
        }
        onChange={e => {
          if (type === 'date') handleDateChange(field, e.target.value);
          else if (type === 'number') handleNumberChange(field, e.target.value);
          else handleChange(field, e.target.value);
        }}
        onWheel={type === 'number' ? disableScroll : undefined}
        className="bg-[#F9F9F9] border-[#EAEAEA] hover:border-[#D0D0D0] focus-visible:ring-[#111111] rounded-xl h-11 text-[14px] font-medium text-[#111111] shadow-none transition-colors"
      />
    </div>
  );

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      if (hasChanges && !showCloseWarning) {
        setShowCloseWarning(true);
        return; // Prevent closing
      }
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[1000px] w-full p-0 overflow-hidden bg-white rounded-[24px] border border-[#EAEAEA] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] [&>button]:hidden">
        
        <DiscardWarningModal 
          open={showCloseWarning}
          onContinueEdit={() => setShowCloseWarning(false)}
          onDiscard={() => {
            setShowCloseWarning(false);
            onOpenChange(false);
          }}
        />

        <FeedbackModal
          open={feedback.open}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
          onClose={() => {
            setFeedback(prev => ({ ...prev, open: false }));
            if (feedback.type === "success") {
              onSuccess();
              onOpenChange(false);
            }
          }}
        />

        {/* Custom Close Button */}
        <div className="absolute top-6 right-6 z-20">
          <button onClick={() => handleOpenChange(false)} className="w-8 h-8 bg-white border border-[#EAEAEA] hover:bg-[#F7F7F7] text-[#666666] rounded-full flex items-center justify-center transition-all shadow-sm">
            <X className="w-4 h-4" />
          </button>
        </div>



        <div className="p-10 max-h-[80vh] overflow-y-auto custom-scrollbar">
          
          {/* HEADER */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-[#111111] text-white text-[11px] font-bold tracking-wider uppercase rounded-full">
                Edit Data
              </span>
              <span className="px-3 py-1 bg-[#F5F5F5] text-[#111111] text-[11px] font-bold tracking-wider uppercase rounded-full">
                {profile.tipe}
              </span>
              {profile.dc_induk && (
                <span className="text-[#878787] text-[12px] font-medium flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Induk: {profile.dc_induk}
                </span>
              )}
            </div>
            
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-[#111111] mb-2">
              {profile.nama_proyek}
            </h1>
            
            <div className="flex items-center gap-6 text-[#666666] text-[13px] font-medium">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#A1A1A1]" /> Cabang {profile.cabang}
              </span>
            </div>
          </div>

          <div className="w-full h-px bg-[#EAEAEA] mb-10"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12">
            
            {/* IDENTITAS */}
            <div>
              <h3 className="text-[12px] font-bold tracking-widest text-[#111111] uppercase mb-6">Identitas & Ops</h3>
              {renderInput("Kode Proyek", "kode")}
              {renderInput("Nama Proyek", "nama_proyek")}
              {renderInput("Inisial", "inisial")}
              {renderInput("Cabang", "cabang")}
              
              <div className="mt-8 mb-6 h-px w-full bg-[#F0F0F0]"></div>
              
              {renderInput("Tanggal GO", "tanggal_go", "date")}
              {renderInput("Masa Sewa Start", "masa_sewa_start", "date")}
              {renderInput("Masa Sewa Finish", "masa_sewa_finish", "date")}
            </div>

            {/* LUASAN */}
            <div>
              <h3 className="text-[12px] font-bold tracking-widest text-[#111111] uppercase mb-6">Metrik Luasan (m²)</h3>
              {renderInput("Luas Lahan", "luas_lahan", "number")}
              {renderInput("Total Luas Bangunan", "total_luas_bangunan", "number")}
              {renderInput("Luas Warehouse", "luas_warehouse", "number")}
              {renderInput("Luas Mezanine", "luas_mezanine", "number")}
              {renderInput("Luas Office Lt 1", "luas_office_lt1", "number")}
              {renderInput("Luas Office Lt 2", "luas_office_lt2", "number")}
              {renderInput("KDB (%)", "kdb_persen", "number")}
              {renderInput("Sisa Lahan", "sisa_lahan", "number")}
            </div>

            {/* INFRA & SPEK */}
            <div>
              <h3 className="text-[12px] font-bold tracking-widest text-[#111111] uppercase mb-6">Infrastruktur & Lainnya</h3>
              {renderInput("Kapasitas Toko", "kapasitas_toko", "number")}
              {renderInput("Main Kontraktor", "main_kontraktor")}
              {renderInput("Daya Listrik", "daya_listrik")}
              {renderInput("Genset", "genset")}
              {renderInput("Sumber Air", "sumber_air")}
              
              <div className="mt-8 mb-6 h-px w-full bg-[#F0F0F0]"></div>
              
              <h3 className="text-[11px] font-bold tracking-widest text-[#878787] uppercase mb-4">Spesifikasi Lantai</h3>
              <div className="grid grid-cols-2 gap-4">
                {renderInput("Tonase", "spek_lantai_tonase", "number")}
                {renderInput("Tebal (cm)", "spek_lantai_tebal", "number")}
              </div>
              {renderInput("Mutu Beton", "spek_lantai_mutu_beton")}
            </div>

          </div>

          <div className="mt-12 bg-[#FFF8F8] border border-[#FFEEEE] rounded-[16px] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h4 className="text-[#D32F2F] text-sm font-bold flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4" /> Danger Zone
              </h4>
              <p className="text-[#D32F2F]/70 text-[13px] font-medium">Data yang dihapus tidak dapat dikembalikan lagi.</p>
            </div>
            {confirmDelete ? (
              <div className="flex gap-2 items-center">
                <Button variant="ghost" className="text-[#878787] hover:text-[#111111] hover:bg-[#F5F5F5] h-10 px-4 rounded-xl text-[13px] font-bold" onClick={() => setConfirmDelete(false)}>Batal</Button>
                <Button variant="destructive" className="bg-[#D32F2F] text-white hover:bg-[#B71C1C] h-10 px-6 rounded-xl text-[13px] font-bold shadow-sm" onClick={deleteProfile} disabled={deleting}>
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ya, Hapus'}
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="border-[#FFEEEE] text-[#D32F2F] bg-white hover:bg-[#FFF0F0] h-10 px-5 rounded-xl text-[13px] font-bold shadow-sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-4 h-4 mr-2" /> Hapus Data
              </Button>
            )}
          </div>
        </div>

        {/* STICKY FOOTER */}
        <div className="bg-[#F9F9F9] p-6 border-t border-[#EAEAEA] flex justify-end gap-3 rounded-b-[24px]">
          <Button variant="outline" className="h-12 px-6 rounded-full text-[14px] font-bold border-[#EAEAEA] text-[#666666] hover:text-[#111111] hover:bg-white bg-white shadow-sm" onClick={() => handleOpenChange(false)}>
            Batal
          </Button>
          <Button 
            className="h-12 px-8 rounded-full text-[14px] font-bold bg-[#111111] hover:bg-[#333333] text-white shadow-[0_4px_14px_0_rgba(0,0,0,0.15)] transition-all"
            onClick={saveChanges}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
