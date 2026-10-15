"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface HubHeaderBannerProps {
  tagLabel?: string;
  subtitle?: string;
  title: string;
  description: string;
  rightElement?: React.ReactNode;
  className?: string;
}

export function HubHeaderBanner({
  tagLabel,
  subtitle = "SPARTA DC Development",
  title,
  description,
  rightElement,
  className,
}: HubHeaderBannerProps) {
  return (
    <div
      className={cn(
        "bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs",
        className
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            {tagLabel && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-orange-100 text-[#E65F2B]">
                {tagLabel}
              </span>
            )}
            {subtitle && (
              <span className="text-xs text-slate-400 font-medium">
                {tagLabel ? `• ${subtitle}` : subtitle}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            {description}
          </p>
        </div>

        {rightElement && (
          <div className="flex items-center gap-3">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  );
}

export default HubHeaderBanner;
