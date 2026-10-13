"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Check, ChevronDown, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  badge?: string | number;
}

export interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  searchable?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih...",
  searchPlaceholder = "Cari pilihan...",
  className,
  triggerClassName,
  contentClassName,
  searchable,
  disabled = false,
  icon,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Auto-enable search if more than 7 options unless explicitly disabled
  const showSearch = searchable !== undefined ? searchable : options.length > 7;

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, search]);

  // Reset highlightedIndex to 0 when search changes or when opening
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (open && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [highlightedIndex, open]);

  // Isolate mouse wheel events completely to prevent background page scroll
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

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredOptions.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target =
        filteredOptions[highlightedIndex] || filteredOptions[0];
      if (target) {
        handleSelect(target.value);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "h-10 px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white hover:bg-slate-50/80 text-slate-700 flex items-center justify-between gap-2 shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#E65F2B]/20 focus:border-[#E65F2B] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer",
            className,
            triggerClassName
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
            <span
              className={cn(
                "truncate font-medium",
                !selectedOption && "text-slate-400"
              )}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className={cn(
          "p-0 w-[240px] rounded-2xl bg-white shadow-2xl border border-slate-200/80 overflow-hidden z-50",
          contentClassName
        )}
        onWheel={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        {showSearch && (
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-14 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-[#E65F2B] focus:ring-1 focus:ring-[#E65F2B] text-slate-800 placeholder-slate-400"
                autoFocus
              />
              {filteredOptions.length > 0 && (
                <div className="absolute right-2 flex items-center gap-0.5 text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 pointer-events-none">
                  <CornerDownLeft className="w-2.5 h-2.5" />
                  <span>Enter</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scrollable Items Container */}
        <div
          ref={listRef}
          className="max-h-60 overflow-y-auto overscroll-contain p-1.5 space-y-0.5"
          onWheel={(e) => e.stopPropagation()}
        >
          {filteredOptions.length === 0 ? (
            <div className="py-5 text-center text-xs text-slate-400">
              Tidak ada hasil &quot;{search}&quot;
            </div>
          ) : (
            filteredOptions.map((opt, index) => {
              const isSelected = opt.value === value;
              const isHighlighted = index === highlightedIndex;

              return (
                <button
                  key={opt.value}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  onMouseDown={(e) => {
                    // Prevent blur cancelation before click
                    e.preventDefault();
                  }}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "w-full px-3 py-2 text-xs text-left rounded-xl flex items-center justify-between gap-2 transition-all cursor-pointer select-none",
                    isSelected && isHighlighted
                      ? "bg-orange-100 text-[#E65F2B] font-bold border border-orange-300"
                      : isSelected
                      ? "bg-orange-50 text-[#E65F2B] font-semibold border border-orange-200/60"
                      : isHighlighted
                      ? "bg-slate-100 text-slate-900 font-medium"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {opt.badge !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-normal">
                        {opt.badge}
                      </span>
                    )}
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
