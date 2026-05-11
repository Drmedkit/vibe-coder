'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowRight, KeyRound, UserPlus } from 'lucide-react'

type AuthMode = 'login' | 'register'

export default function EnterPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [classCode, setClassCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          classCode: classCode.trim(),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Inloggen is mislukt.')
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('We konden geen verbinding maken. Probeer het opnieuw.')
    } finally {
      setIsLoading(false)
    }
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError('')
  }

  return (
    <main className="min-h-[100dvh] bg-[#0d0d0d] h20-pattern flex items-center justify-center p-4">
      <section className="relative w-full max-w-5xl grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-stretch">
        <div className="hidden lg:flex flex-col justify-between rounded-lg border border-white/10 bg-[#161616]/80 p-8 overflow-hidden">
          <div>
            <Image src="/h20-logo-gitw.png" alt="H20 Gaming Impacting The World" width={260} height={46} priority />
            <p className="mt-10 max-w-[52ch] text-white/65 leading-relaxed">
              Vibe Coder is de bouwplaats voor webgames en webpagina&apos;s in het leerlab. Maak een account zonder e-mail, bouw in de browser en bewaar je werk wanneer jij klaar bent.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
              <p className="font-display text-3xl font-black leading-none text-[#F9CD00]">PLAN</p>
              <p className="mt-2 text-sm text-white/55">Denk eerst na over wat je gaat maken.</p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
              <p className="font-display text-3xl font-black leading-none text-white">BUILD</p>
              <p className="mt-2 text-sm text-white/55">Laat AI code voorstellen en keur wijzigingen zelf goed.</p>
            </div>
          </div>
        </div>

        <div className="relative rounded-lg border border-white/10 bg-[#161616] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="mb-8 flex items-center justify-between gap-4">
            <Image src="/h20-logo.png" alt="H20" width={58} height={82} className="h-14 w-auto" priority />
            <div className="flex rounded-md border border-white/10 bg-black/35 p-1">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`focus-ring rounded px-3 py-1.5 text-sm font-medium transition ${mode === 'login' ? 'bg-[#DD084B] text-white' : 'text-white/55 hover:text-white'}`}
              >
                Inloggen
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`focus-ring rounded px-3 py-1.5 text-sm font-medium transition ${mode === 'register' ? 'bg-[#F9CD00] text-black' : 'text-white/55 hover:text-white'}`}
              >
                Registreren
              </button>
            </div>
          </div>

          <div className="mb-6">
            <p className="font-display text-4xl font-black leading-none text-white">
              {mode === 'login' ? 'TERUG NAAR JE PROJECT' : 'MAAK JE WERKPLEK'}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              {mode === 'login'
                ? 'Gebruik je gebruikersnaam en wachtwoord. Er is geen herstel via e-mail.'
                : 'De klascode is h20. Kies daarna zelf een gebruikersnaam en wachtwoord.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-white/75">Klascode</span>
                <input
                  type="text"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                  placeholder="h20"
                  className="focus-ring w-full rounded-md border border-white/10 bg-black/35 px-4 py-3 text-white placeholder:text-white/25"
                  autoComplete="off"
                  disabled={isLoading}
                />
              </label>
            )}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-white/75">Gebruikersnaam</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="bijvoorbeeld: max_gamebouw"
                className="focus-ring w-full rounded-md border border-white/10 bg-black/35 px-4 py-3 text-white placeholder:text-white/25"
                autoComplete="username"
                autoFocus
                disabled={isLoading}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-white/75">Wachtwoord</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="minimaal 6 tekens"
                className="focus-ring w-full rounded-md border border-white/10 bg-black/35 px-4 py-3 text-white placeholder:text-white/25"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                disabled={isLoading}
              />
            </label>

            {error && (
              <div className="rounded-md border border-[#DD084B]/45 bg-[#DD084B]/10 px-4 py-3 text-sm text-white">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !username.trim() || !password || (mode === 'register' && !classCode.trim())}
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-md bg-[#DD084B] px-4 py-3 font-semibold text-white transition hover:bg-[#B8063F] active:translate-y-px disabled:opacity-45"
            >
              {mode === 'login' ? <KeyRound size={18} /> : <UserPlus size={18} />}
              {isLoading ? 'Bezig...' : mode === 'login' ? 'Inloggen' : 'Account maken'}
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
