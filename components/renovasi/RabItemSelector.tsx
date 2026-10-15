"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Plus, Check, ChevronDown, Sparkles, CornerDownLeft, RefreshCw, History, Package } from "lucide-react";
import { cn, formatRupiah } from "@/lib/utils";

export interface MasterItemOption {
  value: string; // master item id as string or history key
  label: string; // display description
  masterItem?: any;
  source?: 'master' | 'history';
  masterItemId?: number;
  recommendedMaterial?: number;
  recommendedUpah?: number;
  kategori_pekerjaan?: string;
  lingkup?: string;
}

export interface RabItemSelectorProps {
  masterItemId: number | null;
  deskripsi: string;
  isCustom: boolean;
  options: MasterItemOption[];
  onSelectMasterItem: (val: string, option?: MasterItemOption) => void;
  onSetCustomItem: (customDeskripsi: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RabItemSelector({
  masterItemId,
  deskripsi,
  isCustom,
  options,
  onSelectMasterItem,
  onSetCustomItem,
  placeholder = "Pilih dari Master Harga atau ketik bebas...",
  disabled = false,
}: RabItemSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Filter master items based on query
  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, query]);

  // Isolate mouse wheel events completely to prevent page/table scroll
  useEffect(() => {
    const el = listRef.current;
    if (!el || !open) return;

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation();
    };

    el.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [open]);

  // Reset highlight index when query or open state changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (open && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [highlightedIndex, open]);

  // When opening, initialize search query with current description if any
  useEffect(() => {
    if (open) {
      setQuery(deskripsi || "");
    }
  }, [open, deskripsi]);

  const handleSelectOption = (opt: MasterItemOption) => {
    onSelectMasterItem(opt.value, opt);
    setOpen(false);
  };

  const handleApplyCustom = (text: string) => {
    const finalVal = text.trim() || deskripsi.trim() || "Item Pekerjaan";
    onSetCustomItem(finalVal);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = filteredOptions.length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (totalItems > 0) {
        setHighlightedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (totalItems > 0) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions.length === 0) {
        // Tidak ada yang cocok -> otomatis gunakan teks yang diketik sebagai item manual
        handleApplyCustom(query);
      } else if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        // Memilih opsi yang disorot
        handleSelectOption(filteredOptions[highlightedIndex]);
      } else {
        handleApplyCustom(query);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  // Batasi panjang teks nama item yang tampil di dalam card agar ringkas dan pas di card
  const displayLabel = useMemo(() => {
    if (!deskripsi) return placeholder;
    const maxLength = 45;
    if (deskripsi.length > maxLength) {
      return deskripsi.slice(0, maxLength).trim() + "...";
    }
    return deskripsi;
  }, [deskripsi, placeholder]);

  // Deteksi apakah item saat ini bersumber dari Riwayat terdahulu
  const isHistoryItem = useMemo(() => {
    if (!isCustom || !deskripsi) return false;
    const norm = deskripsi.trim().toLowerCase();
    return options.some(
      (opt) => opt.source === "history" && opt.label.trim().toLowerCase() === norm
    );
  }, [isCustom, deskripsi, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <div
          role="button"
          tabIndex={0}
          title={deskripsi || ""}
          className={cn(
            "h-9 w-full max-w-full min-w-0 px-3 py-1 text-xs rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 flex items-center justify-between gap-2 cursor-pointer transition-colors shadow-2xs group focus:outline-none focus:ring-2 focus:ring-[#E65F2B]/20 focus:border-[#E65F2B] overflow-hidden",
            disabled && "opacity-50 cursor-not-allowed bg-slate-50"
          )}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
            {isCustom ? (
              isHistoryItem ? (
                <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold text-[10px] flex items-center gap-0.5">
                  <History className="w-2.5 h-2.5" />
                  Riwayat
                </span>
              ) : (
                <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 font-bold text-[10px]">
                  Manual
                </span>
              )
            ) : masterItemId ? (
              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 font-bold text-[10px] flex items-center gap-0.5">
                <Package className="w-2.5 h-2.5" />
                Master
              </span>
            ) : null}

            <span
              title={deskripsi || ""}
              className={cn(
                "truncate font-medium block max-w-full overflow-hidden text-ellipsis whitespace-nowrap",
                deskripsi ? "text-slate-800" : "text-slate-400"
              )}
            >
              {displayLabel}
            </span>
          </div>

          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 group-hover:text-slate-600",
              open && "rotate-180"
            )}
          />
        </div>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0 w-[420px] max-w-[95vw] rounded-2xl bg-white shadow-2xl border border-slate-200/90 overflow-hidden z-50"
        onWheel={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Cari atau ketik nama item..."
              className="w-full pl-8 pr-16 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-[#E65F2B] focus:ring-1 focus:ring-[#E65F2B] text-slate-800 placeholder-slate-400"
              autoFocus
            />
            <div className="absolute right-2 flex items-center gap-0.5 text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 pointer-events-none">
              <CornerDownLeft className="w-2.5 h-2.5" />
              <span>Enter</span>
            </div>
          </div>
        </div>

        {/* Scrollable Master Items List */}
        <div
          ref={listRef}
          className="max-h-64 overflow-y-auto overscroll-contain p-1.5 space-y-0.5"
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Master Item & History Item Options */}
          {filteredOptions.length === 0 ? (
            !query.trim() ? (
              options.length === 0 ? (
                <div className="py-6 px-4 text-center flex flex-col items-center justify-center gap-1.5 text-xs text-slate-400">
                  <span className="font-semibold text-slate-600">Belum ada item di kategori ini</span>
                  <span className="text-[11px] text-slate-400">
                    Ketik nama item di atas lalu tekan <strong className="text-slate-700">Enter</strong> untuk menambahkan.
                  </span>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  Ketik nama item untuk mencari...
                </div>
              )
            ) : null
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected =
                (!isCustom && opt.source === "master" && String(masterItemId) === opt.value) ||
                (isCustom && opt.source === "history" && deskripsi && opt.label.trim().toLowerCase() === deskripsi.trim().toLowerCase());
              const isHighlighted = idx === highlightedIndex;
              const isHistory = opt.source === "history";

              return (
                <button
                  key={opt.value}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectOption(opt)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={cn(
                    "w-full px-3 py-2 text-xs text-left rounded-xl flex items-center justify-between gap-2.5 transition-all cursor-pointer select-none overflow-hidden",
                    isSelected && isHighlighted
                      ? "bg-orange-100 text-[#E65F2B] font-bold border border-orange-300"
                      : isSelected
                      ? "bg-orange-50 text-[#E65F2B] font-semibold border border-orange-200/60"
                      : isHighlighted
                      ? "bg-slate-100 text-slate-900 font-medium"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                    {isHistory ? (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold text-[9px] flex items-center gap-0.5">
                        <History className="w-2.5 h-2.5" />
                        Riwayat
                      </span>
                    ) : (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 font-bold text-[9px] flex items-center gap-0.5">
                        <Package className="w-2.5 h-2.5" />
                        Master
                      </span>
                    )}

                    <span className="truncate flex-1 min-w-0" title={opt.label}>
                      {opt.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#E65F2B] shrink-0" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
