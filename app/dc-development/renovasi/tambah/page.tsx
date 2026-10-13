"use client";

import React from "react";
import Dashboard from "@/components/dashboard/dashboard";
import FormRenovasi from "@/components/renovasi/FormRenovasi";

export default function TambahRenovasiPage() {
  return (
    <Dashboard title="Penawaran RAB/OE">
      <div className="flex-1 min-h-0 flex flex-col w-full h-full overflow-hidden bg-[#FAFAFA] rounded-2xl border border-slate-200/80 shadow-xs">
        <FormRenovasi />
      </div>
    </Dashboard>
  );
}
