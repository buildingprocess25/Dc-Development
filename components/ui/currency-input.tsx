"use client";

import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps {
  value?: number | null;
  onChange?: (value: number) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  autoFocus?: boolean;
}

export function formatRupiahNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val) || val === 0) return "";
  return Math.round(val).toLocaleString("id-ID");
}

export function CurrencyInput({
  value = 0,
  onChange,
  disabled = false,
  placeholder = "0",
  className,
  min = 0,
  max,
  autoFocus = false,
}: CurrencyInputProps) {
  // Simpan nilai display sebagai string dengan format ribuan
  const [displayValue, setDisplayValue] = useState<string>(() =>
    value && value > 0 ? formatRupiahNumber(value) : ""
  );

  const inputRef = useRef<HTMLInputElement>(null);

  // Sync saat prop value dari luar berubah (misal saat auto-fill dari master item atau reset)
  useEffect(() => {
    if (value && value > 0) {
      setDisplayValue(formatRupiahNumber(value));
    } else {
      setDisplayValue("");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Ambil hanya digit angka
    const rawDigits = e.target.value.replace(/\D/g, "");

    if (!rawDigits) {
      setDisplayValue("");
      if (onChange) onChange(0);
      return;
    }

    let numericVal = parseInt(rawDigits, 10);
    if (min !== undefined && numericVal < min) numericVal = min;
    if (max !== undefined && numericVal > max) numericVal = max;

    setDisplayValue(numericVal.toLocaleString("id-ID"));
    if (onChange) onChange(numericVal);
  };

  return (
    <div
      className={cn(
        "relative flex items-center rounded-lg border transition-colors shadow-2xs overflow-hidden",
        disabled
          ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed select-none"
          : "bg-white border-slate-200 text-slate-800 hover:border-slate-300 focus-within:border-[#E65F2B] focus-within:ring-1 focus-within:ring-[#E65F2B]",
        className
      )}
    >
      {/* Prefix Rp */}
      <span
        className={cn(
          "pl-2.5 pr-1 text-[11px] font-bold select-none shrink-0",
          disabled ? "text-slate-400" : "text-slate-500"
        )}
      >
        Rp
      </span>

      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        autoFocus={autoFocus}
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          "w-full h-8 pr-2.5 py-1 text-xs text-right font-semibold bg-transparent outline-none placeholder:text-slate-400 [appearance:textfield]",
          disabled && "cursor-not-allowed"
        )}
      />
    </div>
  );
}
