const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();
  console.log("Connected to PostgreSQL DB");

  const columnsToAdd = [
    { name: 'kontraktor_logo_url', type: 'TEXT' },
    { name: 'kontraktor_logo_drive_id', type: 'TEXT' },
    { name: 'analisa_harga_url', type: 'TEXT' },
    { name: 'analisa_harga_drive_id', type: 'TEXT' },
    { name: 'analisa_harga_nama', type: 'TEXT' },
    { name: 'asuransi_no_polis', type: 'TEXT' },
    { name: 'asuransi_masa_berlaku', type: 'TIMESTAMP(3)' },
    { name: 'asuransi_file_url', type: 'TEXT' },
    { name: 'asuransi_file_drive_id', type: 'TEXT' },
    { name: 'asuransi_file_nama', type: 'TEXT' },
  ];

  for (const col of columnsToAdd) {
    const check = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'dc_penawaran_rekanan' AND column_name = $1;
    `, [col.name]);

    if (check.rows.length === 0) {
      console.log(`Adding column ${col.name} (${col.type})...`);
      await client.query(`
        ALTER TABLE "dc_penawaran_rekanan" ADD COLUMN "${col.name}" ${col.type};
      `);
      console.log(`Column ${col.name} added!`);
    } else {
      console.log(`Column ${col.name} already exists.`);
    }
  }

  const result = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'dc_penawaran_rekanan'
    ORDER BY ordinal_position;
  `);

  console.log("Total columns in dc_penawaran_rekanan:", result.rows.length);
  await client.end();
}

main().catch(err => {
  console.error("Migration error:", err);
  process.exit(1);
});
