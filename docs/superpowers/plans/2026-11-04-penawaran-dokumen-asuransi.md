# Rencana Implementasi: Dokumen Penawaran Rekanan (Logo, Analisa Harga Satuan Excel, Asuransi CAR) & Penghapusan Bukti Pendukung per Item

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghilangkan kewajiban dan kolom unggah bukti pendukung pada tiap baris item BoQ penawaran rekanan, serta menambahkan formulir input kelengkapan penawaran level proposal: Logo Perusahaan Kontraktor, Berkas Analisa Harga Satuan (.xlsx/.xls), dan Data Asuransi Proyek CAR (No Polis, Tanggal Berlaku anti-backdate, Berkas Polis .pdf).

**Architecture:** Kolom-kolom baru ditambahkan pada tabel `dc_penawaran_rekanan`. Komponen baru `FormDokumenAsuransiCard` dipasang di atas tabel BoQ pada Langkah 1, kolom bukti pendukung dihapus dari tabel BoQ (Langkah 1, Langkah 2 Review, dan Modal Evaluasi), serta validasi kelengkapan saat lanjut ke review disesuaikan untuk memvalidasi kelengkapan 3 dokumen utama ini.

**Tech Stack:** Next.js 16 (App Router), Prisma ORM, PostgreSQL, TypeScript, Tailwind CSS 4, React 19, Lucide React.

---

## Global Constraints

- Sesuai panduan arsitektur SPARTA (`GEMINI.md`), gunakan token styling `rounded-2xl`, warna `#E65F2B`, dan `FeedbackModal`.
- Seluruh kolom atau tombol yang berhubungan dengan "Bukti Pendukung" per item BoQ dihapus dari UI tanpa merusak skema database yang sudah ada.
- Input tanggal Masa Berlaku Asuransi tidak boleh backdate (properti `min` disetel ke tanggal hari ini `YYYY-MM-DD`).
- Validasi wajib (mandatory) berlaku saat menekan tombol "Lanjut ke Review" atau "Submit", sedangkan "Simpan Draft" tetap dapat menyimpan parsial tanpa memblokir.

---

## File Structure & Proposed Changes

| Path File | Aksi | Tanggung Jawab |
| :--- | :--- | :--- |
| `prisma/schema.prisma` | Modifikasi | Menambahkan 10 kolom baru pada model `dc_penawaran_rekanan` untuk logo, analisa harga excel, dan asuransi CAR |
| `scripts/migrate-penawaran-dokumen.js` | Baru | Skrip migrasi DDL PostgreSQL untuk menambahkan kolom-kolom baru jika `prisma db push` terhambat lock |
| `app/api/dc-development/penawaran-rekanan/[id]/upload-dokumen/route.ts` | Baru | API Route upload berkas khusus penawaran (Logo, Analisa Excel, Polis PDF) ke storage |
| `app/api/dc-development/penawaran-rekanan/[id]/route.ts` | Modifikasi | Menyimpan dan mengembalikan field-field dokumen & asuransi baru pada GET & PUT |
| `components/penawaran-rekanan/FormDokumenAsuransiCard.tsx` | Baru | Komponen kartu input Logo, Analisa Harga Satuan Excel, dan Asuransi CAR |
| `components/penawaran-rekanan/FormInputBoQTable.tsx` | Modifikasi | Menghapus kolom bukti pendukung, menyematkan `FormDokumenAsuransiCard`, dan memperbarui validasi review |
| `app/dc-development/penawaran-rekanan/[id]/review-penawaran/page.tsx` | Modifikasi | Memperbarui validasi redirect DRAFT dari bukti item ke dokumen penawaran baru |
| `components/penawaran-rekanan/ReviewPenawaranCard.tsx` | Modifikasi | Menghapus kolom bukti pendukung per item dan menambahkan kartu ringkasan dokumen & asuransi |
| `components/penawaran-rekanan/EvaluasiBbmModal.tsx` & `EvaluasiSpecialistModal.tsx` | Modifikasi | Menghapus kolom bukti pendukung per item dan menyertakan akses download dokumen penawaran |

---

## Implementation Tasks

### Task 1: Database Schema & Migration
**Files:**
- Modify: `prisma/schema.prisma`
- Create / Run script: `scripts/migrate-penawaran-dokumen.js`

- [x] **Step 1: Tambahkan field dokumen & asuransi pada model `dc_penawaran_rekanan` di `prisma/schema.prisma`**
  - `kontraktor_logo_url String? @db.Text`
  - `kontraktor_logo_drive_id String?`
  - `analisa_harga_url String? @db.Text`
  - `analisa_harga_drive_id String?`
  - `analisa_harga_nama String?`
  - `asuransi_no_polis String?`
  - `asuransi_masa_berlaku DateTime?`
  - `asuransi_file_url String? @db.Text`
  - `asuransi_file_drive_id String?`
  - `asuransi_file_nama String?`

- [x] **Step 2: Jalankan migrasi schema ke PostgreSQL database**
  - Buat skrip `scripts/migrate-penawaran-dokumen.js` dengan query `ALTER TABLE dc_penawaran_rekanan ADD COLUMN IF NOT EXISTS ...`
  - Eksekusi `node scripts/migrate-penawaran-dokumen.js`

- [x] **Step 3: Verifikasi kolom telah berhasil dibuat di database**

---

### Task 2: API Route Upload Dokumen & Update Penawaran
**Files:**
- Create: `app/api/dc-development/penawaran-rekanan/[id]/upload-dokumen/route.ts`
- Modify: `app/api/dc-development/penawaran-rekanan/[id]/route.ts`

- [x] **Step 1: Buat API Route `upload-dokumen`**
  - Menerima `FormData` (`file`, `type`: `"LOGO"` | `"ANALISA_HARGA"` | `"ASURANSI"`)
  - Validasi tipe MIME & ukuran (Logo: image max 2MB, Analisa: Excel max 10MB, Asuransi: PDF max 10MB)
  - Simpan berkas dan update record `dc_penawaran_rekanan`
  - Kembalikan respon `{ status: "success", data: { file_url, drive_file_id, file_name } }`

- [x] **Step 2: Perbarui API `GET` & `PUT` pada `app/api/dc-development/penawaran-rekanan/[id]/route.ts`**
  - `PUT`: Simpan field `kontraktor_logo_url`, `analisa_harga_url`, `asuransi_no_polis`, `asuransi_masa_berlaku`, `asuransi_file_url`, dll saat save draft atau submit.

---

### Task 3: Komponen UI `FormDokumenAsuransiCard.tsx`
**Files:**
- Create: `components/penawaran-rekanan/FormDokumenAsuransiCard.tsx`

- [x] **Step 1: Buat antarmuka kartu dengan 3 blok visual:**
  - **Blok 1 (Logo Kontraktor)**: Dropzone upload gambar, thumbnail preview, tombol ganti/hapus.
  - **Blok 2 (Analisa Harga Satuan Excel)**: Dropzone upload Excel, icon `FileSpreadsheet`, nama file & size badge, tombol unduh preview / hapus.
  - **Blok 3 (Asuransi Proyek CAR)**:
    - Input No. Polis Asuransi
    - Date Input Masa Berlaku (Valid Until) dengan `min={todayStr}` (anti-backdate)
    - Dropzone upload Dokumen Polis PDF, nama file & badge, tombol unduh preview / hapus.

- [x] **Step 2: Hubungkan handler upload asinkron ke endpoint API `upload-dokumen` dengan state progress & error handling.**

---

### Task 4: Integrasi Form Input BoQ & Hapus Bukti Pendukung per Item
**Files:**
- Modify: `components/penawaran-rekanan/FormInputBoQTable.tsx`

- [x] **Step 1: Hapus kolom "Bukti Pendukung" dari tabel BoQ**
  - Hapus `<th>Bukti Pendukung</th>`
  - Hapus `<td>` yang merender tombol upload bukti pendukung per item
  - Hapus state `uploadingId`, fungsi `handleFileUpload`, dan import yang tidak terpakai

- [x] **Step 2: Sematkan `FormDokumenAsuransiCard` di bagian atas formulir (sebelum tabel BoQ)**
  - Inisialisasi state dokumen & asuransi dari data `penawaran`

- [x] **Step 3: Perbarui fungsi `saveToServer`**
  - Sertakan field dokumen & asuransi dalam payload PUT

- [x] **Step 4: Perbarui validasi `handleProceedReview`**
  - Validasi harga: 100% item terisi harga satuan
  - Validasi dokumen: Logo terunggah, Analisa Harga Satuan Excel terunggah, Asuransi (No Polis, Masa Berlaku >= today, PDF) lengkap
  - Tampilkan `FeedbackModal` tipe warning jika ada field yang belum lengkap

---

### Task 5: Penyesuaian Halaman Review & Modal Evaluasi
**Files:**
- Modify: `app/dc-development/penawaran-rekanan/[id]/review-penawaran/page.tsx`
- Modify: `components/penawaran-rekanan/ReviewPenawaranCard.tsx`
- Modify: `components/penawaran-rekanan/EvaluasiApprovalPenawaranTabs.tsx`
- Modify: `components/penawaran-rekanan/EvaluasiBbmModal.tsx`
- Modify: `components/penawaran-rekanan/EvaluasiSpecialistModal.tsx`

- [x] **Step 1: Perbarui proteksi redirect di `review-penawaran/page.tsx`**
  - Ganti validasi `file_bukti_url` dengan validasi kelengkapan dokumen penawaran baru

- [x] **Step 2: Update `ReviewPenawaranCard.tsx`**
  - Hapus kolom Bukti Pendukung dari tabel Sipil dan ME
  - Tambahkan kartu ringkasan "Kelengkapan Dokumen & Asuransi" di atas tab finansial dengan tombol unduh berkas Analisa Excel dan Polis PDF serta preview Logo kontraktor

- [x] **Step 3: Update Modal Evaluasi BBM & Specialist**
  - Hapus kolom Bukti Pendukung dari tabel komparasi/evaluasi
  - Tampilkan tombol/link akses Analisa Harga Satuan Excel dan Dokumen Asuransi PDF di header evaluasi penawaran

---

### Task 6: Verifikasi & Testing
- [x] **Step 1: Verifikasi tabel dan kolom database PostgreSQL**
- [x] **Step 2: Jalankan `tsc --noEmit` untuk memastikan 0 TypeScript error (Exit Code 0: Clean)**
- [x] **Step 3: Uji coba formulir pengisian penawaran rekanan**
  - Pastikan kolom bukti pendukung sudah hilang
  - Pastikan tanggal masa berlaku asuransi tidak bisa memilih tanggal kemarin/lampau (anti-backdate)
  - Pastikan dokumen tersimpan dan terbaca di halaman review
