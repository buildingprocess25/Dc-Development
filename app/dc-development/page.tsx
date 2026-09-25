"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  ChevronRight,
  ClipboardCheck,
  FileArchive,
  FolderArchive,
  FileStack,
  FileText,
  Hammer,
  HardHat,
  Loader2,
  LogOut,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  UserCog,
} from "lucide-react";
import AppNavbar from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { fetchDcProjects, type DcProject } from "@/lib/api";

const stageLabels: Record<string, string> = {
  PROJECT_CREATED: "Project Created",
  SOIL_TENDER: "Tender Soil",
  SOIL_WORK_RESULT: "Hasil Soil",
  PLANNER_TENDER: "Tender Perencana",
  MK_TENDER: "Tender MK",
  CONTRACTOR_TENDER: "Tender Kontraktor",
  CONSTRUCTION_MONITORING: "Monitoring",
  SAT_SUPERVISION: "Pengawasan SAT",
  BAST_PREPARATION: "Persiapan BAST",
  BAST_APPROVAL: "Approval BAST",
  FINAL_TERM_BILLING: "Termin Final",
  COMPLETED: "Completed",
};

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

export default function DcDevelopmentPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useSession();
  const [projects, setProjects] = useState<DcProject[]>([]);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");

  const roleSource = user?.roles?.length ? user.roles : user?.role;
  const isDocumentOnlyDcUser = normalizeRoles(roleSource).includes(DC_DOCUMENT_ADMIN_ROLE) && !user?.isSuperHuman;
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

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [isLoading, router, user]);



  useEffect(() => {
    if (user && window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  }, [user]);

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return projects;
    return projects.filter((project) =>
      [project.project_code, project.project_name, project.location_name, project.branch_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [projects, query]);

  const activeProjects = projects.filter((project) => project.status !== "COMPLETED").length;
  const completedProjects = projects.filter((project) => project.status === "COMPLETED").length;

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
    <div className="h-screen flex flex-col overflow-hidden bg-slate-100 font-sans text-slate-800">
      <AppNavbar
        title="SPARTA Building"
        showBuildingLogo={true}
        showMenuToggle={true}
        isMenuOpen={sidebarOpen}
        onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        showLogout={true}
        onLogout={() => logout()}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <aside
          className={`
            shrink-0 bg-white border-r border-slate-200 flex flex-col z-20
            transition-all duration-300 ease-in-out overflow-hidden
            absolute md:relative top-0 left-0 h-full
            ${sidebarOpen ? "w-75 translate-x-0 shadow-xl md:shadow-none" : "w-0 -translate-x-full md:translate-x-0 md:w-0"}
          `}
        >
          <div className="px-4 pt-4 pb-3 border-b border-slate-100 shrink-0">
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Navigasi</p>
            <h2 className="mt-0.5 text-sm font-medium text-slate-700">Fitur Akses</h2>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3">
            <div className="flex flex-col gap-3">
              {sidebarGroups.map(({ group, items }) => (
                <section key={group} className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
                  <div className="flex items-center justify-between bg-red-600 px-4 py-3 text-white">
                    <p className="text-sm font-semibold">{group}</p>
                  </div>
                  {items.map((item) => {
                    const Icon = item.icon;
                    const hrefPath = item.href.split("?")[0];
                    const isActive = pathname === hrefPath;
                    return (
                      <Link key={item.title} href={item.href} onClick={() => { if (window.innerWidth <= 768) setSidebarOpen(false); }}>
                        <div className={`group flex items-center gap-3 border-b border-slate-100 px-4 py-3 transition-all duration-200 last:border-b-0 ${
                          isActive
                            ? "bg-red-50"
                            : "bg-white hover:bg-red-50"
                        }`}>
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                            isActive ? "bg-white text-red-600" : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-red-600"
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-[14px] font-medium leading-snug ${isActive ? "text-red-700" : "text-slate-700 group-hover:text-red-700"}`}>{item.title}</p>
                          </div>
                          <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-red-400" : "text-slate-300 group-hover:text-red-400"}`} />
                        </div>
                      </Link>
                    );
                  })}
                </section>
              ))}
            </div>
            {sidebarMenus.length === 0 && (
              <div className="px-3 py-8 text-center">
                <BadgeCheck className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                <p className="text-xs text-slate-400">Tidak ada menu tersedia</p>
              </div>
            )}
          </nav>

          <div className="px-4 py-2.5 border-t border-slate-100 shrink-0 space-y-2">
            <p className="text-[10px] text-slate-400 text-center">SPARTA Building — Alfamart</p>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-3 md:p-4">
          <div className="min-h-full bg-white/50 border border-slate-200 rounded-2xl p-3 md:p-5">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3 mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center font-medium text-sm">
                  {user.namaLengkap ? user.namaLengkap.charAt(0).toUpperCase() : "D"}
                </div>
                <span className="text-sm font-medium text-slate-800">{user.namaLengkap?.toUpperCase() || "DC USER"}</span>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">{user.role}</span>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{user.cabang}</span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center mt-24 text-slate-400">
                <FolderArchive className="w-16 h-16 mb-4 text-slate-300" />
                <h2 className="text-xl font-semibold text-slate-600">Selamat Datang di Penyimpanan Dokumen DC</h2>
                <p className="text-sm mt-2 text-center max-w-md">Silakan gunakan menu navigasi di sebelah kiri untuk mengelola dokumen distribution center Anda.</p>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
