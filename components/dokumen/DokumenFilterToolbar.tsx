"use client";

import React from "react";
import { Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BranchFilterSelect } from "@/components/ui/branch-filter-select";
import { FilterSelect, FilterOption } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";

export interface DokumenFilterToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  onSearchEnter?: () => void;
  cabang: string;
  onCabangChange: (cabang: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
  statusOptions: FilterOption[];
  statusPlaceholder?: string;
  onRefresh: () => void;
  loading?: boolean;
  className?: string;
}

export function DokumenFilterToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Cari dokumen...",
  onSearchEnter,
  cabang,
  onCabangChange,
  status,
  onStatusChange,
  statusOptions,
  statusPlaceholder = "Status Dokumen",
  onRefresh,
  loading = false,
  className,
}: DokumenFilterToolbarProps) {
  return (
    <div
      className={cn(
        "bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sticky top-0 z-10",
        className
      )}
    >
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSearchEnter) {
              onSearchEnter();
            }
          }}
          placeholder={searchPlaceholder}
          className="pl-9 h-10 text-xs rounded-xl border-slate-200 focus-visible:ring-[#E65F2B] bg-slate-50/50"
        />
      </div>

      <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
        <BranchFilterSelect
          value={cabang}
          onChange={onCabangChange}
          className="w-full sm:w-44 h-10 text-xs"
        />

        <FilterSelect
          value={status}
          onChange={onStatusChange}
          placeholder={statusPlaceholder}
          className="w-full sm:w-44 h-10 text-xs"
          options={statusOptions}
        />

        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={loading}
          className="h-10 w-10 shrink-0 rounded-xl border-slate-200 text-slate-600 hover:text-[#E65F2B] hover:bg-orange-50/50 cursor-pointer"
          title="Segarkan Data"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-[#E65F2B]")} />
        </Button>
      </div>
    </div>
  );
}

export default DokumenFilterToolbar;
