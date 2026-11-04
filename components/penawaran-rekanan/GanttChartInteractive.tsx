"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Undo2,
  Redo2,
  Save,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  Link2,
  Loader2,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  X,
  Check,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import GanttDependencyLines from "./GanttDependencyLines";

interface GanttProps {
  penawaran: any;
  totalDays?: number;
  readOnly?: boolean;
}

interface ScheduleItem {
  start: number; // 1-based (Hari 1..N)
  duration: number; // Jumlah hari
}

interface Dependency {
  predecessor_id: number;
  successor_id: number;
}

export type GanttRow =
  | {
    type: "SCOPE";
    id: string; // e.g. "SCOPE-SIPIL"
    scope: "SIPIL" | "ME";
    title: string;
    itemCount: number;
  }
  | {
    type: "CATEGORY";
    id: string; // e.g. "CAT-SIPIL-PEKERJAAN_PERSIAPAN"
    scope: "SIPIL" | "ME";
    categoryName: string;
    itemCount: number;
  }
  | {
    type: "ITEM";
    id: number; // it.id (number)
    rowKey: string; // "ITEM-12"
    scope: "SIPIL" | "ME";
    categoryName: string;
    item: any;
  };

export default function GanttChartInteractive({
  penawaran,
  totalDays = 30,
  readOnly = false,
}: GanttProps) {
  const router = useRouter();
  const maxDays = Math.max(totalDays, penawaran.durasi_pekerjaan_hari || 30, 30);
  const items = useMemo(() => penawaran.items || [], [penawaran.items]);

  const [dayWidth, setDayWidth] = useState(38); // Lebar kolom hari dalam px

  // Struktur hirarki berjenjang: Lingkup (SIPIL / ME) -> Kategori Pekerjaan -> Nama Item
  const ganttRows = useMemo<GanttRow[]>(() => {
    const rows: GanttRow[] = [];

    const sipilItems = items.filter(
      (it: any) => (it.lingkup || "SIPIL").toUpperCase() === "SIPIL"
    );
    const meItems = items.filter(
      (it: any) => (it.lingkup || "").toUpperCase() === "ME"
    );

    const groupByCategory = (scopeItems: any[]) => {
      const catMap = new Map<string, any[]>();
      scopeItems.forEach((it) => {
        const cat = (it.kategori_pekerjaan || "PEKERJAAN LAINNYA").trim();
        if (!catMap.has(cat)) catMap.set(cat, []);
        catMap.get(cat)!.push(it);
      });
      return catMap;
    };

    // 1. SEKSI A: PEKERJAAN SIPIL
    if (sipilItems.length > 0) {
      rows.push({
        type: "SCOPE",
        id: "SCOPE-SIPIL",
        scope: "SIPIL",
        title: "Pekerjaan Sipil",
        itemCount: sipilItems.length,
      });

      const sipilCatMap = groupByCategory(sipilItems);
      sipilCatMap.forEach((catItems, catName) => {
        rows.push({
          type: "CATEGORY",
          id: `CAT-SIPIL-${catName}`,
          scope: "SIPIL",
          categoryName: catName,
          itemCount: catItems.length,
        });

        catItems.forEach((it) => {
          rows.push({
            type: "ITEM",
            id: it.id,
            rowKey: `ITEM-${it.id}`,
            scope: "SIPIL",
            categoryName: catName,
            item: it,
          });
        });
      });
    }

    // 2. SEKSI B: PEKERJAAN ME
    if (meItems.length > 0) {
      rows.push({
        type: "SCOPE",
        id: "SCOPE-ME",
        scope: "ME",
        title: "Pekerjaan Mekanikal & Elektrikal (ME)",
        itemCount: meItems.length,
      });

      const meCatMap = groupByCategory(meItems);
      meCatMap.forEach((catItems, catName) => {
        rows.push({
          type: "CATEGORY",
          id: `CAT-ME-${catName}`,
          scope: "ME",
          categoryName: catName,
          itemCount: catItems.length,
        });

        catItems.forEach((it) => {
          rows.push({
            type: "ITEM",
            id: it.id,
            rowKey: `ITEM-${it.id}`,
            scope: "ME",
            categoryName: catName,
            item: it,
          });
        });
      });
    }

    return rows;
  }, [items]);

  // Perhitungan tinggi baris & offset vertikal
  const rowHeights = useMemo(() => {
    return ganttRows.map((r) => {
      if (r.type === "SCOPE") return 36;
      if (r.type === "CATEGORY") return 32;
      return 44;
    });
  }, [ganttRows]);

  const rowYOffsets = useMemo(() => {
    const offsets: number[] = [];
    let currentY = 0;
    for (let i = 0; i < rowHeights.length; i++) {
      offsets.push(currentY);
      currentY += rowHeights[i];
    }
    return offsets;
  }, [rowHeights]);

  // Inisialisasi schedule: Hanya ambil yang sudah tersimpan di database.
  // DEFAULT NYA TIDAK ADA (KOSONG), user menentukan sendiri dengan drag di timeline!
  const initialSchedule = useMemo(() => {
    const map: Record<number, ScheduleItem> = {};
    items.forEach((it: any) => {
      const g = penawaran.gantt_items?.find((gi: any) => gi.item_id === it.id);
      if (g && g.start_day && g.duration_days) {
        map[it.id] = { start: g.start_day, duration: g.duration_days };
      }
    });
    return map;
  }, [items, penawaran.gantt_items]);

  const initialDependencies = useMemo(() => {
    return (penawaran.dependencies || [])
      .filter((d: any) => {
        const pred = items.find((i: any) => i.id === d.predecessor_id);
        const succ = items.find((i: any) => i.id === d.successor_id);
        if (!pred || !succ) return false;
        // Hanya muat keterikatan jika kedua item dalam lingkup yang sama (Sipil ke Sipil, atau ME ke ME)
        return (pred.lingkup || "SIPIL").toUpperCase() === (succ.lingkup || "SIPIL").toUpperCase();
      })
      .map((d: any) => ({
        predecessor_id: d.predecessor_id,
        successor_id: d.successor_id,
      }));
  }, [penawaran.dependencies, items]);

  const [schedule, setSchedule] = useState<Record<number, ScheduleItem>>(initialSchedule);
  const [dependencies, setDependencies] = useState<Dependency[]>(initialDependencies);

  // History Stack untuk Undo (Ctrl+Z) / Redo (Ctrl+Y) terintegrasi aman
  const [history, setHistory] = useState<{
    entries: { schedule: Record<number, ScheduleItem>; deps: Dependency[] }[];
    index: number;
  }>({
    entries: [{ schedule: initialSchedule, deps: initialDependencies }],
    index: 0,
  });

  // State Interaksi Drag Bar & Resize
  const [dragging, setDragging] = useState<{
    itemId: number;
    mode: "MOVE" | "RESIZE_LEFT" | "RESIZE_RIGHT";
    initialMouseX: number;
    initialStart: number;
    initialDuration: number;
  } | null>(null);

  // State Drag-to-Create Schedule Bar di Grid Timeline
  const [creatingSchedule, setCreatingSchedule] = useState<{
    itemId: number;
    startDay: number;
    currentDay: number;
  } | null>(null);

  // Modal Input Manual Angka (Quick Set)
  const [quickModalItem, setQuickModalItem] = useState<{
    item: any;
    start: number;
    duration: number;
  } | null>(null);

  // State Penarikan Keterikatan
  const [connectingSourceId, setConnectingSourceId] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [hoverTargetItemId, setHoverTargetItemId] = useState<number | null>(null);

  const connectingItem = useMemo(
    () => items.find((i: any) => i.id === connectingSourceId),
    [items, connectingSourceId]
  );
  const connectingScope = connectingItem ? (connectingItem.lingkup || "SIPIL").toUpperCase() : null;

  // State Pop-up Konfirmasi Keterikatan
  const [confirmDependency, setConfirmDependency] = useState<{
    predecessor: any;
    successor: any;
  } | null>(null);

  const [savingDraft, setSavingDraft] = useState(false);
  const [proceeding, setProceeding] = useState(false);

  const [feedback, setFeedback] = useState<{
    isOpen: boolean;
    type: "success" | "error" | "warning";
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: "success",
    title: "",
    message: "",
  });

  const canvasRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const recordHistory = useCallback(
    (newSchedule: Record<number, ScheduleItem>, newDeps: Dependency[]) => {
      setHistory((prev) => {
        const validIndex = Math.max(0, Math.min(prev.index, prev.entries.length - 1));
        const newEntries = prev.entries.slice(0, validIndex + 1);
        const current = { schedule: newSchedule, deps: newDeps };
        return {
          entries: [...newEntries, current],
          index: newEntries.length,
        };
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    setHistory((prev) => {
      if (prev.index <= 0 || prev.entries.length <= 1) return prev;
      const targetIndex = prev.index - 1;
      const target = prev.entries[targetIndex];
      if (!target || !target.schedule) return prev;

      setSchedule(target.schedule);
      setDependencies(target.deps);
      return {
        ...prev,
        index: targetIndex,
      };
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistory((prev) => {
      if (prev.index >= prev.entries.length - 1) return prev;
      const targetIndex = prev.index + 1;
      const target = prev.entries[targetIndex];
      if (!target || !target.schedule) return prev;

      setSchedule(target.schedule);
      setDependencies(target.deps);
      return {
        ...prev,
        index: targetIndex,
      };
    });
  }, []);

  // Shortcut Global Keyboard Listener
  useEffect(() => {
    if (readOnly) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // Jangan intersep shortcut jika user sedang fokus mengetik di field input / textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || e.key === "Y" || (e.shiftKey && (e.key === "z" || e.key === "Z")))
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "Escape") {
        setConnectingSourceId(null);
        setMousePos(null);
        setHoverTargetItemId(null);
        setConfirmDependency(null);
        setQuickModalItem(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readOnly, handleUndo, handleRedo]);

  // Pointer move & up listener untuk Drag-to-Create, Drag-to-Move/Resize, dan Rubberband line
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      // 1. keterikatan rubberband: ikuti posisi kursor presisi terhadap canvas timeline
      if (connectingSourceId && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }

      // 2. Drag to create schedule bar
      if (creatingSchedule && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const dayAtMouse = Math.max(1, Math.min(maxDays, Math.floor(mouseX / dayWidth) + 1));
        setCreatingSchedule((prev) => (prev ? { ...prev, currentDay: dayAtMouse } : null));
        return;
      }

      // 3. Drag move or resize bar
      if (!dragging) return;

      const deltaX = e.clientX - dragging.initialMouseX;
      const deltaDays = Math.round(deltaX / dayWidth);

      if (deltaDays === 0) return;

      setSchedule((prev) => {
        const current = prev[dragging.itemId];
        if (!current) return prev;

        let newStart = dragging.initialStart;
        let newDuration = dragging.initialDuration;

        if (dragging.mode === "MOVE") {
          newStart = Math.max(1, Math.min(dragging.initialStart + deltaDays, maxDays - current.duration + 1));
        } else if (dragging.mode === "RESIZE_RIGHT") {
          newDuration = Math.max(1, Math.min(dragging.initialDuration + deltaDays, maxDays - current.start + 1));
        } else if (dragging.mode === "RESIZE_LEFT") {
          const maxLeftShift = dragging.initialDuration - 1;
          const shift = Math.min(deltaDays, maxLeftShift);
          newStart = Math.max(1, dragging.initialStart + shift);
          newDuration = dragging.initialDuration - (newStart - dragging.initialStart);
        }

        return {
          ...prev,
          [dragging.itemId]: { start: newStart, duration: newDuration },
        };
      });
    };

    const onPointerUp = () => {
      // Selesaikan Drag-to-Create
      if (creatingSchedule) {
        const s = Math.min(creatingSchedule.startDay, creatingSchedule.currentDay);
        const e = Math.max(creatingSchedule.startDay, creatingSchedule.currentDay);
        const dur = e - s + 1;
        const next = {
          ...schedule,
          [creatingSchedule.itemId]: { start: s, duration: dur },
        };
        setSchedule(next);
        recordHistory(next, dependencies);
        setCreatingSchedule(null);
      }

      // Selesaikan Drag Move / Resize
      if (dragging) {
        recordHistory(schedule, dependencies);
        setDragging(null);
      }

      // Jika sedang menarik tali dan dilepas di atas item target yang valid
      if (connectingSourceId && hoverTargetItemId && hoverTargetItemId !== connectingSourceId) {
        triggerConfirmConnection(connectingSourceId, hoverTargetItemId);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragging, creatingSchedule, dayWidth, maxDays, schedule, dependencies, connectingSourceId, hoverTargetItemId]);

  // Koordinat Item untuk SVG Dependency Renderer (dihitung presisi berdasarkan rowYOffsets)
  const itemCoordinates = useMemo(() => {
    const coords: Record<number, { x: number; y: number; width: number; height: number }> = {};
    ganttRows.forEach((r, idx) => {
      if (r.type === "ITEM") {
        const it = r.item;
        const s = schedule[it.id];
        if (s && s.start > 0 && s.duration > 0) {
          coords[it.id] = {
            x: (s.start - 1) * dayWidth,
            y: rowYOffsets[idx] + 8,
            width: s.duration * dayWidth,
            height: 28,
          };
        }
      }
    });
    return coords;
  }, [ganttRows, rowYOffsets, schedule, dayWidth]);

  // Pemicu Pop-up Konfirmasi Keterikatan
  const triggerConfirmConnection = (predecessorId: number, successorId: number) => {
    if (predecessorId === successorId) return;

    const pred = items.find((i: any) => i.id === predecessorId);
    const succ = items.find((i: any) => i.id === successorId);

    if (!pred || !succ) {
      setConnectingSourceId(null);
      setHoverTargetItemId(null);
      setMousePos(null);
      return;
    }

    const predScope = (pred.lingkup || "SIPIL").toUpperCase();
    const succScope = (succ.lingkup || "SIPIL").toUpperCase();

    // Aturan SOP SPARTA: Keterikatan TIDAK BISA dibuat antara item Sipil dan item ME (wajib satu lingkup yang sama)
    if (predScope !== succScope) {
      setFeedback({
        isOpen: true,
        type: "warning",
        title: "Keterikatan Berbeda Lingkup Dilarang",
        message: `Pekerjaan ${predScope === "SIPIL" ? "Sipil" : "ME"} ("${pred.deskripsi}") tidak dapat memiliki keterikatan dengan Pekerjaan ${succScope === "SIPIL" ? "Sipil" : "ME"} ("${succ.deskripsi}"). keterikatan hanya dapat dibuat antar sesama item pekerjaan dalam lingkup yang sama (Sipil ke Sipil, atau ME ke ME).`,
      });
      setConnectingSourceId(null);
      setHoverTargetItemId(null);
      setMousePos(null);
      return;
    }

    const exists = dependencies.some(
      (d) => d.predecessor_id === predecessorId && d.successor_id === successorId
    );

    if (exists) {
      setFeedback({
        isOpen: true,
        type: "warning",
        title: "Keterikatan Sudah Terdaftar",
        message: `Pekerjaan "${pred.deskripsi}" sudah terhubung sebagai pendahulu untuk "${succ.deskripsi}".`,
      });
      setConnectingSourceId(null);
      setHoverTargetItemId(null);
      setMousePos(null);
      return;
    }

    // Buka Pop-up Konfirmasi Keterikatan
    setConfirmDependency({
      predecessor: pred,
      successor: succ,
    });

    setConnectingSourceId(null);
    setHoverTargetItemId(null);
    setMousePos(null);
  };

  const handleDeleteDependency = (predId: number, succId: number) => {
    const pred = items.find((i: any) => i.id === predId);
    const succ = items.find((i: any) => i.id === succId);

    const nextDeps = dependencies.filter(
      (d) => !(d.predecessor_id === predId && d.successor_id === succId)
    );
    setDependencies(nextDeps);
    recordHistory(schedule, nextDeps);

    setFeedback({
      isOpen: true,
      type: "success",
      title: "Keterikatan Dihapus",
      message: `keterikatan antara "${pred?.deskripsi || "Pekerjaan A"}" dan "${succ?.deskripsi || "Pekerjaan B"}" telah dilepaskan.`,
    });
  };

  // Hapus / Reset Jadwal suatu item kembali ke kosong
  const handleRemoveItemSchedule = (itemId: number) => {
    const nextSched = { ...schedule };
    delete nextSched[itemId];
    const nextDeps = dependencies.filter(
      (d) => d.predecessor_id !== itemId && d.successor_id !== itemId
    );
    setSchedule(nextSched);
    setDependencies(nextDeps);
    recordHistory(nextSched, nextDeps);
  };

  // Terapkan Jadwal dari Modal Quick-Set
  const handleApplyQuickModal = () => {
    if (!quickModalItem) return;
    const start = Math.max(1, Math.min(maxDays, quickModalItem.start || 1));
    const duration = Math.max(1, Math.min(maxDays - start + 1, quickModalItem.duration || 1));

    const nextSched = {
      ...schedule,
      [quickModalItem.item.id]: { start, duration },
    };
    setSchedule(nextSched);
    recordHistory(nextSched, dependencies);
    setQuickModalItem(null);
  };

  // Rubberband line saat user sedang menarik tali (dari Tengah Bawah)
  const activeConnectingLine = useMemo(() => {
    if (!connectingSourceId || !mousePos) return null;
    const fromCoord = itemCoordinates[connectingSourceId];
    if (!fromCoord) return null;
    return {
      startX: fromCoord.x + fromCoord.width / 2,
      startY: fromCoord.y + fromCoord.height,
      currentX: mousePos.x,
      currentY: mousePos.y,
    };
  }, [connectingSourceId, mousePos, itemCoordinates]);

  // Simpan data Gantt ke backend
  const saveGanttToServer = async (targetStatus?: string) => {
    // Hanya kirim item yang benar-benar sudah memiliki jadwal (start > 0 & duration > 0)
    const scheduledEntries = Object.entries(schedule).filter(
      ([_, s]) => s && s.start > 0 && s.duration > 0
    );

    const ganttItemsPayload = scheduledEntries.map(([itemIdStr, s]) => ({
      item_id: parseInt(itemIdStr, 10),
      start_day: s.start,
      duration_days: s.duration,
    }));

    const res = await fetch(`/api/dc-development/penawaran-rekanan/${penawaran.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(targetStatus ? { status: targetStatus } : {}),
        gantt_items: ganttItemsPayload,
        dependencies: dependencies,
      }),
    });
    return await res.json();
  };

  const handleSaveDraft = async () => {
    try {
      setSavingDraft(true);
      const json = await saveGanttToServer("DRAFT");
      if (json.status === "success") {
        setFeedback({
          isOpen: true,
          type: "success",
          title: "Draft Jadwal Disimpan",
          message: "Jadwal Gantt Chart dan keterikatan pekerjaan berhasil disimpan.",
        });
      } else {
        setFeedback({
          isOpen: true,
          type: "error",
          title: "Gagal Menyimpan Draft",
          message: json.message || "Gagal menyimpan jadwal draft ke server.",
        });
      }
    } catch (e: any) {
      setFeedback({
        isOpen: true,
        type: "error",
        title: "Error Server",
        message: e.message,
      });
    } finally {
      setSavingDraft(false);
    }
  };

  const scheduledCount = items.filter((it: any) => schedule[it.id] && schedule[it.id].start > 0).length;
  const unscheduledCount = items.length - scheduledCount;

  const handleProceedReview = async () => {
    // Validasi ketat: Seluruh item pekerjaan wajib memiliki jadwal sebelum review final
    if (unscheduledCount > 0) {
      setFeedback({
        isOpen: true,
        type: "warning",
        title: "Jadwal Belum Lengkap",
        message: `Terdapat ${unscheduledCount} dari ${items.length} pekerjaan yang belum dijadwalkan pada Gantt Chart. Silakan tentukan jadwal (drag di timeline) untuk seluruh item pekerjaan sebelum melanjutkan ke review final.`,
      });
      return;
    }

    try {
      setProceeding(true);
      const json = await saveGanttToServer();
      if (json.status === "success") {
        router.push(`/dc-development/penawaran-rekanan/${penawaran.id}/review-gantt`);
      } else {
        setFeedback({
          isOpen: true,
          type: "error",
          title: "Gagal Melanjutkan",
          message: json.message || "Gagal menyimpan perubahan sebelum ke review.",
        });
      }
    } catch (e: any) {
      setFeedback({
        isOpen: true,
        type: "error",
        title: "Error Server",
        message: e.message,
      });
    } finally {
      setProceeding(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Petunjuk Penggunaan Gantt Tanpa Default */}
      {readOnly ? (
        <div className="bg-orange-50/70 border border-orange-200/80 rounded-2xl p-3.5 text-xs text-orange-950 flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-[#E65F2B] shrink-0" />
            <span>
              <strong className="text-orange-900">Jadwal Pelaksanaan Proyek:</strong></span>
          </div>
          <div className="flex items-center space-x-2 font-mono text-[11px] shrink-0">
            <span className="bg-white px-2.5 py-1 rounded-lg border border-orange-200 font-bold text-slate-800">
              Total Terjadwal: {scheduledCount}/{items.length} Item
            </span>
            <span className="bg-orange-100 text-[#E65F2B] border border-orange-200 px-2.5 py-1 rounded-lg font-bold">
              {dependencies.length} Keterikatan
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-orange-50/70 border border-orange-200/80 rounded-2xl p-3.5 text-xs text-orange-950 flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-[#E65F2B] shrink-0" />
            <span>
              <strong className="text-orange-900">Cara Mengatur Jadwal:</strong> Klik dan tarik (*drag*) mouse pada kotak hari di timeline untuk menentukan jadwal hari mulai dan durasi pekerjaan.
            </span>
          </div>
          <div className="flex items-center space-x-2 font-mono text-[11px] shrink-0">
            <span className="bg-white px-2 py-0.5 rounded-lg border border-orange-200 font-bold text-slate-800">
              Terjadwal: {scheduledCount}/{items.length}
            </span>
            {unscheduledCount > 0 && (
              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-lg font-bold">
                {unscheduledCount} Belum Dijadwalkan
              </span>
            )}
          </div>
        </div>
      )}

      {/* Control Bar Atas SPARTA */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          {!readOnly && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={history.index <= 0}
                onClick={handleUndo}
                className="h-8 px-2.5 rounded-xl border-slate-200 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                title="Urungkan perubahan terakhir (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5 mr-1 text-slate-600" />
                Undo <span className="text-[10px] text-slate-400 font-mono ml-1">Ctrl+Z</span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={history.index >= history.entries.length - 1}
                onClick={handleRedo}
                className="h-8 px-2.5 rounded-xl border-slate-200 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                title="Ulangi perubahan (Ctrl+Y)"
              >
                <Redo2 className="w-3.5 h-3.5 mr-1 text-slate-600" />
                Redo <span className="text-[10px] text-slate-400 font-mono ml-1">Ctrl+Y</span>
              </Button>

              <div className="h-5 w-[1px] bg-slate-200 mx-1" />
            </>
          )}

          {/* Zoom In / Out Buttons */}
          <div className="flex items-center space-x-1 bg-slate-100 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setDayWidth((w) => Math.max(26, w - 4))}
              className="p-1 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Perkecil Timeline"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1 text-slate-600">{dayWidth}px</span>
            <button
              type="button"
              onClick={() => setDayWidth((w) => Math.min(60, w + 4))}
              className="p-1 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Perbesar Timeline"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {!readOnly && (
            <>
              {/* Petunjuk Tarik Tali */}
              {connectingSourceId ? (
                <div className="bg-orange-100 border border-orange-300 text-[#E65F2B] px-3 py-1 rounded-xl text-xs font-semibold flex items-center animate-pulse">
                  <Link2 className="w-3.5 h-3.5 mr-1.5" />
                  Mode Tarik Tali (Lingkup {connectingScope}): Klik pin tengah atas sesama pekerjaan {connectingScope}
                  <button
                    type="button"
                    onClick={() => {
                      setConnectingSourceId(null);
                      setMousePos(null);
                      setHoverTargetItemId(null);
                    }}
                    className="ml-2 text-slate-600 hover:text-slate-900 text-[10px] underline font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <div className="hidden lg:flex items-center text-[11px] text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">
                  <HelpCircle className="w-3 h-3 mr-1 text-slate-400" />
                  Tarik tali dari pin tengah bawah ke tengah atas (khusus sesama lingkup Sipil atau sesama ME)
                </div>
              )}
            </>
          )}
        </div>

        {/* Simpan Draft / Badge Read Only */}
        <div className="flex items-center space-x-3">
          {readOnly ? (
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/80 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                View Gantchart
              </span>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={savingDraft}
              onClick={handleSaveDraft}
              className="border-slate-300 text-slate-700 rounded-xl text-xs h-8 px-3.5 font-medium hover:bg-slate-50 cursor-pointer"
            >
              {savingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Simpan Draft Jadwal
            </Button>
          )}
        </div>
      </div>

      {/* Mesin Gantt Chart Canvas SPARTA */}
      {/* 
        SOLUSI OVERLAP / TEMBUS:
        - Kolom kiri: sticky left-0 z-30 bg-white (solid 100%, TANPA alpha) dengan shadow pembatas tebal
        - Header kiri atas: sticky top-0 left-0 z-40 bg-slate-100
        - Header timeline hari: sticky top-0 z-20 bg-slate-50
        - Bar jadwal timeline: z-10
        Dengan struktur ini, saat timeline di-scroll ke kiri, seluruh bar dan angka hari meluncur MULUS di belakang kolom kiri tanpa pernah tembus!
      */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto relative flex">
          {/* Kolom Kiri: Sumbu Y (Daftar Pekerjaan Berjenjang WBS) */}
          <div className="w-84 sm:w-96 flex-shrink-0 sticky left-0 z-30 bg-white border-r border-slate-200 shadow-[4px_0_12px_rgba(0,0,0,0.06)] select-none">
            {/* Header Sudut Kiri Atas */}
            <div className="h-10 border-b border-slate-200 flex items-center justify-between px-4 font-bold text-slate-700 text-xs bg-slate-100 sticky top-0 z-40">
              <span>Item Uraian Pekerjaan</span>
              <span className="text-[10px] text-slate-400 font-normal">H(Mulai - Selesai)</span>
            </div>

            {/* Baris-Baris Kiri: Lockstep dengan ganttRows */}
            <div>
              {ganttRows.map((r, rowIdx) => {
                if (r.type === "SCOPE") {
                  return (
                    <div
                      key={r.id}
                      style={{ height: rowHeights[rowIdx] }}
                      className="px-3 bg-slate-100/95 border-b border-slate-200 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span
                          className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-white shrink-0 ${r.scope === "SIPIL" ? "bg-[#E65F2B]" : "bg-orange-600"
                            }`}
                        >
                          {r.scope === "SIPIL" ? "A" : "B"}
                        </span>
                        <span className="font-bold text-slate-800 text-xs uppercase tracking-wide truncate">
                          {r.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
                        {r.itemCount} Item
                      </span>
                    </div>
                  );
                }

                if (r.type === "CATEGORY") {
                  return (
                    <div
                      key={r.id}
                      style={{ height: rowHeights[rowIdx] }}
                      className="pl-7 pr-3 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-1.5 truncate">
                        <span className="text-slate-400 text-xs">📁</span>
                        <span className="font-semibold text-slate-700 text-[11px] truncate uppercase tracking-wider">
                          {r.categoryName}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {r.itemCount} Item
                      </span>
                    </div>
                  );
                }

                // Baris Item Pekerjaan
                const it = r.item;
                const s = schedule[it.id];
                const endDay = s ? s.start + s.duration - 1 : null;

                return (
                  <div
                    key={r.rowKey}
                    style={{ height: rowHeights[rowIdx] }}
                    className="pl-9 pr-3 bg-white border-b border-slate-100 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="truncate mr-2">
                      <div className="font-medium text-slate-800 text-[11px] truncate" title={it.deskripsi}>
                        {it.deskripsi}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center space-x-1.5">
                        <span className="font-medium text-slate-500">{it.volume} {it.satuan}</span>
                      </div>
                    </div>

                    {s ? (
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <span className="text-[10px] font-mono font-semibold bg-orange-50 text-[#E65F2B] border border-orange-200 px-1.5 py-0.5 rounded">
                          H{s.start} - H{endDay} ({s.duration}h)
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemSchedule(it.id)}
                            className="text-slate-300 hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer"
                            title="Hapus / Reset Jadwal Item Ini"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : readOnly ? (
                      <span className="flex-shrink-0 text-[10px] text-slate-400 italic">
                        Belum dijadwalkan
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setQuickModalItem({ item: it, start: 1, duration: 3 })}
                        className="flex-shrink-0 text-[10px] text-slate-400 hover:text-[#E65F2B] bg-slate-50 hover:bg-orange-50 border border-dashed border-slate-300 hover:border-[#E65F2B] px-2 py-0.5 rounded transition-colors font-medium cursor-pointer"
                        title="Klik untuk memasukkan jadwal secara manual"
                      >
                        + Set Jadwal
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kolom Kanan: Sumbu X (Timeline Hari) & Interactive Canvas */}
          <div
            ref={canvasRef}
            className="flex-1 relative select-none"
            style={{ minWidth: maxDays * dayWidth }}
          >
            {/* Header Sumbu X: Hari H1..Hmax */}
            <div className="h-10 border-b border-slate-200 flex bg-slate-50 sticky top-0 z-20">
              {Array.from({ length: maxDays }).map((_, d) => (
                <div
                  key={d}
                  style={{ width: dayWidth }}
                  className="flex-shrink-0 flex items-center justify-center text-[10px] font-mono font-semibold text-slate-600 border-r border-slate-200/60"
                >
                  H{d + 1}
                </div>
              ))}
            </div>

            {/* Baris-Baris Timeline: Lockstep dengan ganttRows */}
            <div ref={timelineRef} className="relative">
              {/* Kurva Keterikatan (Dependencies) */}
              <GanttDependencyLines
                dependencies={dependencies}
                itemCoordinates={itemCoordinates}
                onDeleteDependency={readOnly ? undefined : handleDeleteDependency}
                activeConnectingLine={readOnly ? null : activeConnectingLine}
              />

              {ganttRows.map((r, rowIdx) => {
                if (r.type === "SCOPE") {
                  return (
                    <div
                      key={r.id}
                      style={{ height: rowHeights[rowIdx] }}
                      className="border-b border-slate-200 bg-slate-100/40 flex relative"
                    >
                      {Array.from({ length: maxDays }).map((_, d) => (
                        <div
                          key={d}
                          style={{ width: dayWidth }}
                          className="flex-shrink-0 border-r border-slate-200/40"
                        />
                      ))}
                    </div>
                  );
                }

                if (r.type === "CATEGORY") {
                  return (
                    <div
                      key={r.id}
                      style={{ height: rowHeights[rowIdx] }}
                      className="border-b border-slate-200/60 bg-slate-50/30 flex relative"
                    >
                      {Array.from({ length: maxDays }).map((_, d) => (
                        <div
                          key={d}
                          style={{ width: dayWidth }}
                          className="flex-shrink-0 border-r border-slate-100"
                        />
                      ))}
                    </div>
                  );
                }

                // Baris Item Pekerjaan di Timeline Canvas
                const it = r.item;
                const s = schedule[it.id];
                const isBeingCreated = creatingSchedule && creatingSchedule.itemId === it.id;

                let previewStart = 1;
                let previewEnd = 1;
                let previewDuration = 1;
                if (isBeingCreated) {
                  previewStart = Math.min(creatingSchedule.startDay, creatingSchedule.currentDay);
                  previewEnd = Math.max(creatingSchedule.startDay, creatingSchedule.currentDay);
                  previewDuration = previewEnd - previewStart + 1;
                }

                const barLeft = s ? (s.start - 1) * dayWidth : 0;
                const barWidth = s ? s.duration * dayWidth : 0;
                const itScope = (it.lingkup || "SIPIL").toUpperCase();
                const isSameScope = !connectingScope || itScope === connectingScope;
                const isConnectingTarget = connectingSourceId && connectingSourceId !== it.id && isSameScope;
                const isForbiddenScopeTarget = connectingSourceId && connectingSourceId !== it.id && !isSameScope;

                return (
                  <div
                    key={r.rowKey}
                    style={{ height: rowHeights[rowIdx] }}
                    className={`border-b border-slate-100 flex relative group ${!readOnly && isConnectingTarget
                      ? "bg-emerald-50/30 cursor-pointer"
                      : !readOnly && isForbiddenScopeTarget
                        ? "opacity-40 bg-slate-100/50 cursor-not-allowed"
                        : !readOnly && !s
                          ? "hover:bg-slate-50/30 cursor-crosshair"
                          : "hover:bg-slate-50/20"
                      }`}
                    onPointerEnter={() => {
                      if (!readOnly && connectingSourceId && connectingSourceId !== it.id && isSameScope) {
                        setHoverTargetItemId(it.id);
                      }
                    }}
                    onPointerLeave={() => {
                      if (!readOnly && hoverTargetItemId === it.id) {
                        setHoverTargetItemId(null);
                      }
                    }}
                    onPointerUp={(e) => {
                      if (!readOnly && connectingSourceId && connectingSourceId !== it.id) {
                        e.stopPropagation();
                        triggerConfirmConnection(connectingSourceId, it.id);
                      }
                    }}
                    onClick={(e) => {
                      if (!readOnly && connectingSourceId && connectingSourceId !== it.id) {
                        e.stopPropagation();
                        triggerConfirmConnection(connectingSourceId, it.id);
                      }
                    }}
                    onPointerDown={(e) => {
                      if (readOnly) return;
                      // Mulai drag-to-create hanya jika item ini belum memiliki jadwal dan tidak sedang connecting
                      if (!s && e.button === 0 && !connectingSourceId) {
                        if (timelineRef.current) {
                          const rect = timelineRef.current.getBoundingClientRect();
                          const clickX = e.clientX - rect.left;
                          const clickedDay = Math.max(1, Math.min(maxDays, Math.floor(clickX / dayWidth) + 1));
                          setCreatingSchedule({
                            itemId: it.id,
                            startDay: clickedDay,
                            currentDay: clickedDay,
                          });
                        }
                      }
                    }}
                  >
                    {/* Grid Kolom Hari Vertikal */}
                    {Array.from({ length: maxDays }).map((_, d) => (
                      <div
                        key={d}
                        style={{ width: dayWidth }}
                        className="flex-shrink-0 border-r border-slate-100"
                      />
                    ))}

                    {/* Hint placeholder saat hover jika belum ada jadwal */}
                    {!readOnly && !s && !isBeingCreated && !connectingSourceId && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                        <span className="text-[10px] text-slate-400 font-medium bg-white/95 border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs">
                          Klik &amp; tarik untuk menjadwalkan
                        </span>
                      </div>
                    )}

                    {/* Hint saat sedang mode menghubungkan keterikatan */}
                    {!readOnly && isConnectingTarget && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-15">
                        <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50/95 border border-emerald-300 px-2.5 py-0.5 rounded-full shadow-2xs">
                          Klik untuk hubungkan sebagai Successor
                        </span>
                      </div>
                    )}

                    {/* Preview Ghost Bar saat user sedang Drag-to-Create */}
                    {!readOnly && isBeingCreated && (
                      <div
                        style={{
                          left: (previewStart - 1) * dayWidth,
                          width: previewDuration * dayWidth,
                          top: 8,
                          height: 28,
                        }}
                        className="absolute bg-orange-400/80 border-2 border-dashed border-[#E65F2B] text-white rounded-xl shadow-xs flex items-center justify-center px-2 text-xs font-bold pointer-events-none z-20 animate-pulse"
                      >
                        H{previewStart} - H{previewEnd} ({previewDuration} Hari)
                      </div>
                    )}

                    {/* Bar Gantt Aktif jika item sudah dijadwalkan */}
                    {s && (
                      <div
                        style={{
                          left: barLeft,
                          width: barWidth,
                          top: 8,
                          height: 28,
                        }}
                        onPointerDown={(e) => {
                          if (readOnly) return;
                          e.stopPropagation();
                          if (connectingSourceId && connectingSourceId !== it.id) {
                            triggerConfirmConnection(connectingSourceId, it.id);
                            return;
                          }
                          // Drag move bar
                          if ((e.target as HTMLElement).tagName !== "BUTTON" && !connectingSourceId) {
                            setDragging({
                              itemId: it.id,
                              mode: "MOVE",
                              initialMouseX: e.clientX,
                              initialStart: s.start,
                              initialDuration: s.duration,
                            });
                          }
                        }}
                        onPointerUp={(e) => {
                          if (readOnly) return;
                          e.stopPropagation();
                          if (connectingSourceId && connectingSourceId !== it.id) {
                            triggerConfirmConnection(connectingSourceId, it.id);
                          }
                        }}
                        onClick={(e) => {
                          if (readOnly) return;
                          e.stopPropagation();
                          if (connectingSourceId && connectingSourceId !== it.id) {
                            triggerConfirmConnection(connectingSourceId, it.id);
                          }
                        }}
                        className={`absolute bg-gradient-to-r from-orange-500 via-[#E65F2B] to-orange-600 text-white rounded-xl shadow-2xs flex items-center justify-between px-2 text-xs font-semibold group z-10 border border-orange-600/60 transition-all ${readOnly
                          ? "cursor-default select-none"
                          : isConnectingTarget
                            ? "ring-4 ring-emerald-400 scale-[1.02] shadow-md cursor-pointer animate-pulse"
                            : isForbiddenScopeTarget
                              ? "opacity-50 cursor-not-allowed"
                              : "cursor-grab active:cursor-grabbing hover:shadow-xs"
                          }`}
                      >
                        {/* Anchor Pin Tengah Atas (Successor Target) */}
                        {!readOnly && (
                          <button
                            type="button"
                            onPointerUp={(e) => {
                              e.stopPropagation();
                              if (connectingSourceId && connectingSourceId !== it.id) {
                                triggerConfirmConnection(connectingSourceId, it.id);
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (connectingSourceId && connectingSourceId !== it.id) {
                                triggerConfirmConnection(connectingSourceId, it.id);
                              } else {
                                setFeedback({
                                  isOpen: true,
                                  type: "warning",
                                  title: "Petunjuk Keterikatan",
                                  message: "Pin Tengah Atas adalah target pekerjaan penerus (Successor). Untuk menghubungkan keterikatan, tarik tali dari Pin Bawah pekerjaan pendahulu terlebih dahulu.",
                                });
                              }
                            }}
                            className={`absolute -top-1.5 left-1/2 -translate-x-1/2 z-20 w-3.5 h-3.5 rounded-full bg-white border-2 border-orange-600 transition-all shadow-xs ${isConnectingTarget
                              ? "scale-125 ring-4 ring-emerald-400 bg-emerald-100 animate-bounce cursor-pointer"
                              : isForbiddenScopeTarget
                                ? "opacity-20 cursor-not-allowed hover:scale-100"
                                : "opacity-80 hover:opacity-100 hover:scale-125 cursor-pointer"
                              }`}
                            title={
                              isConnectingTarget
                                ? "Klik untuk hubungkan ke Pin Atas sebagai Successor"
                                : isForbiddenScopeTarget
                                  ? `Keterikatan dilarang: Item ini berada di lingkup berbeda (${itScope})`
                                  : "Pin Tengah Atas: Target Keterikatan (Successor)"
                            }
                          />
                        )}

                        {/* Left Resize Handle */}
                        {!readOnly && (
                          <div
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              if (!connectingSourceId) {
                                setDragging({
                                  itemId: it.id,
                                  mode: "RESIZE_LEFT",
                                  initialMouseX: e.clientX,
                                  initialStart: s.start,
                                  initialDuration: s.duration,
                                });
                              }
                            }}
                            className="w-2 h-full cursor-ew-resize opacity-60 hover:opacity-100 flex items-center justify-center shrink-0 -ml-1 cursor-pointer"
                            title="Tarik ke kiri/kanan untuk geser hari mulai"
                          >
                            <div className="w-0.5 h-3 bg-white/70 rounded-full" />
                          </div>
                        )}

                        {/* Label Durasi Tengah */}
                        <span className="truncate text-[10px] font-mono font-bold tracking-tight select-none px-1 text-center flex-1">
                          H{s.start} - H{s.start + s.duration - 1} ({s.duration}h)
                        </span>

                        {/* Anchor Pin Tengah Bawah (Predecessor Source) */}
                        {!readOnly && (
                          <button
                            type="button"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              setConnectingSourceId(it.id);
                              if (timelineRef.current) {
                                const rect = timelineRef.current.getBoundingClientRect();
                                setMousePos({
                                  x: e.clientX - rect.left,
                                  y: e.clientY - rect.top,
                                });
                              }
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (connectingSourceId === it.id) {
                                setConnectingSourceId(null);
                                setMousePos(null);
                              } else {
                                setConnectingSourceId(it.id);
                                if (timelineRef.current) {
                                  const rect = timelineRef.current.getBoundingClientRect();
                                  setMousePos({
                                    x: e.clientX - rect.left,
                                    y: e.clientY - rect.top,
                                  });
                                }
                              }
                            }}
                            className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 z-20 w-3.5 h-3.5 rounded-full bg-white border-2 border-orange-600 transition-all shadow-xs ${connectingSourceId === it.id
                              ? "scale-125 ring-4 ring-orange-300 bg-orange-100"
                              : "opacity-80 hover:opacity-100 hover:scale-125 cursor-pointer"
                              }`}
                            title="Pin Tengah Bawah: Tarik / Klik untuk menghubungkan keterikatan ke bawah (Predecessor)"
                          />
                        )}

                        {/* Right Resize Handle */}
                        {!readOnly && (
                          <div
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              if (!connectingSourceId) {
                                setDragging({
                                  itemId: it.id,
                                  mode: "RESIZE_RIGHT",
                                  initialMouseX: e.clientX,
                                  initialStart: s.start,
                                  initialDuration: s.duration,
                                });
                              }
                            }}
                            className="w-2 h-full cursor-ew-resize opacity-60 hover:opacity-100 flex items-center justify-center shrink-0 -mr-1 cursor-pointer"
                            title="Tarik ke kiri/kanan untuk menambah durasi"
                          >
                            <div className="w-0.5 h-3 bg-white/70 rounded-full" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Info & Navigasi */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3 text-xs text-slate-600 flex-wrap">
            <span className="font-medium">
              Terjadwal:{" "}
              <span className={`font-bold ${unscheduledCount === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {scheduledCount} dari {items.length} Pekerjaan
              </span>
            </span>
            <span>•</span>
            <span className="font-medium">
              Keterikatan:{" "}
              <span className={`font-bold ${dependencies.length > 0 ? "text-emerald-600" : "text-slate-500"}`}>
                {dependencies.length} Hubungan
              </span>
            </span>
          </div>

          {!readOnly && (
            <div className="flex items-center space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/dc-development/penawaran-rekanan/${penawaran.id}/review-penawaran`)}
                className="border-slate-300 text-slate-700 text-xs rounded-xl h-9 hover:bg-slate-50 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Kembali ke Review Finansial
              </Button>

              <Button
                type="button"
                disabled={proceeding}
                onClick={handleProceedReview}
                className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white rounded-xl text-xs h-9 px-5 shadow-xs font-semibold disabled:opacity-50"
              >
                {proceeding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Menyimpan...
                  </>
                ) : (
                  <>
                    Review Final Gantt & Penawaran
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Quick-Set Jadwal (Untuk User yang Ingin Memasukkan Angka Manual) */}
      {!readOnly && quickModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E65F2B]">
                  Atur Jadwal Pelaksanaan
                </span>
                <h4 className="font-bold text-slate-800 text-sm mt-0.5 truncate max-w-[240px]">
                  {quickModalItem.item.deskripsi}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setQuickModalItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Mulai Hari Ke (1 s/d {maxDays}):
                </label>
                <input
                  type="number"
                  min={1}
                  max={maxDays}
                  value={quickModalItem.start}
                  onChange={(e) =>
                    setQuickModalItem((prev) =>
                      prev ? { ...prev, start: parseInt(e.target.value) || 1 } : null
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-sm focus:ring-1 focus:ring-[#E65F2B] outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Durasi Pelaksanaan (Hari):
                </label>
                <input
                  type="number"
                  min={1}
                  max={maxDays - quickModalItem.start + 1}
                  value={quickModalItem.duration}
                  onChange={(e) =>
                    setQuickModalItem((prev) =>
                      prev ? { ...prev, duration: parseInt(e.target.value) || 1 } : null
                    )
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-sm focus:ring-1 focus:ring-[#E65F2B] outline-none"
                />
              </div>

              <div className="p-2.5 bg-orange-50/70 border border-orange-200/80 rounded-xl text-orange-900 text-[11px]">
                Jadwal: <strong>Hari ke-{quickModalItem.start}</strong> s/d{" "}
                <strong>Hari ke-{quickModalItem.start + quickModalItem.duration - 1}</strong>{" "}
                ({quickModalItem.duration} Hari)
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickModalItem(null)}
                className="rounded-xl text-xs h-8"
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApplyQuickModal}
                className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white rounded-xl text-xs h-8 px-4 font-semibold"
              >
                Terapkan Jadwal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Keterikatan Pekerjaan */}
      {!readOnly && confirmDependency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-orange-50/60 via-slate-50/30 to-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-[#E65F2B] shrink-0 border border-orange-200/80 shadow-2xs">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Konfirmasi Keterikatan Pekerjaan
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hubungkan hubungan ketergantungan urutan pelaksanaan pekerjaan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDependency(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Konten Modal: Alur Hubungan Predecessor -> Successor */}
            <div className="p-6 space-y-4">
              {/* Box Predecessor (Pekerjaan Pendahulu) */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-100 text-[#E65F2B] border border-orange-200">
                    1. Pekerjaan Pendahulu (Predecessor)
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {confirmDependency.predecessor.lingkup || "SIPIL"} • {confirmDependency.predecessor.kategori_pekerjaan || "UMUM"}
                  </span>
                </div>
                <div className="font-semibold text-slate-900 text-sm">
                  {confirmDependency.predecessor.deskripsi}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1.5 border-t border-slate-200/60 font-mono">
                  <span>Volume: {confirmDependency.predecessor.volume} {confirmDependency.predecessor.satuan}</span>
                  {schedule[confirmDependency.predecessor.id] ? (
                    <span className="text-orange-600 font-bold">
                      Hari ke-{schedule[confirmDependency.predecessor.id].start} s/d ke-{schedule[confirmDependency.predecessor.id].start + schedule[confirmDependency.predecessor.id].duration - 1} ({schedule[confirmDependency.predecessor.id].duration} Hari)
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Belum dijadwalkan</span>
                  )}
                </div>
              </div>

              {/* Tanda Panah & Tipe Hubungan */}
              <div className="flex flex-col items-center justify-center -my-1 space-y-1">
                <div className="h-3 w-0.5 bg-orange-200" />
                <div className="inline-flex items-center space-x-1.5 bg-orange-50 border border-orange-200/80 px-3 py-1 rounded-full text-xs font-semibold text-[#E65F2B] shadow-2xs">
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Finish-to-Start (FS)</span>
                </div>
                <p className="text-[10px] text-slate-400 text-center italic">
                  Pekerjaan penerus dimulai setelah pekerjaan pendahulu selesai
                </p>
                <div className="h-3 w-0.5 bg-orange-200" />
              </div>

              {/* Box Successor (Pekerjaan Penerus) */}
              <div className="bg-emerald-50/30 border border-emerald-200/70 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    2. Pekerjaan Penerus (Successor)
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {confirmDependency.successor.lingkup || "SIPIL"} • {confirmDependency.successor.kategori_pekerjaan || "UMUM"}
                  </span>
                </div>
                <div className="font-semibold text-slate-900 text-sm">
                  {confirmDependency.successor.deskripsi}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1.5 border-t border-emerald-200/60 font-mono">
                  <span>Volume: {confirmDependency.successor.volume} {confirmDependency.successor.satuan}</span>
                  {schedule[confirmDependency.successor.id] ? (
                    <span className="text-emerald-700 font-bold">
                      Hari ke-{schedule[confirmDependency.successor.id].start} s/d ke-{schedule[confirmDependency.successor.id].start + schedule[confirmDependency.successor.id].duration - 1} ({schedule[confirmDependency.successor.id].duration} Hari)
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Belum dijadwalkan</span>
                  )}
                </div>
              </div>

              {/* Peringatan jika jadwal bertabrakan */}
              {(() => {
                const predSched = schedule[confirmDependency.predecessor.id];
                const succSched = schedule[confirmDependency.successor.id];
                if (predSched && succSched) {
                  const predEnd = predSched.start + predSched.duration - 1;
                  if (succSched.start <= predEnd) {
                    return (
                      <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 flex items-start space-x-2 text-xs text-amber-800">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Catatan Urutan Hari:</span> Pekerjaan penerus dijadwalkan mulai Hari ke-{succSched.start}, sedangkan pekerjaan pendahulu selesai Hari ke-{predEnd}. Keterikatan tetap dapat dibuat, dan Anda dapat menggeser posisi baris di timeline.
                        </div>
                      </div>
                    );
                  }
                }
                return null;
              })()}
            </div>

            {/* Footer Aksi */}
            <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end space-x-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDependency(null)}
                className="rounded-xl text-xs h-9 px-4 border-slate-200 hover:bg-slate-100"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const nextDeps = [
                    ...dependencies,
                    {
                      predecessor_id: confirmDependency.predecessor.id,
                      successor_id: confirmDependency.successor.id,
                    },
                  ];
                  setDependencies(nextDeps);
                  recordHistory(schedule, nextDeps);
                  setConfirmDependency(null);
                  setFeedback({
                    isOpen: true,
                    type: "success",
                    title: "Keterikatan Berhasil Dibuat",
                    message: `Pekerjaan "${confirmDependency.predecessor.deskripsi}" resmi dihubungkan sebagai pendahulu untuk "${confirmDependency.successor.deskripsi}".`,
                  });
                }}
                className="rounded-xl text-xs h-9 px-4 bg-[#E65F2B] hover:bg-[#d04f1f] text-white font-medium shadow-xs"
              >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Ya, Hubungkan Keterikatan
              </Button>
            </div>
          </div>
        </div>
      )}

      <FeedbackModal
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={() => setFeedback((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
