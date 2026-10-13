"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Plus, Check, ChevronDown, Sparkles, CornerDownLeft, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MasterItemOption {
  value: string; // master item id as string
  label: string; // display description
  masterItem: any;
}

export interface RabItemSelectorProps {
  masterItemId: number | null;
  deskripsi: string;
  isCustom: boolean;
  options: MasterItemOption[];
  onSelectMasterItem: (masterItemId: string) => void;
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

  const handleSelectMaster = (idStr: string) => {
    onSelectMasterItem(idStr);
    setOpen(false);
  };

  const handleApplyCustom = (text: string) => {
    const finalVal = text.trim() || deskripsi.trim() || "Item Pekerjaan";
    onSetCustomItem(finalVal);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Total selectable targets = filteredOptions.length + (query.trim() ? 1 : 0)
    const hasCustomOption = !!query.trim();
    const totalItems = filteredOptions.length + (hasCustomOption ? 1 : 0);

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
        // No match -> directly use as custom input
        handleApplyCustom(query);
      } else if (highlightedIndex < filteredOptions.length) {
        // Selected a master item
        handleSelectMaster(filteredOptions[highlightedIndex].value);
      } else {
        // Selected the custom item at the bottom
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
              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 font-bold text-[10px]">
                Manual
              </span>
            ) : masterItemId ? (
              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 font-bold text-[10px]">
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
        {/* Search / Creatable Input */}
        <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Cari item master atau ketik item bebas..."
              className="w-full pl-8 pr-16 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-[#E65F2B] focus:ring-1 focus:ring-[#E65F2B] text-slate-800 placeholder-slate-400"
              autoFocus
            />
            <div className="absolute right-2 flex items-center gap-0.5 text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 pointer-events-none">
              <CornerDownLeft className="w-2.5 h-2.5" />
              <span>Enter</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 pl-1">
            Ketik nama item. Jika tidak ada di master harga, tekan Enter untuk otomatis mengisi sebagai item manual.
          </p>
        </div>

        {/* Scrollable Master Items List */}
        <div
          ref={listRef}
          className="max-h-60 overflow-y-auto overscroll-contain p-1.5 space-y-0.5"
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Custom / Creatable Option (Top / if query exists) */}
          {query.trim() && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleApplyCustom(query)}
              className={cn(
                "w-full px-3 py-2 text-xs text-left rounded-xl flex items-center justify-between gap-2 border transition-all cursor-pointer select-none",
                highlightedIndex === filteredOptions.length
                  ? "bg-amber-100 border-amber-300 text-amber-900 font-bold"
                  : "bg-amber-50/60 border-amber-200/80 text-amber-800 hover:bg-amber-100/70"
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="truncate">
                  Gunakan sebagai <strong className="underline">Input Bebas (Manual)</strong>: &quot;{query}&quot;
                </span>
              </div>
              <span className="text-[10px] font-mono text-amber-700 bg-amber-200/60 px-1.5 py-0.5 rounded shrink-0">
                ↵ Enter
              </span>
            </button>
          )}

          {/* Master Item Options */}
          {filteredOptions.length === 0 ? (
            !query.trim() ? (
              options.length === 0 ? (
                <div className="py-6 px-4 text-center flex flex-col items-center justify-center gap-1.5 text-xs text-slate-400">
                  <span className="font-semibold text-slate-600">Belum ada Master Item di kategori ini</span>
                  <span className="text-[11px] text-slate-400">
                    Ketik nama item di atas lalu tekan <strong className="text-slate-700">Enter</strong> untuk Input Bebas (Manual).
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
              const isSelected = !isCustom && String(masterItemId) === opt.value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <button
                  key={opt.value}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectMaster(opt.value)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={cn(
                    "w-full px-3 py-2 text-xs text-left rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer select-none overflow-hidden",
                    isSelected && isHighlighted
                      ? "bg-orange-100 text-[#E65F2B] font-bold border border-orange-300"
                      : isSelected
                      ? "bg-orange-50 text-[#E65F2B] font-semibold border border-orange-200/60"
                      : isHighlighted
                      ? "bg-slate-100 text-slate-900 font-medium"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <span className="truncate flex-1 min-w-0" title={opt.label}>{opt.label}</span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[#E65F2B] shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
