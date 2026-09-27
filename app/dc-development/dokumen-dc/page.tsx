"use client";

import React, { useEffect, useState, useMemo } from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { Search, Download, FolderArchive, Building2, MapPin, Warehouse, CheckCircle2, TrendingUp, ChevronRight, FileText, ChevronDown, ChevronUp, X, Hammer, Maximize, LayoutDashboard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import DetailDokumenModal from "@/components/dokumen-dc/DetailDokumenModal";
import GlobalNotesModal from "@/components/dokumen-dc/GlobalNotesModal";

// --- Types ---
type ProjectProgress = {
  uploaded: number;
  required: number;
  percentage: number;
};

type DokumenDcProject = {
  id: number;
  kode: string;
  nama_proyek: string;
  tipe: string;
  dc_induk: string | null;
  cabang: string;
  totalNotes?: number;
  progress: {
    PEMBANGUNAN: ProjectProgress;
    RENOVASI: ProjectProgress;
    PERLUASAN: ProjectProgress;
  };
};

type SummaryData = {
  totalLokasi: number;
  dcInduk: number;
  warehouse: number;
  depo: number;
  bulky: number;
  storeHub: number;
  gudangAnak: number;
  sudahUpload: number;
  belumUpload: number;
  totalProgressPercent: number;
};

// --- Components ---
const StatCard = ({ title, value, subtitle, icon: Icon, colorClass, delay }: any) => (
  <div 
    className={cn(
      "bg-white rounded-xl p-4 md:p-5 border border-slate-200 shadow-sm flex flex-col relative overflow-hidden transition-all hover:shadow-md",
      "animate-in slide-in-from-bottom-4 fade-in duration-500 fill-mode-backwards"
    )}
    style={{ animationDelay: delay }}
  >
    <div className="flex justify-between items-start mb-2 z-10">
      <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</h3>
      <div className={cn("p-2 rounded-lg bg-opacity-10", colorClass)}>
        <Icon className={cn("w-4 h-4", colorClass.replace('bg-', 'text-').replace('-10', '-600'))} />
      </div>
    </div>
    <div className="z-10 mt-auto">
      <div className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{value}</div>
      <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>
    </div>
    {/* Decorative background blob */}
    <div className={cn("absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-[0.03] pointer-events-none", colorClass.replace('bg-opacity-10', 'bg-current').replace('text-', 'bg-'))} />
  </div>
);

const ProgressBar = ({ label, data, dotColor }: { label: string, data: ProjectProgress, dotColor: string }) => (
  <div className="flex items-center gap-3 text-xs w-full max-w-[200px]">
    <div className="w-20 font-semibold text-slate-500 tracking-wide">{label}</div>
    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden flex items-center">
      <div 
        className={cn("h-full rounded-full transition-all duration-1000", dotColor)}
        style={{ width: `${data.percentage}%` }}
      />
    </div>
    <div className="w-12 text-right font-bold text-slate-700 tabular-nums">
      {data.uploaded}/{data.required}
    </div>
  </div>
);

const TIPE_ORDER = ["DC", "WAREHOUSE", "DEPO", "BULKY", "STORE-HUB", "GUDANG ANAK"];

export default function DokumenDcPage() {
  const router = useRouter();
  const [data, setData] = useState<DokumenDcProject[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCards, setShowCards] = useState(true);

  // Popup Modal State
  const [selectedProjectForPopup, setSelectedProjectForPopup] = useState<DokumenDcProject | null>(null);
  
  // Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedFase, setSelectedFase] = useState("");

  // Global Notes Modal State
  const [globalNotesOpen, setGlobalNotesOpen] = useState(false);
  const [selectedProjectForNotes, setSelectedProjectForNotes] = useState<DokumenDcProject | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [tipeFilter, setTipeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cabangFilter, setCabangFilter] = useState("all");

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dc-development/dokumen-dc");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setSummary(json.summary);
      }
    } catch (err) {
      console.error("Failed to load documents", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute unique dropdown values
  const uniqueBranches = useMemo(() => {
    const branches = new Set(data.map(p => p.cabang).filter(Boolean));
    return Array.from(branches).sort();
  }, [data]);

  const uniqueTipe = useMemo(() => {
    const tipe = new Set(data.map(p => p.tipe).filter(Boolean));
    return Array.from(tipe).sort();
  }, [data]);

  // Filter Data
  const filteredData = useMemo(() => {
    let result = data.filter(item => {
      const matchSearch = !query || 
        item.kode.toLowerCase().includes(query.toLowerCase()) ||
        item.nama_proyek.toLowerCase().includes(query.toLowerCase()) ||
        item.cabang.toLowerCase().includes(query.toLowerCase());
      
      const matchTipe = tipeFilter === 'all' || item.tipe === tipeFilter;
      const matchCabang = cabangFilter === 'all' || item.cabang === cabangFilter;
      
      let matchStatus = true;
      const totalUploaded = item.progress.PEMBANGUNAN.uploaded + item.progress.RENOVASI.uploaded + item.progress.PERLUASAN.uploaded;
      if (statusFilter === 'sudah') matchStatus = totalUploaded > 0;
      if (statusFilter === 'belum') matchStatus = totalUploaded === 0;

      return matchSearch && matchTipe && matchCabang && matchStatus;
    });

    result.sort((a, b) => {
      const indexA = TIPE_ORDER.indexOf(a.tipe);
      const indexB = TIPE_ORDER.indexOf(b.tipe);
      const orderA = indexA !== -1 ? indexA : 99;
      const orderB = indexB !== -1 ? indexB : 99;

      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return (a.nama_proyek || "").localeCompare(b.nama_proyek || "");
    });

    return result;
  }, [data, query, tipeFilter, cabangFilter, statusFilter]);

  return (
    <Dashboard title="Penyimpanan Dokumen DC">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-4 lg:px-6 lg:pt-6 h-[calc(100vh-72px)] space-y-4">
        
        {/* TOP SUMMARY CARDS */}
        {summary && (
          <div className="flex flex-col gap-3 shrink-0">
            <div className="flex justify-end">
              <button 
                onClick={() => setShowCards(!showCards)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
              >
                {showCards ? <><ChevronUp className="w-3.5 h-3.5" /> Sembunyikan Ringkasan</> : <><ChevronDown className="w-3.5 h-3.5" /> Tampilkan Ringkasan</>}
              </button>
            </div>
            
            {showCards && (
              <div className="flex flex-col gap-3 md:gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                  <StatCard title="TOTAL LOKASI ARSIP" value={summary.totalLokasi} subtitle="Semua tipe lokasi" icon={FolderArchive} colorClass="bg-blue-100 text-blue-600" delay="0ms" />
                  <StatCard title="DC INDUK" value={summary.dcInduk} subtitle="Lokasi utama / parent" icon={Building2} colorClass="bg-red-100 text-red-600" delay="50ms" />
                  <StatCard title="WAREHOUSE" value={summary.warehouse} subtitle="Lokasi turunan WH" icon={Warehouse} colorClass="bg-orange-100 text-orange-600" delay="100ms" />
                  <StatCard title="DEPO" value={summary.depo} subtitle="Lokasi turunan depo" icon={MapPin} colorClass="bg-purple-100 text-purple-600" delay="150ms" />
                  <StatCard title="BULKY & LAINNYA" value={summary.bulky + summary.storeHub + summary.gudangAnak} subtitle="Bulky, Store-Hub, Gudang" icon={FileText} colorClass="bg-indigo-100 text-indigo-600" delay="200ms" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:w-3/5">
                  <StatCard title="SUDAH MULAI UPLOAD" value={summary.sudahUpload} subtitle={`${summary.belumUpload} lokasi belum upload`} icon={CheckCircle2} colorClass="bg-emerald-100 text-emerald-600" delay="250ms" />
                  <StatCard title="PROGRESS DOKUMEN" value={`${summary.totalProgressPercent}%`} subtitle="Dari seluruh agregat lokasi" icon={TrendingUp} colorClass="bg-blue-100 text-blue-600" delay="300ms" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TOOLBAR FILTER */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-3 items-center shrink-0 z-20">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Cari kode, nama lokasi, DC induk, atau cabang.."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 w-full rounded-lg border-slate-200 focus-visible:ring-red-500 h-10 text-sm bg-slate-50/50"
            />
          </div>
          <div className="flex flex-wrap lg:flex-nowrap gap-3 w-full lg:w-auto">
            <Select value={tipeFilter} onValueChange={setTipeFilter}>
              <SelectTrigger className="w-full lg:w-[140px] rounded-lg h-10 text-sm border-slate-200 bg-white">
                <SelectValue placeholder="Semua Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                {uniqueTipe.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[150px] rounded-lg h-10 text-sm border-slate-200 bg-white">
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="sudah">Sudah Upload</SelectItem>
                <SelectItem value="belum">Belum Upload</SelectItem>
              </SelectContent>
            </Select>

            <Select value={cabangFilter} onValueChange={setCabangFilter}>
              <SelectTrigger className="w-full lg:w-[160px] rounded-lg h-10 text-sm border-slate-200 bg-white">
                <SelectValue placeholder="Semua Cabang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Cabang</SelectItem>
                {uniqueBranches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>

            <button className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap w-full lg:w-auto">
              <Download className="w-4 h-4" /> Ekspor Data
            </button>
          </div>
        </div>

        {/* TABLE SECTION */}
        <div className="bg-white rounded-t-xl border border-slate-200 border-b-0 shadow-sm flex-1 min-h-0 flex flex-col animate-in slide-in-from-bottom-8 fade-in duration-700">
          <div className="overflow-y-auto flex-1 pb-12">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm border-b border-slate-100 shadow-sm">
                <tr>
                  <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-16">No</th>
                  <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kode</th>
                  <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nama Proyek</th>
                  <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">DC Induk</th>
                  <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tipe</th>
                  <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status Progress</th>
                  <th className="py-3.5 px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-5 px-5"><div className="h-4 bg-slate-200 rounded w-4"></div></td>
                      <td className="py-5 px-5"><div className="h-4 bg-slate-200 rounded w-12"></div></td>
                      <td className="py-5 px-5"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                      <td className="py-5 px-5"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                      <td className="py-5 px-5"><div className="h-6 bg-slate-200 rounded-full w-12"></div></td>
                      <td className="py-5 px-5"><div className="h-10 bg-slate-200 rounded w-48"></div></td>
                      <td className="py-5 px-5 text-right"><div className="h-8 bg-slate-200 rounded w-32 ml-auto"></div></td>
                    </tr>
                  ))
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">
                      Tidak ada proyek dokumen yang ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, index) => (
                    <tr key={item.id} className="hover:bg-orange-50/40 transition-colors group">
                      <td className="py-4 px-5 text-sm font-medium text-slate-500">{index + 1}</td>
                      <td className="py-4 px-5 text-sm font-bold text-slate-700">{item.kode}</td>
                      <td className="py-4 px-5 text-sm font-bold text-slate-900">{item.nama_proyek}</td>
                      <td className="py-4 px-5">
                        {!item.dc_induk || item.dc_induk === "-" ? (
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-extrabold border border-emerald-100 uppercase tracking-wide">
                            DC INDUK UTAMA
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-slate-700">{item.dc_induk}</span>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">
                          {item.tipe}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex flex-col gap-1.5">
                          <ProgressBar label="PEMBANGUNAN" data={item.progress.PEMBANGUNAN} dotColor="bg-[#E65F2B]" />
                          <ProgressBar label="RENOVASI" data={item.progress.RENOVASI} dotColor="bg-slate-300" />
                          <ProgressBar label="PERLUASAN" data={item.progress.PERLUASAN} dotColor="bg-[#E65F2B]" />
                        </div>
                      </td>
                      <td className="py-4 px-5 text-right flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setSelectedProjectForNotes(item);
                            setGlobalNotesOpen(true);
                          }}
                          className="relative inline-flex items-center justify-center w-9 h-9 text-slate-400 bg-white border border-slate-200 rounded-lg hover:bg-orange-50 hover:text-[#E65F2B] hover:border-orange-200 transition-all shadow-sm group-hover:shadow"
                          title="Lihat Catatan"
                        >
                          <FileText className="w-4 h-4" />
                          {(item.totalNotes || 0) > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-black rounded-full px-1 border-[1.5px] border-white shadow-sm">
                              {item.totalNotes! > 99 ? '99+' : item.totalNotes}
                            </span>
                          )}
                        </button>
                        <button 
                          onClick={() => setSelectedProjectForPopup(item)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-[#E65F2B] bg-white border border-orange-200 rounded-lg hover:bg-orange-50 hover:border-[#E65F2B] transition-all shadow-sm group-hover:shadow"
                        >
                          Kelola Dokumen <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* POPUP PILIH TIPE PEKERJAAN */}
      <Dialog open={!!selectedProjectForPopup && !detailModalOpen} onOpenChange={(open) => !open && setSelectedProjectForPopup(null)}>
        <DialogContent className="max-w-2xl p-6 overflow-hidden bg-white rounded-[24px] border border-[#EAEAEA] shadow-2xl">
          {/* Header Minimalist */}
          <div className="text-center mb-6 mt-2 relative">
            <h2 className="text-2xl font-extrabold text-[#111111] tracking-tight">{selectedProjectForPopup?.kode} {selectedProjectForPopup?.nama_proyek}</h2>
            <p className="text-[13px] font-medium text-gray-500 mt-1.5">Pilih tipe pekerjaan untuk mengelola dokumen terkait.</p>
          </div>
          
          {/* Opsi Pekerjaan */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Pembangunan */}
            <button 
              onClick={() => {
                setSelectedFase("PEMBANGUNAN");
                setDetailModalOpen(true);
              }}
              className="flex flex-col items-center p-6 border border-[#EAEAEA] rounded-[20px] hover:border-[#111111] hover:shadow-md transition-all group bg-white"
            >
              <div className="w-14 h-14 bg-gray-50 text-gray-700 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-[#111111] group-hover:text-white transition-all shadow-sm">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-[#111111]">Pembangunan</h3>
              <p className="text-[10px] font-bold text-gray-400 mt-1.5 uppercase tracking-wider text-center leading-relaxed">Proyek Bangunan Baru</p>
            </button>

            {/* Renovasi */}
            <button 
              onClick={() => {
                setSelectedFase("RENOVASI");
                setDetailModalOpen(true);
              }}
              className="flex flex-col items-center p-6 border border-[#EAEAEA] rounded-[20px] hover:border-[#111111] hover:shadow-md transition-all group bg-white"
            >
              <div className="w-14 h-14 bg-gray-50 text-gray-700 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-[#111111] group-hover:text-white transition-all shadow-sm">
                <Hammer className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-[#111111]">Renovasi</h3>
              <p className="text-[10px] font-bold text-gray-400 mt-1.5 uppercase tracking-wider text-center leading-relaxed">Perbaikan & Pembaruan</p>
            </button>

            {/* Perluasan */}
            <button 
              onClick={() => {
                setSelectedFase("PERLUASAN");
                setDetailModalOpen(true);
              }}
              className="flex flex-col items-center p-6 border border-[#EAEAEA] rounded-[20px] hover:border-[#111111] hover:shadow-md transition-all group bg-white"
            >
              <div className="w-14 h-14 bg-gray-50 text-gray-700 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-[#111111] group-hover:text-white transition-all shadow-sm">
                <Maximize className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-[#111111]">Perluasan</h3>
              <p className="text-[10px] font-bold text-gray-400 mt-1.5 uppercase tracking-wider text-center leading-relaxed">Penambahan Area</p>
            </button>

          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DETAIL DOKUMEN (FULLSCREEN-ISH) */}
      <DetailDokumenModal 
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        project={selectedProjectForPopup}
        fase={selectedFase}
      />

      {/* MODAL GLOBAL NOTES */}
      <GlobalNotesModal 
        isOpen={globalNotesOpen}
        onClose={() => {
          setGlobalNotesOpen(false);
          setSelectedProjectForNotes(null);
        }}
        project={selectedProjectForNotes}
      />
    </Dashboard>
  );
}
