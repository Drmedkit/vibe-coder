'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Step = 'username' | 'password'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('username')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim()) return

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      })

      const data = await res.json()

      if (!data.exists) {
        setError('Onbekende code. Vraag je docent om hulp.')
        setIsLoading(false)
        return
      }

      if (data.firstLogin) {
        // Geen wachtwoord nodig - username is de activatiecode
        const result = await signIn('credentials', {
          username: username.trim(),
          password: '',
          redirect: false,
        })

        if (result?.ok) {
          router.push('/first-time-setup')
          router.refresh()
        } else {
          setError('Er ging iets mis. Probeer het opnieuw.')
          setIsLoading(false)
        }
      } else {
        // Bestaand account: vraag wachtwoord
        setStep('password')
        setIsLoading(false)
      }
    } catch {
      setError('Er ging iets mis. Probeer het opnieuw.')
      setIsLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password) return

    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        username: username.trim(),
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Verkeerd wachtwoord. Probeer het opnieuw.')
        setIsLoading(false)
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('Er ging iets mis. Probeer het opnieuw.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image src="/h20-logo.png" alt="H20 Logo" width={80} height={80} />
        </div>

        <div className="bg-gray-900 rounded-lg p-8 border border-gray-800">
          {step === 'username' ? (
            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                  Code
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-gray-800 text-white rounded px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#E1014A] border border-gray-700"
                  autoComplete="username"
                  autoFocus
                  disabled={isLoading}
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading || !username.trim()}
                className="w-full bg-[#E1014A] hover:bg-[#c1013d] disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded px-4 py-2.5 transition-colors"
              >
                {isLoading ? 'Controleren...' : 'Verder'}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Gebruikersnaam
                </label>
                <div className="w-full bg-gray-800/50 text-gray-400 rounded px-4 py-2.5 border border-gray-700 text-sm">
                  {username}
                </div>
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
                  autoComplete="current-password"
                  autoFocus
                  disabled={isLoading}
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={isLoading || !password}
                className="w-full bg-[#E1014A] hover:bg-[#c1013d] disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded px-4 py-2.5 transition-colors"
              >
                {isLoading ? 'Inloggen...' : 'Inloggen'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('username'); setPassword(''); setError('') }}
                className="w-full text-gray-500 hover:text-gray-300 text-sm transition-colors"
              >
                ← Andere code gebruiken
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-gray-700">
          <p>Powered by H20 | Vibe Coder</p>
        </div>
      </div>
    </div>
  )
}
