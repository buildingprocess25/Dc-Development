import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getBranchesUnderInduk, getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';
import {
  canAccessRabOeApproval,
  isApprovalAdmin,
  getApprovalQueueFilterForRole,
  getNextApprovalStatus
} from '@/lib/permissions';
import { toTitleCase } from '@/lib/utils';
import { syncRenovasiPdfToDrive } from '@/lib/renovasi-sync';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !canAccessRabOeApproval(session.role)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Akses ditolak: Anda tidak memiliki wewenang untuk mengakses transaksi Approval RAB/OE.'
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const cabang = searchParams.get('cabang') || '';
    const statusParam = searchParams.get('status') || '';
    const tab = searchParams.get('tab') || 'pending'; // 'pending' | 'history' | 'all'

    const isAdmin = isApprovalAdmin(session.role);
    const rolePendingStatuses = getApprovalQueueFilterForRole(session.role);
    const allowedBranches = getUserCoverageBranches(session);

    // Hitung ringkasan data statistik ter-filter coverage akun
    const summaryWhere = allowedBranches !== null ? {
      OR: [
        { cabang: { in: allowedBranches, mode: 'insensitive' } },
        { project: { cabang: { in: allowedBranches, mode: 'insensitive' } } }
      ]
    } : undefined;

    const allRenovasi = await prisma.dc_renovasi.findMany({
      where: summaryWhere as any,
      select: {
        id: true,
        status: true,
        grand_total: true,
        cabang: true
      }
    });

    const summary = {
      bm_count: allRenovasi.filter((r) => r.status === 'MENUNGGU APPROVAL B&M MANAGER').length,
      specialist_count: allRenovasi.filter((r) => r.status === 'MENUNGGU APPROVAL DC SPECIALIST').length,
      manager_count: allRenovasi.filter((r) => r.status === 'MENUNGGU APPROVAL DC MANAGER').length,
      approved_count: allRenovasi.filter((r) => r.status === 'APPROVED').length,
      revisi_count: allRenovasi.filter((r) => r.status === 'REVISI').length,
      ditolak_count: allRenovasi.filter((r) => r.status === 'DITOLAK').length,
      my_pending_count: 0,
      my_pending_total_biaya: 0
    };

    const myPendingItems = allRenovasi.filter((r) => {
      if (isAdmin) {
        return (
          r.status === 'MENUNGGU APPROVAL B&M MANAGER' ||
          r.status === 'MENUNGGU APPROVAL DC SPECIALIST' ||
          r.status === 'MENUNGGU APPROVAL DC MANAGER'
        );
      }
      return Array.isArray(rolePendingStatuses) && rolePendingStatuses.includes(r.status);
    });

    summary.my_pending_count = myPendingItems.length;
    summary.my_pending_total_biaya = myPendingItems.reduce((acc, curr) => acc + (curr.grand_total || 0), 0);

    // Bangun filter query
    const andConditions: any[] = [];

    // Filter status berdasarkan role dan tab
    if (tab === 'pending') {
      if (isAdmin) {
        if (statusParam && statusParam !== 'all') {
          andConditions.push({ status: statusParam });
        } else {
          andConditions.push({
            status: {
              in: [
                'MENUNGGU APPROVAL B&M MANAGER',
                'MENUNGGU APPROVAL DC SPECIALIST',
                'MENUNGGU APPROVAL DC MANAGER'
              ]
            }
          });
        }
      } else {
        // Non-admin hanya bisa melihat status miliknya
        const statuses = Array.isArray(rolePendingStatuses) ? rolePendingStatuses : [];
        andConditions.push({ status: { in: statuses } });
      }
    } else if (tab === 'history') {
      if (statusParam && statusParam !== 'all') {
        andConditions.push({ status: statusParam });
      } else {
        andConditions.push({
          status: { in: ['APPROVED', 'REVISI', 'DITOLAK'] }
        });
      }
    } else {
      // Tab 'all' (hanya bisa diakses jika admin)
      if (statusParam && statusParam !== 'all') {
        andConditions.push({ status: statusParam });
      }
    }

    // Filter Cabang & Coverage Akun
    if (allowedBranches !== null) {
      if (cabang && cabang !== 'all') {
        const childBranches = getBranchesUnderInduk(cabang);
        const intersect = childBranches.filter((b) => allowedBranches.includes(b.toUpperCase()));
        andConditions.push({
          OR: [
            { cabang: { in: intersect, mode: 'insensitive' } },
            { project: { cabang: { in: intersect, mode: 'insensitive' } } }
          ]
        });
      } else {
        andConditions.push({
          OR: [
            { cabang: { in: allowedBranches, mode: 'insensitive' } },
            { project: { cabang: { in: allowedBranches, mode: 'insensitive' } } }
          ]
        });
      }
    } else {
      if (cabang && cabang !== 'all') {
        const childBranches = getBranchesUnderInduk(cabang);
        andConditions.push({
          OR: [
            { cabang: { in: childBranches, mode: 'insensitive' } },
            { project: { cabang: { in: childBranches, mode: 'insensitive' } } }
          ]
        });
      }
    }

    // Filter Pencarian
    if (search) {
      andConditions.push({
        OR: [
          { nomor_pengajuan: { contains: search, mode: 'insensitive' } },
          { jenis_renovasi: { contains: search, mode: 'insensitive' } },
          { project: { nama_proyek: { contains: search, mode: 'insensitive' } } },
          { project: { kode: { contains: search, mode: 'insensitive' } } },
          { cabang: { contains: search, mode: 'insensitive' } }
        ]
      });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const items = await prisma.dc_renovasi.findMany({
      where,
      include: {
        project: true,
        dokumen: true,
        item_rab: true
      },
      orderBy: { created_at: 'desc' }
    });

    const revisiIds = items
      .filter((r) => r.status === 'REVISI')
      .map((r) => String(r.id));

    const revisiMap: Record<string, any> = {};
    if (revisiIds.length > 0) {
      try {
        const logs = await prisma.app_audit_log.findMany({
          where: {
            modul: 'RENOVASI_DC',
            entitas: 'dc_renovasi',
            entitas_id: { in: revisiIds },
            aksi: 'APPROVAL_REVISI'
          },
          orderBy: { created_at: 'desc' }
        });
        logs.forEach((log) => {
          if (!revisiMap[log.entitas_id]) {
            const db = log.data_baru as any;
            revisiMap[log.entitas_id] = db?.detail_revisi || null;
          }
        });
      } catch (err) {
        console.warn('Gagal memuat log audit revisi:', err);
      }
    }

    const itemsWithDetailRevisi = items.map((r) => ({
      ...r,
      detail_revisi: revisiMap[String(r.id)] || null
    }));

    return NextResponse.json({
      status: 'success',
      data: itemsWithDetailRevisi,
      summary,
      userRole: session.role,
      isAdmin
    });
  } catch (error: any) {
    console.error('Error fetching approval queue:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !canAccessRabOeApproval(session.role)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Akses ditolak: Anda tidak memiliki wewenang untuk melakukan tindakan persetujuan RAB/OE.'
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, action, catatan, detail_revisi } = body;

    if (!id) {
      return NextResponse.json({ status: 'error', message: 'ID pengajuan wajib disertakan' }, { status: 400 });
    }

    if (!action || !['APPROVE', 'REVISI', 'TOLAK'].includes(action)) {
      return NextResponse.json(
        { status: 'error', message: 'Aksi persetujuan tidak valid (harus APPROVE, REVISI, atau TOLAK)' },
        { status: 400 }
      );
    }

    const renovasiId = parseInt(id, 10);
    const existing = await prisma.dc_renovasi.findUnique({
      where: { id: renovasiId },
      include: { project: true }
    });

    if (!existing) {
      return NextResponse.json({ status: 'error', message: 'Data pengajuan renovasi tidak ditemukan' }, { status: 404 });
    }

    const allowedBranches = getUserCoverageBranches(session);
    if (allowedBranches !== null && !isBranchAccessible(existing.cabang || existing.project?.cabang, allowedBranches)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Akses ditolak: Dokumen pengajuan renovasi berada di luar coverage cabang Anda.'
        },
        { status: 403 }
      );
    }

    const isAdmin = isApprovalAdmin(session.role);
    const rolePendingStatuses = getApprovalQueueFilterForRole(session.role);

    // Validasi apakah user berwenang terhadap status pengajuan saat ini
    if (!isAdmin) {
      const allowed = Array.isArray(rolePendingStatuses) && rolePendingStatuses.includes(existing.status);
      if (!allowed) {
        return NextResponse.json(
          {
            status: 'error',
            message: `Akses ditolak: Anda tidak memiliki wewenang memproses persetujuan pada status "${existing.status}".`
          },
          { status: 403 }
        );
      }
    }

    let nextStatus = existing.status;
    let message = '';
    const nowStr = new Date().toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const approverName = (session as any).nama || session.email;
    const approverRole = session.role || 'Approver';

    if (action === 'APPROVE') {
      const transition = getNextApprovalStatus(existing.status);
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
      if ((!catatan || !catatan.trim()) && (!Array.isArray(detail_revisi) || detail_revisi.length === 0)) {
        return NextResponse.json(
          { status: 'error', message: 'Catatan instruksi atau rincian poin revisi wajib diisi agar cabang dapat memperbaikinya.' },
          { status: 400 }
        );
      }
      nextStatus = 'REVISI';
      message = `Pengajuan ${existing.nomor_pengajuan} dikembalikan dengan status REVISI.`;
    } else if (action === 'TOLAK') {
      if (!catatan || !catatan.trim()) {
        return NextResponse.json(
          { status: 'error', message: 'Alasan penolakan pengajuan wajib diisi.' },
          { status: 400 }
        );
      }
      nextStatus = 'DITOLAK';
      message = `Pengajuan ${existing.nomor_pengajuan} telah DITOLAK.`;
    }

    // Bangun catatan histori persetujuan
    let updatedCatatan = existing.catatan_pengajuan || '';
    if (catatan && catatan.trim()) {
      const cleanCatatan = toTitleCase(catatan.trim());
      const roleText = approverRole ? ` - ${approverRole}` : '';
      const logEntry = `[${action} oleh ${approverName}${roleText} (${nowStr})]: ${cleanCatatan}`;
      updatedCatatan = updatedCatatan ? `${updatedCatatan}\n\n${logEntry}` : logEntry;
    }

    const updateData: any = {
      status: nextStatus,
      catatan_pengajuan: updatedCatatan
    };

    const updated = await prisma.dc_renovasi.update({
      where: { id: renovasiId },
      data: updateData,
      include: {
        project: true,
        dokumen: true,
        item_rab: true
      }
    });

    // Catat log ke app_audit_log
    try {
      await prisma.app_audit_log.create({
        data: {
          user_email: session.email,
          modul: 'RENOVASI_DC',
          entitas: 'dc_renovasi',
          entitas_id: String(existing.id),
          aksi: `APPROVAL_${action}`,
          data_lama: {
            status: existing.status,
            catatan_pengajuan: existing.catatan_pengajuan
          },
          data_baru: {
            status: nextStatus,
            catatan_pengajuan: updatedCatatan,
            action,
            catatan_approver: catatan || null,
            detail_revisi: action === 'REVISI' && Array.isArray(detail_revisi) ? detail_revisi : null
          }
        }
      });
    } catch (auditErr) {
      console.warn('Gagal mencatat audit log:', auditErr);
    }

    // Picu sinkronisasi PDF ke Google Drive di latar belakang (memperbarui tanda tangan & status di Drive)
    syncRenovasiPdfToDrive(renovasiId).catch((err) => {
      console.error(`[Approval Background Sync PDF] Gagal sinkronisasi renovasi #${renovasiId}:`, err);
    });

    return NextResponse.json({
      status: 'success',
      message,
      data: updated
    });
  } catch (error: any) {
    console.error('Error processing approval:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
