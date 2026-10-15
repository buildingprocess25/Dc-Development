import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches, isBranchAccessible, getBranchesUnderInduk, getIndukFromCabang } from '@/lib/branches';
import { canManageFungsiRuang, getFungsiRuangPrismaFilter, canUserViewFungsiRuangSubmission } from '@/lib/permissions';
import { sanitizeFungsiRuangInput, generateNomorPengajuanFungsiRuang } from '@/lib/fungsi-ruang/utils';
import { syncFungsiRuangPdfToDrive } from '@/lib/fungsi-ruang-sync';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Sesi login tidak valid' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const branch = searchParams.get('branch');

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

    const userCoverage = getUserCoverageBranches(dbUser || session);

    const andConditions: any[] = [];

    // Filter visibilitas bertingkat per role
    const tierFilter = getFungsiRuangPrismaFilter(dbUser || session);
    if (tierFilter) {
      andConditions.push(tierFilter);
    }

    if (status && status !== 'all') {
      andConditions.push({ status });
    }

    if (search.trim()) {
      andConditions.push({
        OR: [
          { nomor_pengajuan: { contains: search, mode: 'insensitive' } },
          { nama_pemohon: { contains: search, mode: 'insensitive' } },
          { email_pemohon: { contains: search, mode: 'insensitive' } },
          { jabatan: { contains: search, mode: 'insensitive' } },
          { jenis_pengajuan: { contains: search, mode: 'insensitive' } },
          { project: { cabang: { contains: search, mode: 'insensitive' } } },
          { project: { nama_proyek: { contains: search, mode: 'insensitive' } } },
          { project: { kode: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    const where: any = andConditions.length > 0 ? { AND: andConditions } : {};

    const list = await prisma.dc_fungsi_ruang.findMany({
      where,
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
      orderBy: {
        created_at: 'desc',
      },
    });

    // Filter berdasarkan cabang user coverage & hak visibilitas bertingkat (in-memory validation)
    let filtered = list.filter((item) => {
      const itemCabang = (item.project?.cabang || item.renovasi?.cabang || '').toUpperCase();
      if (!isBranchAccessible(itemCabang, userCoverage)) return false;
      return canUserViewFungsiRuangSubmission(dbUser || session, item);
    });

    // Filter berdasarkan dropdown cabang (induk cabang)
    if (branch && branch !== 'all') {
      const childBranches = getBranchesUnderInduk(branch);
      filtered = filtered.filter((r) => {
        const itemCabang = (r.project?.cabang || r.renovasi?.cabang || '').toUpperCase();
        const itemInduk = getIndukFromCabang(itemCabang);
        return (
          itemInduk === branch ||
          childBranches.some((cb) => cb.toUpperCase() === itemCabang)
        );
      });
    }

    return NextResponse.json({
      status: 'success',
      data: filtered,
    });
  } catch (error: any) {
    console.error('Error fetching list fungsi ruang:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal memuat daftar pengajuan fungsi ruang' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Sesi login tidak valid' }, { status: 401 });
    }

    // Hanya Branch Building & Maintenance Manager dan Admin yang dapat membuat pengajuan
    if (!canManageFungsiRuang(session.role)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Akses ditolak: Hanya Branch Building & Maintenance Manager atau Administrator yang berhak membuat pengajuan fungsi ruang.',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      renovasi_id,
      nama_pemohon,
      email_pemohon,
      jabatan,
      divisi,
      departemen,
      jenis_pengajuan,
      alasan_pengajuan,
    } = body;

    if (!renovasi_id) {
      return NextResponse.json(
        { status: 'error', message: 'Proyek renovasi penawaran RAB/OE wajib dipilih' },
        { status: 400 }
      );
    }

    if (!nama_pemohon?.trim() || !email_pemohon?.trim() || !jabatan?.trim() || !divisi?.trim() || !departemen?.trim()) {
      return NextResponse.json(
        { status: 'error', message: 'Seluruh identitas pemohon wajib diisi' },
        { status: 400 }
      );
    }

    if (!jenis_pengajuan?.trim()) {
      return NextResponse.json(
        { status: 'error', message: 'Jenis pengajuan fungsi ruang wajib dipilih' },
        { status: 400 }
      );
    }

    if (!alasan_pengajuan?.trim()) {
      return NextResponse.json(
        { status: 'error', message: 'Alasan pengajuan wajib diisi' },
        { status: 400 }
      );
    }

    // Ambil data renovasi yang berstatus APPROVED
    const renovasi = await prisma.dc_renovasi.findUnique({
      where: { id: parseInt(String(renovasi_id), 10) },
      include: { project: true },
    });

    if (!renovasi) {
      return NextResponse.json(
        { status: 'error', message: 'Data proyek renovasi tidak ditemukan' },
        { status: 404 }
      );
    }

    if (renovasi.status !== 'APPROVED') {
      return NextResponse.json(
        {
          status: 'error',
          message: `Proyek renovasi ${renovasi.nomor_pengajuan} belum berstatus APPROVED (Status saat ini: ${renovasi.status}). Pengajuan fungsi ruang hanya dapat dibuat untuk proyek yang telah disetujui.`,
        },
        { status: 400 }
      );
    }

    // Cek apakah proyek renovasi atau proyek DC ini sedang memiliki pengajuan fungsi ruang yang aktif (proses approval atau revisi)
    const activeFungsiRuang = await prisma.dc_fungsi_ruang.findFirst({
      where: {
        OR: [
          { renovasi_id: renovasi.id },
          { project_id: renovasi.project_id },
        ],
        status: {
          not: 'APPROVED',
        },
      },
      select: {
        id: true,
        nomor_pengajuan: true,
        status: true,
      },
      orderBy: { id: 'desc' },
    });

    if (activeFungsiRuang) {
      return NextResponse.json(
        {
          status: 'error',
          message: `Proyek renovasi ini sedang memiliki pengajuan perubahan fungsi ruang aktif (${activeFungsiRuang.nomor_pengajuan}) dengan status "${activeFungsiRuang.status}". Pengajuan baru tidak dapat dibuat hingga proses sebelumnya selesai.`,
        },
        { status: 400 }
      );
    }

    // Validasi coverage cabang user terhadap proyek berdasarkan kolom coverage_cabang di dc_users
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

    const userCoverage = getUserCoverageBranches(dbUser || session);
    const itemCabang = (renovasi.cabang || renovasi.project?.cabang || '').toUpperCase();
    if (!isBranchAccessible(itemCabang, userCoverage)) {
      return NextResponse.json(
        { status: 'error', message: 'Akses ditolak: Proyek berada di luar coverage cabang Anda.' },
        { status: 403 }
      );
    }

    // Sanitasi teks (Title Case untuk input teks bebas, lowercase untuk email)
    const sanitized = sanitizeFungsiRuangInput({
      nama_pemohon,
      email_pemohon,
      jabatan,
      divisi,
      departemen,
      jenis_pengajuan,
      alasan_pengajuan,
    });

    // Generate nomor pengajuan: NO/PROPNDEV-(dc_project.kode)/(bulan romawi)/(tahun)
    const projectKode = renovasi.project?.kode || 'DC';
    const nomorPengajuan = await generateNomorPengajuanFungsiRuang(prisma, projectKode);

    // Buat record pengajuan fungsi ruang
    // Karena maker adalah Branch Building & Maintenance Manager, tier 1 auto-approved -> Status langsung "MENUNGGU APPROVAL BM/DBM"
    const newSubmission = await prisma.dc_fungsi_ruang.create({
      data: {
        nomor_pengajuan: nomorPengajuan,
        renovasi_id: renovasi.id,
        project_id: renovasi.project_id,
        nama_pemohon: sanitized.nama_pemohon,
        email_pemohon: sanitized.email_pemohon,
        jabatan: sanitized.jabatan,
        divisi: sanitized.divisi,
        departemen: sanitized.departemen,
        jenis_pengajuan: sanitized.jenis_pengajuan,
        alasan_pengajuan: sanitized.alasan_pengajuan,
        status: 'MENUNGGU APPROVAL BM/DBM',
        created_by: session.email || 'SYSTEM',
      },
      include: {
        project: true,
        renovasi: true,
      },
    });

    // Catat log ke app_audit_log
    await prisma.app_audit_log.create({
      data: {
        user_email: session.email || 'SYSTEM',
        modul: 'FUNGSI_RUANG_DC',
        entitas: 'dc_fungsi_ruang',
        entitas_id: String(newSubmission.id),
        aksi: 'CREATE_SUBMISSION',
        data_baru: {
          nomor_pengajuan: newSubmission.nomor_pengajuan,
          nama_pemohon: newSubmission.nama_pemohon,
          email_pemohon: newSubmission.email_pemohon,
          status: newSubmission.status,
          project: newSubmission.project?.nama_proyek,
        },
      },
    });

    // Otomatis generate PDF formulir dan upload ke Google Drive pertama kali
    try {
      const syncResult = await syncFungsiRuangPdfToDrive(newSubmission.id);
      (newSubmission as any).file_url = syncResult.file_url;
      (newSubmission as any).drive_file_id = syncResult.drive_file_id || null;
    } catch (syncErr: unknown) {
      console.warn('[PFR-CREATE] Sinkronisasi PDF ke Drive awal gagal (akan disinkronkan saat dilihat):', (syncErr as Error)?.message);
    }

    return NextResponse.json({
      status: 'success',
      message: `Pengajuan fungsi ruang ${newSubmission.nomor_pengajuan} berhasil dibuat dan otomatis disetujui B&M Manager (menunggu persetujuan BM/DBM).`,
      data: newSubmission,
    });
  } catch (error: any) {
    console.error('Error creating fungsi ruang submission:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal menyimpan pengajuan fungsi ruang' },
      { status: 500 }
    );
  }
}
