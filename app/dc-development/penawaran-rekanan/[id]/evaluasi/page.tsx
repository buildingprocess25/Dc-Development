import React from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  canUserEvaluatePenawaranBbm,
  canUserEvaluatePenawaranSpecialist,
  isApprovalAdmin,
} from "@/lib/permissions";
import EvaluasiApprovalPenawaranTabs from "@/components/penawaran-rekanan/EvaluasiApprovalPenawaranTabs";

export default async function EvaluasiPenawaranPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/dc-development");

  const { id } = await params;
  const penawaranId = parseInt(id);

  const penawaran = await prisma.dc_penawaran_rekanan.findUnique({
    where: { id: penawaranId },
    include: {
      project: true,
      vendor: true,
      items: { orderBy: { id: "asc" } },
      gantt_items: { orderBy: { start_day: "asc" } },
      dependencies: true,
      audit_logs: { orderBy: { created_at: "desc" } },
      klarifikasi: {
        include: {
          items: { orderBy: { id: "asc" } },
          dokumen: true,
          renovasi: {
            include: {
              dokumen: true,
              item_rab: { orderBy: { id: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!penawaran) redirect("/dc-development/penawaran-rekanan");

  const roleUpper = (session.role || "").toUpperCase();
  const isAdmin = isApprovalAdmin(roleUpper) || roleUpper.includes("HEAD_OFFICE");
  const isBbm = canUserEvaluatePenawaranBbm(session);
  const isSpecialist = canUserEvaluatePenawaranSpecialist(session);

  if (!isAdmin && !isBbm && !isSpecialist) {
    redirect("/dc-development/penawaran-rekanan");
  }

  const dokumenList =
    penawaran.klarifikasi?.dokumen ||
    penawaran.klarifikasi?.renovasi?.dokumen ||
    [];

  return (
    <Dashboard title="Evaluasi & Negosiasi Penawaran">
      <div className="flex-1 h-full min-h-0 flex flex-col bg-[#FAFAFA] rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden animate-in fade-in duration-300">
        <EvaluasiApprovalPenawaranTabs
          penawaran={penawaran}
          dokumenList={dokumenList}
          isBbm={isBbm}
          isSpecialist={isSpecialist}
          isAdmin={isAdmin}
        />
      </div>
    </Dashboard>
  );
}
