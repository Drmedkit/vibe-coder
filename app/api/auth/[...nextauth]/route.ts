import NextAuth, { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: "Gebruikersnaam", type: "text" },
        password: { label: "Wachtwoord", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        try {
          // Find user by username
          const user = await prisma.user.findUnique({
            where: { username: credentials.username }
          })

          if (!user) {
            return null
          }

          // Verify password
          const isValidPassword = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          )

          if (!isValidPassword) {
            return null
          }

          // Return user object (will be stored in JWT)
          return {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
            firstLogin: user.firstLogin,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      // Store user info in JWT token
      if (user) {
        token.id = user.id
        token.username = user.username
        token.displayName = user.displayName
        token.role = user.role
        token.firstLogin = user.firstLogin
      }
      return token
    },
    async session({ session, token }) {
      // Add user info to session
      if (token) {
        session.user = {
          id: token.id as string,
          username: token.username as string,
          displayName: token.displayName as string | null,
          role: token.role as string,
          firstLogin: token.firstLogin as boolean,
        }
      }
      return session
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
