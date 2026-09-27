import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDriveClient, getDcDevFolderHierarchyId, uploadFileToFolder } from '@/lib/google-drive';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ success: false, message: 'Invalid ID' }, { status: 400 });
    }

    // Ambil data file dari FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const kategori = formData.get('kategori') as string;
    const fase = formData.get('fase') as string;
    const nama_item = formData.get('nama_item') as string;

    if (!file) {
      return NextResponse.json({ success: false, message: 'Tidak ada file yang diunggah' }, { status: 400 });
    }

    // Ambil info project untuk penamaan folder & file
    const project = await prisma.dc_project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      return NextResponse.json({ success: false, message: 'Proyek tidak ditemukan' }, { status: 404 });
    }

    const drive = await getDriveClient();
    
    // Format nama file agar rapi: [KODE_PROYEK] - [FASE] - [NAMA_FILE_ASLI]
    const cleanFileName = `${project.kode} - ${fase || 'UMUM'} - ${file.name}`;

    // Buat/dapatkan hierarki folder di Google Drive secara dinamis
    const targetFolderId = await getDcDevFolderHierarchyId(
      drive,
      project.cabang,
      project.kode,
      project.nama_proyek,
      project.inisial,
      "Penyimpanan Dokumen DC", // Fitur
      fase,
      kategori,
      nama_item || "DOKUMEN"
    );

    // Proses Upload ke folder spesifik tersebut
    const uploadedData = await uploadFileToFolder(drive, targetFolderId, file, cleanFileName);

    return NextResponse.json({
      success: true,
      message: 'File berhasil diunggah ke Google Drive',
      data: {
        file_id: uploadedData.id,
        file_url: uploadedData.webViewLink,
        file_name: uploadedData.name,
      }
    });

  } catch (error: any) {
    console.error('Error saat upload ke Drive:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
