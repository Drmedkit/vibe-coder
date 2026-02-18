'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function FirstTimeSetupPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (session && !session.user.firstLogin) {
      router.push('/')
    }
  }, [session, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!displayName.trim()) {
      setError('Voer je naam in')
      return
    }

    if (newPassword.length < 4) {
      setError('Wachtwoord moet minimaal 4 tekens zijn')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/user/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, newPassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Er ging iets mis')
        setIsLoading(false)
        return
      }

      // Uitloggen en opnieuw inloggen met het nieuwe wachtwoord
      const username = session?.user.username
      await signOut({ redirect: false })

      const loginResult = await signIn('credentials', {
        username,
        password: newPassword,
        redirect: false,
      })

      if (loginResult?.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError('Account ingesteld! Je kunt nu inloggen met je nieuwe wachtwoord.')
        setTimeout(() => router.push('/login'), 2000)
      }
    } catch {
      setError('Er ging iets mis. Probeer het opnieuw.')
      setIsLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-white text-sm">Laden...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image src="/h20-logo.png" alt="H20 Logo" width={80} height={80} />
        </div>

        <div className="bg-gray-900 rounded-lg p-8 border border-gray-800">
          <h1 className="text-xl font-bold text-white mb-1 text-center">
            Stel je account in
          </h1>
          <p className="text-gray-400 text-sm text-center mb-6">
            Kies een naam en wachtwoord om verder te gaan.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-500 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-300 mb-2">
                Jouw naam
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-gray-800 text-white rounded px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#E1014A] border border-gray-700"
                placeholder="Bijv. Jan"
                autoFocus
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Kies een wachtwoord
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-gray-800 text-white rounded px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#E1014A] border border-gray-700"
                placeholder="Minimaal 4 tekens"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Wachtwoord herhalen
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
              className="w-full bg-[#E1014A] hover:bg-[#c1013d] disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded px-4 py-2.5 transition-colors mt-2"
            >
              {isLoading ? 'Opslaan...' : 'Account instellen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
