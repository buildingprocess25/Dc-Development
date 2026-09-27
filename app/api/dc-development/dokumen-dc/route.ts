import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const tipe = searchParams.get('tipe') || 'all';
    const cabang = searchParams.get('cabang') || 'all';

    // Build the query where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { kode: { contains: search, mode: 'insensitive' } },
        { nama_proyek: { contains: search, mode: 'insensitive' } },
        { cabang: { contains: search, mode: 'insensitive' } },
        { dc_induk: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (tipe !== 'all') {
      where.tipe = tipe;
    }
    
    if (cabang !== 'all') {
      where.cabang = cabang;
    }

    // Fetch projects
    const projects = await prisma.dc_project.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        dokumen: {
          select: {
            fase_proyek: true,
            is_custom: true,
            file_url: true,
            catatan: true
          }
        }
      }
    });

    // Helper functions for base required slots
    const BASE_SLOTS = {
      PEMBANGUNAN: 66,
      RENOVASI: 44,
      PERLUASAN: 105
    };

    // Process progress and stats
    let totalSudahUpload = 0;
    let totalBelumUpload = 0;
    let totalUploadedSlotsAllProjects = 0;
    let totalRequiredSlotsAllProjects = 0;

    const formattedProjects = projects.map(proj => {
      // Calculate progress for each phase
      const calcProgress = (fase: "PEMBANGUNAN" | "RENOVASI" | "PERLUASAN") => {
        const faseDocs = proj.dokumen.filter(d => d.fase_proyek === fase);
        
        // Custom items add to the denominator
        const customCount = faseDocs.filter(d => d.is_custom).length;
        const requiredSlots = BASE_SLOTS[fase] + customCount;
        
        // Uploaded items (file_url is not null) add to the numerator
        const uploadedCount = faseDocs.filter(d => d.file_url !== null).length;
        
        return {
          uploaded: uploadedCount,
          required: requiredSlots,
          percentage: requiredSlots > 0 ? Math.round((uploadedCount / requiredSlots) * 100) : 0
        };
      };

      const progress = {
        PEMBANGUNAN: calcProgress("PEMBANGUNAN"),
        RENOVASI: calcProgress("RENOVASI"),
        PERLUASAN: calcProgress("PERLUASAN")
      };

      // Project level stats for top cards
      const hasUploadedAnything = (progress.PEMBANGUNAN.uploaded + progress.RENOVASI.uploaded + progress.PERLUASAN.uploaded) > 0;
      if (hasUploadedAnything) totalSudahUpload++;
      else totalBelumUpload++;

      totalUploadedSlotsAllProjects += (progress.PEMBANGUNAN.uploaded + progress.RENOVASI.uploaded + progress.PERLUASAN.uploaded);
      totalRequiredSlotsAllProjects += (progress.PEMBANGUNAN.required + progress.RENOVASI.required + progress.PERLUASAN.required);

      const totalNotes = proj.dokumen.filter(d => d.catatan && d.catatan.trim() !== "").length;

      return {
        id: proj.id,
        kode: proj.kode,
        nama_proyek: proj.nama_proyek,
        tipe: proj.tipe,
        dc_induk: proj.dc_induk,
        cabang: proj.cabang,
        progress,
        totalNotes
      };
    });

    // Count Location Types for Top Cards
    // Note: In real scenarios, you might query these independently of the filters above to keep global stats
    const allProjectsCount = await prisma.dc_project.groupBy({
      by: ['tipe'],
      _count: true
    });

    const tipeCounts = allProjectsCount.reduce((acc, curr) => {
      acc[curr.tipe] = curr._count;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      data: formattedProjects,
      summary: {
        totalLokasi: formattedProjects.length,
        dcInduk: tipeCounts['DC'] || 0,
        warehouse: tipeCounts['WAREHOUSE'] || 0,
        depo: tipeCounts['DEPO'] || 0,
        bulky: tipeCounts['BULKY'] || 0,
        storeHub: tipeCounts['STORE-HUB'] || 0,
        gudangAnak: tipeCounts['GUDANG ANAK'] || 0,
        sudahUpload: totalSudahUpload,
        belumUpload: totalBelumUpload,
        totalProgressPercent: totalRequiredSlotsAllProjects > 0 
          ? Math.round((totalUploadedSlotsAllProjects / totalRequiredSlotsAllProjects) * 100) 
          : 0
      }
    });
  } catch (error: any) {
    console.error('Error fetching dokumen DC projects:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
