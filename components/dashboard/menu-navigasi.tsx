"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  ChevronRight,
  ChevronDown,
  Database,
  FolderArchive,
  LogOut,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";

type DcMenuId = "dc-profile" | "dc-documents" | "manajemen-user";

type DcMenuItem = {
  id: DcMenuId;
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "Master Data" | "Administrator";
};

const dcMenus: DcMenuItem[] = [
  { id: "dc-profile", title: "Profile DC", href: "/dc-development/profile", icon: Database, group: "Master Data" },
  { id: "dc-documents", title: "Dokumen DC", href: "/dc-development/dokumen-dc", icon: FolderArchive, group: "Master Data" },
  { id: "manajemen-user", title: "Manajemen User", href: "/dc-development/manajemen-user", icon: Users, group: "Administrator" },
];

export default function MenuNavigasi({ sidebarOpen, setSidebarOpen }: { sidebarOpen: boolean; setSidebarOpen: (v: boolean) => void }) {
  const pathname = usePathname();
  const { user, logout } = useSession();
  
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ 
    "Master Data": true, 
    "Administrator": true 
  });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem("sidebarOpenGroups");
    if (saved) {
      try {
        setOpenGroups(JSON.parse(saved));
      } catch (e) {}
    } else {
      const activeGroup = dcMenus.find(m => pathname.includes(m.href))?.group;
      const initial = { 
        "Master Data": true,
        ...(activeGroup ? { [activeGroup]: true } : {})
      };
      setOpenGroups(initial);
      localStorage.setItem("sidebarOpenGroups", JSON.stringify(initial));
    }
  }, [pathname]);

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => {
      const next = { ...prev, [group]: !prev[group] };
      localStorage.setItem("sidebarOpenGroups", JSON.stringify(next));
      return next;
    });
  };

  const role = user?.role?.toUpperCase();
  // Pisahkan string berdasarkan koma, misalnya "dc-profile,dc-documents"
  const userMenus = (user as any)?.akses_menu 
    ? (user as any).akses_menu.split(',').map((m: string) => m.trim()) 
    : [];

  const sidebarGroups = useMemo(() => {
    if (!role) return [];
    
    // Filter menu dcMenus berdasarkan yang ada di akses_menu user
    const isAll = userMenus.includes("all") || userMenus.includes("ALL");
    const allowedMenus = dcMenus.filter(menu => isAll || userMenus.includes(menu.id));
    
    if (allowedMenus.length === 0) return [];
    
    const grouped = allowedMenus.reduce((acc, curr) => {
      if (!acc[curr.group]) acc[curr.group] = [];
      acc[curr.group].push(curr);
      return acc;
    }, {} as Record<string, DcMenuItem[]>);

    return Object.keys(grouped).map(group => ({
      group,
      items: grouped[group]
    }));
  }, [role, userMenus.join(',')]);

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`
          shrink-0 bg-[#1F1F1F] text-white flex flex-col z-20
          transition-all duration-300 ease-in-out overflow-hidden
          absolute md:relative top-0 left-0 h-full
          ${sidebarOpen ? "w-[240px] translate-x-0" : "w-0 -translate-x-full md:translate-x-0 md:w-0"}
          md:flex
        `}
      >
        {/* NEW BRANDING AREA INSIDE SIDEBAR */}
        <div className="px-4 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <img src="/Alfamart-logo.png" alt="Alfamart" className="h-6 object-contain" />
            <div className="h-5 w-px bg-white/20"></div>
            <img src="/Sparta-Logo.png" alt="Sparta" className="h-6 object-contain" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white leading-none">
            DC <span className="text-[#E65F2B]">Development</span>
          </h1>
        </div>

        <div className="px-4 pb-2 shrink-0 mt-2">
          <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Menu Navigasi</h2>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          <div className="flex flex-col gap-4">
            {sidebarGroups.map(({ group, items }) => {
                const GroupIcon = Database;

              return (
                <section key={group} className="mx-4 rounded-[14px] overflow-hidden bg-[#2A2A2A] shadow-md border border-white/5">
                  {/* Header Group */}
                  <div 
                    className={`flex items-center justify-between px-3 py-2.5 text-white cursor-pointer select-none transition-colors hover:brightness-110 ${
                      group === "Administrator" ? "bg-gradient-to-r from-gray-700 to-gray-800" : "bg-gradient-to-r from-[#E65F2B] to-[#D3501F]"
                    }`}
                    onClick={() => toggleGroup(group)}
                  >
                    <div className="flex items-center gap-2.5">
                      <GroupIcon className="h-3.5 w-3.5 opacity-90" />
                      <p className="text-[12px] font-bold tracking-wide uppercase">{group}</p>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform duration-200 ${(!isClient || openGroups[group]) ? "rotate-180" : ""}`} />
                  </div>
                  
                  {/* Items Group */}
                  <div className={`flex flex-col px-2 gap-1 overflow-hidden transition-all duration-300 ${!isClient || openGroups[group] ? "max-h-[500px] py-2" : "max-h-0 py-0"}`}>
                  {items.map((item) => {
                    const Icon = item.icon;
                    const hrefPath = item.href.split("?")[0];
                    const isActive = pathname === hrefPath;
                    return (
                      <Link key={item.title} href={item.href} onClick={() => { if (window.innerWidth <= 768) setSidebarOpen(false); }}>
                        <div className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 ${
                          isActive
                            ? "bg-white/10 text-white shadow-sm ring-1 ring-white/10"
                            : "text-gray-400 hover:bg-white/5 hover:text-white"
                        }`}>
                          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${isActive ? "text-[#E65F2B]" : "text-gray-500 group-hover:text-[#E65F2B]"}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-[12px] font-medium leading-snug`}>{item.title}</p>
                          </div>
                          <ChevronRight className={`h-3 w-3 shrink-0 ${isActive ? "text-[#E65F2B]" : "text-[#333333] group-hover:text-[#E65F2B]"}`} />
                        </div>
                      </Link>
                    );
                  })}
                  </div>
                </section>
              );
            })}
          </div>
          {sidebarGroups.length === 0 && (
            <div className="px-3 py-8 text-center">
              <BadgeCheck className="mx-auto mb-2 h-7 w-7 text-slate-300" />
              <p className="text-xs text-slate-400">Tidak ada menu tersedia</p>
            </div>
          )}
        </nav>

        <div className="px-4 pb-4 mt-auto shrink-0 flex flex-col gap-4">
          
          {/* USER PROFILE IN SIDEBAR */}
          <div className="flex items-center gap-2.5 bg-white/5 rounded-[12px] p-2 pr-3 border border-white/10 transition-colors hover:bg-white/10">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E65F2B] to-[#D3501F] text-white flex items-center justify-center font-extrabold text-[13px] shadow-sm shrink-0">
              {user?.namaLengkap ? user.namaLengkap.charAt(0).toUpperCase() : "D"}
            </div>
            <div className="flex flex-col min-w-0 overflow-hidden">
              <span className="text-[12px] font-bold text-white leading-tight truncate">
                {user?.namaLengkap?.toUpperCase() || "DC USER"}
              </span>
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5 truncate">
                {user?.role?.replace(/_/g, ' ')} &bull; {user?.cabang}
              </span>
            </div>
          </div>

          <Button variant="outline" onClick={logout} className="w-full justify-start h-11 bg-transparent border-white/10 text-gray-300 hover:bg-[#D32F2F] hover:text-white hover:border-[#D32F2F] rounded-[14px] transition-all">
            <LogOut className="w-4 h-4 mr-3" />
            <span className="font-semibold text-[13px]">Keluar Sistem</span>
          </Button>
        </div>
      </aside>
    </>
  );
}
