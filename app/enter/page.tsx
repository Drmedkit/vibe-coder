'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle,
  Key,
  Lightning,
  SpinnerGap,
  UserPlus,
} from '@phosphor-icons/react'

type AuthMode = 'login' | 'register'

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
}

export default function EnterPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [classCode, setClassCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const name = process.env.NEXT_PUBLIC_PRODUCT_NAME || 'Vibe'

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const response = await fetch(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, classCode: classCode.trim() }),
      })
      const data = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(data.error || 'We could not open the workshop.')
      router.push('/')
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Connection failed. Try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[#f2eee5] text-[#171511] lg:grid lg:grid-cols-[1.15fr_.85fr]">
      <section className="relative hidden min-h-[100dvh] overflow-hidden border-r border-[#171511]/15 p-10 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute -right-24 top-20 h-96 w-96 rounded-[42%_58%_64%_36%] bg-[#d8ad3b] opacity-85 motion-safe:animate-[spin_26s_linear_infinite]" />
        <div className="absolute bottom-28 right-16 h-52 w-52 rounded-full border border-[#171511]/20" />
        <div className="relative flex items-center gap-3 font-bold tracking-[-.03em]"><BrandMark /><span>{name}</span></div>
        <div className="relative max-w-3xl">
          <p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#806821]"><Lightning size={16} weight="fill" /> Five-minute creation engine</p>
          <h1 className="max-w-[10ch] text-6xl font-semibold leading-[.91] tracking-[-.075em] xl:text-8xl">What will exist before the bell rings?</h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-[#171511]/60">Start with a rough thought. Leave with a working interactive product, its own data, generated artwork, and a link anyone can open.</p>
        </div>
        <div className="relative grid max-w-2xl grid-cols-2 gap-px overflow-hidden border border-[#171511]/15 bg-[#171511]/15">
          {['One prompt starts it', 'Every version is saved', 'AI and images built in', 'A real link at the end'].map(item => (
            <div key={item} className="flex items-center gap-3 bg-[#f2eee5] p-4 text-sm font-semibold"><CheckCircle size={18} weight="fill" className="text-[#806821]" />{item}</div>
          ))}
        </div>
      </section>

      <section className="flex min-h-[100dvh] items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-12 flex items-center justify-between lg:hidden"><div className="flex items-center gap-3 font-bold"><BrandMark />{name}</div></div>
          <div className="mb-9 flex border-b border-[#171511]/15">
            {(['login', 'register'] as const).map(item => (
              <button key={item} onClick={() => { setMode(item); setError('') }} className={`relative flex-1 px-3 py-3 text-sm font-semibold transition ${mode === item ? 'text-[#171511]' : 'text-[#171511]/40'}`}>
                {item === 'login' ? 'Sign in' : 'Join a class'}
                {mode === item && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#171511]" />}
              </button>
            ))}
          </div>
          <p className="text-xs font-bold uppercase tracking-[.11em] text-[#806821]">{mode === 'login' ? 'Welcome back' : 'Start making'}</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-.06em]">{mode === 'login' ? 'Open your workshop.' : 'Claim your workbench.'}</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#171511]/55">{mode === 'login' ? 'Your creations, links, and checkpoints are waiting.' : 'No email or personal profile. Use the class code your teacher gave you.'}</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            {mode === 'register' && (
              <label className="block space-y-2"><span className="text-xs font-bold">Class code</span><input value={classCode} onChange={event => setClassCode(event.target.value)} placeholder="Enter the code" disabled={isLoading} className="w-full rounded-lg border border-[#171511]/18 bg-white/40 px-4 py-3.5 text-sm outline-none transition placeholder:text-[#171511]/25 focus:border-[#171511]/55" /></label>
            )}
            <label className="block space-y-2"><span className="text-xs font-bold">Username</span><input value={username} onChange={event => setUsername(event.target.value)} placeholder="3–24 letters or numbers" autoComplete="username" autoFocus disabled={isLoading} className="w-full rounded-lg border border-[#171511]/18 bg-white/40 px-4 py-3.5 text-sm outline-none transition placeholder:text-[#171511]/25 focus:border-[#171511]/55" /></label>
            <label className="block space-y-2"><span className="text-xs font-bold">Password</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={mode === 'register' ? 8 : undefined} placeholder="At least 8 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} disabled={isLoading} className="w-full rounded-lg border border-[#171511]/18 bg-white/40 px-4 py-3.5 text-sm outline-none transition placeholder:text-[#171511]/25 focus:border-[#171511]/55" /></label>
            {error && <p className="border-l-2 border-[#ce5c4b] bg-[#ce5c4b]/8 px-3 py-2 text-sm text-[#973e33]">{error}</p>}
            <button type="submit" disabled={isLoading || !username.trim() || !password || (mode === 'register' && !classCode.trim())} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#171511] px-4 py-3.5 text-sm font-bold text-[#fffaf0] transition hover:-translate-y-0.5 hover:bg-[#302b22] active:translate-y-px disabled:translate-y-0 disabled:opacity-35">
              {isLoading ? <SpinnerGap className="spin" size={19} /> : mode === 'login' ? <Key size={19} /> : <UserPlus size={19} />}
              {isLoading ? 'Opening workshop' : mode === 'login' ? 'Enter workshop' : 'Create my account'}
              {!isLoading && <ArrowRight size={18} />}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
