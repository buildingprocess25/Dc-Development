"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Dashboard from "@/components/dashboard/dashboard";
import { useSession } from "@/context/SessionContext";
import {
  canAccessRabOeApproval,
  canAccessApprovalNavigation
} from "@/lib/permissions";
import {
  ClipboardCheck,
  FileText,
  ChevronRight,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApprovalSummary {
  my_pending_count: number;
  my_pending_total_biaya: number;
  bm_count: number;
  specialist_count: number;
  manager_count: number;
  approved_count: number;
  revisi_count: number;
  ditolak_count: number;
  total_all: number;
}

export default function ApprovalHubPage() {
  const { user } = useSession();
  const [summary, setSummary] = useState<ApprovalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAccessRabOe = canAccessRabOeApproval(user?.role);
  const canAccessNav = canAccessApprovalNavigation(user?.role, (user as any)?.akses_menu);

  const loadSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/dc-development/renovasi/approval?limit=1");
      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Gagal memuat ringkasan approval");
      }
      setSummary(json.summary || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  if (!canAccessNav) {
    return (
      <Dashboard title="Pusat Approval DC">
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Akses Modul Approval Dibatasi</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
            Modul Approval dibatasi khusus untuk wewenang <strong>Branch Building & Maintenance Manager</strong>, <strong>DC Building & Development Specialist</strong>, <strong>DC Building & Development Manager</strong>, atau <strong>Administrator</strong>.
          </p>
          <Link href="/dc-development" className="mt-5">
            <Button variant="outline" className="rounded-xl text-xs h-9">
              Kembali ke Dashboard
            </Button>
          </Link>
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E65F2B]/10 text-[#E65F2B] flex items-center justify-center font-bold">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-[#111111] tracking-tight">
              Pusat Approval DC
            </h2>
            <p className="text-xs text-slate-500 font-medium hidden sm:block">
              Verifikasi dan otorisasi pengajuan proyek pengembangan DC Alfamart
            </p>
          </div>
        </div>
      }
    >
      <div className="flex-1 overflow-y-auto px-6 md:px-12 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card: Rencana Anggaran Biaya (Gambar 1 layout with DC-Development styling) */}
          {canAccessRabOe ? (
            <Link
              href="/dc-development/approval/rab-oe"
              className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E65F2B] rounded-3xl"
            >
              <div className="bg-white rounded-3xl border border-slate-200/90 hover:border-[#E65F2B]/50 p-8 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center justify-between min-h-[290px] relative overflow-hidden group-hover:-translate-y-1">
                {/* Pending Notification Badge */}
                {(summary?.my_pending_count ?? 0) > 0 && (
                  <div className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-[#E65F2B] text-[11px] font-bold shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E65F2B] animate-pulse" />
                    <span>{summary?.my_pending_count} Perlu Tindakan</span>
                  </div>
                )}

                {/* Soft squircle centered icon */}
                <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#E65F2B] mt-2 mb-6 group-hover:scale-110 group-hover:bg-[#E65F2B] group-hover:text-white transition-all duration-300 shadow-xs">
                  <FileText className="w-8 h-8 transition-colors" />
                </div>

                {/* Center Content */}
                <div className="space-y-2 mb-6">
                  <h4 className="text-base md:text-lg font-bold text-slate-900 group-hover:text-[#E65F2B] transition-colors tracking-tight">
                    RAB/OE
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-[260px] mx-auto">
                    Daftar seluruh dokumen RAB/OE yang telah diajukan.
                  </p>
                </div>

                {/* Footer Action */}
                <div className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 group-hover:text-[#E65F2B] transition-colors mt-auto">
                  <span>Lihat Dokumen</span>
                  <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          ) : null}
        </div>
      </div>
    </Dashboard>
  );
}
