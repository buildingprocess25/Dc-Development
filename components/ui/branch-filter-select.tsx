"use client";

import React, { useMemo } from "react";
import { useSession } from "@/context/SessionContext";
import {
  ALL_INDUK_CABANG,
  getIndukCabangFromCoverage,
  getIndukFromCabang,
  isDcAdmin,
} from "@/lib/branches";
import { FilterSelect, FilterOption } from "@/components/ui/filter-select";
import { Building2 } from "lucide-react";

export interface BranchFilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allLabel?: string;
  showAllOption?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  customBranches?: string[];
  disabled?: boolean;
}

/**
 * Hook to retrieve available Induk Cabang for the currently logged-in user.
 * - DC ADMIN: all induk cabang (unrestricted)
 * - All other roles (including HEAD OFFICE users): strictly limited to coverage_cabang / cabang
 */
export function useAvailableIndukCabang(customBranches?: string[]): string[] {
  const { user } = useSession();

  const isFullAdmin = useMemo(() => {
    return isDcAdmin(user);
  }, [user]);

  return useMemo(() => {
    if (customBranches && customBranches.length > 0) {
      return customBranches;
    }

    // Role DC ADMIN: Satu-satunya yang memiliki akses penuh ke seluruh cabang
    if (isFullAdmin) {
      return ALL_INDUK_CABANG.filter((c) => c !== "HEAD OFFICE");
    }

    if (!user) return [];

    // Role selain DC ADMIN (termasuk user dengan cabang HEAD OFFICE):
    // Wajib mengikuti cakupan cabang pada coverage_cabang
    if (user.coverage_cabang) {
      const fromCoverage = getIndukCabangFromCoverage(user.coverage_cabang);
      if (fromCoverage.length > 0) return fromCoverage;
    }

    if (user.cabang && user.cabang.toUpperCase() !== "HEAD OFFICE") {
      return [getIndukFromCabang(user.cabang)];
    }

    return [];
  }, [user, isFullAdmin, customBranches]);
}

/**
 * Reusable Branch Filter component with isolated scrolling, search, and automatic
 * permission filtering based on user's coverage_cabang.
 */
export function BranchFilterSelect({
  value,
  onChange,
  placeholder = "Semua Cabang",
  allLabel = "Semua Cabang",
  showAllOption = true,
  className,
  triggerClassName,
  contentClassName,
  customBranches,
  disabled = false,
}: BranchFilterSelectProps) {
  const availableBranches = useAvailableIndukCabang(customBranches);

  const options: FilterOption[] = useMemo(() => {
    const list: FilterOption[] = [];
    if (showAllOption) {
      list.push({ value: "all", label: allLabel });
    }
    for (const b of availableBranches) {
      list.push({ value: b, label: b });
    }
    return list;
  }, [availableBranches, showAllOption, allLabel]);

  return (
    <FilterSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder="Cari cabang..."
      className={className}
      triggerClassName={triggerClassName}
      contentClassName={contentClassName}
      disabled={disabled}
      searchable={true}
    />
  );
}
