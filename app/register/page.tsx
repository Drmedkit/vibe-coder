'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { signIn } from 'next-auth/react'

export default function RegisterPage() {
  const router = useRouter()
  const [inviteCode, setInviteCode] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (!inviteCode.trim()) {
      setError('Voer een invite code in')
      return
    }

    if (!username.trim() || username.length < 3) {
      setError('Gebruikersnaam moet minimaal 3 tekens zijn')
      return
    }

    if (!displayName.trim()) {
      setError('Voer een naam in')
      return
    }

    if (password.length < 4) {
      setError('Wachtwoord moet minimaal 4 tekens zijn')
      return
    }

    if (password !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteCode,
          username,
          displayName,
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Er ging iets mis')
        setIsLoading(false)
        return
      }

      // Auto-login after registration
      const loginResult = await signIn('credentials', {
        username,
        password,
        redirect: false,
      })

      if (loginResult?.ok) {
        router.push('/')
      } else {
        setError('Account aangemaakt! Je kunt nu inloggen.')
        setTimeout(() => router.push('/login'), 2000)
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

        {/* Register Card */}
        <div className="bg-gray-900 rounded-lg p-8 border border-gray-800">
          <h1 className="text-2xl font-bold text-white mb-2 text-center">
            Nieuw Account Aanmaken
          </h1>
          <p className="text-gray-400 text-sm text-center mb-6">
            Je hebt een invite code nodig om een account aan te maken
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className={`${error.includes('aangemaakt') ? 'bg-green-500/10 border-green-500/50 text-green-500' : 'bg-red-500/10 border-red-500/50 text-red-500'} border rounded-lg p-3 text-sm`}>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-300 mb-2">
                Invite Code
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full bg-gray-800 text-white rounded px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#E1014A] border border-gray-700"
                placeholder="Vraag aan je docent"
                required
                disabled={isLoading}
              />
            </div>

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
                placeholder="Kies een username"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-2">
                Jouw Naam
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-gray-800 text-white rounded px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#E1014A] border border-gray-700"
                placeholder="Bijv. Jan de Vries"
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
                placeholder="Minimaal 4 tekens"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Bevestig Wachtwoord
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-gray-800 text-white rounded px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#E1014A] border border-gray-700"
                placeholder="Herhaal je wachtwoord"
                required
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#E1014A] hover:bg-[#c1013d] disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded px-4 py-2.5 transition-colors mt-6"
            >
              {isLoading ? 'Account aanmaken...' : 'Account Aanmaken'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>
              Heb je al een account?{' '}
              <button
                onClick={() => router.push('/login')}
                className="text-[#E1014A] hover:underline"
              >
                Inloggen
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-600">
          <p>Powered by H20 | Vibe Coder</p>
        </div>
      </div>
    </div>
  )
}
