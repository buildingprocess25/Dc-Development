import { google, type drive_v3 } from 'googleapis';
import fs from 'fs';
import { Readable } from 'stream';

interface TokenFileData {
    token?: string;
    refresh_token: string;
    token_uri?: string;
    client_id: string;
    client_secret: string;
    scopes?: string[];
}

function resolveTokenPath(envPath: string | undefined): string | null {
    if (envPath && fs.existsSync(envPath)) return envPath;
    return null;
}

async function loadOAuth2Client(tokenPath: string) {
    const raw = fs.readFileSync(tokenPath, "utf-8");
    const data: TokenFileData = JSON.parse(raw);
    const client = new google.auth.OAuth2(data.client_id, data.client_secret);
    client.setCredentials({ refresh_token: data.refresh_token });
    
    try {
        const { credentials } = await client.refreshAccessToken();
        client.setCredentials(credentials);
        console.log(`✅ Token refreshed dari ${tokenPath}`);
    } catch (e) {
        console.error(`⚠️ Gagal refresh token dari ${tokenPath}:`, e);
    }
    return client;
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GoogleDriveProvider {
    docDrive: drive_v3.Drive | null = null;
    private static _instance: GoogleDriveProvider | null = null;
    private static _initPromise: Promise<void> | null = null;

    static get instance(): GoogleDriveProvider {
        if (!this._instance) {
            this._instance = new GoogleDriveProvider();
        }
        return this._instance;
    }

    static async initialize(): Promise<GoogleDriveProvider> {
        const inst = this.instance;
        if (!this._initPromise) {
            this._initPromise = inst._load();
        }
        await this._initPromise;
        return inst;
    }

    private constructor() {}

    private async _load() {
        const docTokenPath = resolveTokenPath(process.env.GOOGLE_DOC_TOKEN_PATH);
        if (docTokenPath) {
            try {
                const docAuth = await loadOAuth2Client(docTokenPath);
                this.docDrive = google.drive({ version: "v3", auth: docAuth });
                console.log("✅ Service Dokumen (Drive) Berhasil.");
            } catch (e) {
                console.error("⚠️ Warning: Token Dokumen gagal dimuat:", e);
            }
        } else {
            console.warn("⚠️ Warning: token_doc.json tidak ditemukan, document CRUD tidak tersedia.");
        }
    }

    private ensureDocDrive(): drive_v3.Drive {
        if (!this.docDrive) throw new Error("Service Dokumen belum siap (Token gagal load)");
        return this.docDrive;
    }

    private async setPublicPermission(drive: drive_v3.Drive, fileId: string | undefined) {
        if (!fileId) return;
        try {
            await drive.permissions.create({
                fileId,
                requestBody: { type: "anyone", role: "reader" },
                fields: "id",
                supportsAllDrives: true,
            });
        } catch (err: any) {
            console.error(`⚠️ Failed to set public permission for ${fileId}:`, err?.message || err);
        }
    }

    async uploadFile(
        folderId: string,
        filename: string,
        mimeType: string,
        buffer: Buffer,
        maxRetry = 2,
        options?: { makePublic?: boolean },
    ): Promise<{ id?: string; webViewLink?: string; thumbnailLink?: string; name?: string; mimeType?: string }> {
        const drive = this.ensureDocDrive();

        for (let attempt = 0; attempt <= maxRetry; attempt++) {
            try {
                const uploaded = await drive.files.create({
                    requestBody: { name: filename, parents: [folderId] },
                    media: { mimeType, body: Readable.from(buffer) },
                    fields: "id, webViewLink, thumbnailLink, name, mimeType",
                    supportsAllDrives: true,
                });

                if (options?.makePublic !== false) {
                    await this.setPublicPermission(drive, uploaded.data.id ?? undefined);
                }

                await sleep(250);
                return {
                    id: uploaded.data.id ?? undefined,
                    webViewLink: uploaded.data.webViewLink ?? undefined,
                    thumbnailLink: uploaded.data.thumbnailLink ?? undefined,
                    name: uploaded.data.name ?? undefined,
                    mimeType: uploaded.data.mimeType ?? undefined,
                };
            } catch (err: any) {
                const status = err?.code ?? err?.response?.status;
                if ([429, 500, 502, 503, 504].includes(status) && attempt < maxRetry) {
                    await sleep(800 * (attempt + 1));
                    continue;
                }
                throw err;
            }
        }
        throw new Error("upload_file: max retries exceeded");
    }

    async deleteDriveFile(fileId: string): Promise<void> {
        const drive = this.ensureDocDrive();
        try {
            await drive.files.delete({ fileId, supportsAllDrives: true });
        } catch (e) {
            console.error(`Gagal hapus file ${fileId}:`, e);
        }
    }
}
