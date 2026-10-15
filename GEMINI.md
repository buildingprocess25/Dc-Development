# SPARTA DC-Development — AI Assistant Rules & Guidelines

## 1. Aturan Wajib: Prioritaskan Penggunaan Komponen yang Ada (Component Reuse First)
- **Wajib Cek Komponen yang Sudah Ada Terlebih Dahulu**: Sebelum membuat UI, halaman, atau fitur baru, AI WAJIB memeriksa folder `components/` untuk menemukan komponen yang sudah ada.
- **Dilarang Membuat Komponen Duplikat**: Jangan membuat komponen baru dengan fungsi, tata letak, atau tampilan yang sama jika komponen tersebut sudah tersedia di codebase.
- **Ekstrak Komponen Baru Hanya Jika Belum Ada**: Jika suatu fitur baru membutuhkan elemen UI yang belum ada komponennya, buat komponen tersebut secara modular, rapi, dan letakkan di direktori `components/` yang sesuai agar dapat digunakan kembali oleh modul-modul lain di masa depan.
- **Konsistensi Desain**: Seluruh halaman harus mengikuti pola desain SPARTA (kartu ber-radius `rounded-2xl`, border `border-slate-200/80`, tombol aksen oranye `#E65F2B`, tipografi jelas dan bersih).

---

## 2. Katalog Komponen Reusable yang Tersedia

### A. Halaman Depan / Hub Modul (`components/hub/`)
- **`HubHeaderBanner`** (`components/hub/HubHeaderBanner.tsx`):
  Banner kartu putih di bagian atas halaman depan modul (berisi tag pill uppercase, subtitle dot `• SPARTA DC Development`, judul halaman tebal, dan deskripsi).
- **`HubCategoryCard`** (`components/hub/HubCategoryCard.tsx`):
  Kartu modul di grid (berisi ikon squircle oranye, badge status hijau / badge oranye pulse `N Perlu Tindakan`, judul, deskripsi, footer stats, dan tombol aksi oranye `Buka Dokumen →` atau `Buka Antrean →`).

### B. Modul Approval (`components/approval/`)
- **`ApprovalPageTitle`** (`components/approval/ApprovalPageTitle.tsx`):
  Header standar untuk halaman antrean approval (tombol kembali, breadcrumb uppercase, judul tebal, slot extra badge SOP).
- **`ApprovalFilterToolbar`** (`components/approval/ApprovalFilterToolbar.tsx`):
  Toolbar filter antrean approval (tabs role `Perlu Tindakan Saya` & `Semua Berkas Terkait`, filter status untuk admin, input pencarian, dan dropdown cabang).
- **`ApprovalActionCard`** (`components/approval/ApprovalActionCard.tsx`):
  Kartu aksi persetujuan standar SPARTA (tanpa textarea catatan di awal) yang menampilkan ringkasan wewenang approver, tahap transisi berikutnya, dan tombol aksi pemicu dialog.
- **`ApprovalActionDialog`** (`components/approval/ApprovalActionDialog.tsx`):
  Modal dialog pop-up konfirmasi aksi persetujuan (Setujui, Kembalikan Revisi, Tolak) yang mendukung `rab-oe` dan `fungsi-ruang`. Catatan WAJIB diisi saat Kembalikan Revisi, dan OPSIONAL saat Setujui (Approve).
- **`ApprovalStepper`** (`components/approval/ApprovalStepper.tsx`):
  Indikator tahapan approval berjenjang visual (4 tahap untuk RAB/OE, 7 tahap untuk Fungsi Ruang).
- **`ApprovalNotesHistory`** (`components/approval/ApprovalNotesHistory.tsx`):
  Komponen riwayat catatan persetujuan dan audit trail bertingkat dengan filter zero-empty.
- **`SubmissionReasonCard`** (`components/approval/SubmissionReasonCard.tsx`):
  Komponen penampil rincian dan alasan pengajuan (otomatis disembunyikan bila data alasan kosong).
- **`RevisionInstructionBanner`** & **`RevisionPinpointBadge`**:
  Banner instruksi perbaikan revisi dan penanda revisi pinpoint pada form.

### C. Modul Daftar Dokumen (`components/dokumen/`)
- **`DokumenHeaderCard`** (`components/dokumen/DokumenHeaderCard.tsx`):
  Banner header halaman katalog dokumen resmi (tombol kembali `ChevronLeft`, ikon + kategori kecil, judul dokumen, badge SOP).
- **`DokumenFilterToolbar`** (`components/dokumen/DokumenFilterToolbar.tsx`):
  Toolbar pencarian dan pemfilteran dokumen (search bar, filter cabang, filter status dokumen dinamis, tombol refresh dengan animasi putar).
- **`DokumenRabOeTable`** & **`DokumenFungsiRuangTable`**:
  Tabel katalog dokumen arsip resmi beserta aksi unduh berkas PDF dan tinjau detail.

### D. Komponen Form, Filter & UI Global (`components/ui/`)
- **`BranchFilterSelect`** (`components/ui/branch-filter-select.tsx`):
  Dropdown pilihan cabang yang otomatis membatasi opsi sesuai hak akses `coverage_cabang` pengguna yang sedang login.
- **`FilterSelect`** (`components/ui/filter-select.tsx`):
  Dropdown filter bergaya bersih dengan fitur search dan keyboard navigasi.
- **`FeedbackModal`** (`components/ui/feedback-modal.tsx`):
  Modal dialog feedback hasil aksi (sukses atau gagal/error).
- **`Dashboard`** (`components/dashboard/dashboard.tsx`):
  Layout wrapper utama dengan sidebar navigasi, header bar, dan area konten responsif.

### E. Modal Peninjauan Detail
- **`DetailRenovasiModal`** (`components/renovasi/DetailRenovasiModal.tsx`):
  Modal peninjauan detail lengkap estimasi RAB / OE, rincian biaya, item pekerjaan, dan histori approval.
- **`DetailFungsiRuangModal`** & **`ReviewFungsiRuangModal`** (`components/fungsi-ruang/`):
  Modal peninjauan data perubahan fungsi ruang, komparasi luas, foto lingkungan, dan form review approval.

---

## 3. Aturan Pembuatan Fitur Baru di Masa Depan
1. **Analisis Komponen**: Sebelum menulis JSX/TSX di file `page.tsx` baru, periksa apakah struktur halaman termasuk kategori **Hub**, **Approval**, **Katalog Dokumen**, atau **Form Input**.
2. **Gunakan Komponen yang Sesuai**: Gunakan komponen dari katalog di atas sesuai kategori halaman tersebut.
3. **Ekstrak Komponen Baru**: Bila ada elemen berulang baru (misal: tabel log baru, card metrik baru), buat di folder `components/<nama_modul>/` dan buatlah fleksibel (*configurable via props*) agar modul lain bisa memakainya.
