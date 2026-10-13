"use client";

import React, { useState, useEffect } from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { Plus, Search, Edit3, Trash2, Mail, MapPin, Briefcase, Shield, Key, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ALL_BRANCHES, ALL_INDUK_CABANG, CABANG_GRUP } from "@/lib/branches";

const ROLES = [
  "BRANCH BUILDING KOORDINATOR",
  "BRANCH BUILDING & MAINTENANCE MANAGER",
  "DC DOCUMENT ADMIN",
  "DC BUILDING & DEVELOPMENT SPECIALIST",
  "DC BUILDING & DEVELOPMENT MANAGER",
  "DC ADMIN"
];

import { dcMenus } from "@/components/dashboard/menu-navigasi";
import { SearchableSelectInput } from "@/components/ui/searchable-select";
import { MultiSelectInput } from "@/components/ui/multi-select";

const AVAILABLE_MENUS = dcMenus.map(m => ({
  id: m.id,
  label: m.title
}));

export default function ManajemenUser() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Modal state
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Feedback state
  const [feedback, setFeedback] = useState<{ open: boolean, type: "success"|"error", title: string, message: string }>({ open: false, type: "success", title: "", message: "" });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dc-development/users");
      const json = await res.json();
      if (json.status === "success") setUsers(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      email: "",
      nama: "",
      cabang: "",
      coverage_cabang: "",
      role: "",
      nama_pt: "",
      akses_menu: ""
    });
    setIsEditing(false);
    setOpenModal(true);
  };

  const handleOpenEdit = (user: any) => {
    setFormData({ ...user });
    setIsEditing(true);
    setOpenModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin menghapus user ini?")) return;
    try {
      const res = await fetch(`/api/dc-development/users/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.status !== "success") throw new Error(json.message);
      
      setFeedback({ open: true, type: "success", title: "Berhasil!", message: "Data user berhasil dihapus." });
      fetchUsers();
    } catch (e: any) {
      setFeedback({ open: true, type: "error", title: "Gagal!", message: e.message || "Gagal menghapus user." });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const url = isEditing ? `/api/dc-development/users/${formData.id}` : `/api/dc-development/users`;
      const method = isEditing ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const json = await res.json();
      
      if (json.status !== "success") throw new Error(json.message);
      
      setFeedback({ open: true, type: "success", title: "Berhasil!", message: `Data user berhasil ${isEditing ? "diperbarui" : "ditambahkan"}.` });
      setOpenModal(false);
      fetchUsers();
    } catch (e: any) {
      setFeedback({ open: true, type: "error", title: "Gagal!", message: e.message || "Terjadi kesalahan." });
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.nama?.toLowerCase().includes(search.toLowerCase())) ||
    (u.email?.toLowerCase().includes(search.toLowerCase())) ||
    (u.cabang?.toLowerCase().includes(search.toLowerCase())) ||
    (u.role?.toLowerCase().includes(search.toLowerCase()))
  );

  const toTitleCase = (str: string) => {
    return str.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    );
  };

  const handleCabangChange = (val: string) => {
    let coverage = val;
    if (CABANG_GRUP[val]) {
      coverage = CABANG_GRUP[val].join(", ");
    }
    setFormData({ ...formData, cabang: val, coverage_cabang: coverage });
  };

  const handleRoleChange = (val: string) => {
    let akses = formData.akses_menu;
    if (val === "DC ADMIN") akses = "all";
    setFormData({ ...formData, role: val, akses_menu: akses });
  };

  return (
    <Dashboard 
      title="Manajemen User"
      headerActions={
        <Button onClick={handleOpenAdd} className="h-11 px-5 rounded-xl font-bold bg-[#E65F2B] hover:bg-[#D3501F] text-white shadow-sm">
          <Plus className="w-5 h-5 mr-2" />
          Tambah User
        </Button>
      }
    >
      <div className="bg-white rounded-2xl shadow-sm border border-[#EAEAEA] flex flex-col flex-1 min-h-0">
        <div className="p-3 md:p-4 border-b border-[#EAEAEA]">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="Cari email, nama, cabang, role..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 bg-gray-50 border-gray-200 rounded-lg focus-visible:ring-[#E65F2B] text-[13px] font-medium"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-[#EAEAEA]">
                <th className="py-3 px-4 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">User Info</th>
                <th className="py-3 px-4 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Cabang</th>
                <th className="py-3 px-4 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Role</th>
                <th className="py-3 px-4 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Hak Akses</th>
                <th className="py-3 px-4 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest w-[100px]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-8 text-center text-sm font-medium text-gray-500">Memuat data...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-sm font-medium text-gray-500">Tidak ada user ditemukan.</td></tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-sm">
                          {u.nama?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div>
                          <p className="text-[13px] font-bold text-gray-900">{u.nama}</p>
                          <p className="text-[12px] font-medium text-gray-500 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" /> {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[12px] font-bold">
                        <MapPin className="w-3.5 h-3.5" /> {u.cabang}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 text-[#E65F2B] text-[12px] font-bold">
                        <Briefcase className="w-3.5 h-3.5" /> {u.role?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {u.akses_menu === "all" ? (
                          <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-[10px] font-bold uppercase tracking-wider">Akses Penuh</span>
                        ) : u.akses_menu ? (
                          u.akses_menu.split(',').map((m: string) => {
                            const found = AVAILABLE_MENUS.find(x => x.id === m.trim());
                            const label = found ? found.label : m.trim();
                            return (
                              <span key={m} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-[10px] font-bold uppercase tracking-wider">{label}</span>
                            );
                          })
                        ) : (
                          <span className="text-gray-400 text-xs italic">Tidak ada akses</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleOpenEdit(u)} className="p-2 text-gray-400 hover:text-[#111111] hover:bg-gray-100 rounded-lg transition-colors">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(u.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-w-3xl w-full p-8 bg-white rounded-[24px] border border-[#EAEAEA] shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
          <div className="mb-8 shrink-0">
            <h3 className="text-2xl font-extrabold text-gray-900">{isEditing ? "Edit User" : "Tambah User Baru"}</h3>
            <p className="text-[13px] text-gray-500 font-medium mt-1">Kelola data informasi akun, wilayah cabang, dan hak akses menu.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* KOLOM KIRI: Data Profil */}
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">Nama Lengkap</label>
                <Input 
                  value={formData.nama || ""} 
                  onChange={e => setFormData({...formData, nama: toTitleCase(e.target.value)})} 
                  placeholder="e.g. Budi Santoso"
                  className="h-11 bg-gray-50 rounded-xl"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">Email Akun</label>
                <Input 
                  value={formData.email || ""} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                  type="email"
                  placeholder="e.g. budi.santoso@alfamart.com"
                  className="h-11 bg-gray-50 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">Induk Cabang</label>
                <SearchableSelectInput 
                  value={formData.cabang || ""} 
                  onChange={val => handleCabangChange(val)} 
                  options={ALL_INDUK_CABANG.map(c => ({ value: c, label: c }))}
                  placeholder="Pilih Induk Cabang..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">Role (Jabatan)</label>
                <SearchableSelectInput 
                  value={formData.role || ""} 
                  onChange={val => handleRoleChange(val)} 
                  options={ROLES.map(r => ({ value: r, label: r }))}
                  placeholder="Pilih Role..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">Nama PT</label>
                <Input 
                  value={formData.nama_pt || ""} 
                  onChange={e => setFormData({...formData, nama_pt: toTitleCase(e.target.value)})} 
                  placeholder="e.g. PT SUMBER ALFARIA TRIJAYA TBK"
                  className="h-11 bg-gray-50 rounded-xl"
                />
              </div>
            </div>

            {/* KOLOM KANAN: Hak Akses & Cakupan */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-[#E65F2B] uppercase tracking-wider flex items-center gap-2">
                  <Key className="w-4 h-4" /> Hak Akses Menu
                </label>
                <div className="bg-[#E65F2B]/5 p-4 rounded-xl border border-[#E65F2B]/20">
                  <p className="text-[11px] text-gray-600 font-medium mb-3">Tentukan menu apa saja yang bisa diakses oleh user ini.</p>
                  
                  {formData.role === "DC ADMIN" ? (
                    <div className="h-11 bg-green-50 text-green-700 flex items-center px-4 rounded-xl font-bold text-sm border border-green-200">
                      <Shield className="w-4 h-4 mr-2" /> Akses Penuh (Semua Menu)
                    </div>
                  ) : (
                    <MultiSelectInput
                      value={formData.akses_menu === "all" ? AVAILABLE_MENUS.map(m => m.id) : (formData.akses_menu ? formData.akses_menu.split(",").map((s:string) => s.trim()).filter(Boolean) : [])}
                      onChange={(vals) => {
                        if (vals.length === AVAILABLE_MENUS.length) {
                          setFormData({ ...formData, akses_menu: "all" });
                        } else {
                          setFormData({ ...formData, akses_menu: vals.join(", ") });
                        }
                      }}
                      options={AVAILABLE_MENUS.map(m => ({ value: m.id, label: m.label }))}
                      placeholder="Pilih menu..."
                    />
                  )}
                </div>
              </div>

              {formData.cabang && (
                <div className="space-y-2">
                  <label className="text-[12px] font-bold text-[#E65F2B] uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Coverage Cabang
                  </label>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-[11px] text-gray-600 font-medium mb-3">
                      {formData.cabang === "HEAD OFFICE" ? "Pilih cabang mana saja yang bisa diakses (Nasional):" : `Pilih area cakupan untuk ${formData.cabang}:`}
                    </p>
                    <MultiSelectInput
                      value={formData.coverage_cabang ? formData.coverage_cabang.split(",").map((s:string) => s.trim()).filter(Boolean) : []}
                      onChange={(vals) => {
                        setFormData({ ...formData, coverage_cabang: vals.join(", ") });
                      }}
                      options={
                        formData.cabang === "HEAD OFFICE" 
                          ? ALL_BRANCHES.map(b => ({ value: b, label: b }))
                          : (CABANG_GRUP[formData.cabang] || [formData.cabang]).map((b: string) => ({ value: b, label: b }))
                      }
                      placeholder="Pilih coverage cabang..."
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-10 shrink-0 pt-6 border-t border-gray-100">
            <Button variant="outline" onClick={() => setOpenModal(false)} className="h-11 rounded-xl px-5 font-bold">Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="h-11 rounded-xl px-6 font-bold bg-[#111111] hover:bg-[#333333] text-white">
              {saving ? "Menyimpan..." : "Simpan Data"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <FeedbackModal 
        open={feedback.open} 
        type={feedback.type} 
        title={feedback.title} 
        message={feedback.message} 
        onClose={() => setFeedback(prev => ({ ...prev, open: false }))} 
      />
    </Dashboard>
  );
}
