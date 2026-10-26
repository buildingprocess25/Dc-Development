import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canUserViewAanwijzing, isExternalPartnerRole } from '@/lib/permissions';
import { syncAanwijzingPdfToDrive, syncAanwijzingVendorPdfToDrive } from '@/lib/aanwijzing-sync';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Sesi login tidak valid' }, { status: 401 });
    }

    const { id } = await params;
    const aanwijzingId = parseInt(id, 10);
    if (isNaN(aanwijzingId)) {
      return NextResponse.json({ status: 'error', message: 'ID Undangan tidak valid' }, { status: 400 });
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
          include: { vendor: true },
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

    const isContractorUser = isExternalPartnerRole(currentUser.role);

    const { searchParams } = new URL(request.url);
    const queryTipe = (searchParams.get('tipe') || '').toUpperCase();
    const queryVendorId = searchParams.get('vendor_id');
    const queryPesertaId = searchParams.get('peserta_id');

    // JALUR 1: PDF KHUSUS KONTRAKTOR / REKANAN
    if (isContractorUser || queryTipe === 'KONTRAKTOR' || queryVendorId || queryPesertaId) {
      let targetPeserta = null;
      if (isContractorUser) {
        const uEmail = (currentUser.email || '').toLowerCase();
        const uPt = ((currentUser.nama_pt || (currentUser as any).namaPt || '') as string).toLowerCase();
        targetPeserta =
          aanwijzing.peserta.find((p) => {
            const pEmail = (p.email || p.vendor?.email || '').toLowerCase();
            const pName = (p.vendor?.nama_perusahaan || '').toLowerCase();
            return (uEmail && pEmail === uEmail) || (uPt && pName.includes(uPt));
          }) || aanwijzing.peserta[0];
      } else {
        targetPeserta =
          aanwijzing.peserta.find((p) =>
            queryPesertaId
              ? p.id === Number(queryPesertaId)
              : queryVendorId
              ? p.vendor_id === Number(queryVendorId)
              : false
          ) || aanwijzing.peserta[0];
      }

      if (!targetPeserta) {
        return NextResponse.json(
          { status: 'error', message: 'Peserta kontraktor tidak ditemukan' },
          { status: 404 }
        );
      }

      const isDownloadReq = searchParams.get('download') === '1';
      const proxyViewUrl = `/api/dc-development/aanwijzing/${aanwijzingId}/pdf?tipe=kontraktor&vendor_id=${targetPeserta.vendor_id}`;
      const proxyUrl = isDownloadReq ? `${proxyViewUrl}&download=1` : proxyViewUrl;

      // KETENTUAN UTAMA: Jika sudah tersimpan link Google Drive di dc_aanwijzing_vendor,
      // LANGSUNG KEMBALIKAN TANPA GENERATE ULANG!
      if (
        targetPeserta.file_url &&
        (targetPeserta.file_url.startsWith('http://') || targetPeserta.file_url.startsWith('https://'))
      ) {
        return NextResponse.json({
          status: 'success',
          data: {
            // Khusus kontraktor, konsultan, atau rekanan eksternal:
            // Karena mereka tidak memiliki akun SAT Alfamart (@alfamart.co.id), tautan file_url WAJIB
            // menggunakan proxy streaming SPARTA agar tidak mengalami akses ditolak di Google Drive.
            // Untuk staf internal yang memiliki akun SAT, file_url tetap mengembalikan link Drive resmi.
            file_url: isContractorUser ? proxyUrl : targetPeserta.file_url,
            proxy_url: proxyUrl,
            drive_url: targetPeserta.file_url,
            drive_file_id: targetPeserta.drive_file_id,
            nomor_undangan: aanwijzing.nomor_undangan,
            vendor_id: targetPeserta.vendor_id,
            cached: true,
          },
        });
      }

      // Klik & Generate pertama kali: di-upload ke Drive dan tersimpan di dc_aanwijzing_vendor
      try {
        const syncResult = await syncAanwijzingVendorPdfToDrive(aanwijzingId, {
          pesertaId: targetPeserta.id,
          vendorId: targetPeserta.vendor_id,
        });

        return NextResponse.json({
          status: 'success',
          data: {
            file_url: isContractorUser ? proxyUrl : syncResult.file_url,
            proxy_url: proxyUrl,
            drive_url: syncResult.file_url,
            drive_file_id: syncResult.drive_file_id,
            nomor_undangan: aanwijzing.nomor_undangan,
            vendor_id: targetPeserta.vendor_id,
            cached: false,
          },
        });
      } catch (vendorSyncErr: any) {
        console.warn('[AANWIJZING-VENDOR-SYNC-FALLBACK] Gagal sinkronisasi PDF kontraktor:', vendorSyncErr?.message);
        return NextResponse.json({
          status: 'success',
          data: {
            file_url: proxyUrl,
            proxy_url: proxyUrl,
            nomor_undangan: aanwijzing.nomor_undangan,
            vendor_id: targetPeserta.vendor_id,
            cached: false,
          },
        });
      }
    }

    // JALUR 2: PDF INTERNAL (ARSIP DOKUMEN DC)
    const isDownloadReq = searchParams.get('download') === '1';
    const internalProxyUrl = `/api/dc-development/aanwijzing/${aanwijzingId}/pdf${isDownloadReq ? '?download=1' : ''}`;

    // KETENTUAN UTAMA: Jika sudah tersimpan link Google Drive di dc_aanwijzing,
    // LANGSUNG KEMBALIKAN TANPA GENERATE ULANG!
    if (aanwijzing.file_url && (aanwijzing.file_url.startsWith('http://') || aanwijzing.file_url.startsWith('https://'))) {
      return NextResponse.json({
        status: 'success',
        data: {
          file_url: isContractorUser ? internalProxyUrl : aanwijzing.file_url,
          proxy_url: internalProxyUrl,
          drive_url: aanwijzing.file_url,
          drive_file_id: aanwijzing.drive_file_id,
          nomor_undangan: aanwijzing.nomor_undangan,
          cached: true,
        },
      });
    }

    // Generate pertama kali untuk internal, upload ke Drive & simpan di dc_aanwijzing
    try {
      const syncResult = await syncAanwijzingPdfToDrive(aanwijzingId);
      return NextResponse.json({
        status: 'success',
        data: {
          file_url: isContractorUser ? internalProxyUrl : syncResult.file_url,
          proxy_url: internalProxyUrl,
          drive_url: syncResult.file_url,
          drive_file_id: syncResult.drive_file_id,
          nomor_undangan: aanwijzing.nomor_undangan,
          cached: false,
        },
      });
    } catch (syncErr: any) {
      console.warn('[AANWIJZING-SYNC-FALLBACK] Gagal sinkronisasi PDF internal:', syncErr?.message);
      return NextResponse.json({
        status: 'success',
        data: {
          file_url: internalProxyUrl,
          proxy_url: internalProxyUrl,
          nomor_undangan: aanwijzing.nomor_undangan,
          cached: false,
        },
      });
    }
  } catch (error: any) {
    console.error('Error on aanwijzing download-pdf route:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal menyiapkan file PDF' },
      { status: 500 }
    );
  }
}
