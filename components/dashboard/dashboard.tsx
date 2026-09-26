"use client";

import React, { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import MenuNavigasi from "./menu-navigasi";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: React.ReactNode;
  headerActions?: React.ReactNode;
}

export default function Dashboard({ children, title, headerActions }: DashboardLayoutProps) {
  const { user } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (user && window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }, [user]);

  if (!user) return null;

  return (
    <div className="h-screen flex flex-row overflow-hidden bg-[#1F1F1F] font-sans text-slate-800 p-2 md:p-3 gap-3">
      <MenuNavigasi sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      
      {/* FLOATING MAIN CONTENT CARD */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#FAFAFA] rounded-2xl md:rounded-3xl shadow-2xl relative border border-white/10 m-1 md:my-0 md:mr-0">
        
        {/* LOCAL HEADER */}
        <header className="h-20 shrink-0 flex items-center justify-between px-6 md:px-10 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <ChevronRight className="w-5 h-5" />
            </button>
            {typeof title === "string" ? (
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">{title}</h2>
            ) : (
              title
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {headerActions}
            <div className="items-center gap-3 bg-gray-50 rounded-full p-1.5 pr-4 border border-gray-100 ml-2 hidden sm:flex">
              <div className="w-9 h-9 rounded-full bg-[#1F1F1F] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                {user.namaLengkap ? user.namaLengkap.charAt(0).toUpperCase() : "D"}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-900 leading-none">{user.namaLengkap?.toUpperCase() || "DC USER"}</span>
                <span className="text-[10px] font-semibold text-[#E65F2B] uppercase tracking-wider mt-1">{user.role.replace(/_/g, ' ')} &bull; {user.cabang}</span>
              </div>
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}
