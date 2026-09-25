import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.dc_users.upsert({
    where: { email: 'admin@dc.com' },
    update: {},
    create: {
      email: 'admin@dc.com',
      nama: 'Admin DC',
      cabang: 'HO',
      role: 'ADMIN_DC',
      nama_pt: 'PT Sumber Alfaria Trijaya Tbk'
    },
  })
  console.log('Seeding done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
