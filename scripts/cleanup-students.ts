import 'dotenv/config'
import { prisma } from '../lib/prisma'

async function cleanupStudents() {
  try {
    console.log('🧹 Cleaning up example student accounts...\n')

    // Delete all leerling1-30 accounts
    const deleted = await prisma.user.deleteMany({
      where: {
        username: {
          startsWith: 'leerling',
        },
      },
    })

    console.log(`✅ Deleted ${deleted.count} student accounts`)
    console.log('\n✨ Database cleaned up!')
    console.log('   Only Tobias account remains')
    console.log('   New users can register with invite code: h20-vibe-2026')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

cleanupStudents()
