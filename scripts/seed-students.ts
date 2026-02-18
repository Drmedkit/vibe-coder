/**
 * Maak leerling-accounts aan in de database.
 *
 * Gebruik:
 *   npx tsx scripts/seed-students.ts [aantal]
 *
 * Voorbeeld:
 *   npx tsx scripts/seed-students.ts 30   ← maakt leerling1 t/m leerling30
 *   npx tsx scripts/seed-students.ts      ← maakt leerling1 t/m leerling5 (standaard)
 *
 * Accounts hebben firstLogin=true zodat de leerling bij eerste bezoek
 * alleen de code (gebruikersnaam) nodig heeft om in te loggen.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcrypt'

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL
if (!connectionString) throw new Error('DATABASE_URL is niet ingesteld')

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const count = parseInt(process.argv[2] ?? '5', 10)

  if (isNaN(count) || count < 1) {
    console.error('Geef een geldig aantal op (bijv. 30)')
    process.exit(1)
  }

  console.log(`\nLeerling accounts aanmaken: leerling1 t/m leerling${count}\n`)

  // Placeholder hash - wordt nooit gebruikt (firstLogin bypasses password check)
  const placeholderHash = await bcrypt.hash('placeholder-not-used', 10)

  let created = 0
  let skipped = 0

  for (let i = 1; i <= count; i++) {
    const username = `leerling${i}`

    const existing = await prisma.user.findUnique({ where: { username } })

    if (existing) {
      console.log(`  ⏭  ${username} bestaat al (firstLogin=${existing.firstLogin})`)
      skipped++
      continue
    }

    await prisma.user.create({
      data: {
        username,
        passwordHash: placeholderHash,
        displayName: null,
        role: 'STUDENT',
        firstLogin: true,
      },
    })

    console.log(`  ✅ ${username} aangemaakt`)
    created++
  }

  console.log(`\nKlaar! ${created} aangemaakt, ${skipped} overgeslagen.\n`)
}

main()
  .catch((e) => {
    console.error('Fout:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
