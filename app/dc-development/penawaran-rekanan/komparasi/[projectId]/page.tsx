import React from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canUserSelectWinner, isApprovalAdmin } from "@/lib/permissions";
import { getUserCoverageBranches, isBranchAccessible } from "@/lib/branches";
import KomparasiMultiRekananMatrix from "@/components/penawaran-rekanan/KomparasiMultiRekananMatrix";

export default async function KomparasiPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/dc-development");

  const roleUpper = (session.role || "").toUpperCase();
  const isKontraktor = roleUpper.includes("KONTRAKTOR") || roleUpper.includes("VENDOR");

  // Kontraktor dilarang melihat dashboard komparasi multi-rekanan
  if (isKontraktor) {
    redirect("/dc-development/penawaran-rekanan");
  }

  const { projectId } = await params;
  const { from } = (await searchParams) || {};
  const pId = parseInt(projectId);

  const isFromApproval = from === "approval";
  const backUrl = isFromApproval
    ? "/dc-development/approval/penawaran-rekanan"
    : "/dc-development/penawaran-rekanan";
  const backLabel = isFromApproval
    ? "Kembali ke Antrean Approval"
    : "Kembali ke Daftar Penawaran";

  const klarifikasi = await prisma.dc_aanwijzing_klarifikasi.findFirst({
    where: { project_id: pId, status: "APPROVED" },
    include: {
      project: true,
      items: { orderBy: { id: "asc" } },
      dokumen: true,
      aanwijzing: {
        include: {
          peserta: {
            include: {
              vendor: true,
            },
          },
        },
      },
    },
  });

  if (!klarifikasi) redirect("/dc-development/penawaran-rekanan");

  // Validasi cakupan cabang user internal
  const userCoverage = getUserCoverageBranches(session);
  if (!isApprovalAdmin(roleUpper) && !roleUpper.includes("HEAD_OFFICE") && !roleUpper.includes("DIRECTOR")) {
    if (!isBranchAccessible(klarifikasi.cabang, userCoverage)) {
      redirect("/dc-development/penawaran-rekanan");
    }
  }

  const penawaranList = await prisma.dc_penawaran_rekanan.findMany({
    where: { project_id: pId },
    include: {
      vendor: true,
      items: { orderBy: { id: "asc" } },
      gantt_items: { orderBy: { start_day: "asc" } },
      dependencies: true,
      audit_logs: { orderBy: { created_at: "desc" } },
    },
    orderBy: { grand_total: "asc" },
  });

  const totalOe = (klarifikasi.items || []).reduce(
    (sum: number, it: any) => sum + (it.total_biaya_akhir || 0),
    0
  );
  const canSelectWinner = canUserSelectWinner(session, totalOe);

  return (
    <Dashboard title="Komparasi & Evaluasi Penawaran Tender">
      <div className="flex-1 h-full min-h-0 flex flex-col bg-[#FAFAFA] rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden animate-in fade-in duration-300">
        <KomparasiMultiRekananMatrix
          klarifikasi={klarifikasi}
          penawaranList={penawaranList}
          canSelectWinner={canSelectWinner}
          backUrl={backUrl}
          backLabel={backLabel}
        />
      </div>
    </Dashboard>
  );
}
