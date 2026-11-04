# Design Document: Penambahan Dokumen Penawaran Rekanan (Logo, Analisa Harga Satuan Excel, Asuransi CAR) & Penghapusan Bukti Pendukung per Item

**Tanggal:** 2026-11-04  
**Status:** Approved by User  
**Topik:** Formulir Penawaran Rekanan DC-Development  

---

## 1. Latar Belakang & Tujuan
Pada formulir penawaran rekanan kontraktor saat ini, terdapat kewajiban mengunggah berkas "Bukti Pendukung" pada setiap baris item BoQ pekerjaan. Hal ini membebani rekanan karena jumlah item pekerjaan sangat banyak dan berulang.

Pembaruan ini bertujuan untuk:
1. **Menghilangkan kewajiban dan kolom "Bukti Pendukung" pada setiap item pekerjaan BoQ**, sehingga kontraktor hanya fokus memasukkan nilai Harga Satuan Material dan Harga Satuan Upah (baik via formulir web langsung maupun via Impor Excel).
2. **Menambahkan kelengkapan dokumen level penawaran (Proposal-Level Attachments)**:
   - **Logo Kontraktor**: Berkas gambar identitas perusahaan (.png, .jpg, .webp).
   - **Analisa Harga Satuan**: Berkas perhitungan analisa harga satuan lengkap dalam format spreadsheet Excel (.xlsx, .xls).
   - **Asuransi Proyek (CAR / Contractor All Risks)**:
     - Nomor Polis Asuransi.
     - Masa Berlaku Asuransi (Valid Until) dengan validasi anti-backdate (`>= hari ini`).
     - Berkas Dokumen Polis Asuransi dalam format PDF.
3. Seluruh dokumen dan data asuransi ini berstatus **Wajib (Mandatory)** sebelum kontraktor dapat melanjutkan ke tahap Review Penawaran dan Final Submit, namun tetap dapat disimpan bertahap sebagai Draft.

---

## 2. Arsitektur & Database Schema

### Perubahan Model Prisma `dc_penawaran_rekanan`
File: `prisma/schema.prisma`
```prisma
model dc_penawaran_rekanan {
  // Field eksisting ...
  id                           Int      @id @default(autoincrement())
  nomor_penawaran              String   @unique
  // ...

  // --- KELENGKAPAN DOKUMEN & ASURANSI PENAWARAN BARU ---
  // 1. Logo Perusahaan Kontraktor
  kontraktor_logo_url          String?  @db.Text
  kontraktor_logo_drive_id     String?

  // 2. Analisa Harga Satuan (Excel)
  analisa_harga_url            String?  @db.Text
  analisa_harga_drive_id       String?
  analisa_harga_nama           String?

  // 3. Asuransi Proyek (Contractor All Risks)
  asuransi_no_polis            String?
  asuransi_masa_berlaku        DateTime?
  asuransi_file_url            String?  @db.Text
  asuransi_file_drive_id       String?
  asuransi_file_nama           String?

  // Relasi & Timestamps ...
}
```

*Catatan Migrasi*:
- Kolom lama `file_bukti_url`, `file_bukti_drive_id`, dan `file_bukti_nama` pada `dc_penawaran_rekanan_item` dipertahankan di database sebagai nullable untuk integritas historis, namun tidak lagi digunakan pada UI maupun validasi bisnis.

---

## 3. Komponen Antarmuka Pengguna (UI/UX)

### A. Komponen Baru: `FormDokumenAsuransiCard.tsx`
Lokasi: `components/penawaran-rekanan/FormDokumenAsuransiCard.tsx`
- **Desain SPARTA**: `rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs`.
- **Struktur 3 Grid Kolom / Card**:
  1. **Logo Kontraktor**:
     - Upload box dengan ikon gambar, mendukung drag-and-drop.
     - Tampilan thumbnail logo yang telah diupload (ukuran proporsional) dengan tombol ganti dan hapus.
     - Format: PNG, JPG, JPEG, WebP (maksimal 2MB).
  2. **Analisa Harga Satuan (Format Excel)**:
     - Upload box dengan ikon `FileSpreadsheet` berwarna hijau emerald.
     - Menampilkan nama berkas Excel yang diunggah, ukuran, serta tombol unduh preview / hapus berkas.
     - Format: `.xlsx`, `.xls` (maksimal 10MB).
  3. **Asuransi Proyek (CAR)**:
     - Input teks: `Nomor Polis Asuransi` (placeholder: e.g. POL-CAR/2026/XXXXX).
     - Input tanggal: `Masa Berlaku Hingga` dengan properti `min={today}` sehingga input tanggal tidak bisa backdate.
     - Upload box: `Dokumen Polis Asuransi` format PDF dengan ikon `ShieldCheck` oranye, preview link, dan tombol hapus/ganti berkas (maksimal 10MB).

### B. Pembersihan Tabel BoQ (`FormInputBoQTable.tsx`)
- Kolom **Bukti Pendukung** (header `<th>` dan baris `<td>`) dihapus sepenuhnya dari tabel Pekerjaan Sipil dan ME.
- Kolom tabel menjadi lebih lapang dan fokus:
  `No | Deskripsi Pekerjaan | Volume & Satuan | Harga Satuan Material (Rp) | Harga Satuan Upah (Rp) | Total Biaya (Rp)`
- Menghubungkan state form dokumen & asuransi dari `FormDokumenAsuransiCard`.

### C. Logika Validasi Alur Pengisian
- **Simpan Draft (`handleSaveDraft`)**:
  - Kontraktor bebas menyimpan perubahan kapan saja. Nilai harga parsial, dokumen yang baru diupload sebagian, atau nomor polis yang baru diketik akan tersimpan tanpa memblokir.
- **Lanjut ke Review (`handleProceedReview`)**:
  - Validasi ketat diterapkan:
    1. Seluruh item BoQ wajib memiliki harga satuan (material > 0 atau upah > 0).
    2. Logo kontraktor wajib sudah diunggah (`kontraktor_logo_url`).
    3. Analisa Harga Satuan Excel wajib sudah diunggah (`analisa_harga_url`).
    4. Asuransi lengkap: `asuransi_no_polis` terisi, `asuransi_masa_berlaku` terisi dan `>= today`, serta `asuransi_file_url` (PDF) terunggah.
  - Jika belum lengkap, muncul `FeedbackModal` tipe `warning` yang merinci butir-butir yang masih belum lengkap.

### D. Penyesuaian Halaman Review & Evaluasi
1. `app/dc-development/penawaran-rekanan/[id]/review-penawaran/page.tsx`:
   - Ganti validasi redirect lama yang memeriksa `file_bukti_url` dengan validasi kelengkapan dokumen penawaran baru.
2. `components/penawaran-rekanan/ReviewPenawaranCard.tsx`:
   - Hapus kolom "Bukti Pendukung" pada tabel review Sipil & ME.
   - Tambahkan kartu ringkasan "Kelengkapan Dokumen & Asuransi" di atas tab finansial dengan tombol unduh berkas Analisa Excel dan Polis PDF.
3. `EvaluasiBbmModal.tsx` & `EvaluasiSpecialistModal.tsx`:
   - Hapus kolom bukti pendukung per item.
   - Sediakan tombol akses dokumen Analisa Harga Satuan Excel & Asuransi di panel atas modal evaluasi.

---

## 4. API Endpoints & Penyimpanan Berkas

### A. Endpoint Upload Dokumen Penawaran
- `POST /api/dc-development/penawaran-rekanan/upload-dokumen`:
  - Menerima `FormData`: `file`, `category` (`"LOGO"` | `"ANALISA_HARGA"` | `"ASURANSI"`), dan metadata penawaran (`nomor_penawaran`, `cabang`, `nama_proyek`).
  - Mengunggah file ke Google Drive ke folder terorganisir per penawaran:
    `SPARTA / PENAWARAN_REKANAN / [CABANG] / [NOMOR_PENAWARAN] / [CATEGORY]`
  - Mengembalikan objek respons `{ status: "success", data: { file_url, drive_file_id, file_name } }`.

### B. Endpoint Simpan / Perbarui Penawaran
- `PUT /api/dc-development/penawaran-rekanan/[id]`:
  - Menerima payload yang diperluas:
    ```json
    {
      "kontraktor_logo_url": "...",
      "kontraktor_logo_drive_id": "...",
      "analisa_harga_url": "...",
      "analisa_harga_drive_id": "...",
      "analisa_harga_nama": "...",
      "asuransi_no_polis": "...",
      "asuransi_masa_berlaku": "2027-11-04T00:00:00.000Z",
      "asuransi_file_url": "...",
      "asuransi_file_drive_id": "...",
      "asuransi_file_nama": "...",
      "items": [...]
    }
    ```
  - Validasi server-side memastikan jika `status === "DIAJUKAN"`, maka seluruh field dokumen & asuransi wajib tidak boleh null/kosong, dan `asuransi_masa_berlaku` tidak boleh sebelum tanggal sekarang.

---

## 5. Rencana Pengujian (Testing Plan)
1. **Schema Sync**: Schema Prisma terupdate dan field baru tersinkronisasi ke PostgreSQL.
2. **Unggah Dokumen**:
   - Uji upload file Logo (PNG/JPG).
   - Uji upload file Analisa Harga Satuan (Excel).
   - Uji input No Polis, Date Picker anti-backdate, dan upload Dokumen Polis (PDF).
3. **Pembersihan Bukti Pendukung**:
   - Pastikan tabel BoQ tidak lagi menampilkan kolom "Bukti Pendukung" dan tidak ada error upload bukti item.
4. **Validasi Alur**:
   - Simpan draft saat dokumen belum lengkap -> Berhasil simpan.
   - Klik "Lanjut ke Review" saat dokumen belum lengkap -> Dicegah dengan rincian pesan peringatan.
   - Lengkapi seluruh dokumen dan harga -> Berhasil lanjut ke Review Penawaran.
5. **Kompilasi TypeScript**: Memastikan `tsc --noEmit` berhasil dengan 0 error.
