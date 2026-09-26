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
      <main className="flex-1 flex flex-col overflow-hidden bg-[#F1F2F4] rounded-2xl md:rounded-[32px] shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] relative border border-gray-200/60 m-1 md:my-3 md:mr-3 md:ml-0">
        
        {/* Subtle Background Pattern */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.35]" 
          style={{ 
            backgroundImage: 'radial-gradient(#9CA3AF 1px, transparent 1px)', 
            backgroundSize: '20px 20px' 
          }} 
        />
        
        {/* LOCAL HEADER */}
        <header className="h-24 shrink-0 flex items-center justify-between px-6 md:px-12 bg-transparent relative z-10">
          <div className="flex items-center gap-5">
            <button className="md:hidden p-2 rounded-xl bg-white border border-[#EAEAEA] text-[#666666] hover:bg-[#F9F9F9] shadow-sm transition-all" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <ChevronRight className="w-5 h-5" />
            </button>
            {typeof title === "string" ? (
              <h2 className="text-2xl md:text-[28px] font-extrabold text-[#111111] tracking-tight">{title}</h2>
            ) : (
              title
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {headerActions}
          </div>
        </header>

        <div className="flex-1 overflow-hidden px-6 md:px-12 pb-6 md:pb-12 flex flex-col relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
