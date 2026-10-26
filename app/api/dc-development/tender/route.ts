import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncTenderPdfToDrive } from "@/lib/tender-sync";
import { getVendorUsers, enrichPesertaWithPic } from "@/lib/tender-helper";

// GET /api/dc-development/tender - Ambil daftar tender
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const cabang = searchParams.get("cabang");
    const kategoriNilai = searchParams.get("kategori_nilai");

    const where: any = {};

    if (search) {
      where.OR = [
        { nomor_tender: { contains: search, mode: "insensitive" } },
        { project: { nama_proyek: { contains: search, mode: "insensitive" } } },
        { project: { cabang: { contains: search, mode: "insensitive" } } },
        { created_by: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status && status !== "ALL" && status !== "all") {
      where.status = status;
    }

    if (cabang && cabang !== "ALL" && cabang !== "all") {
      where.cabang = cabang;
    }

    if (kategoriNilai && kategoriNilai !== "ALL" && kategoriNilai !== "all") {
      where.kategori_nilai = kategoriNilai;
    }

    const tenders = await prisma.dc_tender.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            kode: true,
            nama_proyek: true,
            cabang: true,
            dc_induk: true,
          },
        },
        renovasi: {
          select: {
            id: true,
            nomor_pengajuan: true,
            grand_total: true,
            jenis_renovasi: true,
          },
        },
        fungsi_ruang: {
          select: {
            id: true,
            nomor_pengajuan: true,
            jenis_pengajuan: true,
          },
        },
        peserta: {
          include: {
            vendor: true,
          },
        },
        schedule: {
          orderBy: { urutan: "asc" },
        },
        audit_logs: {
          orderBy: { created_at: "desc" },
          take: 5,
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Ambil akun PIC dari dc_users untuk memperkaya info vendor
    const vendorUsers = await getVendorUsers();
    const enrichedTenders = tenders.map((t) => ({
      ...t,
      peserta: enrichPesertaWithPic(t.peserta, vendorUsers),
    }));

    return NextResponse.json({
      status: "success",
      data: enrichedTenders,
    });
  } catch (error: any) {
    console.error("Error fetching tenders:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Gagal memuat daftar Pengajuan Proposal Tender." },
      { status: 500 }
    );
  }
}

// POST /api/dc-development/tender - Buat Pengajuan Proposal Tender baru
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      project_id,
      renovasi_id,
      fungsi_ruang_id,
      kategori_nilai,
      nilai_proyek,
      cabang,
      created_by,
      user_name,
      user_role,
      butuh_konsultan,
      tipe_konsultan,
      catatan_maker,
      peserta,
      schedule,
    } = body;

    // 1. Validasi dasar
    if (!project_id || !renovasi_id || !cabang || !created_by) {
      return NextResponse.json(
        { status: "error", message: "Data proyek, renovasi, cabang, dan pembuat wajib diisi." },
        { status: 400 }
      );
    }

    if (!Array.isArray(peserta) || peserta.length === 0) {
      return NextResponse.json(
        { status: "error", message: "Peserta tender wajib dipilih minimal 3 kontraktor." },
        { status: 400 }
      );
    }

    // 2. Filter kontraktor vs konsultan
    const kontraktorList = peserta.filter(
      (p: any) => p.peran === "MAIN_KONTRAKTOR" || p.peran === "KONTRAKTOR"
    );

    if (kontraktorList.length < 3) {
      return NextResponse.json(
        { status: "error", message: `Minimal 3 rekanan Kontraktor wajib diajukan (saat ini: ${kontraktorList.length}).` },
        { status: 400 }
      );
    }

    // 3. Validasi alasan jika peserta ditandai TIDAK_LOLOS
    for (const p of peserta) {
      if (p.status_tahap === "TIDAK_LOLOS" && (!p.alasan_tidak_lolos || !p.alasan_tidak_lolos.trim())) {
        return NextResponse.json(
          { status: "error", message: "Alasan wajib diisi jika ada rekanan yang dinyatakan Tidak Lolos kualifikasi." },
          { status: 400 }
        );
      }
    }

    // 3b. Validasi tanggal jadwal: tanggal_selesai tidak boleh lebih kecil dari tanggal_mulai
    if (Array.isArray(schedule)) {
      for (const s of schedule) {
        if (s.tanggal_mulai && s.tanggal_selesai) {
          if (new Date(s.tanggal_selesai) < new Date(s.tanggal_mulai)) {
            return NextResponse.json(
              {
                status: "error",
                message: `Tanggal selesai kegiatan "${s.nama_kegiatan || "Jadwal"}" tidak boleh lebih awal dari tanggal mulai.`,
              },
              { status: 400 }
            );
          }
        }
      }
    }

    // 4. Generate Nomor Tender Unik: TND/DC/YYMM/XXXX
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `TND/DC/${year}${month}/`;

    const countThisMonth = await prisma.dc_tender.count({
      where: {
        nomor_tender: {
          startsWith: prefix,
        },
      },
    });

    const sequence = String(countThisMonth + 1).padStart(4, "0");
    const nomorTender = `${prefix}${sequence}`;

    // 5. Simpan transaksi tender
    const newTender = await prisma.$transaction(async (tx) => {
      const createdTender = await tx.dc_tender.create({
        data: {
          nomor_tender: nomorTender,
          project_id: Number(project_id),
          renovasi_id: Number(renovasi_id),
          fungsi_ruang_id: fungsi_ruang_id ? Number(fungsi_ruang_id) : null,
          kategori_nilai: kategori_nilai || (Number(nilai_proyek) > 1_000_000_000 ? "DI_ATAS_1M" : "DI_BAWAH_1M"),
          nilai_proyek: Number(nilai_proyek) || 0,
          cabang,
          created_by,
          butuh_konsultan: Boolean(butuh_konsultan),
          tipe_konsultan: butuh_konsultan ? tipe_konsultan : null,
          catatan_maker: catatan_maker || null,
          status: "PRAKUALIFIKASI",
        },
      });

      // Simpan Peserta Tender
      for (const p of peserta) {
        await tx.dc_tender_peserta.create({
          data: {
            tender_id: createdTender.id,
            vendor_id: Number(p.vendor_id),
            peran: p.peran === "KONTRAKTOR" ? "MAIN_KONTRAKTOR" : p.peran,
            status_tahap: p.status_tahap || "PRAKUALIFIKASI",
            alasan_tidak_lolos: p.alasan_tidak_lolos || null,
            score: p.score ? Number(p.score) : null,
          },
        });
      }

      // Simpan Jadwal Schedule jika ada
      if (Array.isArray(schedule) && schedule.length > 0) {
        for (let i = 0; i < schedule.length; i++) {
          const s = schedule[i];
          if (s.nama_kegiatan && s.tanggal_mulai && s.tanggal_selesai) {
            await tx.dc_tender_schedule.create({
              data: {
                tender_id: createdTender.id,
                kategori_jadwal: s.kategori_jadwal || "TENDER_MAIN_KONTRAKTOR",
                nama_kegiatan: s.nama_kegiatan,
                tanggal_mulai: new Date(s.tanggal_mulai),
                tanggal_selesai: new Date(s.tanggal_selesai),
                keterangan: s.keterangan || null,
                urutan: s.urutan !== undefined ? Number(s.urutan) : i + 1,
              },
            });
          }
        }
      }

      // Simpan Initial Audit Log
      await tx.dc_tender_audit_log.create({
        data: {
          tender_id: createdTender.id,
          user_email: created_by,
          user_name: user_name || created_by.split("@")[0],
          user_role: user_role || "B&M Manager / Pemohon",
          action: "SUBMIT",
          from_status: "-",
          to_status: "PRAKUALIFIKASI",
          notes: catatan_maker || "Pengajuan Proposal Tender baru diajukan oleh maker.",
        },
      });

      return createdTender;
    });

    // Jalankan regenerasi PDF dan upload Google Drive secara background (asinkron)
    syncTenderPdfToDrive(newTender.id).catch((err) => {
      console.warn(`[ASYNC-DRIVE-SYNC] Gagal sinkronisasi PDF tender #${newTender.id}:`, err);
    });

    return NextResponse.json(
      {
        status: "success",
        message: `Pengajuan Proposal Tender ${newTender.nomor_tender} berhasil dibuat.`,
        data: newTender,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating tender:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Gagal menyimpan Pengajuan Proposal Tender baru." },
      { status: 500 }
    );
  }
}
