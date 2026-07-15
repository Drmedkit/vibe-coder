'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Globe, LinkSimple, Plus, SpinnerGap, Trash } from '@phosphor-icons/react'
import { ProjectRecord, UserRole } from '@/lib/v2/types'

interface ProjectItem extends ProjectRecord { unlistedUrl: string | null; publicUrl: string | null }

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [user, setUser] = useState<{ username: string; role: UserRole } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    fetch('/api/v2/projects', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json() as { error?: string; projects?: ProjectItem[]; user?: { username: string; role: UserRole } }
        if (!response.ok) throw new Error(data.error || 'Creations could not be loaded.')
        setProjects(data.projects || [])
        setUser(data.user || null)
      })
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : 'Creations could not be loaded.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const remove = async (project: ProjectItem) => {
    if (!window.confirm(`Delete “${project.title}” and all of its checkpoints?`)) return
    const response = await fetch(`/api/v2/projects/${project.id}`, { method: 'DELETE' })
    if (response.ok) setProjects(current => current.filter(item => item.id !== project.id))
  }

  return (
    <main className="min-h-[100dvh] bg-[#f2eee5] text-[#171511]">
      <header className="border-b border-[#171511]/15 px-5 py-4 lg:px-10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
          <button onClick={() => router.push('/')} className="flex items-center gap-2 text-sm font-bold"><ArrowLeft size={18} />Workshop</button>
          <div className="text-right"><p className="text-sm font-bold">{user?.username}</p><p className="text-[10px] uppercase tracking-[.1em] text-[#171511]/45">{user?.role}</p></div>
        </div>
      </header>
      <section className="mx-auto max-w-[1400px] px-5 py-12 lg:px-10 lg:py-20">
        <div className="flex flex-col gap-8 border-b border-[#171511]/15 pb-10 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[.1em] text-[#806821]">Your worlds</p><h1 className="mt-3 text-5xl font-semibold tracking-[-.07em] sm:text-7xl">Keep what matters.<br />Remix the rest.</h1></div>
          <button onClick={() => router.push('/')} className="flex w-max items-center gap-2 rounded-lg bg-[#171511] px-5 py-3 text-sm font-bold text-[#fffaf0]"><Plus size={18} />New creation</button>
        </div>
        {error && <p className="mt-6 border-l-2 border-[#ce5c4b] px-3 text-sm text-[#973e33]">{error}</p>}
        {loading ? (
          <div className="flex min-h-64 items-center justify-center"><SpinnerGap className="spin" size={26} /></div>
        ) : projects.length === 0 ? (
          <button onClick={() => router.push('/')} className="mt-10 flex w-full items-center justify-between border-y border-[#171511]/15 py-8 text-left"><div><strong className="text-2xl tracking-[-.04em]">Make your first thing</strong><p className="mt-2 text-sm text-[#171511]/50">One idea is enough to start.</p></div><ArrowRight size={24} /></button>
        ) : (
          <div className="mt-2">
            {projects.map((project, index) => (
              <article key={project.id} className="grid gap-5 border-b border-[#171511]/15 py-7 transition hover:bg-white/25 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center sm:px-3">
                <span className="font-mono text-xs text-[#171511]/30">{String(index + 1).padStart(2, '0')}</span>
                <button onClick={() => router.push(`/?project=${project.id}`)} className="min-w-0 text-left"><h2 className="truncate text-2xl font-semibold tracking-[-.045em]">{project.title}</h2><p className="mt-1 max-w-2xl truncate text-sm text-[#171511]/50">{project.summary || 'A blank project waiting for its first build.'}</p><div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[.08em]"><span className="border border-[#171511]/15 px-2 py-1">{project.status}</span>{project.publicUrl ? <span className="flex items-center gap-1 border border-[#806821]/30 px-2 py-1 text-[#806821]"><Globe size={12} />public</span> : project.unlistedUrl ? <span className="flex items-center gap-1 border border-[#171511]/15 px-2 py-1"><LinkSimple size={12} />unlisted</span> : null}</div></button>
                <div className="flex items-center gap-2"><button onClick={() => router.push(`/?project=${project.id}`)} className="flex items-center gap-2 rounded-lg bg-[#171511] px-4 py-2.5 text-xs font-bold text-[#fffaf0]">Open <ArrowRight size={15} /></button><button onClick={() => remove(project)} className="grid h-9 w-9 place-items-center rounded-lg border border-[#171511]/15 text-[#171511]/45 transition hover:border-[#ce5c4b]/40 hover:text-[#973e33]" title="Delete"><Trash size={16} /></button></div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
