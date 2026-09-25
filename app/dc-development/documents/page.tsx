"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Download,
  FileDown,
  FileSpreadsheet,
  FolderArchive,
  Hammer,
  Loader2,
  RefreshCw,
  Search,
  Maximize,
  MessageSquare,
  FileText,
  Files,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from "@/context/SessionContext";
import { fetchDcArchiveProjects, fetchDcDocuments, exportDcData, exportGlobalDcData, fetchDcDocumentCustomItems, type DcArchiveProject, type DcDocument, type DcDocumentCustomItem } from "@/lib/api";
import { getDcDocumentConfigForStage, getTotalRequiredDcDocumentSlots } from "@/lib/dc-document.config";
import { canViewAllBranches, getParentBranch, getSubBranchesForParent } from "@/lib/constants";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

type NoteDisplay = {
  note: DcDocument;
  stageKey: string;
  stageLabel: string;
  category: string;
  itemTitle: string;
  format: string;
  isCategoryNote?: boolean;
};

type GroupedProjectNotes = {
  stageKey: string;
  stageLabel: string;
  total: number;
  categories: Array<{
    category: string;
    notes: NoteDisplay[];
  }>;
};

const NOTE_STAGE_ORDER = ["PEMBANGUNAN", "RENOVASI", "PERLUASAN", "UMUM"];
const NOTE_STAGE_LABELS: Record<string, string> = {
  PEMBANGUNAN: "Pembangunan",
  RENOVASI: "Renovasi",
  PERLUASAN: "Perluasan",
  UMUM: "Umum",
};

const normalizeNoteStage = (stage?: string | null) => {
  const normalized = String(stage || "").trim().toUpperCase();
  return NOTE_STAGE_ORDER.includes(normalized) ? normalized : "UMUM";
};

const formatDocumentSlotLabel = (raw?: string) => raw ? raw.replace(/_/g, "/") : "Format tidak diketahui";

type DcArchiveStatusFilter = "all" | "lengkap" | "belum";

const toArchiveStatusFilter = (value: string): DcArchiveStatusFilter => (
  value === "lengkap" || value === "belum" ? value : "all"
);

const ARCHIVE_TYPE_OPTIONS = [
  { value: "DC", label: "DC" },
  { value: "WAREHOUSE", label: "Warehouse" },
  { value: "DEPO", label: "Depo" },
  { value: "BULKY", label: "Bulky" },
  { value: "STORE_HUB", label: "Store-Hub" },
  { value: "GUDANG_ANAK", label: "Gudang Anak" },
] as const;

const getArchiveTypeLabel = (archive: DcArchiveProject) => {
  const key = archive.archive_type || archive.project_type;
  return ARCHIVE_TYPE_OPTIONS.find((item) => item.value === key)?.label || archive.project_type || key || "-";
};

const getArchiveParentBranch = (archive: DcArchiveProject) => archive.parent_branch_name || getParentBranch(archive.branch_name);
const MiniProgress = ({ label, current, total }: { label: string; current: number; total: number }) => {
  const isZero = current === 0;
  const isComplete = current === total && total > 0;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={`flex items-center gap-2.5 transition-opacity ${isZero ? 'opacity-40 hover:opacity-100' : 'opacity-100'}`}>
      <span className="w-[85px] text-[10px] font-bold tracking-wider uppercase text-slate-500 truncate" title={label}>
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-9 text-right text-[10px] font-bold ${isZero ? 'text-slate-400' : 'text-slate-800'}`}>
        {current}/{total}
      </span>
    </div>
  );
};

export default function DcDocumentsPage() {
  const router = useRouter();
  const { user, isLoading } = useSession();
  const [archives, setArchives] = useState<DcArchiveProject[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [tipeDcFilter, setTipeDcFilter] = useState("all");
  const [loadingArchives, setLoadingArchives] = useState(false);
  const [message, setMessage] = useState("");

  const [selectedArchiveForType, setSelectedArchiveForType] = useState<DcArchiveProject | null>(null);
  const [selectedArchiveForNotes, setSelectedArchiveForNotes] = useState<DcArchiveProject | null>(null);
  const [projectNotes, setProjectNotes] = useState<DcDocument[]>([]);
  const [customItemsForNotes, setCustomItemsForNotes] = useState<DcDocumentCustomItem[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  const actor = useMemo(() => ({
    actor_email: user?.email || "",
    actor_role: user?.role || "",
  }), [user]);


  const handleExportGlobal = async (format: 'csv' | 'excel' | 'pdf') => {
    if (!actor.actor_email || !actor.actor_role) return;
    try {
      const queryParams: { search?: string; status?: string; branch_name?: string; archive_type?: string } = {
        search: query.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        branch_name: branchFilter !== 'all' ? branchFilter : undefined,
        archive_type: tipeDcFilter !== 'all' ? tipeDcFilter : undefined,
      };

      await exportGlobalDcData(queryParams, actor, format);
    } catch (error) {
      setMessage(getErrorMessage(error, "Gagal mengunduh file ekspor"));
    }
  };

  const handleExportProject = async (archive: DcArchiveProject, format: 'csv' | 'excel' | 'pdf') => {
    if (!actor.actor_email || !actor.actor_role) return;
    try {
      await exportDcData(archive.id, format, actor.actor_role, actor.actor_email);
    } catch (error) {
      setMessage(getErrorMessage(error, "Gagal mengunduh file ekspor proyek"));
    }
  };

  const handleOpenNotes = useCallback(async (archive: DcArchiveProject) => {
    if (!actor.actor_email) return;
    setSelectedArchiveForNotes(archive);
    setLoadingNotes(true);
    setProjectNotes([]);
    setCustomItemsForNotes([]);
    try {
      const res = await fetchDcDocuments({
        actor_email: actor.actor_email,
        actor_role: actor.actor_role,
        project_id: archive.project_id,
        entity_type: "DC_ARCHIVE_PROJECT"
      }, { suppressGlobalError: true });
      const [customPembangunan, customRenovasi, customPerluasan] = await Promise.all([
        fetchDcDocumentCustomItems(archive.id, { ...actor, stage: "PEMBANGUNAN" }, { suppressGlobalError: true }),
        fetchDcDocumentCustomItems(archive.id, { ...actor, stage: "RENOVASI" }, { suppressGlobalError: true }),
        fetchDcDocumentCustomItems(archive.id, { ...actor, stage: "PERLUASAN" }, { suppressGlobalError: true }),
      ]);
      const docs = res.data ?? [];
      const withNotes = docs.filter(d => !!d.notes);
      setProjectNotes(withNotes);
      setCustomItemsForNotes([
        ...(customPembangunan.data ?? []),
        ...(customRenovasi.data ?? []),
        ...(customPerluasan.data ?? []),
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingNotes(false);
    }
  }, [actor]);


  const groupedProjectNotes = useMemo<GroupedProjectNotes[]>(() => {
    const customItemMap = new Map<string, DcDocumentCustomItem>();
    customItemsForNotes.forEach(item => customItemMap.set(`CUSTOM_K_${item.id}`, item));

    const resolveNote = (note: DcDocument): NoteDisplay | null => {
      const [rawJenisKey = "", rawFormat = ""] = (note.document_type || "").split("__");
      const stageKey = normalizeNoteStage(note.stage);

      let jenisKey = rawJenisKey;
      let displayFormat = formatDocumentSlotLabel(rawFormat);

      if (rawJenisKey.startsWith("ITEM_NOTE_")) {
        jenisKey = rawJenisKey.replace("ITEM_NOTE_", "");
        if (!rawFormat) {
          displayFormat = "CATATAN ITEM";
        }
      }

      if (jenisKey.startsWith("CAT_NOTE_")) {
        return null;
      }

      const customItem = customItemMap.get(jenisKey);
      if (customItem) {
        return {
          note,
          stageKey,
          stageLabel: NOTE_STAGE_LABELS[stageKey],
          category: "DATA PENTING LAINNYA",
          itemTitle: customItem.title,
          format: displayFormat,
        };
      }

      for (const utama of getDcDocumentConfigForStage(stageKey)) {
        for (const detail of utama.details) {
          const jenis = detail.jenis.find(item => item.key === jenisKey);
          if (jenis) {
            return {
              note,
              stageKey,
              stageLabel: NOTE_STAGE_LABELS[stageKey],
              category: utama.title,
              itemTitle: jenis.title,
              format: displayFormat,
            };
          }
        }
      }

      return {
        note,
        stageKey,
        stageLabel: NOTE_STAGE_LABELS[stageKey],
        category: "Kategori tidak diketahui",
        itemTitle: jenisKey || "Item tidak diketahui",
        format: displayFormat,
      };
    };

    const stageMap = new Map<string, Map<string, NoteDisplay[]>>();
    projectNotes.map(resolveNote).forEach(item => {
      if (!item) return;
      if (!stageMap.has(item.stageKey)) stageMap.set(item.stageKey, new Map());
      const categoryMap = stageMap.get(item.stageKey)!;
      if (!categoryMap.has(item.category)) categoryMap.set(item.category, []);
      categoryMap.get(item.category)!.push(item);
    });

    return NOTE_STAGE_ORDER
      .filter(stageKey => stageMap.has(stageKey))
      .map(stageKey => {
        const categoryMap = stageMap.get(stageKey)!;
        const categories = Array.from(categoryMap.entries()).map(([category, notes]) => ({
          category,
          notes: notes.sort((a, b) => String(a.itemTitle).localeCompare(String(b.itemTitle), "id-ID")),
        }));
        return {
          stageKey,
          stageLabel: NOTE_STAGE_LABELS[stageKey],
          total: categories.reduce((sum, category) => sum + category.notes.length, 0),
          categories,
        };
      });
  }, [customItemsForNotes, projectNotes]);
  const isHOUser = useMemo(() => (
    canViewAllBranches(user?.roles, user?.isSuperHuman ?? false) || user?.cabang?.toUpperCase() === "HEAD OFFICE"
  ), [user]);

  const loadArchives = useCallback(async () => {
    if (!actor.actor_email || !actor.actor_role) return;
    setLoadingArchives(true);
    setMessage("");
    try {
      const subBranches = isHOUser && branchFilter !== "all"
        ? getSubBranchesForParent(branchFilter)
        : null;
      let data: DcArchiveProject[];
      const statusParam = toArchiveStatusFilter(statusFilter);

      if (subBranches && subBranches.length > 1) {
        const results = await Promise.all(
          subBranches.map((sub) =>
            fetchDcArchiveProjects({
              actor_email: actor.actor_email,
              actor_role: actor.actor_role,
              search: query.trim() || undefined,
              branch_name: sub,
              status: statusParam,
              archive_type: tipeDcFilter !== "all" ? tipeDcFilter : undefined,
            }, { suppressGlobalError: true }).then((res) => res.data ?? [])
          )
        );
        data = results.flat();
      } else {
        const res = await fetchDcArchiveProjects({
          actor_email: actor.actor_email,
          actor_role: actor.actor_role,
          search: query.trim() || undefined,
          branch_name: branchFilter === "all" ? undefined : branchFilter,
          status: statusParam,
          archive_type: tipeDcFilter !== "all" ? tipeDcFilter : undefined,
        }, { suppressGlobalError: true });
        data = res.data ?? [];
      }

      setArchives(data);
    } catch (error) {
      setMessage(getErrorMessage(error, "Gagal memuat arsip dokumen DC"));
    } finally {
      setLoadingArchives(false);
    }
  }, [actor.actor_email, actor.actor_role, branchFilter, query, statusFilter, tipeDcFilter, isHOUser]);

  useEffect(() => {
    if (!isLoading && user) loadArchives();
  }, [isLoading, loadArchives, user]);

  const branchOptions = useMemo(() => {
    const branches = new Set<string>();
    archives.forEach((archive) => {
      const parentBranch = getArchiveParentBranch(archive);
      if (parentBranch) branches.add(parentBranch);
    });
    return Array.from(branches).sort((a, b) => a.localeCompare(b));
  }, [archives]);

  const filteredArchives = useMemo(() => {
    const filtered = archives.filter((item) => {
      const matchesTipe = tipeDcFilter === "all"
        ? true
        : (item.archive_type || item.project_type) === tipeDcFilter;
      const matchesStatus = statusFilter === "all"
        ? true
        : (statusFilter === "lengkap" ? item.jumlah_dokumen > 0 : item.jumlah_dokumen === 0);
      const matchesBranch = branchFilter === "all"
        ? true
        : getArchiveParentBranch(item) === branchFilter;

      return matchesTipe && matchesStatus && matchesBranch;
    });

    const typeOrder = ["DC", "WAREHOUSE", "DEPO", "BULKY", "STORE_HUB", "GUDANG_ANAK"];

    return filtered.sort((a, b) => {
      if (tipeDcFilter === "all") {
        const typeA = (a.archive_type || a.project_type || "").toUpperCase();
        const typeB = (b.archive_type || b.project_type || "").toUpperCase();
        const indexA = typeOrder.indexOf(typeA);
        const indexB = typeOrder.indexOf(typeB);

        if (indexA !== -1 && indexB !== -1) {
          if (indexA !== indexB) return indexA - indexB;
        } else if (indexA !== -1) {
          return -1;
        } else if (indexB !== -1) {
          return 1;
        }
      }

      const nameA = (a.archive_name || a.archive_code || "").toUpperCase();
      const nameB = (b.archive_name || b.archive_code || "").toUpperCase();
      return nameA.localeCompare(nameB);
    });
  }, [archives, tipeDcFilter, statusFilter, branchFilter]);

  const totals = useMemo(() => {
    const complete = filteredArchives.filter(a => a.jumlah_dokumen > 0).length;
    const branches = new Set(filteredArchives.map((item) => getArchiveParentBranch(item)).filter(Boolean));
    const childLocations = filteredArchives.filter(a => (a.archive_type || a.project_type) !== "DC");
    const linkedChildLocations = childLocations.filter(a => !!a.parent_dc_code).length;
    const countType = (type: string) => filteredArchives.filter(a => (a.archive_type || a.project_type) === type).length;
    const totalDc = countType("DC");
    const totalWarehouse = countType("WAREHOUSE");
    const totalDepo = countType("DEPO");
    const totalBulky = countType("BULKY");
    const totalStoreHub = countType("STORE_HUB");
    const totalGudangAnak = countType("GUDANG_ANAK");
    const totalDocsAll = filteredArchives.reduce((sum, a) => sum + (a.jumlah_dokumen || 0), 0);

    return {
      total: filteredArchives.length,
      complete,
      incomplete: filteredArchives.length - complete,
      branches: branches.size,
      totalDc,
      totalWarehouse,
      totalDepo,
      totalBulky,
      totalStoreHub,
      totalGudangAnak,
      childLocations: childLocations.length,
      linkedChildLocations,
      totalDocs: totalDocsAll,
      progress: filteredArchives.length > 0 ? Math.round((complete / filteredArchives.length) * 100) : 0,
      parentLinkProgress: childLocations.length > 0 ? Math.round((linkedChildLocations / childLocations.length) * 100) : 100,
    };
  }, [filteredArchives]);

  if (isLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7f9] text-slate-900 [font-family:var(--font-sans)]">
      {/* HEADER PREMIUM */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-red-700 to-red-600 shadow-md">
        <div className="mx-auto flex h-[80px] max-w-[1400px] items-center gap-5 px-6 lg:px-8">
          <Link href="/dc-development" className="group flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white hover:text-red-700" title="Kembali">
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
          </Link>
          <Image src="/assets/Alfamart-Emblem.png" alt="Alfamart" width={94} height={42} className="h-[42px] w-auto drop-shadow-md" priority />
          <div className="h-8 w-px bg-white/20" />
          <h1 className="text-xl font-bold tracking-tight text-white lg:text-2xl">Penyimpanan Dokumen DC</h1>
          <Button
            variant="outline"
            className="ml-auto hidden rounded-xl border-white/20 bg-white/10 font-medium text-white backdrop-blur-sm transition-all hover:bg-white hover:text-red-700 md:inline-flex"
            onClick={loadArchives}
            disabled={loadingArchives}
          >
            <RefreshCw className={(loadingArchives) ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh Data
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        {message && (
          <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/80 px-5 py-4 text-sm font-semibold text-blue-800 shadow-sm backdrop-blur-md">
            {message}
          </div>
        )}

        <div className="space-y-6">
          {/* DASHBOARD WIDGETS */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 xl:grid-cols-5">
            <MetricCard title="Total Lokasi Arsip" value={totals.total} subtitle={`${totals.branches} induk cabang, 6 tipe lokasi`} icon={<Building2 className="h-5 w-5 opacity-70" />} />
            <MetricCard title="DC Induk" value={totals.totalDc} subtitle="Lokasi utama / parent" icon={<Building2 className="h-5 w-5 opacity-70" />} />
            <MetricCard title="Warehouse" value={totals.totalWarehouse} subtitle="Lokasi turunan WH" icon={<FolderArchive className="h-5 w-5 opacity-70" />} />
            <MetricCard title="Depo" value={totals.totalDepo} subtitle="Lokasi turunan depo" icon={<FolderArchive className="h-5 w-5 opacity-70" />} />
            <MetricCard title="Bulky" value={totals.totalBulky} subtitle="Lokasi turunan bulky" icon={<FolderArchive className="h-5 w-5 opacity-70" />} />
            <MetricCard title="Store-Hub" value={totals.totalStoreHub} subtitle="Lokasi turunan store-hub" icon={<FolderArchive className="h-5 w-5 opacity-70" />} />
            <MetricCard title="Gudang Anak" value={totals.totalGudangAnak} subtitle="Lokasi turunan gudang" icon={<FolderArchive className="h-5 w-5 opacity-70" />} />
            <MetricCard
              title="Sudah Mulai Upload"
              value={totals.complete}
              subtitle={`${totals.incomplete} lokasi belum upload`}
              tone="green"
              icon={<CheckCircle2 className="h-5 w-5 opacity-70" />}
            />
            <MetricCard
              title="Progress Dokumen"
              value={`${totals.progress}%`}
              subtitle={`${totals.complete} dari ${totals.total} lokasi mulai upload`}
              progress={totals.progress}
              icon={<CheckCircle2 className="h-5 w-5 opacity-70" />}
            />
          </section>

          {/* FILTER & TOOLS */}
          <section className="rounded-2xl border border-slate-200/60 bg-white/60 p-5 shadow-sm backdrop-blur-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Cari kode, nama lokasi, DC induk, atau cabang..."
                  className="h-11 w-full rounded-xl border-slate-200 bg-white pl-10 pr-4 shadow-sm focus:border-red-500 focus:ring-red-500"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Select value={tipeDcFilter} onValueChange={setTipeDcFilter}>
                  <SelectTrigger className="h-11 w-[160px] rounded-xl border-slate-200 bg-white shadow-sm">
                    <SelectValue placeholder="Tipe Gedung" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Tipe</SelectItem>
                    {ARCHIVE_TYPE_OPTIONS.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-11 w-[160px] rounded-xl border-slate-200 bg-white shadow-sm">
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="lengkap">Sudah Upload</SelectItem>
                    <SelectItem value="belum">Belum Upload</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white shadow-sm lg:w-[180px]">
                    <SelectValue placeholder="Semua Cabang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Cabang</SelectItem>
                    {branchOptions.map((branch) => (
                      <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-11 rounded-xl border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-red-600">
                      <Download className="mr-2 h-4 w-4" />
                      Ekspor Data
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[180px] rounded-xl">
                    <DropdownMenuItem onClick={() => handleExportGlobal('csv')} className="cursor-pointer gap-2 py-2">
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      Unduh CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportGlobal('excel')} className="cursor-pointer gap-2 py-2">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      Unduh Excel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportGlobal('pdf')} className="cursor-pointer gap-2 py-2">
                      <FileDown className="h-4 w-4 text-red-500" />
                      Unduh PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </section>

          {/* MAIN DATA TABLE */}
          <Card className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-lg shadow-slate-200/40">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1240px] text-left text-sm">
                <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-4">No</th>
                    <th className="px-6 py-4">Kode</th>
                    <th className="px-6 py-4">Nama Proyek</th>
                    {/* <th className="px-6 py-4">Cabang</th> */}
                    {/* <th className="px-6 py-4">Induk Cabang</th> */}
                    <th className="px-6 py-4">DC Induk</th>
                    <th className="px-6 py-4">Tipe</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredArchives.map((archive, index) => {
                    return (
                      <tr key={archive.id} className="group transition-colors hover:bg-red-50/40">
                        <td className="px-6 py-5 text-slate-500">{index + 1}</td>
                        <td className="px-6 py-5 font-bold text-slate-700">{archive.archive_code}</td>
                        <td className="px-6 py-5">
                          <span className="font-semibold text-slate-900 uppercase">{archive.archive_name}</span>
                          {archive.location_name && <div className="mt-0.5 text-xs text-slate-500 uppercase">{archive.location_name}</div>}
                        </td>
                        {/* <td className="px-6 py-5 font-medium text-slate-700">{archive.branch_name}</td> */}
                        {/* <td className="px-6 py-5 font-medium text-slate-700">{getArchiveParentBranch(archive)}</td> */}
                        <td className="px-6 py-5 text-slate-600">
                          {archive.parent_dc_code ? (
                            <div className="font-medium">
                              <span className="font-bold text-slate-800 uppercase">{archive.parent_dc_code}</span>
                              <div className="mt-0.5 text-xs text-slate-500 uppercase">{archive.parent_dc_name}</div>
                            </div>
                          ) : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="px-6 py-5">
                          <Badge variant="outline" className="rounded-md border-slate-200 bg-slate-50 font-medium text-slate-600">
                            {getArchiveTypeLabel(archive)}
                          </Badge>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-2 min-w-[170px]">
                            <MiniProgress
                              label="Pembangunan"
                              current={archive.docs_pembangunan || 0}
                              total={getTotalRequiredDcDocumentSlots('Pembangunan') + (archive.custom_items_pembangunan || 0)}
                            />
                            <MiniProgress
                              label="Renovasi"
                              current={archive.docs_renovasi || 0}
                              total={getTotalRequiredDcDocumentSlots('Renovasi') + (archive.custom_items_renovasi || 0)}
                            />
                            <MiniProgress
                              label="Perluasan"
                              current={archive.docs_perluasan || 0}
                              total={getTotalRequiredDcDocumentSlots('Perluasan') + (archive.custom_items_perluasan || 0)}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="relative inline-block">
                              <Button size="sm" variant="outline" className="rounded-lg border-slate-200 bg-white font-medium text-slate-500 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-700" onClick={() => handleOpenNotes(archive)} title="Lihat Catatan">
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              {(archive.total_notes || 0) > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                                  {(archive.total_notes || 0) > 99 ? '99+' : archive.total_notes}
                                </span>
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="rounded-lg border-slate-200 bg-white font-medium text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-red-600" title="Ekspor data proyek">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[190px] rounded-xl">
                                <DropdownMenuItem onClick={() => handleExportProject(archive, 'csv')} className="cursor-pointer gap-2 py-2">
                                  <FileText className="h-4 w-4 text-slate-500" />
                                  Ekspor CSV Proyek
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportProject(archive, 'excel')} className="cursor-pointer gap-2 py-2">
                                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                                  Ekspor Excel Proyek
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportProject(archive, 'pdf')} className="cursor-pointer gap-2 py-2">
                                  <FileDown className="h-4 w-4 text-red-500" />
                                  Ekspor PDF Proyek
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button size="sm" className="rounded-lg bg-white font-semibold text-red-600 shadow-sm border border-red-100 transition-all hover:bg-red-600 hover:text-white" onClick={() => setSelectedArchiveForType(archive)}>
                              Kelola Dokumen
                              <ChevronRight className="ml-1.5 h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {loadingArchives && (
                    <tr>
                      <td colSpan={9} className="px-6 py-16 text-center text-slate-500">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-red-500" />
                        <p className="mt-3 font-medium">Memuat data...</p>
                      </td>
                    </tr>
                  )}
                  {!loadingArchives && archives.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-16 text-center text-slate-500">
                        <FolderArchive className="mx-auto h-12 w-12 text-slate-300" />
                        <p className="mt-3 font-medium">Belum ada data DC / Warehouse.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* SELECTION MODAL */}
      <Dialog open={!!selectedArchiveForType} onOpenChange={(open) => !open && setSelectedArchiveForType(null)}>
        <DialogContent className="max-w-3xl overflow-hidden rounded-[2rem] border-0 p-0 shadow-2xl">
          <div className="bg-gradient-to-br from-red-700 to-red-600 p-8 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('/assets/pattern-light.svg')] opacity-10"></div>
            <h2 className="relative z-10 text-3xl font-black tracking-tight">{selectedArchiveForType?.archive_name}</h2>
            <p className="relative z-10 mt-2 text-red-100 font-medium">Pilih tipe pekerjaan untuk mengelola dokumen terkait.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-50 p-8">
            <button
              onClick={() => router.push(`/dc-development/documents/${selectedArchiveForType?.id}/PEMBANGUNAN`)}
              className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-100 bg-white p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-red-500 hover:shadow-xl focus:outline-none"
            >
              <div className="mb-4 inline-flex rounded-2xl bg-red-50 p-4 text-red-600 transition-transform group-hover:scale-110">
                <Building2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Pembangunan</h3>
              <p className="mt-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Proyek Bangunan Baru</p>
            </button>
            <button
              onClick={() => router.push(`/dc-development/documents/${selectedArchiveForType?.id}/RENOVASI`)}
              className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-100 bg-white p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-red-500 hover:shadow-xl focus:outline-none"
            >
              <div className="mb-4 inline-flex rounded-2xl bg-red-50 p-4 text-red-600 transition-transform group-hover:scale-110">
                <Hammer className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Renovasi</h3>
              <p className="mt-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Perbaikan & Pembaruan</p>
            </button>
            <button
              onClick={() => router.push(`/dc-development/documents/${selectedArchiveForType?.id}/PERLUASAN`)}
              className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-100 bg-white p-8 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-red-500 hover:shadow-xl focus:outline-none"
            >
              <div className="mb-4 inline-flex rounded-2xl bg-red-50 p-4 text-red-600 transition-transform group-hover:scale-110">
                <Maximize className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Perluasan</h3>
              <p className="mt-2 text-xs font-medium text-slate-500 uppercase tracking-wider">Penambahan Area</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* NOTES MODAL */}
      <Dialog open={!!selectedArchiveForNotes} onOpenChange={(open) => !open && setSelectedArchiveForNotes(null)}>
        <DialogContent className="max-w-4xl overflow-hidden rounded-2xl border-0 bg-slate-50 p-0 shadow-2xl">
          <div className="bg-white px-6 py-5 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
              <MessageSquare className="h-5 w-5 text-red-500" />
              Catatan Proyek
            </DialogTitle>
            <DialogDescription className="mt-1 font-medium text-slate-500">
              {selectedArchiveForNotes?.archive_name} - {selectedArchiveForNotes?.branch_name}
            </DialogDescription>
          </div>
          <div className="max-h-[68vh] overflow-y-auto p-6">
            {loadingNotes ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center text-slate-400">
                <Loader2 className="mb-4 h-8 w-8 animate-spin text-red-500" />
                <p className="font-medium">Memuat catatan...</p>
              </div>
            ) : groupedProjectNotes.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center text-slate-400">
                <FileText className="mb-4 h-12 w-12 opacity-20" />
                <p className="font-medium">Belum ada catatan pada proyek ini.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedProjectNotes.map(stageGroup => (
                  <section key={stageGroup.stageKey} className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                          <Files className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-black uppercase tracking-tight text-slate-900">{stageGroup.stageLabel}</h3>
                          <p className="text-xs font-semibold text-slate-500">{stageGroup.total} catatan pada tahap ini</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="rounded-lg border-red-100 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                        {stageGroup.stageKey}
                      </Badge>
                    </div>

                    <div className="space-y-3 border-l border-slate-200 pl-4">
                      {stageGroup.categories.map(categoryGroup => (
                        <div key={`${stageGroup.stageKey}-${categoryGroup.category}`} className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            <Tag className="h-4 w-4 text-red-500" />
                            {categoryGroup.category}
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{categoryGroup.notes.length}</span>
                          </div>
                          <div className="grid gap-2">
                            {categoryGroup.notes
                              .sort((a, b) => (b.isCategoryNote ? 1 : 0) - (a.isCategoryNote ? 1 : 0))
                              .map(item => (
                              <article key={item.note.id} className={`rounded-xl border p-4 shadow-sm ${item.isCategoryNote ? 'border-red-200 bg-gradient-to-r from-red-50 to-white' : 'border-slate-200 bg-white'}`}>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <div className={`text-sm font-bold leading-snug ${item.isCategoryNote ? 'text-red-900' : 'text-slate-900'}`}>{item.itemTitle}</div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <Badge variant="outline" className={`rounded-md text-[10px] font-bold uppercase tracking-wider ${item.isCategoryNote ? 'border-red-200 bg-red-100 text-red-700' : 'bg-slate-50 text-slate-600'}`}>
                                        {item.format}
                                      </Badge>
                                      {!item.note.drive_file_id && !item.note.file_name && !item.isCategoryNote && (
                                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">Catatan saja</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className={`text-right text-[11px] font-semibold ${item.isCategoryNote ? 'text-red-400' : 'text-slate-400'}`}>
                                    {new Date(item.note.created_at || "").toLocaleDateString("id-ID")}
                                  </div>
                                </div>
                                <div className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium leading-relaxed ${item.isCategoryNote ? 'bg-red-100/50 text-red-800' : 'bg-slate-50 text-slate-700'}`}>
                                  {item.note.notes}
                                </div>
                                <div className="mt-2 text-[11px] font-medium text-slate-400">
                                  Oleh: {item.note.created_by_email || item.note.uploaded_by_email || "Unknown"}
                                </div>
                              </article>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end border-t border-slate-100 bg-white p-4">
            <Button variant="outline" className="rounded-xl font-medium" onClick={() => setSelectedArchiveForNotes(null)}>Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  tone = "slate",
  progress,
  icon,
  filled = false,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  tone?: "slate" | "red" | "green" | "amber";
  progress?: number;
  icon?: React.ReactNode;
  filled?: boolean;
}) {
  const isRed = tone === "red";
  const isGreen = tone === "green";
  const isAmber = tone === "amber";

  const iconBg = isGreen ? 'bg-emerald-100 text-emerald-600' : isAmber ? 'bg-amber-100 text-amber-600' : isRed ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500';
  const valColor = isGreen ? 'text-emerald-700' : isAmber ? 'text-amber-700' : isRed ? 'text-red-700' : 'text-slate-800';

  return (
    <div className={`group relative overflow-hidden rounded-[1.25rem] border p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
      filled
        ? isRed ? 'border-red-500 bg-gradient-to-br from-red-600 to-red-700 text-white shadow-red-200' : 'bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-700'
        : 'border-white/60 bg-white/80 backdrop-blur-xl shadow-lg shadow-slate-200/40'
    }`}>
      {/* Decorative gradient blur blob on hover */}
      {!filled && (
        <div className={`absolute -right-6 -top-6 h-28 w-28 rounded-full blur-3xl transition-opacity duration-500 opacity-0 group-hover:opacity-20 ${
          isGreen ? 'bg-emerald-500' : isAmber ? 'bg-amber-500' : isRed ? 'bg-red-500' : 'bg-slate-500'
        }`} />
      )}
      
      <div className="relative z-10 flex h-full flex-col justify-between gap-4">
        <div className="flex items-start justify-between">
          <p className={`text-[11px] font-bold uppercase tracking-widest ${filled ? 'text-white/80' : 'text-slate-500'}`}>
            {title}
          </p>
          {icon && (
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${
              filled ? 'bg-white/20 text-white backdrop-blur-md' : iconBg
            }`}>
              {icon}
            </div>
          )}
        </div>
        
        <div>
          <h3 className={`text-3xl font-black tracking-tight drop-shadow-sm ${filled ? 'text-white' : valColor}`}>
            {value}
          </h3>
          {subtitle && (
            <p className={`mt-1.5 text-xs font-medium ${filled ? 'text-white/70' : 'text-slate-500'}`}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      
      {progress !== undefined && (
        <div className="relative z-10 mt-5 h-2 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ease-out ${
              isGreen ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : isAmber ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-red-400 to-red-500'
            }`} 
            style={{ width: `${progress}%` }} 
          />
        </div>
      )}
    </div>
  );
}
