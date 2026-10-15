"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export interface ApprovalPageTitleProps {
  breadcrumb: string;
  title: string;
  backHref?: string;
  backTitle?: string;
  extraBadge?: React.ReactNode;
}

export function ApprovalPageTitle({
  breadcrumb,
  title,
  backHref = "/dc-development/approval",
  backTitle = "Kembali ke Pusat Approval",
  extraBadge,
}: ApprovalPageTitleProps) {
  return (
    <div className="flex items-center gap-3">
      <Link href={backHref}>
        <button
          type="button"
          className="p-2 rounded-xl bg-white border border-[#EAEAEA] text-[#666666] hover:bg-[#F9F9F9] hover:text-slate-900 shadow-xs transition-all cursor-pointer"
          title={backTitle}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </Link>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {breadcrumb}
          </span>
          {extraBadge}
        </div>
        <h2 className="text-xl md:text-2xl font-extrabold text-[#111111] tracking-tight">
          {title}
        </h2>
      </div>
    </div>
  );
}

export default ApprovalPageTitle;
