import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { isApprovalAdmin } from '@/lib/permissions';
import { getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const roleUpper = (session.role || '').toUpperCase();
    if (roleUpper.includes('KONTRAKTOR') || roleUpper.includes('VENDOR')) {
      return NextResponse.json({ status: 'error', message: 'Akses ditolak: Kontraktor dilarang melihat data komparasi rekanan lain' }, { status: 403 });
    }

    const { projectId } = await params;
    const pId = parseInt(projectId);

    // Ambil klarifikasi aanwijzing beserta item-item OE
    const klarifikasi = await prisma.dc_aanwijzing_klarifikasi.findFirst({
      where: { project_id: pId, status: 'APPROVED' },
      include: {
        project: true,
        items: { orderBy: { id: 'asc' } },
        dokumen: true,
      },
    });

    if (!klarifikasi) {
      return NextResponse.json(
        { status: 'error', message: 'Klarifikasi aanwijzing tidak ditemukan atau belum disetujui (APPROVED)' },
        { status: 404 }
      );
    }

    // Validasi cakupan cabang user internal
    const userCoverage = getUserCoverageBranches(session);
    if (!isApprovalAdmin(roleUpper) && !roleUpper.includes('HEAD_OFFICE') && !roleUpper.includes('DIRECTOR')) {
      if (!isBranchAccessible(klarifikasi.cabang, userCoverage)) {
        return NextResponse.json({ status: 'error', message: 'Di luar cakupan cabang wewenang Anda' }, { status: 403 });
      }
    }

    // Ambil seluruh penawaran kontraktor pada proyek ini (kecuali yang masih DRAFT)
    const penawaranList = await prisma.dc_penawaran_rekanan.findMany({
      where: {
        project_id: pId,
      },
      include: {
        vendor: true,
        items: { orderBy: { id: 'asc' } },
        gantt_items: { orderBy: { start_day: 'asc' } },
        dependencies: true,
        audit_logs: { orderBy: { created_at: 'desc' } },
      },
      orderBy: { grand_total: 'asc' },
    });

    return NextResponse.json({
      status: 'success',
      data: {
        klarifikasi,
        penawaranList,
      },
    });
  } catch (error: any) {
    console.error('Error in komparasi route:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
