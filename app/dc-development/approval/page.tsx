"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Dashboard from "@/components/dashboard/dashboard";
import { useSession } from "@/context/SessionContext";
import {
  canAccessRabOeApproval,
  canAccessFungsiRuangApproval,
  canAccessApprovalNavigation
} from "@/lib/permissions";
import {
  FileSpreadsheet,
  LayoutGrid,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HubHeaderBanner, HubCategoryCard, HubCategoryCardProps } from "@/components/hub";

interface ApprovalSummary {
  my_pending_count: number;
  total_all: number;
}

interface FungsiRuangApprovalSummary {
  my_pending_count: number;
  total_all: number;
}

export default function ApprovalHubPage() {
  const { user } = useSession();
  const [summary, setSummary] = useState<ApprovalSummary | null>(null);
  const [pfrSummary, setPfrSummary] = useState<FungsiRuangApprovalSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const canAccessRabOe = canAccessRabOeApproval(user?.role);
  const canAccessFungsiRuang = canAccessFungsiRuangApproval(user?.role);
  const canAccessNav = canAccessApprovalNavigation(user?.role, (user as any)?.akses_menu);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const promises: Promise<any>[] = [];
      if (canAccessRabOe) {
        promises.push(
          fetch("/api/dc-development/renovasi/approval?limit=1")
            .then((r) => r.json())
            .then((j) => {
              if (j.status === "success") setSummary(j.summary || null);
            })
            .catch(() => {})
        );
      }
      if (canAccessFungsiRuang) {
        promises.push(
          fetch("/api/dc-development/fungsi-ruang/approval?limit=1")
            .then((r) => r.json())
            .then((j) => {
              if (j.status === "success") setPfrSummary(j.summary || null);
            })
            .catch(() => {})
        );
      }
      await Promise.all(promises);
    } catch (err: any) {
      console.error("Gagal memuat ringkasan approval:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [user?.role]);

  if (!canAccessNav) {
    return (
      <Dashboard title="Pusat Approval DC">
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Akses Modul Approval Dibatasi</h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
            Modul Approval dibatasi khusus untuk approver yang berwenang atau <strong>Administrator</strong>.
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

  const rabOePending = summary?.my_pending_count ?? 0;
  const pfrPending = pfrSummary?.my_pending_count ?? 0;

  const approvalCards: (HubCategoryCardProps & { id: string })[] = [];

  if (canAccessRabOe) {
    approvalCards.push({
      id: "rab-oe",
      title: "Rencana Anggaran Biaya (RAB / OE)",
      description: "Verifikasi estimasi biaya renovasi DC, penawaran harga vendor, dan otorisasi berjenjang.",
      href: "/dc-development/approval/rab-oe",
      icon: FileSpreadsheet,
      active: true,
      badge: rabOePending > 0 ? `${rabOePending} Perlu Tindakan` : "Semua Diproses",
      badgeVariant: rabOePending > 0 ? "orange" : "success",
      stats: "Persetujuan 3 Tingkat",
      actionLabel: "Buka Antrean",
    });
  }

  if (canAccessFungsiRuang) {
    approvalCards.push({
      id: "fungsi-ruang",
      title: "Perubahan Fungsi Ruang (PFR)",
      description: "Persetujuan perubahan, pengurangan, dan penambahan fungsi ruang proyek existing sesuai SOP SAT/SOP/DCB/008.",
      href: "/dc-development/approval/fungsi-ruang",
      icon: LayoutGrid,
      active: true,
      badge: pfrPending > 0 ? `${pfrPending} Perlu Tindakan` : "Semua Diproses",
      badgeVariant: pfrPending > 0 ? "orange" : "success",
      stats: "SOP SAT/FRM/DCB/010",
      actionLabel: "Buka Antrean",
    });
  }

  return (
    <Dashboard title="Pusat Approval DC">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)] space-y-6">
        {/* Header Banner */}
        <HubHeaderBanner
          tagLabel="Pusat Verifikasi & Otorisasi"
          subtitle="SPARTA DC Development"
          title="Pusat Approval Proyek DC"
          description="Verifikasi, telaah berkas, dan otorisasi persetujuan digital berjenjang untuk seluruh pengajuan proyek pengembangan & renovasi DC Alfamart."
        />

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {approvalCards.map((card) => (
            <HubCategoryCard key={card.id} {...card} />
          ))}
        </div>
      </div>
    </Dashboard>
  );
}
