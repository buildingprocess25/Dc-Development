import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient, getDcAanwijzingFolderHierarchyId, uploadFileToFolder } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const cabang = (formData.get('cabang') as string) || 'TANPA CABANG';
    const kode = (formData.get('kode') as string) || 'XXX';
    const namaProyek = (formData.get('nama_proyek') as string) || 'PROYEK';
    const inisial = formData.get('inisial') as string | null;
    const nomorUndangan = (formData.get('nomor_undangan') as string) || 'DRAFT';
    const subFolder = (formData.get('sub_folder') as string) || 'Klarifikasi';
    const customName = formData.get('custom_name') as string | null;

    if (!file) {
      return NextResponse.json(
        { status: 'error', message: 'File tidak ditemukan' },
        { status: 400 }
      );
    }

    const drive = await getDriveClient();

    // Dapatkan folder hierarki di Google Drive: Cabang -> DC Dev -> Project -> Building -> Aanwijzing -> [Undangan] -> [Subfolder]
    const targetFolderId = await getDcAanwijzingFolderHierarchyId(
      drive,
      cabang,
      kode,
      namaProyek,
      inisial,
      nomorUndangan,
      subFolder
    );

    // Format nama file
    const originalExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
    let baseFileName = (file.name || 'file').replace(/\.[^/.]+$/, '');
    if (customName && customName.trim()) {
      baseFileName = customName.trim();
    }
    const safeBaseName = baseFileName.replace(/[^a-zA-Z0-9._\-\s()]/g, '_');
    const cleanFileName = originalExt ? `${safeBaseName}${originalExt}` : safeBaseName;

    const uploadedData = await uploadFileToFolder(drive, targetFolderId, file, cleanFileName);

    return NextResponse.json({
      status: 'success',
      data: {
        file_url: uploadedData.webViewLink || uploadedData.thumbnailLink || '',
        drive_file_id: uploadedData.id || '',
        file_name: uploadedData.name || cleanFileName,
        mime_type: uploadedData.mimeType || file.type,
      },
    });
  } catch (error: any) {
    console.error('Error uploading klarifikasi aanwijzing file to Google Drive:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal mengunggah file ke Google Drive' },
      { status: 500 }
    );
  }
}
