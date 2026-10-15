import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getBranchesUnderInduk, getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';
import {
  canAccessFungsiRuangApproval,
  isApprovalAdmin,
  getFungsiRuangApprovalQueueForRole,
  getNextFungsiRuangApprovalStatus,
  canUserApproveFungsiRuang,
  getFungsiRuangPrismaFilter,
  canUserViewFungsiRuangSubmission,
} from '@/lib/permissions';
import { toTitleCase } from '@/lib/utils';
import { syncFungsiRuangPdfToDrive } from '@/lib/fungsi-ruang-sync';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    // Ambil data user terkini dari tabel dc_users untuk coverage cabang yang up-to-date
    const dbUser = await prisma.dc_users.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        cabang: true,
        role: true,
        coverage_cabang: true,
      },
    });

    const currentUser = dbUser || session;

    if (!canAccessFungsiRuangApproval(currentUser.role)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Akses ditolak: Anda tidak memiliki wewenang untuk mengakses transaksi Approval Fungsi Ruang.'
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const cabang = searchParams.get('cabang') || '';
    const statusParam = searchParams.get('status') || '';
    const tab = searchParams.get('tab') || 'pending'; // 'pending' | 'history' | 'all'

    const isAdmin = isApprovalAdmin(currentUser.role);
    const rolePendingStatuses = getFungsiRuangApprovalQueueForRole(currentUser.role);
    const allowedBranches = getUserCoverageBranches(currentUser);
    const tierFilter = getFungsiRuangPrismaFilter(currentUser);

    // Ambil seluruh pengajuan untuk perhitungan ringkasan summary (difilter coverage cabang dan aturan bertingkat)
    const summaryWhereConditions: any[] = [];
    if (allowedBranches !== null) {
      summaryWhereConditions.push({
        OR: [
          { project: { cabang: { in: allowedBranches, mode: 'insensitive' } } },
          { renovasi: { cabang: { in: allowedBranches, mode: 'insensitive' } } }
        ]
      });
    }

    if (tierFilter) {
      summaryWhereConditions.push(tierFilter);
    }

    const summaryWhere = summaryWhereConditions.length > 0 ? { AND: summaryWhereConditions } : undefined;

    const allSubmissions = await prisma.dc_fungsi_ruang.findMany({
      where: summaryWhere,
      include: {
        project: {
          select: {
            id: true,
            kode: true,
            nama_proyek: true,
            tipe: true,
            cabang: true,
          },
        },
        renovasi: {
          select: {
            id: true,
            nomor_pengajuan: true,
            cabang: true,
            status: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Validasi coverage & aturan bertingkat tambahan
    const accessibleAll = allSubmissions.filter((item) => {
      const itemCabang = (item.project?.cabang || item.renovasi?.cabang || '').toUpperCase();
      if (!isBranchAccessible(itemCabang, allowedBranches)) return false;
      return canUserViewFungsiRuangSubmission(currentUser, item);
    });

    const allPendingStages = [
      'MENUNGGU APPROVAL BM/DBM',
      'MENUNGGU APPROVAL REGIONAL B&M MANAGER',
      'MENUNGGU APPROVAL DC SPECIALIST',
      'MENUNGGU APPROVAL B&M GM',
      'MENUNGGU APPROVAL OPERATION DIRECTOR',
      'MENUNGGU APPROVAL PROPERTY DEV MANAGER',
    ];

    const myPendingItems = accessibleAll.filter((r) => {
      if (isAdmin) {
        return allPendingStages.includes(r.status);
      }
      return Array.isArray(rolePendingStatuses) && rolePendingStatuses.includes(r.status);
    });

    const summary = {
      my_pending_count: myPendingItems.length,
      approved_count: accessibleAll.filter((r) => r.status === 'APPROVED').length,
      revisi_count: accessibleAll.filter((r) => r.status === 'REVISI').length,
      total_pending_all: accessibleAll.filter((r) => allPendingStages.includes(r.status)).length,
      total_all: accessibleAll.length,
    };

    // Filter daftar pengajuan berdasarkan tab
    let resultItems = accessibleAll;
    if (tab === 'pending') {
      resultItems = myPendingItems;
    } else if (tab === 'history') {
      resultItems = accessibleAll.filter((r) => r.status === 'APPROVED' || r.status === 'REVISI');
    }

    // Filter status khusus jika dipilih di dropdown status
    if (statusParam && statusParam !== 'all') {
      resultItems = resultItems.filter((r) => r.status === statusParam);
    }

    // Filter cabang induk jika dipilih di dropdown cabang
    if (cabang && cabang !== 'all') {
      const childBranches = getBranchesUnderInduk(cabang);
      resultItems = resultItems.filter((r) => {
        const itemCabang = (r.project?.cabang || r.renovasi?.cabang || '').toUpperCase();
        return childBranches.some((cb) => cb.toUpperCase() === itemCabang);
      });
    }

    // Filter pencarian teks
    if (search.trim()) {
      const q = search.toLowerCase();
      resultItems = resultItems.filter(
        (r) =>
          r.nomor_pengajuan.toLowerCase().includes(q) ||
          r.nama_pemohon.toLowerCase().includes(q) ||
          r.email_pemohon.toLowerCase().includes(q) ||
          r.jabatan.toLowerCase().includes(q) ||
          r.jenis_pengajuan.toLowerCase().includes(q) ||
          r.project?.nama_proyek?.toLowerCase().includes(q) ||
          r.project?.kode?.toLowerCase().includes(q) ||
          r.project?.cabang?.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      status: 'success',
      data: resultItems,
      summary,
    });
  } catch (error: any) {
    console.error('Error fetching approval queue for fungsi ruang:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal memuat antrean approval fungsi ruang' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !canAccessFungsiRuangApproval(session.role)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Akses ditolak: Anda tidak memiliki wewenang untuk memproses persetujuan Fungsi Ruang.'
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, action, catatan } = body;

    if (!id) {
      return NextResponse.json({ status: 'error', message: 'ID pengajuan wajib disertakan' }, { status: 400 });
    }

    // Hanya ada 2 aksi: APPROVE dan REVISI (tidak ada aksi tolak)
    if (!action || !['APPROVE', 'REVISI'].includes(action)) {
      return NextResponse.json(
        { status: 'error', message: 'Aksi persetujuan tidak valid (harus APPROVE atau REVISI)' },
        { status: 400 }
      );
    }

    const submissionId = parseInt(String(id), 10);
    const existing = await prisma.dc_fungsi_ruang.findUnique({
      where: { id: submissionId },
      include: {
        project: true,
        renovasi: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { status: 'error', message: 'Data pengajuan fungsi ruang tidak ditemukan' },
        { status: 404 }
      );
    }

    // Ambil data user terkini dari tabel dc_users
    const dbUser = await prisma.dc_users.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        cabang: true,
        role: true,
        coverage_cabang: true,
      },
    });

    // Validasi apakah user berhak memproses pengajuan ini
    const canApprove = canUserApproveFungsiRuang(dbUser || session, existing);
    if (!canApprove) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Akses ditolak: Anda tidak memiliki wewenang memproses persetujuan pada status "${existing.status}" atau cabang ini.`
        },
        { status: 403 }
      );
    }

    let nextStatus = existing.status;
    let message = '';
    const cleanCatatan = catatan?.trim() ? toTitleCase(catatan.trim()) : '';

    if (action === 'APPROVE') {
      const transition = getNextFungsiRuangApprovalStatus(existing.status);
      if (!transition) {
        return NextResponse.json(
          {
            status: 'error',
            message: `Pengajuan ini tidak sedang dalam antrean persetujuan (status saat ini: ${existing.status}).`
          },
          { status: 400 }
        );
      }
      nextStatus = transition.nextStatus;
      message =
        nextStatus === 'APPROVED'
          ? `Pengajuan ${existing.nomor_pengajuan} berhasil disetujui (Final APPROVED).`
          : `Pengajuan ${existing.nomor_pengajuan} berhasil disetujui dan diteruskan ke: ${transition.label}.`;
    } else if (action === 'REVISI') {
      if (!cleanCatatan) {
        return NextResponse.json(
          { status: 'error', message: 'Catatan instruksi perbaikan wajib diisi agar Branch B&M Manager dapat memperbaikinya.' },
          { status: 400 }
        );
      }
      nextStatus = 'REVISI';
      message = `Pengajuan ${existing.nomor_pengajuan} berhasil dikembalikan ke Branch B&M Manager dengan status REVISI.`;
    }

    // Update status di dc_fungsi_ruang
    const updated = await prisma.dc_fungsi_ruang.update({
      where: { id: submissionId },
      data: {
        status: nextStatus,
      },
      include: {
        project: true,
        renovasi: true,
      },
    });

    // Catat riwayat ke app_audit_log
    try {
      await prisma.app_audit_log.create({
        data: {
          user_email: session.email || 'SYSTEM',
          modul: 'FUNGSI_RUANG_DC',
          entitas: 'dc_fungsi_ruang',
          entitas_id: String(existing.id),
          aksi: `APPROVAL_${action}`,
          data_lama: {
            status: existing.status,
          },
          data_baru: {
            status: nextStatus,
            catatan: cleanCatatan,
            action_by_role: session.role,
            action_by_name: (session as any).nama || (session as any).namaLengkap || (session as any).name || session.email,
          },
        },
      });
    } catch (auditErr) {
      console.error('Gagal mencatat audit log fungsi ruang:', auditErr);
    }

    // Picu sinkronisasi PDF ke Google Drive di latar belakang (sama seperti pola modul rab-oe)
    // agar modal dialog persetujuan merespons seketika tanpa tertahan proses pembuatan berkas
    syncFungsiRuangPdfToDrive(submissionId).catch((syncErr: unknown) => {
      console.warn(`[PFR-APPROVAL-SYNC] Sinkronisasi PDF ke Drive gagal (${action}):`, (syncErr as Error)?.message);
    });

    return NextResponse.json({
      status: 'success',
      message,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error processing approval for fungsi ruang:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal memproses persetujuan fungsi ruang' },
      { status: 500 }
    );
  }
}
