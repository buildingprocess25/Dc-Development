"use client";

import React from "react";
import Dashboard from "@/components/dashboard/dashboard";
import DocumentCategoryCard, { DocumentCategoryCardProps } from "@/components/dokumen/DocumentCategoryCard";
import { FileSpreadsheet, FileText, FolderKanban } from "lucide-react";

export default function DaftarDokumenHubPage() {
  const documentCards: DocumentCategoryCardProps[] = [
    {
      id: "rab-oe",
      title: "Rencana Anggaran Biaya (RAB / OE)",
      description: "Daftar dokumen estimasi biaya renovasi DC, persetujuan digital berjenjang, dan arsip PDF resmi.",
      href: "/dc-development/daftar-dokumen/rab-oe",
      icon: FileSpreadsheet,
      active: true,
      badge: "Tersedia & Aktif",
      stats: "Persetujuan 4 Tingkat"
    },
    {
      id: "gambar-kerja",
      title: "Gambar Kerja & As-Built Drawing",
      description: "Arsip gambar teknik sipil, mekanikal & elektrikal (ME), serta revisi gambar perencanaan renovasi.",
      href: "#",
      icon: FileText,
      active: false,
      badge: "Segera Hadir",
      stats: "Fase Perencanaan"
    },
    {
      id: "berita-acara",
      title: "Berita Acara Serah Terima (BAST)",
      description: "Dokumen berita acara penyelesaian pekerjaan renovasi dan serah terima fasilitas DC.",
      href: "#",
      icon: FolderKanban,
      active: false,
      badge: "Segera Hadir",
      stats: "Fase Konstruksi"
    }
  ];

  return (
    <Dashboard title="Daftar Dokumen">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-5 lg:p-6 animate-in fade-in duration-300 overflow-y-auto h-[calc(100vh-60px)] space-y-6">
        {/* Header Banner */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-orange-100 text-[#E65F2B]">
                  Pusat Arsip Digital
                </span>
                <span className="text-xs text-slate-400 font-medium">&bull; SPARTA DC Development</span>
              </div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Daftar Dokumen Proyek DC
              </h1>
              <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Akses cepat dan penelusuran seluruh dokumen resmi proyek pengembangan dan renovasi DC Alfamart.
              </p>
            </div>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {documentCards.map((doc) => (
            <DocumentCategoryCard key={doc.id} {...doc} />
          ))}
        </div>
      </div>
    </Dashboard>
  );
}
