import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canUserViewAanwijzing, isApprovalAdmin, isSameCreator } from '@/lib/permissions';
import { generateUndanganAanwijzingPdf } from '@/lib/pdf/generate-undangan-aanwijzing-pdf';
import { sendUndanganAanwijzingEmail, findPicUserForVendor } from '@/lib/email/aanwijzing-mailer';
import { syncAanwijzingPdfToDrive } from '@/lib/aanwijzing-sync';

export async function POST(
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
        coverage_cabang: true,
      },
    });
    const currentUser = dbUser || session;

    const aanwijzing = await prisma.dc_aanwijzing.findUnique({
      where: { id: aanwijzingId },
      include: {
        project: true,
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

    const isAdmin = isApprovalAdmin(currentUser.role);
    const isCreator = isSameCreator(currentUser, aanwijzing.created_by);

    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { status: 'error', message: 'Akses ditolak: Hanya pembuat atau Admin yang dapat mengirim ulang email' },
        { status: 403 }
      );
    }

    let vendorIdTarget: number | null = null;
    try {
      const body = await request.json();
      if (body.vendor_id) vendorIdTarget = Number(body.vendor_id);
    } catch {
      // no body, send all
    }

    // 1. Pastikan PDF internal ter-sync dan tersimpan
    await syncAanwijzingPdfToDrive(aanwijzing.id);

    const targets = vendorIdTarget
      ? aanwijzing.peserta.filter((p) => p.vendor_id === vendorIdTarget)
      : aanwijzing.peserta;

    const results = [];
    for (const p of targets) {
      const vendorNamaPerusahaan = p.vendor?.nama_perusahaan || '';
      const picUser = await findPicUserForVendor(vendorNamaPerusahaan);

      const vendorEmail = (p.email || p.vendor?.email || '').trim();
      const picEmail = picUser?.email?.trim();
      const toEmail = picEmail || vendorEmail;
      const ccEmail = picEmail && vendorEmail && picEmail.toLowerCase() !== vendorEmail.toLowerCase()
        ? vendorEmail
        : undefined;

      // Generate PDF khusus kontraktor bersangkutan (tanpa nama kontraktor lain)
      const vendorPdfBuffer = await generateUndanganAanwijzingPdf(aanwijzing.id, {
        tipe: 'KONTRAKTOR',
        pesertaId: p.id,
        vendorId: p.vendor_id,
      });

      const emailResult = await sendUndanganAanwijzingEmail({
        aanwijzingId: aanwijzing.id,
        nomorUndangan: aanwijzing.nomor_undangan,
        namaProyek: aanwijzing.project.nama_proyek,
        cabang: aanwijzing.cabang,
        tanggalPelaksanaan: new Date(aanwijzing.tanggal_pelaksanaan).toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        waktuPelaksanaan: aanwijzing.waktu_pelaksanaan,
        lokasi: aanwijzing.lokasi,
        catatan: aanwijzing.catatan,
        deadlineKonfirmasi:
          new Date(aanwijzing.deadline_konfirmasi).toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }) + ' pukul 23:59 WIB (Jam 24:00)',
        vendorNama: vendorNamaPerusahaan,
        vendorEmail: vendorEmail,
        toEmail: toEmail,
        toNama: picUser?.nama,
        ccEmail: ccEmail,
        portalUrl: process.env.WEB_SPARTA,
        pdfBuffer: vendorPdfBuffer,
      });

      await prisma.dc_aanwijzing_vendor.update({
        where: { id: p.id },
        data: {
          email_sent: emailResult.success,
          email_sent_at: emailResult.success ? new Date() : null,
          email_error: emailResult.error || null,
        },
      });

      results.push({
        vendor_id: p.vendor_id,
        to: toEmail,
        cc: ccEmail,
        email: vendorEmail,
        success: emailResult.success,
        simulated: emailResult.simulated,
        error: emailResult.error,
      });
    }

    return NextResponse.json({
      status: 'success',
      message: `Proses pengiriman email selesai untuk ${results.length} rekanan`,
      data: results,
    });
  } catch (error: any) {
    console.error('Error resending email:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal mengirim ulang email' },
      { status: 500 }
    );
  }
}
