"use client";

import React from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { FormKlarifikasiAanwijzing } from "@/components/klarifikasi-aanwijzing/FormKlarifikasiAanwijzing";

export default function TambahKlarifikasiPage() {
  return (
    <Dashboard title="Buat Klarifikasi Aanwijzing">
      <div className="flex-1 min-h-0 flex flex-col w-full h-full overflow-hidden bg-[#FAFAFA] rounded-2xl border border-slate-200/80 shadow-xs">
        <FormKlarifikasiAanwijzing mode="tambah" />
      </div>
    </Dashboard>
  );
}
