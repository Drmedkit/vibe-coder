import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      username: string
      displayName: string | null
      role: string
      firstLogin: boolean
    }
  }

  interface User {
    id: string
    username: string
    displayName: string | null
    role: string
    firstLogin: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    username: string
    displayName: string | null
    role: string
    firstLogin: boolean
  }
}
