import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canUserViewAanwijzing, isExternalPartnerRole } from '@/lib/permissions';
import { generateUndanganAanwijzingPdf } from '@/lib/pdf/generate-undangan-aanwijzing-pdf';
import { getDriveClient, downloadFileBuffer } from '@/lib/google-drive';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { status: 'error', message: 'Sesi login tidak valid' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const aanwijzingId = parseInt(id, 10);
    if (isNaN(aanwijzingId)) {
      return NextResponse.json(
        { status: 'error', message: 'ID Undangan tidak valid' },
        { status: 400 }
      );
    }

    const dbUser = await prisma.dc_users.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        role: true,
        cabang: true,
        nama: true,
        nama_pt: true,
        coverage_cabang: true,
      },
    });
    const currentUser = dbUser || session;

    const aanwijzing = await prisma.dc_aanwijzing.findUnique({
      where: { id: aanwijzingId },
      include: {
        project: true,
        renovasi: true,
        peserta: {
          include: {
            vendor: true,
          },
        },
      },
    });

    if (!aanwijzing) {
      return NextResponse.json(
        { status: 'error', message: 'Data Undangan Aanwijzing tidak ditemukan' },
        { status: 404 }
      );
    }

    if (!canUserViewAanwijzing(currentUser, aanwijzing)) {
      return NextResponse.json(
        { status: 'error', message: 'Akses ditolak: Dokumen ini berada di luar wewenang Anda' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const isDownload = searchParams.get('download') === '1';
    const queryTipe = (searchParams.get('tipe') || '').toUpperCase();
    const queryVendorId = searchParams.get('vendor_id') ? Number(searchParams.get('vendor_id')) : undefined;
    const queryPesertaId = searchParams.get('peserta_id') ? Number(searchParams.get('peserta_id')) : undefined;

    // Rekanan eksternal (Kontraktor, Konsultan, Vendor, Rekanan) tidak punya akun SAT Alfamart
    const isContractorUser = isExternalPartnerRole(currentUser.role);

    let pdfOptions: { tipe: 'INTERNAL' | 'KONTRAKTOR'; vendorId?: number; pesertaId?: number };
    let fileSuffix = 'INTERNAL';
    let targetDriveFileId: string | null = null;

    if (isContractorUser) {
      // Kontraktor login: HANYA boleh mendapatkan PDF khusus untuk perusahaannya sendiri
      const uEmail = (currentUser.email || '').toLowerCase();
      const uPt = ((currentUser.nama_pt || (currentUser as any).namaPt || '') as string).toLowerCase();
      const myPeserta =
        aanwijzing.peserta.find((p) => {
          const pEmail = (p.email || p.vendor?.email || '').toLowerCase();
          const pName = (p.vendor?.nama_perusahaan || '').toLowerCase();
          return (uEmail && pEmail === uEmail) || (uPt && pName.includes(uPt));
        }) || aanwijzing.peserta[0];

      pdfOptions = {
        tipe: 'KONTRAKTOR',
        pesertaId: myPeserta?.id,
        vendorId: myPeserta?.vendor_id,
      };
      fileSuffix = (myPeserta?.vendor?.nama_perusahaan || 'KONTRAKTOR').replace(/[^a-zA-Z0-9]/g, '_');
      targetDriveFileId = myPeserta?.drive_file_id || null;
    } else if (queryTipe === 'KONTRAKTOR' || queryVendorId || queryPesertaId) {
      // Staf Internal mengunduh versi khusus salah satu kontraktor
      const targetPeserta =
        aanwijzing.peserta.find((p) =>
          queryPesertaId ? p.id === queryPesertaId : p.vendor_id === queryVendorId
        ) || aanwijzing.peserta[0];

      pdfOptions = {
        tipe: 'KONTRAKTOR',
        pesertaId: targetPeserta?.id,
        vendorId: targetPeserta?.vendor_id,
      };
      fileSuffix = (targetPeserta?.vendor?.nama_perusahaan || 'KONTRAKTOR').replace(/[^a-zA-Z0-9]/g, '_');
      targetDriveFileId = targetPeserta?.drive_file_id || null;
    } else {
      // Staf Internal mengunduh berkas lengkap (Internal Rekap)
      pdfOptions = { tipe: 'INTERNAL' };
      fileSuffix = 'INTERNAL';
      targetDriveFileId = aanwijzing.drive_file_id || null;
    }

    // Proxy Google Drive: jika berkas sudah tersimpan di Google Drive,
    // server mengambil buffer resmi dari Google Drive via server credentials
    let pdfBuffer: Buffer | null = null;
    if (targetDriveFileId) {
      try {
        const drive = await getDriveClient();
        pdfBuffer = await downloadFileBuffer(drive, targetDriveFileId);
      } catch (driveErr) {
        console.warn('[PDF-PROXY] Gagal mengambil buffer dari Google Drive, generate on-the-fly:', (driveErr as Error)?.message);
      }
    }

    // Jika belum ada di Google Drive atau gagal unduh buffer, generate on-the-fly
    if (!pdfBuffer) {
      pdfBuffer = await generateUndanganAanwijzingPdf(aanwijzing.id, pdfOptions);
    }

    const safeNomor = aanwijzing.nomor_undangan.replace(/[\/\\]/g, '_');
    const filename = `Surat_Undangan_Aanwijzing_${safeNomor}_${fileSuffix}.pdf`;
    const dispositionType = isDownload ? 'attachment' : 'inline';

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${dispositionType}; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error streaming aanwijzing PDF:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal menghasilkan dokumen PDF' },
      { status: 500 }
    );
  }
}
