"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Dashboard from "@/components/dashboard/dashboard";
import { useSession } from "@/context/SessionContext";
import {
  canAccessRabOeApproval,
  canAccessFungsiRuangApproval,
  canAccessTenderApproval,
  canAccessApprovalNavigation,
  canAccessKlarifikasiAanwijzingApproval,
  canAccessPenawaranRekananApproval,
  isApprovalAdmin,
} from "@/lib/permissions";
import {
  FileSpreadsheet,
  LayoutGrid,
  FileSignature,
  ShieldCheck,
  ClipboardCheck,
  FileCheck,
  Scale,
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

interface TenderApprovalSummary {
  my_pending_count: number;
  total_all: number;
}

interface PenawaranApprovalSummary {
  my_pending_count: number;
  total_all: number;
}

export default function ApprovalHubPage() {
  const { user } = useSession();
  const [summary, setSummary] = useState<ApprovalSummary | null>(null);
  const [pfrSummary, setPfrSummary] = useState<FungsiRuangApprovalSummary | null>(null);
  const [tenderSummary, setTenderSummary] = useState<TenderApprovalSummary | null>(null);
  const [penawaranSummary, setPenawaranSummary] = useState<PenawaranApprovalSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const canAccessRabOe = canAccessRabOeApproval(user?.role);
  const canAccessFungsiRuang = canAccessFungsiRuangApproval(user?.role);
  const canAccessTender = canAccessTenderApproval(user?.role);
  const canAccessKlarifikasi = canAccessKlarifikasiAanwijzingApproval(user?.role);
  const canAccessPenawaran = canAccessPenawaranRekananApproval(user?.role);
  const canAccessAanwijzing = isApprovalAdmin(user?.role) || (user?.role?.toUpperCase().includes("MANAGER") && user?.role?.toUpperCase().includes("DEVELOPMENT"));
  const canAccessNav = canAccessApprovalNavigation(user?.role, (user as any)?.akses_menu) || canAccessAanwijzing || canAccessKlarifikasi || canAccessPenawaran;

  const [aanwijzingPending, setAanwijzingPending] = useState(0);
  const [klarifikasiPending, setKlarifikasiPending] = useState(0);

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
      if (canAccessTender) {
        promises.push(
          fetch("/api/dc-development/tender/approval?limit=1")
            .then((r) => r.json())
            .then((j) => {
              if (j.status === "success") setTenderSummary(j.summary || null);
            })
            .catch(() => {})
        );
      }
      if (canAccessAanwijzing) {
        promises.push(
          fetch("/api/dc-development/aanwijzing?status=MENUNGGU_APPROVAL_DC_MANAGER")
            .then((r) => r.json())
            .then((j) => {
              if (j.status === "success" && Array.isArray(j.data)) {
                setAanwijzingPending(j.data.length);
              }
            })
            .catch(() => {})
        );
      }
      if (canAccessKlarifikasi) {
        promises.push(
          fetch("/api/dc-development/klarifikasi-aanwijzing/summary")
            .then((r) => r.json())
            .then((j) => {
              if (j.status === "success" && j.data) {
                setKlarifikasiPending(j.data.my_pending_count || 0);
              }
            })
            .catch(() => {})
        );
      }
      if (canAccessPenawaran) {
        promises.push(
          fetch("/api/dc-development/penawaran-rekanan/approval?tab=my-queue&limit=1")
            .then((r) => r.json())
            .then((j) => {
              if (j.status === "success" && j.summary) {
                setPenawaranSummary(j.summary);
              }
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
  const tenderPending = tenderSummary?.my_pending_count ?? 0;
  const penawaranPending = penawaranSummary?.my_pending_count ?? 0;

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

  if (canAccessTender) {
    approvalCards.push({
      id: "tender",
      title: "Pengajuan Rekanan Tender",
      description: "Verifikasi calon rekanan kontraktor & konsultan pengawas, pra-kualifikasi peserta, jadwal pelaksanaan, dan otorisasi tender.",
      href: "/dc-development/approval/tender",
      icon: FileSignature,
      active: true,
      badge: tenderPending > 0 ? `${tenderPending} Perlu Tindakan` : "Semua Diproses",
      badgeVariant: tenderPending > 0 ? "orange" : "success",
      stats: "Threshold > Rp 1M & <= Rp 1M",
      actionLabel: "Buka Antrean",
    });
  }

  if (canAccessAanwijzing) {
    approvalCards.push({
      id: "aanwijzing",
      title: "Undangan Aanwijzing (< 1M)",
      description: "Persetujuan kelanjutan rapat Aanwijzing proyek < 1M dengan kehadiran rekanan kontraktor kurang dari 3 peserta.",
      href: "/dc-development/approval/aanwijzing",
      icon: ClipboardCheck,
      active: true,
      badge: aanwijzingPending > 0 ? `${aanwijzingPending} Perlu Tindakan` : "Semua Diproses",
      badgeVariant: aanwijzingPending > 0 ? "orange" : "success",
      stats: "Otorisasi DC Manager (< 3 Rekanan)",
      actionLabel: "Buka Antrean",
    });
  }

  if (canAccessKlarifikasi) {
    approvalCards.push({
      id: "klarifikasi-aanwijzing",
      title: "Klarifikasi Aanwijzing",
      description: "Persetujuan Berita Acara Klarifikasi penyesuaian volume dan penambahan item pekerjaan pasca rapat aanwijzing fisik.",
      href: "/dc-development/approval/klarifikasi-aanwijzing",
      icon: FileCheck,
      active: true,
      badge: klarifikasiPending > 0 ? `${klarifikasiPending} Perlu Tindakan` : "Semua Diproses",
      badgeVariant: klarifikasiPending > 0 ? "orange" : "success",
      stats: "SOP SAT/SOP/DCB/003",
      actionLabel: "Buka Antrean",
    });
  }

  if (canAccessPenawaran) {
    approvalCards.push({
      id: "penawaran-rekanan",
      title: "Evaluasi Penawaran Rekanan",
      description: "Evaluasi teknis & finansial penawaran tender kontraktor, verifikasi BoQ vs OE, serta negosiasi spesifikasi dan harga.",
      href: "/dc-development/approval/penawaran-rekanan",
      icon: Scale,
      active: true,
      badge: penawaranPending > 0 ? `${penawaranPending} Perlu Tindakan` : "Semua Diproses",
      badgeVariant: penawaranPending > 0 ? "orange" : "success",
      stats: "Tahap BBM & DC Specialist",
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
