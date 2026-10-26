"use client";

import React, { useState } from "react";
import { Plus, X, ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StringListInputProps {
  label: string;
  placeholder?: string;
  items: string[];
  onChange: (items: string[]) => void;
  description?: string;
  badgeColor?: "orange" | "blue" | "emerald" | "slate";
}

export function StringListInput({
  label,
  placeholder = "Ketik item lalu tekan Enter atau klik Tambah...",
  items = [],
  onChange,
  description,
  badgeColor = "slate",
}: StringListInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleAddItem = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (items.includes(trimmed)) {
      setInputValue("");
      return;
    }
    onChange([...items, trimmed]);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  const getBadgeStyle = () => {
    switch (badgeColor) {
      case "orange":
        return "bg-orange-50 text-orange-800 border-orange-200/80 hover:bg-orange-100/70";
      case "blue":
        return "bg-blue-50 text-blue-800 border-blue-200/80 hover:bg-blue-100/70";
      case "emerald":
        return "bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100/70";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200/80 hover:bg-slate-200/70";
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
          {label}
        </label>
        <span className="text-[11px] font-medium text-slate-500">
          {items.length} terdaftar
        </span>
      </div>

      {description && (
        <p className="text-[11px] text-slate-500 leading-relaxed -mt-1">
          {description}
        </p>
      )}

      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="text-xs h-9 pr-8 rounded-xl border-slate-200 focus:border-[#E65F2B] focus:ring-[#E65F2B]/20"
          />
        </div>
        <Button
          type="button"
          onClick={handleAddItem}
          disabled={!inputValue.trim()}
          className="h-9 px-3 text-xs bg-slate-800 hover:bg-slate-900 text-white rounded-xl shadow-xs transition-all flex items-center space-x-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah</span>
        </Button>
      </div>

      {/* Item List / Tags */}
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 bg-slate-50/70 rounded-xl border border-slate-200/60 mt-1">
          {items.map((item, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-lg border transition-all ${getBadgeStyle()}`}
            >
              <span className="break-all text-[11px] leading-tight mr-1.5">
                {item}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveItem(idx)}
                className="text-slate-400 hover:text-rose-600 transition-colors rounded-full p-0.5"
                title="Hapus item"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className="flex items-center space-x-2 text-[11px] text-slate-400 italic py-1 px-1">
          <ListPlus className="w-3.5 h-3.5 opacity-60" />
          <span>Belum ada data ditambahkan</span>
        </div>
      )}
    </div>
  );
}
