import 'dotenv/config'
import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcrypt'
import { prisma } from '../lib/prisma'

async function seedUsers() {
  console.log('🌱 Starting user seed...\n')

  const SALT_ROUNDS = 10

  try {
    // 1. Create Tobias (teacher account)
    const tobiasPassword = await bcrypt.hash('fornite', SALT_ROUNDS)
    const tobias = await prisma.user.upsert({
      where: { username: 'Tobias' },
      update: {},
      create: {
        username: 'Tobias',
        passwordHash: tobiasPassword,
        role: UserRole.TEACHER,
        firstLogin: true,
      },
    })
    console.log('✅ Created teacher: Tobias (password: fornite)')

    // 2. Create 30 student accounts (leerling1-30)
    const studentPassword = await bcrypt.hash('h20', SALT_ROUNDS)

    for (let i = 1; i <= 30; i++) {
      const username = `leerling${i}`
      await prisma.user.upsert({
        where: { username },
        update: {},
        create: {
          username,
          passwordHash: studentPassword,
          role: UserRole.STUDENT,
          firstLogin: true,
        },
      })
      console.log(`✅ Created student: ${username} (password: h20)`)
    }

    console.log('\n🎉 Successfully seeded 31 users:')
    console.log('   - 1 teacher (Tobias)')
    console.log('   - 30 students (leerling1-30)')
    console.log('\nAll users have firstLogin=true and must change password on first login.')

  } catch (error) {
    console.error('❌ Error seeding users:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedUsers()
