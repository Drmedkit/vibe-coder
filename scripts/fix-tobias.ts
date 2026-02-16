import 'dotenv/config'
import { prisma } from '../lib/prisma'

async function fixTobias() {
  try {
    const tobias = await prisma.user.update({
      where: { username: 'Tobias' },
      data: {
        firstLogin: false,
        displayName: 'Tobias',
      },
    })

    console.log('✅ Tobias account updated:')
    console.log('   - firstLogin: false')
    console.log('   - displayName: Tobias')
    console.log('   - Can now login directly without setup!')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixTobias()
