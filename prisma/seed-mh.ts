import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Master Harga Dummy Data...')

  // Kita buat untuk dua cabang: JAKARTA (HO/Pusat) dan BALI
  const cabangs = ["JAKARTA", "BALI"]

  const komponenList = [
    // UPAH
    { kategori: "UPAH", nama_komponen: "Mandor", satuan: "OH", hargaBase: 245000 },
    { kategori: "UPAH", nama_komponen: "Tukang", satuan: "OH", hargaBase: 175000 },
    { kategori: "UPAH", nama_komponen: "Pekerja", satuan: "OH", hargaBase: 140000 },
    // MATERIAL
    { kategori: "MATERIAL", nama_komponen: "Keramik 60x60 Sandimas", satuan: "M2", hargaBase: 55000 },
    { kategori: "MATERIAL", nama_komponen: "Semen PC", satuan: "KG", hargaBase: 1750 },
    { kategori: "MATERIAL", nama_komponen: "Semen Portland", satuan: "ZAK", hargaBase: 66800 },
    { kategori: "MATERIAL", nama_komponen: "Pasir Pasang", satuan: "M3", hargaBase: 362000 },
    { kategori: "MATERIAL", nama_komponen: "Semen Nat", satuan: "KG", hargaBase: 15000 }
  ];

  // Bersihkan data lama jika script dijalankan ulang (opsional)
  await prisma.mh_harga_material_item_cabang.deleteMany();
  await prisma.mh_komponen_dasar.deleteMany();

  for (const comp of komponenList) {
    // 1. Insert Komponen Dasar
    const createdComp = await prisma.mh_komponen_dasar.create({
      data: {
        kategori: comp.kategori,
        nama_komponen: comp.nama_komponen,
        satuan: comp.satuan,
      }
    });

    // 2. Insert Harga Komponen per Cabang
    for (const cabang of cabangs) {
      // Simulasi perbedaan harga: Cabang Bali sedikit lebih mahal (10%)
      const multiplier = cabang === "BALI" ? 1.1 : 1.0;
      await prisma.mh_harga_material_item_cabang.create({
        data: {
          komponen_id: createdComp.id,
          cabang: cabang,
          coverage_cabang: cabang,
          harga_satuan: Math.round(comp.hargaBase * multiplier)
        }
      });
    }
  }

  console.log('✅ Seeding berhasil! Data dummy Upah dan Material beserta harganya sudah masuk ke database.')
}

main()
  .catch(e => {
    console.error('❌ Gagal melakukan seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
