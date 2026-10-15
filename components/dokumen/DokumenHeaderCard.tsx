"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DokumenHeaderCardProps {
  title: string;
  categoryLabel?: string;
  icon?: React.ElementType;
  backHref?: string;
  backTitle?: string;
  badgeLabel?: string;
  className?: string;
}

export function DokumenHeaderCard({
  title,
  categoryLabel = "Katalog Dokumen Resmi",
  icon: Icon,
  backHref = "/dc-development/daftar-dokumen",
  backTitle = "Kembali ke Daftar Dokumen",
  badgeLabel,
  className,
}: DokumenHeaderCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Link href={backHref}>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-xl border-slate-200 text-slate-600 hover:text-[#E65F2B] hover:bg-orange-50/50 cursor-pointer"
            title={backTitle}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-[#E65F2B]" />}
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {categoryLabel}
            </span>
          </div>
          <h1 className="text-lg font-black text-slate-800 tracking-tight">
            {title}
          </h1>
        </div>
      </div>

      {badgeLabel && (
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-orange-100 text-[#E65F2B]">
            {badgeLabel}
          </span>
        </div>
      )}
    </div>
  );
}

export default DokumenHeaderCard;
