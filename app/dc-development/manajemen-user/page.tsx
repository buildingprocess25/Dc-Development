"use client";

import React, { useState, useEffect } from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { Plus, Search, Edit3, Trash2, Mail, MapPin, Briefcase, Shield, Key, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const CABANG_TUNGGAL = [
  "LUWU", "REMBANG", "TEGAL", "GORONTALO", "PONTIANAK", "CIANJUR", "JEMBER", 
  "BALI", "KLATEN", "MAKASSAR", "PLUMBON", "PEKANBARU", "JAMBI", "HEAD OFFICE", 
  "CILACAP", "SEMARANG", "MALANG", "MANADO", "BATAM", "MADIUN"
];

const CABANG_GRUP: Record<string, string[]> = {
  "BANDUNG RAYA": ["BANDUNG RAYA", "BANDUNG", "BANDUNG 1", "BANDUNG 2"],
  "LOMBOK": ["LOMBOK", "SUMBAWA"],
  "MEDAN": ["MEDAN", "ACEH"],
  "LAMPUNG": ["LAMPUNG", "KOTABUMI"],
  "PALEMBANG": ["PALEMBANG", "BENGKULU", "BANGKA", "BELITUNG"],
  "SIDOARJO": ["SIDOARJO", "SIDOARJO BPN SMD", "MANOKWARI", "NTT", "SORONG"],
  "BANJARMASIN": ["BANJARMASIN", "PALANGKARAYA"],
  "CIKOKOL": ["CIKOKOL", "PARUNG", "BALARAJA", "SERANG", "BINTAN"],
  "CILEUNGSI": ["CILEUNGSI", "BOGOR", "BEKASI", "KARAWANG"]
};

const ALL_INDUK_CABANG = [...CABANG_TUNGGAL, ...Object.keys(CABANG_GRUP)].sort();

const ALL_BRANCHES = Array.from(new Set([
  ...CABANG_TUNGGAL,
  ...Object.values(CABANG_GRUP).flat()
])).sort();

const ROLES = [
  "DC DOCUMENT ADMIN",
  "DC BUILDING & DEVELOPMENT SPECIALIST",
  "DC BUILDING & DEVELOPMENT MANAGER",
  "DC ADMIN"
];

const AVAILABLE_MENUS = [
  { id: "dc-profile", label: "Profile DC" },
  { id: "dc-documents", label: "Dokumen DC" },
  { id: "manajemen-user", label: "Manajemen User" }
];

export default function ManajemenUser() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Modal state
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);
  const [menuDropdownOpen, setMenuDropdownOpen] = useState(false);
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

  const handleCabangChange = (val: string) => {
    let coverage = val;
    if (CABANG_GRUP[val]) {
      coverage = CABANG_GRUP[val].join(", ");
    }
    setFormData({ ...formData, cabang: val, coverage_cabang: coverage });
  };

  const handleCoverageToggle = (child: string) => {
    let current = formData.coverage_cabang ? formData.coverage_cabang.split(",").map((s:string) => s.trim()) : [];
    
    let affectedBranches = [child];
    if (formData.cabang === "HEAD OFFICE" && CABANG_GRUP[child]) {
      affectedBranches = CABANG_GRUP[child];
    }

    const isChecked = current.includes(child);

    if (isChecked) {
      current = current.filter((c:string) => !affectedBranches.includes(c));
    } else {
      current = [...new Set([...current, ...affectedBranches])];
    }
    
    setFormData({ ...formData, coverage_cabang: current.join(", ") });
  };

  const handleRoleChange = (val: string) => {
    let akses = formData.akses_menu;
    if (val === "DC ADMIN") akses = "all";
    setFormData({ ...formData, role: val, akses_menu: akses });
  };

  const handleMenuToggle = (menuId: string) => {
    if (formData.role === "DC ADMIN") return;
    
    let current = formData.akses_menu === "all" 
      ? AVAILABLE_MENUS.map(m => m.id)
      : (formData.akses_menu ? formData.akses_menu.split(",").map((s:string) => s.trim()).filter(Boolean) : []);
    
    if (current.includes(menuId)) {
      current = current.filter((m: string) => m !== menuId);
    } else {
      current.push(menuId);
    }

    if (current.length === AVAILABLE_MENUS.length) {
      setFormData({ ...formData, akses_menu: "all" });
    } else {
      setFormData({ ...formData, akses_menu: current.join(", ") });
    }
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
        <div className="p-4 md:p-6 border-b border-[#EAEAEA]">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input 
              placeholder="Cari email, nama, cabang, role..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-11 h-12 bg-gray-50 border-gray-200 rounded-xl focus-visible:ring-[#E65F2B] text-[14px] font-medium"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-[#EAEAEA]">
                <th className="py-4 px-6 text-[11px] font-extrabold text-gray-500 uppercase tracking-widest">User Info</th>
                <th className="py-4 px-6 text-[11px] font-extrabold text-gray-500 uppercase tracking-widest">Cabang</th>
                <th className="py-4 px-6 text-[11px] font-extrabold text-gray-500 uppercase tracking-widest">Role</th>
                <th className="py-4 px-6 text-[11px] font-extrabold text-gray-500 uppercase tracking-widest">Hak Akses</th>
                <th className="py-4 px-6 text-[11px] font-extrabold text-gray-500 uppercase tracking-widest w-[120px]">Aksi</th>
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
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold">
                          {u.nama?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div>
                          <p className="text-[14px] font-bold text-gray-900">{u.nama}</p>
                          <p className="text-[12px] font-medium text-gray-500 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" /> {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[12px] font-bold">
                        <MapPin className="w-3.5 h-3.5" /> {u.cabang}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 text-[#E65F2B] text-[12px] font-bold">
                        <Briefcase className="w-3.5 h-3.5" /> {u.role?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {u.akses_menu === "all" ? (
                          <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-[10px] font-bold uppercase tracking-wider">Akses Penuh</span>
                        ) : u.akses_menu ? (
                          u.akses_menu.split(',').map((m: string) => (
                            <span key={m} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-[10px] font-bold uppercase tracking-wider">{m.trim()}</span>
                          ))
                        ) : (
                          <span className="text-gray-400 text-xs italic">Tidak ada akses</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
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
        <DialogContent className="max-w-md w-full p-6 bg-white rounded-[24px] border border-[#EAEAEA] shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
          <div className="mb-6 shrink-0">
            <h3 className="text-xl font-extrabold text-gray-900">{isEditing ? "Edit User" : "Tambah User Baru"}</h3>
            <p className="text-[13px] text-gray-500 font-medium mt-1">Kelola data informasi akun dan hak akses menu.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">Nama Lengkap</label>
              <Input 
                value={formData.nama || ""} 
                onChange={e => setFormData({...formData, nama: e.target.value})} 
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
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">Induk Cabang</label>
                <select 
                  value={formData.cabang || ""} 
                  onChange={e => handleCabangChange(e.target.value)} 
                  className="h-11 w-full bg-gray-50 border-gray-200 rounded-xl px-3 text-sm focus:ring-[#E65F2B] outline-none"
                >
                  <option value="" disabled>-- Pilih Cabang --</option>
                  {ALL_INDUK_CABANG.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">Role</label>
                <select 
                  value={formData.role || ""} 
                  onChange={e => handleRoleChange(e.target.value)} 
                  className="h-11 w-full bg-gray-50 border-gray-200 rounded-xl px-3 text-sm focus:ring-[#E65F2B] outline-none"
                >
                  <option value="" disabled>-- Pilih Jabatan --</option>
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            {formData.cabang === "HEAD OFFICE" ? (
              <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-100 max-h-[300px] flex flex-col">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-bold text-[#E65F2B] uppercase tracking-wider">Coverage Cabang (Nasional)</label>
                  <button 
                    onClick={() => {
                      const currentLength = formData.coverage_cabang ? formData.coverage_cabang.split(",").length : 0;
                      if (currentLength >= ALL_BRANCHES.length) {
                        setFormData({ ...formData, coverage_cabang: "" });
                      } else {
                        setFormData({ ...formData, coverage_cabang: ALL_BRANCHES.join(", ") });
                      }
                    }}
                    className="text-[10px] font-bold text-[#E65F2B] bg-[#E65F2B]/10 px-2 py-1 rounded hover:bg-[#E65F2B]/20 transition-colors"
                  >
                    Pilih / Hapus Semua
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 font-medium">Pilih area cakupan (Pusat / Nasional):</p>
                <div className="flex flex-wrap gap-2 mt-2 overflow-y-auto custom-scrollbar flex-1 pb-2">
                  {ALL_INDUK_CABANG.map(child => {
                    const isChecked = (formData.coverage_cabang || "").includes(child);
                    return (
                      <label key={child} className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:border-[#E65F2B] transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => handleCoverageToggle(child)}
                          className="rounded text-[#E65F2B] focus:ring-[#E65F2B]"
                        />
                        <span className="text-[12px] font-bold text-gray-700">{child}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : formData.cabang && CABANG_GRUP[formData.cabang] ? (
              <div className="space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <label className="text-[12px] font-bold text-[#E65F2B] uppercase tracking-wider">Coverage Cabang (Grup)</label>
                <p className="text-[11px] text-gray-500 font-medium">Pilih area cakupan untuk pengguna ini:</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {CABANG_GRUP[formData.cabang].map(child => {
                    const isChecked = (formData.coverage_cabang || "").includes(child);
                    return (
                      <label key={child} className="flex items-center gap-2 cursor-pointer bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:border-[#E65F2B] transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => handleCoverageToggle(child)}
                          className="rounded text-[#E65F2B] focus:ring-[#E65F2B]"
                        />
                        <span className="text-[12px] font-bold text-gray-700">{child}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">Nama PT</label>
              <Input 
                value={formData.nama_pt || ""} 
                onChange={e => setFormData({...formData, nama_pt: e.target.value})} 
                placeholder="e.g. PT SUMBER ALFARIA TRIJAYA TBK"
                className="h-11 bg-gray-50 rounded-xl"
              />
            </div>

            <div className="space-y-1.5 relative">
              <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Key className="w-4 h-4" /> Hak Akses Menu
              </label>
              
              <div 
                onClick={() => {
                  if (formData.role !== "DC ADMIN") setMenuDropdownOpen(!menuDropdownOpen)
                }}
                className={`h-11 bg-gray-50 rounded-xl px-3 flex items-center justify-between border ${formData.role === "DC ADMIN" ? "opacity-50 cursor-not-allowed border-transparent" : "cursor-pointer border-gray-200 hover:border-[#E65F2B] transition-colors"}`}
              >
                <span className="text-sm text-gray-700 font-medium line-clamp-1">
                  {formData.akses_menu === "all" ? "Akses Penuh (Semua Menu)" : (formData.akses_menu || "Pilih menu...")}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${menuDropdownOpen ? "rotate-180" : ""}`} />
              </div>

              {menuDropdownOpen && formData.role !== "DC ADMIN" && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 shadow-2xl rounded-xl z-50 p-2 overflow-hidden flex flex-col gap-1">
                  <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pilih Akses Menu</span>
                    <button 
                      onClick={() => setFormData({ ...formData, akses_menu: formData.akses_menu === "all" ? "" : "all" })}
                      className="text-[10px] font-bold text-[#E65F2B] bg-[#E65F2B]/10 hover:bg-[#E65F2B]/20 px-2 py-1 rounded transition-colors"
                    >
                      {formData.akses_menu === "all" ? "Hapus Semua" : "Pilih Semua"}
                    </button>
                  </div>
                  {AVAILABLE_MENUS.map(menu => {
                    const isChecked = formData.akses_menu === "all" || (formData.akses_menu || "").includes(menu.id);
                    return (
                      <label key={menu.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => handleMenuToggle(menu.id)}
                          className="rounded text-[#E65F2B] focus:ring-[#E65F2B] w-4 h-4"
                        />
                        <span className="text-[13px] font-bold text-gray-700">{menu.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end mt-8 shrink-0">
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
