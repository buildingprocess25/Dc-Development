import { google, drive_v3 } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const MASTER_DRIVE_FOLDER_ID = "1SY5gg3Yw6BQZ4UQrAuxUk_adCW00gYwM";

// In-memory cache to prevent race conditions when creating folders concurrently
const folderCache = new Map<string, Promise<string>>();

const escapeDriveQueryString = (value: string): string => value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export async function getDriveClient(): Promise<drive_v3.Drive> {
  const paths = [
    path.resolve(process.cwd(), 'token_doc.json'),
    path.resolve(process.cwd(), 'token.json'),
    'c:/alfamart/KERJA/dc-development/token_doc.json',
    'c:/alfamart/KERJA/dc-development/token.json'
  ];

  let validPath = null;
  for (const p of paths) {
    if (fs.existsSync(p)) {
      validPath = p;
      break;
    }
  }

  if (!validPath) {
    throw new Error(`File token tidak ditemukan. CWD: ${process.cwd()}`);
  }

  const raw = fs.readFileSync(validPath, 'utf-8');
  const data = JSON.parse(raw);
  
  const client = new google.auth.OAuth2(data.client_id, data.client_secret);
  client.setCredentials({ refresh_token: data.refresh_token });
  
  return google.drive({ version: 'v3', auth: client });
}

export async function getOrCreateFolder(drive: drive_v3.Drive, name: string, parentId: string): Promise<string> {
  const safeName = escapeDriveQueryString(name);
  const cacheKey = `${parentId}_${safeName}`;

  if (folderCache.has(cacheKey)) {
    return folderCache.get(cacheKey)!;
  }

  const createPromise = (async () => {
    try {
      const query = `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const res = await drive.files.list({ q: query, fields: "files(id)", supportsAllDrives: true, includeItemsFromAllDrives: true });
      const items = res.data.files || [];
      if (items.length > 0) return items[0].id!;

      const folder = await drive.files.create({
        requestBody: {
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        },
        fields: "id",
        supportsAllDrives: true,
      });
      return folder.data.id!;
    } catch (error) {
      folderCache.delete(cacheKey); // Hapus dari cache jika gagal agar bisa di-retry
      throw error;
    }
  })();

  folderCache.set(cacheKey, createPromise);
  return createPromise;
}

export async function getDcDevFolderHierarchyId(
  drive: drive_v3.Drive,
  cabang: string,
  kode: string,
  nama_proyek: string,
  inisial: string | null,
  fitur: string,      // e.g., "Penyimpanan Dokumen DC"
  fase: string,       // e.g., "PEMBANGUNAN"
  kategori: string,   // e.g., "SITEPLAN"
  nama_item: string   // e.g., "Gambar Kerja Arsitektur"
): Promise<string> {
  // 1. Master Folder -> Cabang
  const cabangFolderId = await getOrCreateFolder(drive, cabang || "TANPA CABANG", MASTER_DRIVE_FOLDER_ID);
  
  // 2. Cabang -> DC Development
  const dcDevFolderId = await getOrCreateFolder(drive, "DC Development", cabangFolderId);
  
  // 3. DC Development -> Project Folder (KODE - NAMA_PROYEK - INISIAL)
  const inisialText = inisial ? ` - ${inisial}` : '';
  const projectName = `${kode || "XXX"} - ${nama_proyek || "TANPA NAMA"}${inisialText}`;
  const projectFolderId = await getOrCreateFolder(drive, projectName, dcDevFolderId);
  
  // 4. Project Folder -> Building
  const buildingFolderId = await getOrCreateFolder(drive, "Building", projectFolderId);
  
  // 5. Building -> Fitur
  const fiturFolderId = await getOrCreateFolder(drive, fitur || "Umum", buildingFolderId);

  // 6. Fitur -> Fase
  const faseFolderId = await getOrCreateFolder(drive, fase || "UMUM", fiturFolderId);
  
  // 7. Fase -> Kategori
  const kategoriFolderId = await getOrCreateFolder(drive, kategori || "KATEGORI", faseFolderId);

  // 8. Kategori -> Jenis Item
  const itemFolderId = await getOrCreateFolder(drive, nama_item || "ITEM", kategoriFolderId);
  
  return itemFolderId;
}

function bufferToStream(buffer: Buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

export async function uploadFileToFolder(
  drive: drive_v3.Drive,
  folderId: string,
  file: File,
  cleanFileName: string
) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploaded = await drive.files.create({
    requestBody: {
      name: cleanFileName,
      parents: [folderId]
    },
    media: {
      mimeType: file.type,
      body: bufferToStream(buffer),
    },
    fields: 'id, webViewLink, thumbnailLink, name, mimeType',
    supportsAllDrives: true,
  });

  // Opsional jadikan public, ignore error jika diblokir
  if (uploaded.data.id) {
    try {
      await drive.permissions.create({
        fileId: uploaded.data.id,
        requestBody: { type: 'anyone', role: 'reader' },
        supportsAllDrives: true,
      });
    } catch (permError: any) {
      console.warn('Gagal mengubah permission menjadi public:', permError.message);
    }
  }

  return uploaded.data;
}
