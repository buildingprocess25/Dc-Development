import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ success: false, message: 'Invalid ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const fase = searchParams.get('fase'); // e.g. "PEMBANGUNAN", "RENOVASI", "PERLUASAN"

    // Optional fase filter
    const whereClause: any = { project_id: projectId };
    const riwayatWhereClause: any = { dokumen: { project_id: projectId } };
    
    if (fase && fase !== 'ALL') {
      whereClause.fase_proyek = fase;
      riwayatWhereClause.dokumen.fase_proyek = fase;
    }

    // Fetch project to ensure it exists
    const project = await prisma.dc_project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
    }

    // Fetch documents for this project (and specific phase if provided)
    const dokumen = await prisma.dc_dokumen.findMany({
      where: whereClause,
      orderBy: { created_at: 'asc' }
    });

    // Fetch riwayat
    const riwayat = await prisma.dc_dokumen_riwayat.findMany({
      where: riwayatWhereClause,
      include: {
        dokumen: {
          select: {
            kategori: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // Enrich riwayat and dokumen with user names
    const emails = Array.from(new Set([
      ...riwayat.map((r: any) => r.created_by),
      ...dokumen.map((d: any) => d.updated_by).filter(Boolean)
    ]));
    const users = await prisma.dc_users.findMany({
      where: { email: { in: emails } },
      select: { email: true, nama: true, role: true }
    });
    const userMap = new Map(users.map((u: any) => [u.email, u]));

    const enrichedRiwayat = riwayat.map((r: any) => ({
      ...r,
      user_nama: userMap.get(r.created_by)?.nama || r.created_by,
      user_role: userMap.get(r.created_by)?.role || 'SISTEM'
    }));

    const enrichedDokumen = dokumen.map((d: any) => ({
      ...d,
      user_nama: d.updated_by ? (userMap.get(d.updated_by)?.nama || d.updated_by) : null
    }));

    return NextResponse.json({
      success: true,
      data: {
        project,
        dokumen: enrichedDokumen,
        riwayat: enrichedRiwayat
      }
    });

  } catch (error: any) {
    console.error('Error fetching detail dokumen DC:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
