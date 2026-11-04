import { NextRequest, NextResponse } from 'next/server';
import { getDriveClient, getDcPenawaranFolderHierarchyId, uploadFileToFolder } from '@/lib/google-drive';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const cabang = (formData.get('cabang') as string) || 'TANPA CABANG';
    const kode = (formData.get('kode') as string) || 'XXX';
    const namaProyek = (formData.get('nama_proyek') as string) || 'PROYEK';
    const inisial = formData.get('inisial') as string | null;
    const nomorPenawaran = (formData.get('nomor_penawaran') as string) || 'DRAFT';
    const vendorNama = (formData.get('vendor_nama') as string) || session.nama_pt || 'KONTRAKTOR';

    if (!file) {
      return NextResponse.json({ status: 'error', message: 'File bukti tidak ditemukan' }, { status: 400 });
    }

    const drive = await getDriveClient();
    const folderId = await getDcPenawaranFolderHierarchyId(
      drive,
      cabang,
      kode,
      namaProyek,
      inisial,
      nomorPenawaran,
      vendorNama
    );

    const originalExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
    const cleanBase = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._\-\s()]/g, '_');
    const cleanFileName = `Bukti_${Date.now()}_${cleanBase}${originalExt}`;

    const uploaded = await uploadFileToFolder(drive, folderId, file, cleanFileName);

    return NextResponse.json({
      status: 'success',
      data: {
        file_url: uploaded.webViewLink || uploaded.thumbnailLink || '',
        drive_file_id: uploaded.id || '',
        file_name: uploaded.name || cleanFileName,
        mime_type: uploaded.mimeType || file.type,
      },
    });
  } catch (error: any) {
    console.error('Error uploading bukti penawaran to Google Drive:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || 'Gagal mengunggah berkas bukti' },
      { status: 500 }
    );
  }
}
