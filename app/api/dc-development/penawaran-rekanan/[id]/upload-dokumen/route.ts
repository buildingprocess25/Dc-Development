import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getDriveClient, getDcPenawaranFolderHierarchyId, uploadFileToFolder } from '@/lib/google-drive';
import { isExternalPartnerRole } from '@/lib/permissions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const penawaranId = parseInt(id);
    if (isNaN(penawaranId)) {
      return NextResponse.json({ status: 'error', message: 'ID Penawaran tidak valid' }, { status: 400 });
    }

    const penawaran = await prisma.dc_penawaran_rekanan.findUnique({
      where: { id: penawaranId },
      include: { project: true },
    });

    if (!penawaran) {
      return NextResponse.json({ status: 'error', message: 'Data penawaran tidak ditemukan' }, { status: 404 });
    }

    // Rekanan hanya boleh mengunggah untuk penawaran miliknya
    const isKontraktor = isExternalPartnerRole(session.role);
    if (isKontraktor && penawaran.vendor_email.toLowerCase() !== session.email.toLowerCase()) {
      return NextResponse.json({ status: 'error', message: 'Akses ditolak' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as string || '').toUpperCase(); // 'LOGO' | 'ANALISA_HARGA' | 'ASURANSI'

    if (!file) {
      return NextResponse.json({ status: 'error', message: 'File tidak ditemukan' }, { status: 400 });
    }

    if (!['LOGO', 'ANALISA_HARGA', 'ASURANSI'].includes(type)) {
      return NextResponse.json(
        { status: 'error', message: 'Tipe dokumen tidak valid. Harus LOGO, ANALISA_HARGA, atau ASURANSI' },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const fileSize = file.size;

    // Validasi Ukuran & Format Spesifik
    if (type === 'LOGO') {
      const validLogoExts = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
      const hasValidExt = validLogoExts.some((ext) => fileName.endsWith(ext));
      if (!hasValidExt && !file.type.startsWith('image/')) {
        return NextResponse.json(
          { status: 'error', message: 'Format logo harus berupa gambar (PNG, JPG, JPEG, WebP, SVG)' },
          { status: 400 }
        );
      }
      if (fileSize > 2 * 1024 * 1024) {
        return NextResponse.json(
          { status: 'error', message: 'Ukuran file logo maksimal 2MB' },
          { status: 400 }
        );
      }
    } else if (type === 'ANALISA_HARGA') {
      const validExcelExts = ['.xlsx', '.xls', '.xlsm'];
      const hasValidExt = validExcelExts.some((ext) => fileName.endsWith(ext));
      if (!hasValidExt) {
        return NextResponse.json(
          { status: 'error', message: 'Format berkas Analisa Harga Satuan harus berupa Excel (.xlsx / .xls)' },
          { status: 400 }
        );
      }
      if (fileSize > 15 * 1024 * 1024) {
        return NextResponse.json(
          { status: 'error', message: 'Ukuran file Analisa Harga Satuan maksimal 15MB' },
          { status: 400 }
        );
      }
    } else if (type === 'ASURANSI') {
      if (!fileName.endsWith('.pdf') && file.type !== 'application/pdf') {
        return NextResponse.json(
          { status: 'error', message: 'Format dokumen polis asuransi harus berupa PDF' },
          { status: 400 }
        );
      }
      if (fileSize > 15 * 1024 * 1024) {
        return NextResponse.json(
          { status: 'error', message: 'Ukuran file dokumen asuransi maksimal 15MB' },
          { status: 400 }
        );
      }
    }

    // Inisialisasi Google Drive
    const drive = await getDriveClient();
    const folderId = await getDcPenawaranFolderHierarchyId(
      drive,
      penawaran.cabang,
      penawaran.project.kode,
      penawaran.project.nama_proyek,
      penawaran.project.inisial,
      penawaran.nomor_penawaran,
      penawaran.vendor_nama
    );

    const originalExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
    const cleanBase = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._\-\s()]/g, '_');
    const prefix = type === 'LOGO' ? 'Logo' : type === 'ANALISA_HARGA' ? 'AHS' : 'Polis_CAR';
    const cleanFileName = `${prefix}_${Date.now()}_${cleanBase}${originalExt}`;

    const uploaded = await uploadFileToFolder(drive, folderId, file, cleanFileName);

    const fileUrl = uploaded.webViewLink || uploaded.thumbnailLink || (uploaded.id ? `https://drive.google.com/file/d/${uploaded.id}/view` : '');
    const driveFileId = uploaded.id || '';
    const uploadedName = uploaded.name || file.name;

    // Update database secara langsung
    const updateData: any = {};
    if (type === 'LOGO') {
      updateData.kontraktor_logo_url = fileUrl;
      updateData.kontraktor_logo_drive_id = driveFileId;
    } else if (type === 'ANALISA_HARGA') {
      updateData.analisa_harga_url = fileUrl;
      updateData.analisa_harga_drive_id = driveFileId;
      updateData.analisa_harga_nama = file.name;
    } else if (type === 'ASURANSI') {
      updateData.asuransi_file_url = fileUrl;
      updateData.asuransi_file_drive_id = driveFileId;
      updateData.asuransi_file_nama = file.name;
    }

    await prisma.dc_penawaran_rekanan.update({
      where: { id: penawaranId },
      data: updateData,
    });

    return NextResponse.json({
      status: 'success',
      data: {
        type,
        file_url: fileUrl,
        drive_file_id: driveFileId,
        file_name: file.name,
      },
    });
  } catch (error: any) {
    console.error('Error uploading penawaran document:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal mengunggah dokumen' },
      { status: 500 }
    );
  }
}
