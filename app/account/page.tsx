'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Key, SignOut, SpinnerGap } from '@phosphor-icons/react'

export default function AccountPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const response = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await response.json() as { error?: string }
    if (response.ok) {
      setCurrentPassword('')
      setNewPassword('')
      setMessage('Password changed. You are all set.')
    } else {
      setError(data.error || 'The password could not be changed.')
    }
    setBusy(false)
  }

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/enter')
    router.refresh()
  }

  return (
    <main className="min-h-[100dvh] bg-[#f2eee5] text-[#171511]">
      <header className="border-b border-[#171511]/15 px-5 py-4 lg:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button onClick={() => router.push('/')} className="flex items-center gap-2 text-sm font-bold"><ArrowLeft size={18} />Workshop</button>
          <span className="font-mono text-[10px] uppercase tracking-[.12em] text-[#806821]">Account controls</span>
        </div>
      </header>
      <section className="mx-auto grid max-w-5xl gap-12 px-5 py-14 lg:grid-cols-[1fr_.9fr] lg:px-10 lg:py-24">
        <div><p className="text-xs font-bold uppercase tracking-[.1em] text-[#806821]">Your keys</p><h1 className="mt-3 text-5xl font-semibold leading-[.94] tracking-[-.065em] sm:text-7xl">Keep your worlds yours.</h1><p className="mt-6 max-w-lg text-base leading-7 text-[#171511]/55">Change your password here whenever a teacher gives you a temporary one. No email address or personal profile is needed.</p></div>
        <div className="border-t border-[#171511]/15 pt-6">
          <form onSubmit={changePassword}>
            <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-lg bg-[#171511] text-[#edc64e]"><Key size={21} /></div>
            <label className="block text-xs font-bold">Current password<input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" className="mt-2 block w-full rounded-lg border border-[#171511]/15 bg-white/35 px-3 py-3 text-sm outline-none focus:border-[#806821]" /></label>
            <label className="mt-5 block text-xs font-bold">New password<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={8} autoComplete="new-password" className="mt-2 block w-full rounded-lg border border-[#171511]/15 bg-white/35 px-3 py-3 text-sm outline-none focus:border-[#806821]" /></label>
            {error && <p className="mt-4 border-l-2 border-[#ce5c4b] pl-3 text-sm text-[#973e33]">{error}</p>}
            {message && <p className="mt-4 flex items-center gap-2 text-sm text-[#4f6f3e]"><CheckCircle weight="fill" />{message}</p>}
            <button disabled={busy || !currentPassword || newPassword.length < 8} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#171511] px-4 py-3 text-sm font-bold text-[#fffaf0] disabled:opacity-35">{busy ? <SpinnerGap className="spin" /> : <Key size={17} />}Change password</button>
          </form>
          <button onClick={signOut} className="mt-10 flex items-center gap-2 text-sm font-bold text-[#973e33]"><SignOut size={18} />Sign out of Vibe</button>
        </div>
      </section>
    </main>
  )
}
