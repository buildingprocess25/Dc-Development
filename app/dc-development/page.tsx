"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FolderArchive } from "lucide-react";
import Dashboard from "@/components/dashboard/dashboard";
import { useSession } from "@/context/SessionContext";

export default function DcDevelopmentPage() {
  const router = useRouter();
  const { user, isLoading } = useSession();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [isLoading, router, user]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
          <span className="text-sm font-medium">Memuat Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <Dashboard title="Dashboard">
      <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-[#FAFAFA] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center text-gray-400 -mt-20">
            <FolderArchive className="w-16 h-16 mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-600 tracking-tight">Selamat Datang di DC Development</h2>
            <p className="text-sm mt-2 text-center max-w-md">Silakan gunakan menu navigasi di sebelah kiri untuk mengelola dokumen distribution center Anda.</p>
        </div>
      </div>
    </Dashboard>
  );
}
