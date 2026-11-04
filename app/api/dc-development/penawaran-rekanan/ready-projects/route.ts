import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';
import { isApprovalAdmin, isExternalPartnerRole } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const roleUpper = (session.role || '').toUpperCase();
    const isRekananUser = isExternalPartnerRole(session.role);
    const userCoverage = getUserCoverageBranches(session);

    // Ambil seluruh klarifikasi yang APPROVED
    const klarifikasiList = await prisma.dc_aanwijzing_klarifikasi.findMany({
      where: {
        status: 'APPROVED',
      },
      include: {
        project: true,
        aanwijzing: {
          include: {
            peserta: {
              include: {
                vendor: true,
              },
            },
          },
        },
        penawaran_rekanan: {
          select: {
            id: true,
            nomor_penawaran: true,
            vendor_id: true,
            vendor_nama: true,
            vendor_email: true,
            status: true,
            grand_total: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const isMatchingParticipant = (p: any) => {
      const emailMatch = p.email && session.email && p.email.toLowerCase() === session.email.toLowerCase();
      const ptMatch =
        session.nama_pt &&
        p.vendor?.nama_perusahaan &&
        (p.vendor.nama_perusahaan.trim().toUpperCase() === session.nama_pt.trim().toUpperCase() ||
          p.vendor.nama_perusahaan.toUpperCase().includes(session.nama_pt.toUpperCase()) ||
          session.nama_pt.toUpperCase().includes(p.vendor.nama_perusahaan.toUpperCase()));
      return Boolean(emailMatch || ptMatch);
    };

    const readyProjects = [];

    for (const k of klarifikasiList) {
      // Validasi akses cabang untuk user internal
      if (!isRekananUser && !isApprovalAdmin(roleUpper) && !roleUpper.includes('HEAD_OFFICE') && !roleUpper.includes('DIRECTOR')) {
        if (!isBranchAccessible(k.cabang, userCoverage)) continue;
      }

      let matchedPeserta: any = null;
      if (isRekananUser) {
        matchedPeserta = k.aanwijzing.peserta.find(
          (p) => isMatchingParticipant(p) && p.status_kehadiran_aktual === 'HADIR_AKTUAL'
        );
        // Jika rekanan tidak terdaftar atau tidak HADIR_AKTUAL, tidak berhak input penawaran
        if (!matchedPeserta) continue;
      }

      // Cek apakah sudah ada penawaran oleh rekanan ini
      const existingPenawaran = k.penawaran_rekanan.find((p) => {
        if (isRekananUser) {
          const emailMatch = p.vendor_email && session.email && p.vendor_email.toLowerCase() === session.email.toLowerCase();
          const ptMatch =
            session.nama_pt &&
            (p.vendor_nama.trim().toUpperCase() === session.nama_pt.trim().toUpperCase() ||
              p.vendor_nama.toUpperCase().includes(session.nama_pt.toUpperCase()) ||
              session.nama_pt.toUpperCase().includes(p.vendor_nama.toUpperCase()));
          return Boolean(emailMatch || ptMatch);
        }
        return false;
      });

      // Hitung status jendela tender berdasarkan tanggal hari ini vs tanggal tender
      const todayStr = new Date().toLocaleDateString("en-CA");
      const tenderDateObj = k.tanggal_tender
        ? new Date(k.tanggal_tender)
        : new Date("2026-11-03T00:00:00.000Z");
      const tenderDateStr = tenderDateObj.toLocaleDateString("en-CA");

      let windowStatus: "MENUNGGU_JADWAL" | "DIBUKA" | "TERLEWAT" = "DIBUKA";
      if (todayStr < tenderDateStr) {
        windowStatus = "MENUNGGU_JADWAL";
      } else if (todayStr > tenderDateStr) {
        windowStatus = "TERLEWAT";
      } else {
        windowStatus = "DIBUKA";
      }

      const isAlreadySubmitted = Boolean(
        existingPenawaran && existingPenawaran.status !== "DRAFT"
      );

      // Jika jadwal lewat dan rekanan belum mengajukan penawaran resmi (belum isi atau masih draft), otomatis tereliminasi
      const isEliminated = Boolean(windowStatus === "TERLEWAT" && !isAlreadySubmitted);

      readyProjects.push({
        klarifikasi_id: k.id,
        nomor_klarifikasi: k.nomor_klarifikasi,
        project_id: k.project_id,
        nama_proyek: k.project.nama_proyek,
        kode_proyek: k.project.kode,
        cabang: k.cabang,
        alamat_lokasi: k.project.alamat || 'Alamat proyek belum diisi di profil DC',
        durasi_hari_akhir: k.durasi_hari_akhir,
        tanggal_tender: tenderDateStr,
        window_status: windowStatus,
        is_eliminated: isEliminated,
        can_input_now: windowStatus === "DIBUKA",
        vendor_id: matchedPeserta?.vendor_id || null,
        vendor_nama: matchedPeserta?.vendor?.nama_perusahaan || session.nama_pt || null,
        existing_penawaran_id: existingPenawaran?.id || null,
        existing_nomor_penawaran: existingPenawaran?.nomor_penawaran || null,
        existing_status: existingPenawaran?.status || null,
        is_already_submitted: isAlreadySubmitted,
      });
    }

    return NextResponse.json({
      status: 'success',
      data: readyProjects,
    });
  } catch (error: any) {
    console.error('Error fetching ready projects for penawaran:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
