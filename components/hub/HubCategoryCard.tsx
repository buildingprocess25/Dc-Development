"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface HubCategoryCardProps {
  id?: string;
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  active?: boolean;
  badge?: string;
  badgeVariant?: "success" | "warning" | "orange" | "neutral";
  stats?: string;
  actionLabel?: string;
}

export function HubCategoryCard({
  title,
  description,
  href,
  icon: IconComponent,
  active = true,
  badge,
  badgeVariant = "success",
  stats,
  actionLabel = "Buka Dokumen",
}: HubCategoryCardProps) {
  const isOrangeBadge = badgeVariant === "warning" || badgeVariant === "orange";

  return (
    <div
      className={`rounded-2xl border transition-all p-5 flex flex-col justify-between ${
        active
          ? "bg-white border-slate-200 hover:border-[#E65F2B] hover:shadow-md group"
          : "bg-slate-50/60 border-slate-200/60 opacity-80"
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
              active ? "bg-orange-50 text-[#E65F2B]" : "bg-slate-200 text-slate-400"
            }`}
          >
            <IconComponent className="w-5 h-5" />
          </div>

          {badge && (
            <span
              className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
                !active
                  ? "bg-slate-100 text-slate-500 border-slate-200"
                  : isOrangeBadge
                  ? "bg-orange-50 text-[#E65F2B] border-orange-200 shadow-2xs"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {active && isOrangeBadge && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#E65F2B] animate-pulse" />
              )}
              <span>{badge}</span>
            </span>
          )}
        </div>

        <h3 className="text-base font-bold text-slate-800 mb-2 group-hover:text-[#E65F2B] transition-colors">
          {title}
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed mb-4">
          {description}
        </p>
      </div>

      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-400">
          {stats}
        </span>

        {active ? (
          <Link href={href}>
            <Button
              size="sm"
              className="bg-[#E65F2B] hover:bg-[#d04f1f] text-white rounded-xl text-xs font-bold px-3 py-1.5 shadow-xs cursor-pointer group-hover:translate-x-0.5 transition-transform"
            >
              {actionLabel}
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        ) : (
          <span className="text-xs text-slate-400 font-medium italic">Tidak Tersedia</span>
        )}
      </div>
    </div>
  );
}

export default HubCategoryCard;
