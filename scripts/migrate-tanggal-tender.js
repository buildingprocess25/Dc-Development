const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();
  console.log("Connected to PostgreSQL DB");

  // Check column exists
  const checkCol = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'dc_aanwijzing_klarifikasi' AND column_name = 'tanggal_tender';
  `);
  console.log("Column check:", checkCol.rows);

  if (checkCol.rows.length === 0) {
    console.log("Adding column tanggal_tender...");
    await client.query(`
      ALTER TABLE "dc_aanwijzing_klarifikasi" ADD COLUMN "tanggal_tender" TIMESTAMP(3);
    `);
    console.log("Column added!");
  }

  // Update existing data to 03 November 2026
  const updateRes = await client.query(`
    UPDATE "dc_aanwijzing_klarifikasi"
    SET "tanggal_tender" = '2026-11-03 00:00:00'
    WHERE "tanggal_tender" IS NULL OR "tanggal_tender" != '2026-11-03 00:00:00';
  `);
  console.log(`Updated ${updateRes.rowCount} records with tanggal_tender = 2026-11-03 00:00:00`);

  const rows = await client.query(`
    SELECT id, nomor_klarifikasi, status, tanggal_tender
    FROM "dc_aanwijzing_klarifikasi";
  `);
  console.log("Current klarifikasi records:", rows.rows);

  await client.end();
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
