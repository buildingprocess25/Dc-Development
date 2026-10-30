"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Hardcoded base units (user requested: minimal 2 base hardcoded)
export const DEFAULT_BASE_UNITS = ["m2", "ls"];

// Global client-side set to immediately share new units across rows in the same session
const clientUnitSet = new Set<string>(DEFAULT_BASE_UNITS);

interface SatuanComboboxProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function SatuanCombobox({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Pilih / ketik satuan...",
}: SatuanComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const [recommendations, setRecommendations] = useState<string[]>(Array.from(clientUnitSet));
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 100,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync external value
  useEffect(() => {
    setQuery(value || "");
    if (value && value.trim()) {
      clientUnitSet.add(value.trim().toLowerCase());
    }
  }, [value]);

  // Fetch recommendations from DB on mount
  useEffect(() => {
    let isMounted = true;
    async function loadUnits() {
      try {
        const res = await fetch("/api/dc-development/satuan");
        const json = await res.json();
        if (json.status === "success" && Array.isArray(json.data) && isMounted) {
          json.data.forEach((u: string) => {
            if (u && typeof u === "string") {
              clientUnitSet.add(u.trim().toLowerCase());
            }
          });
          setRecommendations(Array.from(clientUnitSet));
        }
      } catch (err) {
        console.warn("Failed to load satuan recommendations:", err);
      }
    }
    loadUnits();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update floating dropdown position when open
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 130),
      });
    }
  }, [open]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase();
    setQuery(val);
    onChange(val);
    if (!open) setOpen(true);
  };

  const handleBlur = () => {
    if (query && query.trim()) {
      const clean = query.trim().toLowerCase();
      clientUnitSet.add(clean);
      setRecommendations(Array.from(clientUnitSet));
      onChange(clean);
    }
  };

  const handleSelectOption = (opt: string) => {
    const clean = opt.trim().toLowerCase();
    setQuery(clean);
    onChange(clean);
    clientUnitSet.add(clean);
    setRecommendations(Array.from(clientUnitSet));
    setOpen(false);
    inputRef.current?.blur();
  };

  const filteredOptions = recommendations.filter((opt) =>
    opt.toLowerCase().includes(query.trim().toLowerCase())
  );

  const isQueryNew =
    query.trim().length > 0 &&
    !recommendations.some((u) => u.toLowerCase() === query.trim().toLowerCase());

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex items-center bg-white border border-slate-300 rounded-lg transition-all shadow-2xs group",
        disabled
          ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed select-none"
          : "hover:border-slate-400 focus-within:border-[#E65F2B] focus-within:ring-1 focus-within:ring-[#E65F2B]",
        className
      )}
    >
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        value={query}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onFocus={() => {
          if (!disabled) {
            setOpen(true);
            inputRef.current?.select();
          }
        }}
        placeholder={placeholder}
        className={cn(
          "w-full h-8 px-2 pr-6 text-center text-xs font-semibold text-slate-800 bg-transparent outline-none placeholder:text-slate-400",
          disabled && "cursor-not-allowed text-slate-400"
        )}
      />

      {/* Dropdown Chevron Toggle Button */}
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => !prev);
            if (!open) inputRef.current?.focus();
          }
        }}
        className={cn(
          "absolute right-1 top-0 bottom-0 flex items-center justify-center px-1 text-slate-400 hover:text-slate-600 transition-colors",
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        )}
        title="Pilih satuan"
      >
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", open && "rotate-180 text-[#E65F2B]")} />
      </button>

      {/* Floating Dropdown Menu (Fixed in portal/overlay coordinates to avoid clipping) */}
      {open && !disabled && (
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            zIndex: 999999,
          }}
          className="bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 py-1"
        >
          <div className="px-2 py-1 text-[9px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-100 flex items-center justify-between">
            <span>Rekomendasi Satuan</span>
            <Sparkles className="w-2.5 h-2.5 text-[#E65F2B]" />
          </div>

          <div className="max-h-40 overflow-y-auto divide-y divide-slate-50">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = query.trim().toLowerCase() === opt.toLowerCase();
                const isBase = DEFAULT_BASE_UNITS.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectOption(opt);
                    }}
                    className={cn(
                      "w-full px-2.5 py-1.5 text-xs text-left flex items-center justify-between hover:bg-orange-50/70 hover:text-[#E65F2B] transition-colors cursor-pointer",
                      isSelected && "bg-orange-50 font-bold text-[#E65F2B]"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{opt}</span>
                      {isBase && (
                        <span className="text-[9px] font-semibold text-slate-400 uppercase bg-slate-100 px-1 py-0.2 rounded">
                          Default
                        </span>
                      )}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#E65F2B]" />}
                  </button>
                );
              })
            ) : (
              <div className="p-2 text-center text-slate-400 text-[11px]">
                Tidak ada pilihan yang cocok
              </div>
            )}

            {/* Opsi Gunakan Satuan Baru yang Sedang Diketik */}
            {isQueryNew && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectOption(query);
                }}
                className="w-full px-2.5 py-2 text-xs text-left bg-emerald-50/60 hover:bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>+ Gunakan satuan &quot;{query}&quot;</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
