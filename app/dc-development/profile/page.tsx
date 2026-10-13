"use client";

import React, { useEffect, useState, useMemo } from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProfileTable, DcProfile } from "@/components/profile-dc/ProfileTable";
import { ViewProfileModal } from "@/components/profile-dc/ViewProfileModal";
import { EditProfileModal } from "@/components/profile-dc/EditProfileModal";
import { useSession } from "@/context/SessionContext";
import { BranchFilterSelect } from "@/components/ui/branch-filter-select";
import { getBranchesUnderInduk, getUserCoverageBranches, isBranchAccessible } from "@/lib/branches";

const TIPE_ORDER = ["DC", "WAREHOUSE", "DEPO", "BULKY", "STORE-HUB", "GUDANG ANAK"];

export default function ProfileDcPage() {
  const { user } = useSession();
  const [profiles, setProfiles] = useState<DcProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");

  const [selectedViewProfile, setSelectedViewProfile] = useState<DcProfile | null>(null);
  const [selectedEditProfile, setSelectedEditProfile] = useState<DcProfile | null>(null);

  const userCoverageBranches = useMemo(() => getUserCoverageBranches(user), [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/dc-development/profile");
      const json = await res.json();
      if (!res.ok || json.status !== 'success') throw new Error(json.message || "Gagal memuat profile");
      setProfiles(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const uniqueBranches = useMemo(() => {
    const branches = new Set(profiles.map(p => {
      if (!p.cabang) return "";
      return p.cabang.charAt(0).toUpperCase() + p.cabang.slice(1).toLowerCase();
    }).filter(Boolean));
    return Array.from(branches).sort();
  }, [profiles]);

  const uniqueTypes = useMemo(() => {
    const types = new Set(profiles.map(p => p.tipe).filter(Boolean));
    return Array.from(types).sort((a, b) => {
      const indexA = TIPE_ORDER.indexOf(a);
      const indexB = TIPE_ORDER.indexOf(b);
      const orderA = indexA !== -1 ? indexA : 99;
      const orderB = indexB !== -1 ? indexB : 99;
      return orderA - orderB;
    });
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    let result = profiles;

    // 1. Batasi berdasarkan coverage akun
    if (userCoverageBranches) {
      result = result.filter(p => isBranchAccessible(p.cabang, userCoverageBranches));
    }

    if (query) {
      const normalized = query.toLowerCase();
      result = result.filter(
        (p) =>
          p.kode?.toLowerCase().includes(normalized) ||
          p.nama_proyek?.toLowerCase().includes(normalized) ||
          p.cabang?.toLowerCase().includes(normalized)
      );
    }

    if (typeFilter !== "all") {
      result = result.filter(p => p.tipe === typeFilter);
    }

    if (branchFilter !== "all") {
      const childBranches = getBranchesUnderInduk(branchFilter);
      result = result.filter(p => childBranches.some(b => b.toUpperCase() === (p.cabang || "").toUpperCase()));
    }

    // Sort result by TIPE_ORDER then alphabetical
    result.sort((a, b) => {
      const indexA = TIPE_ORDER.indexOf(a.tipe);
      const indexB = TIPE_ORDER.indexOf(b.tipe);
      const orderA = indexA !== -1 ? indexA : 99;
      const orderB = indexB !== -1 ? indexB : 99;

      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return (a.nama_proyek || "").localeCompare(b.nama_proyek || "");
    });

    return result;
  }, [profiles, query, typeFilter, branchFilter, userCoverageBranches]);

  return (
    <Dashboard title="Profile DC">
      <div className="flex flex-col bg-[#FAFAFA] p-3 md:p-4 lg:p-5 animate-in fade-in duration-500 overflow-y-auto h-[calc(100vh-60px)]">

        {/* Toolbar Section */}
        <div className="bg-white p-2.5 lg:p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-2.5 mb-4 items-center sticky top-0 z-20">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Cari kode, nama proyek, DC induk, atau cabang.."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 w-full rounded-lg border-slate-200 focus-visible:ring-orange-500 h-10 text-sm bg-slate-50/50"
            />
          </div>
          <div className="flex gap-3 w-full lg:w-auto">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full lg:w-[140px] rounded-lg h-10 text-sm border-slate-200 bg-white">
                <SelectValue placeholder="Semua Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                {uniqueTypes.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <BranchFilterSelect
              value={branchFilter}
              onChange={setBranchFilter}
              placeholder="Semua Cabang"
              className="w-full lg:w-[160px]"
            />
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <ProfileTable
            loading={loading}
            error={error}
            profiles={filteredProfiles}
            allProfiles={profiles}
            onView={(p) => setSelectedViewProfile(p)}
            onEdit={(p) => setSelectedEditProfile(p)}
          />
        </div>

        <ViewProfileModal
          open={!!selectedViewProfile}
          onOpenChange={(open) => !open && setSelectedViewProfile(null)}
          profile={selectedViewProfile}
        />

        <EditProfileModal
          open={!!selectedEditProfile}
          onOpenChange={(open) => !open && setSelectedEditProfile(null)}
          profile={selectedEditProfile}
          onSuccess={loadData}
        />
      </div>
    </Dashboard>
  );
}
