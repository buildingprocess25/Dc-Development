"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VolumeInputProps {
  value: number | string;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  showStepper?: boolean;
}

export function VolumeInput({
  value = 0,
  onChange,
  disabled = false,
  className,
  inputClassName,
  min = 0,
  max,
  step = 1,
  placeholder = "0",
  showStepper = true,
}: VolumeInputProps) {
  const [displayVal, setDisplayVal] = useState<string>(() => {
    if (value === 0 || value === "0") return "0";
    if (!value) return "0";
    return String(value);
  });

  const prevValRef = useRef<string>(displayVal);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    const s = value === 0 || value === "0" ? "0" : value ? String(value) : "0";
    const currentNum = parseFloat(displayVal.replace(",", "."));
    const propNum = parseFloat(s.replace(",", "."));
    if (currentNum !== propNum || (displayVal === "" && s === "0")) {
      setDisplayVal(s);
      prevValRef.current = s;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    const prev = prevValRef.current;

    // Filter only valid numeric characters (digits, dot, comma)
    raw = raw.replace(/[^0-9.,]/g, "");

    // Jika user mengosongkan seluruh teks
    if (raw === "") {
      setDisplayVal("");
      prevValRef.current = "";
      onChange(0);
      return;
    }

    // Hindari multiple dots/commas
    const dotCount = (raw.match(/[.,]/g) || []).length;
    if (dotCount > 1) {
      let seen = false;
      raw = raw.replace(/[.,]/g, (match) => {
        if (!seen) {
          seen = true;
          return match;
        }
        return "";
      });
    }

    // ATURAN ELIMINASI ANGKA 0 DEFAULT:
    // "volume nya kan default 0 kalau mau dari depan 0 di input atau dari belakang 0 di input 0 nya harus hilang"
    if (prev === "0") {
      // Kasus 1: User mengetik digit SETELAH 0 (misal: "05") -> hilangkan 0 di depan -> "5"
      if (/^0[0-9]+$/.test(raw)) {
        raw = raw.replace(/^0+/, "") || "0";
      }
      // Kasus 2: User mengetik digit SEBELUM 0 (misal: "50" dengan panjang 2 karakter) -> hilangkan 0 lama di belakang -> "5"
      else if (/^[1-9]0$/.test(raw)) {
        raw = raw.slice(0, -1);
      }
    } else {
      // Jika sebelumnya bukan 0 tunggal, cegah leading zero yang tidak valid (misal "012" -> "12")
      if (/^0+[1-9]/.test(raw)) {
        raw = raw.replace(/^0+/, "");
      }
    }

    setDisplayVal(raw);
    prevValRef.current = raw;

    const normalized = raw.replace(",", ".");
    if (normalized.endsWith(".") || normalized === "") {
      const num = parseFloat(normalized.slice(0, -1)) || 0;
      onChange(num);
    } else {
      let num = parseFloat(normalized);
      if (isNaN(num)) num = 0;
      if (min !== undefined && num < min) num = min;
      if (max !== undefined && num > max) num = max;
      onChange(num);
    }
  };

  const handleBlur = () => {
    if (displayVal === "" || displayVal === "." || displayVal === ",") {
      setDisplayVal("0");
      prevValRef.current = "0";
      onChange(0);
    } else {
      let cleaned = displayVal;
      if (cleaned.endsWith(".") || cleaned.endsWith(",")) {
        cleaned = cleaned.slice(0, -1);
        setDisplayVal(cleaned);
        prevValRef.current = cleaned;
      }
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Otomatis sorot seluruh teks agar input apapun langsung menimpa nilai default
    e.target.select();
  };

  const handleStep = (direction: "up" | "down") => {
    if (disabled) return;
    const current = parseFloat(displayVal.replace(",", ".")) || 0;
    let next = direction === "up" ? current + step : current - step;
    if (min !== undefined && next < min) next = min;
    if (max !== undefined && next > max) next = max;
    // Format agar tidak floating point weirdness
    const nextStr = Number(next.toFixed(2)).toString();
    setDisplayVal(nextStr);
    prevValRef.current = nextStr;
    onChange(next);
  };

  return (
    <div
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
        inputMode="decimal"
        disabled={disabled}
        value={displayVal}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={cn(
          "w-full h-8 px-2 text-center text-xs font-bold text-slate-900 bg-transparent outline-none",
          showStepper ? "pr-6" : "",
          disabled && "cursor-not-allowed text-slate-400",
          inputClassName
        )}
      />

      {/* Stepper Buttons (Up / Down) */}
      {showStepper && !disabled && (
        <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-center gap-0.5 select-none">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => handleStep("up")}
            className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Tambah volume"
          >
            <ChevronUp className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => handleStep("down")}
            className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Kurang volume"
          >
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
        </div>
      )}
    </div>
  );
}
