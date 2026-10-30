"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Dashboard from "@/components/dashboard/dashboard";
import { FormKlarifikasiAanwijzing } from "@/components/klarifikasi-aanwijzing/FormKlarifikasiAanwijzing";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EditKlarifikasiPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dc-development/klarifikasi-aanwijzing/${id}`);
        const json = await res.json();
        if (json.status === "success" && json.data) {
          setData(json.data);
        } else {
          setError(json.message || "Gagal memuat data klarifikasi.");
        }
      } catch (err: any) {
        setError(err.message || "Terjadi kesalahan sistem saat menghubungi server.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  return (
    <Dashboard title="Perbaiki Klarifikasi Aanwijzing">
      <div className="flex-1 min-h-0 flex flex-col w-full h-full overflow-hidden bg-[#FAFAFA] rounded-2xl border border-slate-200/80 shadow-xs">
        {loading ? (
          <div className="py-24 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#E65F2B] mb-2" />
            <p className="text-xs">Memuat berkas Berita Acara Klarifikasi...</p>
          </div>
        ) : error || !data ? (
          <div className="p-8 text-center text-rose-600 bg-white m-6 rounded-2xl border border-rose-200">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
            <p className="font-bold text-sm">{error || "Data tidak ditemukan."}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/dc-development/klarifikasi-aanwijzing")}
              className="mt-4 rounded-xl border-slate-300"
            >
              Kembali ke Daftar
            </Button>
          </div>
        ) : (
          <FormKlarifikasiAanwijzing mode="edit" initialData={data} />
        )}
      </div>
    </Dashboard>
  );
}
