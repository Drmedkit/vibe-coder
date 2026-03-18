'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function EnterPage() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!code.trim()) return

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Verkeerde code. Probeer het opnieuw.')
        setIsLoading(false)
        return
      }

      router.push('/')
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
          <h1 className="text-xl font-bold text-white mb-1 text-center">
            Vibe Coder
          </h1>
          <p className="text-gray-400 text-sm text-center mb-6">
            Voer de klascode in om verder te gaan.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-300 mb-2">
                Klascode
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Voer de klascode in"
                className="w-full bg-gray-800 text-white rounded px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#E1014A] border border-gray-700"
                autoComplete="off"
                autoFocus
                disabled={isLoading}
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading || !code.trim()}
              className="w-full bg-[#E1014A] hover:bg-[#c1013d] disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded px-4 py-2.5 transition-colors"
            >
              {isLoading ? 'Controleren...' : 'Verder'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center text-xs text-gray-700">
          <p>Powered by H20 | Vibe Coder</p>
        </div>
      </div>
    </div>
  )
}
