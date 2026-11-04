import React from "react";
import Dashboard from "@/components/dashboard/dashboard";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isExternalPartnerRole } from "@/lib/permissions";
import GanttReviewCard from "@/components/penawaran-rekanan/GanttReviewCard";

export default async function ReviewGanttPage({
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
      gantt_items: true,
      dependencies: true,
    },
  });

  if (!penawaran) redirect("/dc-development/penawaran-rekanan");

  const isKontraktor = isExternalPartnerRole(session.role);

  // Kontraktor hanya boleh membuka penawaran miliknya
  if (isKontraktor && penawaran.vendor_email.toLowerCase() !== session.email.toLowerCase()) {
    redirect("/dc-development/penawaran-rekanan");
  }

  return (
    <Dashboard title="Review Final Gantt & Penawaran">
      <GanttReviewCard penawaran={penawaran} isKontraktor={isKontraktor} />
    </Dashboard>
  );
}
