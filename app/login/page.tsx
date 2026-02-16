'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Verkeerde gebruikersnaam of wachtwoord')
        setIsLoading(false)
        return
      }

      // Successful login - check if first login
      const response = await fetch('/api/auth/session')
      const session = await response.json()

      if (session?.user?.firstLogin) {
        router.push('/first-time-setup')
      } else {
        router.push('/')
      }
    } catch (error) {
      setError('Er ging iets mis. Probeer het opnieuw.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image src="/h20-logo.png" alt="H20 Logo" width={80} height={80} />
        </div>

        {/* Login Card */}
        <div className="bg-gray-900 rounded-lg p-8 border border-gray-800">
          <h1 className="text-2xl font-bold text-white mb-2 text-center">
            Welkom bij Vibe Coder
          </h1>
          <p className="text-gray-400 text-sm text-center mb-6">
            Log in met je gebruikersnaam en wachtwoord
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-500 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Gebruikersnaam
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-800 text-white rounded px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#E1014A] border border-gray-700"
                placeholder="Bijv. leerling1 of Tobias"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Wachtwoord
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800 text-white rounded px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#E1014A] border border-gray-700"
                placeholder="Voer je wachtwoord in"
                required
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#E1014A] hover:bg-[#c1013d] disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded px-4 py-2.5 transition-colors"
            >
              {isLoading ? 'Inloggen...' : 'Inloggen'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Eerste keer inloggen? Je moet je wachtwoord wijzigen.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-600">
          <p>Powered by H20 | Vibe Coder v1.0</p>
        </div>
      </div>
    </div>
  )
}
