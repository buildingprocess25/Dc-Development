import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getVendorUsers, enrichPesertaWithPic } from "@/lib/tender-helper";
import { syncTenderPdfToDrive } from "@/lib/tender-sync";

// GET /api/dc-development/tender/[id] - Ambil detail lengkap satu Pengajuan Proposal Tender
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenderId = Number(id);

    if (isNaN(tenderId)) {
      return NextResponse.json(
        { status: "error", message: "ID tender tidak valid." },
        { status: 400 }
      );
    }

    const tender = await prisma.dc_tender.findUnique({
      where: { id: tenderId },
      include: {
        project: true,
        renovasi: {
          include: {
            dokumen: true,
          },
        },
        fungsi_ruang: {
          include: {
            pemohon: true,
          },
        },
        peserta: {
          include: {
            vendor: true,
          },
          orderBy: { peran: "asc" },
        },
        schedule: {
          orderBy: { urutan: "asc" },
        },
        audit_logs: {
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!tender) {
      return NextResponse.json(
        { status: "error", message: "Data Pengajuan Proposal Tender tidak ditemukan." },
        { status: 404 }
      );
    }

    const vendorUsers = await getVendorUsers();
    const enrichedTender = {
      ...tender,
      peserta: enrichPesertaWithPic(tender.peserta, vendorUsers),
    };

    return NextResponse.json({
      status: "success",
      data: enrichedTender,
    });
  } catch (error: any) {
    console.error("Error fetching tender detail:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Gagal memuat detail tender." },
      { status: 500 }
    );
  }
}

// PUT /api/dc-development/tender/[id] - Update tender (DRAFT atau REVISI)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenderId = Number(id);
    const body = await req.json();

    const existingTender = await prisma.dc_tender.findUnique({
      where: { id: tenderId },
      include: { peserta: true },
    });

    if (!existingTender) {
      return NextResponse.json(
        { status: "error", message: "Data tender tidak ditemukan." },
        { status: 404 }
      );
    }

    const {
      catatan_maker,
      catatan_kualifikasi,
      butuh_konsultan,
      tipe_konsultan,
      peserta,
      schedule,
      user_email,
      user_name,
      user_role,
      action_note,
      status_target,
    } = body;

    // Validasi tanggal jadwal: tanggal_selesai tidak boleh lebih kecil dari tanggal_mulai
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

    const updatedTender = await prisma.$transaction(async (tx) => {
      // 1. Update data pokok tender
      const tender = await tx.dc_tender.update({
        where: { id: tenderId },
        data: {
          catatan_maker: catatan_maker !== undefined ? catatan_maker : existingTender.catatan_maker,
          butuh_konsultan: butuh_konsultan !== undefined ? Boolean(butuh_konsultan) : existingTender.butuh_konsultan,
          tipe_konsultan: tipe_konsultan !== undefined ? tipe_konsultan : existingTender.tipe_konsultan,
          status: status_target || existingTender.status,
        },
      });

      // Update catatan_kualifikasi secara langsung via raw SQL
      if (catatan_kualifikasi !== undefined) {
        await tx.$executeRaw`
          UPDATE "dc_tender" 
          SET "catatan_kualifikasi" = ${catatan_kualifikasi} 
          WHERE "id" = ${tenderId}
        `;
        (tender as any).catatan_kualifikasi = catatan_kualifikasi;
      }

      // 2. Update peserta jika dikirimkan
      if (Array.isArray(peserta)) {
        await tx.dc_tender_peserta.deleteMany({
          where: { tender_id: tenderId },
        });

        for (const p of peserta) {
          await tx.dc_tender_peserta.create({
            data: {
              tender_id: tenderId,
              vendor_id: Number(p.vendor_id),
              peran: p.peran === "KONTRAKTOR" ? "MAIN_KONTRAKTOR" : p.peran,
              status_tahap: p.status_tahap || "PRAKUALIFIKASI",
              alasan_tidak_lolos: p.alasan_tidak_lolos || null,
              score: p.score ? Number(p.score) : null,
              is_pemenang: Boolean(p.is_pemenang),
            },
          });
        }
      }

      // 3. Update jadwal jika dikirimkan
      if (Array.isArray(schedule)) {
        await tx.dc_tender_schedule.deleteMany({
          where: { tender_id: tenderId },
        });

        for (let i = 0; i < schedule.length; i++) {
          const s = schedule[i];
          if (s.nama_kegiatan && s.tanggal_mulai && s.tanggal_selesai) {
            await tx.dc_tender_schedule.create({
              data: {
                tender_id: tenderId,
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

      // 4. Catat Audit Log
      const isRevisiResubmission = existingTender.status === "REVISI" && status_target === "MENUNGGU APPROVAL DC SPECIALIST";
      const logAction = isRevisiResubmission ? "REVISI_SUBMITTED" : "UPDATE";

      await tx.dc_tender_audit_log.create({
        data: {
          tender_id: tenderId,
          user_email: user_email || existingTender.created_by,
          user_name: user_name || (user_email || existingTender.created_by).split("@")[0],
          user_role: user_role || "Pemohon / Maker",
          action: logAction,
          from_status: existingTender.status,
          to_status: status_target || existingTender.status,
          notes: action_note || (isRevisiResubmission ? "Pengajuan ulang perbaikan revisi proposal tender oleh maker." : "Pembaruan berkas Pengajuan Proposal Tender oleh maker."),
        },
      });

      return tender;
    });

    const fullUpdatedTender = await prisma.dc_tender.findUnique({
      where: { id: tenderId },
      include: {
        project: true,
        peserta: {
          include: { vendor: true },
          orderBy: { peran: "asc" },
        },
        schedule: {
          orderBy: { urutan: "asc" },
        },
        audit_logs: {
          orderBy: { created_at: "desc" },
        },
      },
    });

    const vendorUsers = await getVendorUsers();
    const enrichedTender = fullUpdatedTender
      ? {
        ...fullUpdatedTender,
        peserta: enrichPesertaWithPic(fullUpdatedTender.peserta, vendorUsers),
      }
      : updatedTender;

    // Jalankan regenerasi PDF dan upload Google Drive secara background (asinkron)
    // saat tender beralih dari pra-kualifikasi ke kualifikasi / approval / selesai
    if (updatedTender.status !== "PRAKUALIFIKASI" && updatedTender.status !== "DRAFT") {
      syncTenderPdfToDrive(tenderId).catch((err) => {
        console.warn(`[ASYNC-DRIVE-SYNC] Gagal sinkronisasi PDF tender #${tenderId}:`, err);
      });
    }

    return NextResponse.json({
      status: "success",
      message: "Data Pengajuan Proposal Tender berhasil diperbarui.",
      data: enrichedTender,
    });
  } catch (error: any) {
    console.error("Error updating tender:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Gagal memperbarui Pengajuan Proposal Tender." },
      { status: 500 }
    );
  }
}

// DELETE /api/dc-development/tender/[id] - Hapus tender (hanya DRAFT / PRAKUALIFIKASI / REVISI)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenderId = Number(id);

    const existingTender = await prisma.dc_tender.findUnique({
      where: { id: tenderId },
    });

    if (!existingTender) {
      return NextResponse.json(
        { status: "error", message: "Data Pengajuan Proposal Tender tidak ditemukan." },
        { status: 404 }
      );
    }

    // Sesuai aturan GEMINI.md: Dokumen yang sedang aktif di alur approval dilarang dihapus.
    // Hanya boleh dihapus jika masih PRAKUALIFIKASI, DRAFT, atau REVISI.
    const allowedDeleteStatuses = ["PRAKUALIFIKASI", "DRAFT", "REVISI"];
    if (!allowedDeleteStatuses.includes(existingTender.status)) {
      return NextResponse.json(
        {
          status: "error",
          message: `Pengajuan Proposal Tender dengan status "${existingTender.status}" tidak dapat dihapus karena sedang dalam proses evaluasi/approval resmi.`,
        },
        { status: 400 }
      );
    }

    await prisma.dc_tender.delete({
      where: { id: tenderId },
    });

    return NextResponse.json({
      status: "success",
      message: `Pengajuan Proposal Tender ${existingTender.nomor_tender} berhasil dibatalkan dan dihapus.`,
    });
  } catch (error: any) {
    console.error("Error deleting tender:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Gagal menghapus Pengajuan Proposal Tender." },
      { status: 500 }
    );
  }
}
