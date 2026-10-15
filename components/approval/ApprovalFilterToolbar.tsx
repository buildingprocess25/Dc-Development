"use client";

import React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FilterSelect, FilterOption } from "@/components/ui/filter-select";
import { BranchFilterSelect } from "@/components/ui/branch-filter-select";
import { cn } from "@/lib/utils";

export interface ApprovalFilterToolbarProps {
  // Search
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  // Branch
  branchFilter: string;
  onBranchChange: (branch: string) => void;
  branchAllLabel?: string;

  // Role scoping
  isAdmin?: boolean;

  // Tabs for Non-Admin
  activeTab?: "MY_QUEUE" | "ALL" | string;
  onTabChange?: (tab: any) => void;
  pendingCount?: number;
  totalCount?: number;
  tabPendingLabel?: string;
  tabAllLabel?: string;

  // Filter Status for Admin
  adminStatusFilter?: string;
  onAdminStatusChange?: (status: string) => void;
  adminStatusOptions?: FilterOption[];
  adminStatusLabel?: string;
  adminStatusPlaceholder?: string;

  // Custom slots
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
}

export function ApprovalFilterToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Cari no. pengajuan / proyek...",
  branchFilter,
  onBranchChange,
  branchAllLabel = "Semua Cabang",
  isAdmin = false,
  activeTab = "MY_QUEUE",
  onTabChange,
  pendingCount = 0,
  totalCount,
  tabPendingLabel = "Perlu Tindakan Saya",
  tabAllLabel = "Semua Berkas Terkait",
  adminStatusFilter = "all",
  onAdminStatusChange,
  adminStatusOptions = [],
  adminStatusLabel = "Filter Status:",
  adminStatusPlaceholder = "Pilih status",
  leftContent,
  rightContent,
  className,
}: ApprovalFilterToolbarProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-4",
        className
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left side: Tabs for Non-Admin OR Status Dropdown for Admin */}
        <div className="flex items-center gap-3">
          {!isAdmin ? (
            <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => onTabChange?.("MY_QUEUE")}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
                  activeTab === "MY_QUEUE"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                <span>{tabPendingLabel}</span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-[#E65F2B] text-white">
                    {pendingCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onTabChange?.("ALL")}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                  activeTab === "ALL"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                <span>{tabAllLabel}</span>
                {typeof totalCount === "number" && (
                  <span className="text-slate-400 font-mono text-[10px]">
                    ({totalCount})
                  </span>
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">
                {adminStatusLabel}
              </span>
              <div className="w-56">
                <FilterSelect
                  value={adminStatusFilter}
                  onChange={(val) => onAdminStatusChange?.(val)}
                  options={adminStatusOptions}
                  placeholder={adminStatusPlaceholder}
                  triggerClassName="h-9 rounded-xl text-xs bg-slate-50 border-slate-200"
                />
              </div>
            </div>
          )}

          {leftContent}
        </div>

        {/* Right side: Search & Branch */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9 rounded-xl text-xs bg-slate-50 border-slate-200 focus-visible:ring-[#E65F2B]/30"
            />
          </div>

          <div className="w-full sm:w-48">
            <BranchFilterSelect
              value={branchFilter}
              onChange={onBranchChange}
              allLabel={branchAllLabel}
              triggerClassName="h-9 rounded-xl text-xs bg-slate-50 border-slate-200"
            />
          </div>

          {rightContent}
        </div>
      </div>
    </div>
  );
}

export default ApprovalFilterToolbar;
