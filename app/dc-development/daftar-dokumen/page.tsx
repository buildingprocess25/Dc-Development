"use client";

import React from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { FileSpreadsheet, LayoutGrid, FileSignature, FileCheck } from "lucide-react";
import { HubHeaderBanner, HubCategoryCard, HubCategoryCardProps } from "@/components/hub";

export default function DaftarDokumenHubPage() {
  const documentCards: (HubCategoryCardProps & { id: string })[] = [
    {
      id: "rab-oe",
      title: "Rencana Anggaran Biaya (RAB / OE)",
      description: "Daftar dokumen estimasi biaya renovasi DC, persetujuan digital berjenjang, dan arsip PDF resmi.",
      href: "/dc-development/daftar-dokumen/rab-oe",
      icon: FileSpreadsheet,
      active: true,
      badge: "Tersedia & Aktif",
      badgeVariant: "success",
      stats: "Persetujuan 4 Tingkat",
      actionLabel: "Buka Dokumen",
    },
    {
      id: "fungsi-ruang",
      title: "Perubahan Fungsi Ruang (PFR)",
      description: "Pengajuan perubahan, pengurangan, dan/atau penambahan fungsi ruang proyek existing sesuai SOP SAT/SOP/DCB/008.",
      href: "/dc-development/daftar-dokumen/fungsi-ruang",
      icon: LayoutGrid,
      active: true,
      badge: "Tersedia & Aktif",
      badgeVariant: "success",
      stats: "SOP SAT/FRM/DCB/010",
      actionLabel: "Buka Dokumen",
    },
    {
      id: "tender",
      title: "Usulan Peserta Tender (Kontraktor & Konsultan)",
      description: "Proposal kualifikasi rekanan pelaksana proyek renovasi DC, evaluasi kelayakan vendor, jadwal tender & konstruksi, serta arsip digital.",
      href: "/dc-development/daftar-dokumen/tender",
      icon: FileSignature,
      active: true,
      badge: "Tersedia & Aktif",
      badgeVariant: "success",
      stats: "Pagu > 1M & <= 1M",
      actionLabel: "Buka Dokumen",
    },
    {
      id: "undangan-aanwijzing",
      title: "Surat Undangan Aanwijzing",
      description: "Arsip surat undangan resmi rapat penjelasan pekerjaan (Aanwijzing), peninjauan fisik lokasi proyek, dan rekapitulasi respon kontraktor.",
      href: "/dc-development/daftar-dokumen/undangan-aanwijzing",
      icon: FileSpreadsheet,
      active: true,
      badge: "Tersedia & Aktif",
      badgeVariant: "success",
      stats: "Dual-Tier & Timeout 48H",
      actionLabel: "Buka Dokumen",
    },
    {
      id: "klarifikasi-aanwijzing",
      title: "Berita Acara Aanwijzing",
      description: "Arsip resmi Berita Acara Klarifikasi Hasil Aanwijzing, penyesuaian volume fisik lapangan, dan penambahan item pekerjaan baru.",
      href: "/dc-development/daftar-dokumen/klarifikasi-aanwijzing",
      icon: FileCheck,
      active: true,
      badge: "Tersedia & Aktif",
      badgeVariant: "success",
      stats: "SOP SAT/SOP/DCB/003",
      actionLabel: "Buka Dokumen",
    },
  ];

  return (
    <Dashboard title="Daftar Dokumen">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)] space-y-6">
        {/* Header Banner */}
        <HubHeaderBanner
          tagLabel="Pusat Arsip Digital"
          subtitle="SPARTA DC Development"
          title="Daftar Dokumen Proyek DC"
          description="Akses cepat dan penelusuran seluruh dokumen resmi proyek pengembangan dan renovasi DC Alfamart."
        />

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {documentCards.map((doc) => (
            <HubCategoryCard key={doc.id} {...doc} />
          ))}
        </div>
      </div>
    </Dashboard>
  );
}
