"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DocumentCategoryCardProps {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  badge: string;
  stats: string;
}

export default function DocumentCategoryCard({
  title,
  description,
  href,
  icon: IconComponent,
  active,
  badge,
  stats
}: DocumentCategoryCardProps) {
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
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              active ? "bg-orange-50 text-[#E65F2B]" : "bg-slate-200 text-slate-400"
            }`}
          >
            <IconComponent className="w-5 h-5" />
          </div>
          <span
            className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
              active
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
            }`}
          >
            {badge}
          </span>
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
              Buka Dokumen
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
