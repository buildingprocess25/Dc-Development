"use client"

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, X, ChevronLeft } from 'lucide-react';

interface AppNavbarProps {
  title?: string;
  showBackButton?: boolean;
  backHref?: string;
  showMenuToggle?: boolean;
  isMenuOpen?: boolean;
  onMenuToggle?: () => void;
  showLogout?: boolean;
  onLogout?: () => void;
  showBuildingLogo?: boolean;
  rightActions?: React.ReactNode; // <--- Tambahkan ini
  variant?: "brand" | "clean";
}

export default function AppNavbar({
  title = "SPARTA Building",
  showBackButton = false,
  backHref = "/dashboard",
  showMenuToggle = false,
  isMenuOpen = false,
  onMenuToggle,
  showLogout = false,
  onLogout,
  showBuildingLogo = false,
  rightActions, // <--- Tambahkan ini
  variant = "brand",
}: AppNavbarProps) {
  const isClean = variant === "clean";
  return (
    <header className={`flex items-center justify-between p-3 md:px-6 sticky top-0 z-50 shrink-0 gap-2 ${
      isClean
        ? "border-b border-slate-200 bg-white text-slate-900"
        : "border-b border-red-900 bg-linear-to-r from-red-700 via-red-600 to-red-800 text-white shadow-md"
    }`}>
      <div className="flex items-center gap-2 md:gap-5 min-w-0">
        {showMenuToggle && onMenuToggle && (
          <button onClick={onMenuToggle} className={`p-1.5 md:p-2 rounded-lg border transition-all duration-200 shrink-0 ${isClean ? "border-slate-200 bg-slate-50 hover:bg-slate-100" : "border-white/20 bg-white/15 hover:bg-white/30"}`} aria-label="Toggle sidebar">
            {isMenuOpen ? <X className="w-4 h-4 md:w-5 md:h-5" /> : <Menu className="w-4 h-4 md:w-5 md:h-5" />}
          </button>
        )}
        {showBackButton && (
          <Link href={backHref} className="mr-1 hover:bg-white/20 p-1.5 rounded-full transition-colors shrink-0">
            <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
          </Link>
        )}
        <img src="/Alfamart-logo.png" alt="Logo Alfamart" className="h-7 w-auto md:h-10 object-contain drop-shadow-md shrink-0" />
        <div className={`h-6 md:h-8 w-px hidden md:block shrink-0 ${isClean ? "bg-slate-200" : "bg-white/30"}`} />
        <h1 className={`text-base sm:text-lg md:text-xl font-semibold tracking-[0.08em] truncate ${isClean ? "" : "drop-shadow-md"}`}>{title}</h1>
        {showBuildingLogo && (
          <img src="/Sparta-Logo.png" alt="Sparta Logo" className="h-7 w-auto md:h-10 hidden sm:block object-contain drop-shadow-md shrink-0" />
        )}
      </div>

      <div className="flex items-center gap-1.5 md:gap-3 relative z-10 shrink-0">
        {/* Render custom action di sini (seperti icon lonceng) */}
        {rightActions}
        
        {showLogout && onLogout && (
          <Button variant="outline" onClick={onLogout} className={`transition-all h-8 md:h-9 px-2.5 md:px-4 ${isClean ? "border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:text-red-700" : "border-white/30 bg-black/10 text-white shadow-sm backdrop-blur-sm hover:bg-white hover:text-red-700"}`}>
            <LogOut className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline text-xs md:text-sm">Logout</span>
          </Button>
        )}
      </div>
    </header>
  );
}
