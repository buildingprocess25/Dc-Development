import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient, getDcRenovasiFolderHierarchyId, uploadFileToFolder } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const cabang = formData.get('cabang') as string || 'TANPA CABANG';
    const kode = formData.get('kode') as string || 'XXX';
    const namaProyek = formData.get('nama_proyek') as string || 'PROYEK';
    const inisial = formData.get('inisial') as string | null;
    const nomorPengajuan = formData.get('nomor_pengajuan') as string || 'DRAFT';
    const subFolder = (formData.get('sub_folder') as any) || 'Gambar Sipil';
    const customName = formData.get('custom_name') as string | null;

    if (!file) {
      return NextResponse.json({ status: 'error', message: 'File tidak ditemukan' }, { status: 400 });
    }

    const drive = await getDriveClient();

    // Buat atau dapatkan hierarki folder renovasi di Google Drive
    const targetFolderId = await getDcRenovasiFolderHierarchyId(
      drive,
      cabang,
      kode,
      namaProyek,
      inisial,
      nomorPengajuan,
      subFolder
    );

    // Format nama file agar bersih, prioritaskan custom_name dari input user
    const originalExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
    let baseFileName = (file.name || 'file').replace(/\.[^/.]+$/, '');
    if (customName && customName.trim()) {
      baseFileName = customName.trim();
    }
    const safeBaseName = baseFileName.replace(/[^a-zA-Z0-9._\-\s()]/g, '_');
    const cleanFileName = originalExt ? `${safeBaseName}${originalExt}` : safeBaseName;

    // Upload file ke folder target
    const uploadedData = await uploadFileToFolder(drive, targetFolderId, file, cleanFileName);

    return NextResponse.json({
      status: 'success',
      data: {
        file_url: uploadedData.webViewLink || uploadedData.thumbnailLink || '',
        drive_file_id: uploadedData.id || '',
        file_name: uploadedData.name || cleanFileName,
        mime_type: uploadedData.mimeType || file.type
      }
    });
  } catch (error: any) {
    console.error('Error uploading renovasi file to Google Drive:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal mengunggah file ke Google Drive' },
      { status: 500 }
    );
  }
}
