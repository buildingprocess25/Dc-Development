"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  Database,
  FolderArchive,
  FileSignature,
  HardHat,
  Share2,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";
import {
  BUILDING_DEVELOPMENT_GM_ROLE,
  DC_BUILDING_DEVELOPMENT_MANAGER_ROLE,
  DC_BUILDING_DEVELOPMENT_SPECIALIST_ROLE,
  DC_CONTRACTOR_ROLE,
  DC_DOCUMENT_ADMIN_ROLE,
  DC_PLANNER_CONSULTANT_ROLE,
  DC_SOIL_CONSULTANT_ROLE,
  DC_SUPERVISOR_MK_ROLE,
  LOCATION_DEVELOPMENT_GM_ROLE,
  PROPERTY_DEVELOPMENT_DIRECTOR_ROLE,
  ROLE_CONFIG,
  SUPER_HUMAN_ROLE,
  normalizeRoles,
} from "@/lib/constants";

type DcMenuId =
  | "dc-projects"
  | "dc-tender-soil"
  | "dc-tender-planner"
  | "dc-tender-mk"
  | "dc-tender-contractor"
  | "dc-monitoring"
  | "dc-supervision"
  | "dc-terms"
  | "dc-bast"
  | "dc-documents"
  | "dc-users"
  | "dc-vendors";

type DcMenuItem = {
  id: DcMenuId | "shared-approval" | "shared-documents";
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  group: "Master Data" | "Tender" | "Pelaksanaan" | "Administrasi" | "Shared";
};

const dcMenus: DcMenuItem[] = [
  { id: "dc-documents", title: "Dokumen DC", href: "/dc-development/documents", icon: FolderArchive, group: "Master Data" },
];

const internalDcRoles = [
  DC_BUILDING_DEVELOPMENT_SPECIALIST_ROLE,
  DC_BUILDING_DEVELOPMENT_MANAGER_ROLE,
  BUILDING_DEVELOPMENT_GM_ROLE,
  LOCATION_DEVELOPMENT_GM_ROLE,
  PROPERTY_DEVELOPMENT_DIRECTOR_ROLE,
  SUPER_HUMAN_ROLE,
];

const dcMenuAccessByRole: Record<string, DcMenuId[]> = {
  [DC_SOIL_CONSULTANT_ROLE]: ["dc-projects", "dc-tender-soil", "dc-documents"],
  [DC_PLANNER_CONSULTANT_ROLE]: ["dc-projects", "dc-tender-planner", "dc-documents"],
  [DC_SUPERVISOR_MK_ROLE]: ["dc-projects", "dc-tender-mk", "dc-supervision", "dc-documents"],
  [DC_CONTRACTOR_ROLE]: ["dc-projects", "dc-tender-contractor", "dc-monitoring", "dc-terms", "dc-bast", "dc-documents"],
  [DC_DOCUMENT_ADMIN_ROLE]: ["dc-documents"],
  "ADMIN_DC": ["dc-documents"], // Support for ADMIN_DC role
};

internalDcRoles.forEach((role) => {
  dcMenuAccessByRole[role] = dcMenus
    .map((menu) => menu.id)
    .filter((id): id is DcMenuId => id.startsWith("dc-") && id !== "dc-users");
});

dcMenuAccessByRole[SUPER_HUMAN_ROLE] = dcMenus.map((menu) => menu.id).filter((id): id is DcMenuId => id.startsWith("dc-"));

const sharedMenus: DcMenuItem[] = [];

const getAccessibleDcMenus = (roles: string | string[] | undefined) => {
  const normalizedRoles = normalizeRoles(roles);
  const menuIds = new Set<DcMenuId>();
  normalizedRoles.forEach((role) => {
    dcMenuAccessByRole[role]?.forEach((menuId) => menuIds.add(menuId));
  });
  return dcMenus.filter((menu) => menuIds.has(menu.id as DcMenuId));
};

const getAccessibleSharedMenus = (roles: string | string[] | undefined) => {
  const normalizedRoles = normalizeRoles(roles);
  const allowedIds = new Set<string>();
  normalizedRoles.forEach((role) => {
    ROLE_CONFIG[role]?.forEach((menuId) => allowedIds.add(menuId));
  });

  return sharedMenus.filter((menu) =>
    (menu.id === "shared-approval" && allowedIds.has("menu-approval"))
    || (menu.id === "shared-documents" && allowedIds.has("menu-daftardokumen"))
  );
};

export default function MenuNavigasi({ sidebarOpen, setSidebarOpen }: { sidebarOpen: boolean; setSidebarOpen: (v: boolean) => void }) {
  const pathname = usePathname();
  const { user, logout } = useSession();

  const roleSource = user?.roles?.length ? user.roles : user?.role;
  const accessibleDcMenus = useMemo(() => getAccessibleDcMenus(roleSource), [roleSource]);
  const accessibleSharedMenus = useMemo(() => getAccessibleSharedMenus(roleSource), [roleSource]);
  const sidebarMenus = useMemo(
    () => [...accessibleDcMenus, ...accessibleSharedMenus],
    [accessibleDcMenus, accessibleSharedMenus]
  );
  
  const sidebarGroups = useMemo(() => {
    const order: DcMenuItem["group"][] = ["Master Data", "Tender", "Pelaksanaan", "Administrasi", "Shared"];
    return order
      .map((group) => ({ group, items: sidebarMenus.filter((item) => item.group === group) }))
      .filter((entry) => entry.items.length > 0);
  }, [sidebarMenus]);

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
          ${sidebarOpen ? "w-[280px] translate-x-0" : "w-0 -translate-x-full md:translate-x-0 md:w-0"}
          md:flex
        `}
      >
        {/* NEW BRANDING AREA INSIDE SIDEBAR */}
        <div className="px-6 pt-8 pb-6 shrink-0">
          <div className="flex items-center gap-4 mb-5">
            <img src="/Alfamart-logo.png" alt="Alfamart" className="h-8 object-contain" />
            <div className="h-6 w-px bg-white/20"></div>
            <img src="/Sparta-Logo.png" alt="Sparta" className="h-8 object-contain" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white leading-none">
            DC <span className="text-[#E65F2B]">Development</span>
          </h1>
        </div>

        <div className="px-6 pb-2 shrink-0 mt-4">
          <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Menu Navigasi</h2>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          <div className="flex flex-col gap-4">
            {sidebarGroups.map(({ group, items }) => {
              const GroupIcon = 
                group === "Master Data" ? Database :
                group === "Tender" ? FileSignature :
                group === "Pelaksanaan" ? HardHat :
                group === "Administrasi" ? ClipboardList : Share2;

              return (
                <section key={group} className="mx-4 rounded-[14px] overflow-hidden bg-[#2A2A2A] shadow-md border border-white/5">
                  {/* Header Group */}
                  <div className="flex items-center justify-between bg-gradient-to-r from-[#E65F2B] to-[#D3501F] px-4 py-3 text-white">
                    <div className="flex items-center gap-3">
                      <GroupIcon className="h-4 w-4 opacity-90" />
                      <p className="text-[13px] font-bold tracking-wide uppercase">{group}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 opacity-70" />
                  </div>
                  
                  {/* Items Group */}
                  <div className="flex flex-col px-2 py-2 gap-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const hrefPath = item.href.split("?")[0];
                    const isActive = pathname === hrefPath;
                    return (
                      <Link key={item.title} href={item.href} onClick={() => { if (window.innerWidth <= 768) setSidebarOpen(false); }}>
                        <div className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                          isActive
                            ? "bg-white/10 text-white shadow-sm ring-1 ring-white/10"
                            : "text-gray-400 hover:bg-white/5 hover:text-white"
                        }`}>
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors ${isActive ? "text-[#E65F2B]" : "text-gray-500 group-hover:text-[#E65F2B]"}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-[13px] font-medium leading-snug`}>{item.title}</p>
                          </div>
                          <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-[#E65F2B]" : "text-[#333333] group-hover:text-[#E65F2B]"}`} />
                        </div>
                      </Link>
                    );
                  })}
                  </div>
                </section>
              );
            })}
          </div>
          {sidebarMenus.length === 0 && (
            <div className="px-3 py-8 text-center">
              <BadgeCheck className="mx-auto mb-2 h-7 w-7 text-slate-300" />
              <p className="text-xs text-slate-400">Tidak ada menu tersedia</p>
            </div>
          )}
        </nav>

        <div className="px-6 py-6 mt-auto shrink-0 space-y-4">
          <Button variant="outline" onClick={logout} className="w-full justify-start h-11 bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white rounded-xl">
            <LogOut className="w-4 h-4 mr-3" />
            Keluar Sistem
          </Button>
          <p className="text-[10px] text-gray-500 font-medium tracking-wide uppercase">&copy; {new Date().getFullYear()} PT Sumber Alfaria Trijaya Tbk.</p>
        </div>
      </aside>
    </>
  );
}
