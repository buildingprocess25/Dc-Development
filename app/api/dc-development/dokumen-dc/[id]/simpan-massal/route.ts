import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from '@/lib/auth';

type UpsertPayload = {
  kategori: string;
  nama_item: string;
  jenis_file: string;
  file_url: string | null;
  file_name: string | null;
  catatan: string | null;
  is_custom: boolean;
};

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

    const body = await request.json();
    const { fase_proyek, items } = body as { 
      fase_proyek: string; 
      items: UpsertPayload[]; 
    };

    const session = await getSession();
    const userEmail = session?.email || 'System';

    if (!fase_proyek || !items || !Array.isArray(items)) {
      return NextResponse.json({ success: false, message: 'Format payload tidak valid' }, { status: 400 });
    }

    // Execute everything in a transaction to ensure integrity
    await prisma.$transaction(async (tx) => {
      let firstUpsertedId: number | null = null;
      let itemChanges = new Map<string, { files: string[], catatan?: string }>();
      let processedCatatanFor = new Set<string>();

      for (const item of items) {
        // Find existing to know what changed for history log
        const existing = await tx.dc_dokumen.findFirst({
          where: {
            project_id: projectId,
            fase_proyek,
            kategori: item.kategori,
            nama_item: item.nama_item
          }
        });

        let fileChanged = false;
        let catatanChanged = false;
        let isNewCustomItem = false;

        if (!existing) {
          if (item.file_url) fileChanged = true;
          // Only flag catatan as changed if we haven't saved it for this item yet
          if (item.catatan && !processedCatatanFor.has(item.nama_item)) {
            catatanChanged = true;
          }
          if (item.is_custom) isNewCustomItem = true;
        } else {
          if (item.file_url !== existing.file_url) fileChanged = true;
          if (item.catatan !== existing.catatan) catatanChanged = true;
        }

        // Only process if there is a change or it's new
        if (fileChanged || catatanChanged || isNewCustomItem) {
          let upserted;
          
          if (existing) {
            upserted = await tx.dc_dokumen.update({
              where: { id: existing.id },
              data: {
                file_url: item.file_url,
                file_name: item.file_name,
                catatan: item.catatan,
                is_custom: item.is_custom,
                jenis_file: item.jenis_file,
                updated_by: userEmail,
                updated_at: new Date()
              }
            });
          } else {
            upserted = await tx.dc_dokumen.create({
              data: {
                project_id: projectId,
                fase_proyek,
                kategori: item.kategori,
                nama_item: item.nama_item,
                jenis_file: item.jenis_file,
                file_url: item.file_url,
                file_name: item.file_name,
                catatan: item.catatan,
                is_custom: item.is_custom,
                updated_by: userEmail
              }
            });
          }

          processedCatatanFor.add(item.nama_item);

          if (!firstUpsertedId) {
            firstUpsertedId = upserted.id;
          }

          if (!itemChanges.has(item.nama_item)) {
            itemChanges.set(item.nama_item, { files: [] });
          }
          
          const changes = itemChanges.get(item.nama_item)!;
          
          if (isNewCustomItem && !fileChanged && !catatanChanged) {
            changes.files.push(`Menambahkan Item Baru`);
          } else {
            if (fileChanged) {
              if (item.file_url) changes.files.push(`Upload ${item.jenis_file}`);
              else changes.files.push(`Hapus ${item.jenis_file}`);
            }
            
            if (catatanChanged) {
              changes.catatan = item.catatan || 'Dihapus';
            }
          }
        }
      }

      // Insert a single history row for the entire batch if there are changes
      if (firstUpsertedId && itemChanges.size > 0) {
        let actionLogs: string[] = [];
        itemChanges.forEach((changes, nama_item) => {
          let parts = [];
          if (changes.files.length > 0) parts.push(changes.files.join(', '));
          if (changes.catatan) parts.push(`Catatan: "${changes.catatan}"`);
          actionLogs.push(`- ${nama_item}: ${parts.join(' | ')}`);
        });

        await tx.dc_dokumen_riwayat.create({
          data: {
            dokumen_id: firstUpsertedId,
            action: 'UPDATE_BATCH',
            deskripsi_log: `Menyimpan ${itemChanges.size} item:\n${actionLogs.join('\n')}`,
            created_by: userEmail
          }
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Semua perubahan berhasil disimpan'
    });

  } catch (error: any) {
    console.error('Error in simpan-massal:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
