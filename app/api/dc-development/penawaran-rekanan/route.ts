import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getUserCoverageBranches, isBranchAccessible } from '@/lib/branches';
import { isExternalPartnerRole } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const branchFilter = searchParams.get('cabang');
    const projectId = searchParams.get('project_id');

    const isRekananUser = isExternalPartnerRole(session.role);
    const userCoverage = getUserCoverageBranches(session);

    const where: any = {};

    // Filter hak akses: Rekanan hanya melihat penawaran miliknya
    if (isRekananUser) {
      const orConditions: any[] = [
        { vendor_email: { equals: session.email, mode: 'insensitive' } },
        { created_by: { equals: session.email, mode: 'insensitive' } },
      ];
      if (session.nama_pt) {
        orConditions.push({
          vendor_nama: { contains: session.nama_pt.trim(), mode: 'insensitive' },
        });
      }
      where.OR = orConditions;
    } else {
      // User internal (BBM Manager, DC Specialist, Admin, dll.) disaring berdasarkan coverage_cabang
      if (userCoverage && userCoverage.length > 0) {
        where.cabang = { in: userCoverage, mode: 'insensitive' };
      }
    }

    // Filter status
    if (status && status !== 'ALL' && status !== 'all') {
      where.status = status;
    }

    // Filter cabang
    if (branchFilter && branchFilter !== 'ALL' && branchFilter !== 'all') {
      where.cabang = branchFilter;
    }

    // Filter project_id
    if (projectId) {
      where.project_id = parseInt(projectId);
    }

    // Pencarian fleksibel
    if (search.trim()) {
      const q = search.trim();
      const searchOr = [
        { nomor_penawaran: { contains: q, mode: 'insensitive' } },
        { vendor_nama: { contains: q, mode: 'insensitive' } },
        { cabang: { contains: q, mode: 'insensitive' } },
        { project: { nama_proyek: { contains: q, mode: 'insensitive' } } },
        { project: { kode: { contains: q, mode: 'insensitive' } } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchOr }];
        delete where.OR;
      } else {
        where.OR = searchOr;
      }
    }

    const penawaranList = await prisma.dc_penawaran_rekanan.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            kode: true,
            nama_proyek: true,
            cabang: true,
            dc_induk: true,
            alamat: true,
          },
        },
        klarifikasi: {
          select: {
            id: true,
            nomor_klarifikasi: true,
            durasi_hari_akhir: true,
            status: true,
            tanggal_tender: true,
          },
        },
        vendor: {
          select: {
            id: true,
            nama_perusahaan: true,
            golongan: true,
            cabang: true,
            nomor_telepon: true,
            email: true,
          },
        },
        audit_logs: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({
      status: 'success',
      data: penawaranList,
    });
  } catch (error: any) {
    console.error('Error fetching penawaran rekanan list:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { klarifikasi_id, vendor_id } = body;

    if (!klarifikasi_id) {
      return NextResponse.json({ status: 'error', message: 'klarifikasi_id wajib disertakan' }, { status: 400 });
    }

    const klarifikasi = await prisma.dc_aanwijzing_klarifikasi.findUnique({
      where: { id: parseInt(klarifikasi_id) },
      include: {
        project: true,
        aanwijzing: {
          include: {
            peserta: {
              include: { vendor: true },
            },
          },
        },
        items: true,
      },
    });

    if (!klarifikasi || klarifikasi.status !== 'APPROVED') {
      return NextResponse.json(
        { status: 'error', message: 'Proses klarifikasi aanwijzing belum disetujui final (APPROVED)' },
        { status: 400 }
      );
    }

    const todayStr = new Date().toLocaleDateString("en-CA");
    const tenderDateObj = klarifikasi.tanggal_tender
      ? new Date(klarifikasi.tanggal_tender)
      : new Date("2026-11-03T00:00:00.000Z");
    const tenderDateStr = tenderDateObj.toLocaleDateString("en-CA");

    const roleUpper = (session.role || '').toUpperCase();
    const isRekananUser =
      roleUpper.includes('KONTRAKTOR') ||
      roleUpper.includes('VENDOR') ||
      roleUpper.includes('KONSULTAN') ||
      Boolean(session.nama_pt);

    // Kontraktor hanya berhak input pada hari-H tanggal tender (00:00 - 23:59)
    if (isRekananUser && todayStr !== tenderDateStr) {
      if (todayStr < tenderDateStr) {
        return NextResponse.json(
          {
            status: 'error',
            message: `Input penawaran belum dibuka. Jadwal pelaksanaan tender lelang adalah pada tanggal ${tenderDateStr}.`,
          },
          { status: 403 }
        );
      } else {
        return NextResponse.json(
          {
            status: 'error',
            message: `Batas waktu pengisian penawaran tender telah berakhir (${tenderDateStr}). Anda dinyatakan tereliminasi dari tender lelang proyek ini.`,
          },
          { status: 403 }
        );
      }
    }

    let targetVendorId: number;
    let targetVendorNama: string;
    let targetVendorEmail: string;

    if (isRekananUser) {
      const peserta = klarifikasi.aanwijzing.peserta.find((p) => {
        const emailMatch = p.email && session.email && p.email.toLowerCase() === session.email.toLowerCase();
        const ptMatch =
          session.nama_pt &&
          p.vendor?.nama_perusahaan &&
          (p.vendor.nama_perusahaan.trim().toUpperCase() === session.nama_pt.trim().toUpperCase() ||
            p.vendor.nama_perusahaan.toUpperCase().includes(session.nama_pt.toUpperCase()) ||
            session.nama_pt.toUpperCase().includes(p.vendor.nama_perusahaan.toUpperCase()));
        return Boolean(emailMatch || ptMatch);
      });

      if (!peserta) {
        return NextResponse.json(
          { status: 'error', message: 'Akun atau PT Anda tidak terdaftar sebagai peserta pada aanwijzing ini' },
          { status: 403 }
        );
      }

      if (peserta.status_kehadiran_aktual !== 'HADIR_AKTUAL') {
        return NextResponse.json(
          { status: 'error', message: 'Hanya rekanan yang berstatus HADIR_AKTUAL yang dapat memasukkan penawaran' },
          { status: 403 }
        );
      }

      targetVendorId = peserta.vendor_id;
      targetVendorNama = peserta.vendor.nama_perusahaan || session.nama_pt || 'Kontraktor';
      targetVendorEmail = session.email;
    } else {
      if (!vendor_id) {
        return NextResponse.json({ status: 'error', message: 'vendor_id wajib diisi untuk user internal' }, { status: 400 });
      }
      const vendor = await prisma.dc_master_vendor.findUnique({
        where: { id: parseInt(vendor_id) },
      });
      if (!vendor) {
        return NextResponse.json({ status: 'error', message: 'Data vendor tidak ditemukan' }, { status: 404 });
      }
      targetVendorId = vendor.id;
      targetVendorNama = vendor.nama_perusahaan;
      targetVendorEmail = vendor.email;
    }

    // Periksa apakah draft penawaran sudah ada
    let penawaran = await prisma.dc_penawaran_rekanan.findFirst({
      where: {
        klarifikasi_id: klarifikasi.id,
        vendor_id: targetVendorId,
      },
      include: {
        items: { orderBy: { id: 'asc' } },
        gantt_items: true,
        dependencies: true,
      },
    });

    if (!penawaran) {
      const year = new Date().getFullYear().toString().slice(-2);
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const count = await prisma.dc_penawaran_rekanan.count();
      const nomorPenawaran = `TDR/DC/${year}${month}/${String(count + 1).padStart(4, '0')}`;

      penawaran = await prisma.$transaction(async (tx) => {
        const created = await tx.dc_penawaran_rekanan.create({
          data: {
            nomor_penawaran: nomorPenawaran,
            project_id: klarifikasi.project_id,
            klarifikasi_id: klarifikasi.id,
            vendor_id: targetVendorId,
            vendor_nama: targetVendorNama,
            vendor_email: targetVendorEmail,
            cabang: klarifikasi.cabang,
            status: 'DRAFT',
            durasi_pekerjaan_hari: klarifikasi.durasi_hari_akhir || 30,
            created_by: session.email,
            items: {
              create: klarifikasi.items.map((it) => ({
                klarifikasi_item_id: it.id,
                lingkup: it.lingkup,
                kategori_pekerjaan: it.kategori_pekerjaan,
                deskripsi: it.deskripsi,
                satuan: it.satuan,
                volume: it.volume_akhir,
                harga_material: 0,
                harga_upah: 0,
                total_harga: 0,
              })),
            },
          },
          include: {
            items: { orderBy: { id: 'asc' } },
            gantt_items: true,
            dependencies: true,
          },
        });

        // Catat initial audit log
        await tx.dc_penawaran_rekanan_audit_log.create({
          data: {
            penawaran_id: created.id,
            user_email: session.email,
            user_name: session.nama_pt || session.email,
            user_role: session.role,
            action: 'CREATE_DRAFT',
            from_status: 'BELUM_ADA',
            to_status: 'DRAFT',
            notes: 'Inisialisasi draft penawaran rekanan',
          },
        });

        return created;
      });
    }

    return NextResponse.json({
      status: 'success',
      data: penawaran,
    });
  } catch (error: any) {
    console.error('Error creating/retrieving draft penawaran:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
