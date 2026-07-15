'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowSquareOut, CheckCircle, Copy, Globe, Plus, SpinnerGap, X } from '@phosphor-icons/react'
import { ProjectRecord } from '@/lib/v2/types'

interface Classroom { id: string; name: string; join_code?: string; joinCode?: string; member_count?: number }
interface ProjectItem extends ProjectRecord { unlistedUrl: string | null; publicUrl: string | null }

export default function TeacherPage() {
  const router = useRouter()
  const [classes, setClasses] = useState<Classroom[]>([])
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [className, setClassName] = useState('')
  const [slugs, setSlugs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [classesResponse, projectsResponse] = await Promise.all([fetch('/api/v2/classes'), fetch('/api/v2/projects')])
      const classData = await classesResponse.json() as { error?: string; classes?: Classroom[] }
      const projectData = await projectsResponse.json() as { error?: string; projects?: ProjectItem[] }
      if (!classesResponse.ok) throw new Error(classData.error || 'Teacher access required.')
      if (!projectsResponse.ok) throw new Error(projectData.error || 'Projects could not be loaded.')
      setClasses(classData.classes || [])
      setProjects(projectData.projects || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Teacher view could not load.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const createClass = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!className.trim()) return
    setBusy('class')
    const response = await fetch('/api/v2/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: className }) })
    const data = await response.json() as { error?: string; classroom: Classroom }
    if (response.ok) { setClasses(current => [data.classroom, ...current]); setClassName('') } else setError(data.error || 'Class could not be created.')
    setBusy('')
  }

  const approve = async (project: ProjectItem) => {
    const slug = (slugs[project.id] || project.approvedSlug || '').trim().toLowerCase()
    if (!slug) return
    setBusy(project.id)
    const response = await fetch(`/api/v2/projects/${project.id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) })
    const data = await response.json() as { error?: string }
    if (response.ok) await load(); else setError(data.error || 'Project could not be approved.')
    setBusy('')
  }

  const unpublish = async (project: ProjectItem) => {
    setBusy(project.id)
    const response = await fetch(`/api/v2/projects/${project.id}/approve`, { method: 'DELETE' })
    const data = await response.json() as { error?: string }
    if (response.ok) await load(); else setError(data.error || 'Project could not be unpublished.')
    setBusy('')
  }

  return (
    <main className="min-h-[100dvh] bg-[#12110f] text-[#fffaf0]">
      <header className="border-b border-white/10 px-5 py-4 lg:px-10"><div className="mx-auto flex max-w-[1400px] items-center justify-between"><button onClick={() => router.push('/')} className="flex items-center gap-2 text-sm font-bold text-white/70"><ArrowLeft size={18} />Workshop</button><span className="font-mono text-[10px] uppercase tracking-[.12em] text-[#edc64e]">Teacher control room</span></div></header>
      <section className="mx-auto max-w-[1400px] px-5 py-10 lg:px-10 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr]">
          <aside>
            <p className="text-xs font-bold uppercase tracking-[.1em] text-[#edc64e]">Classes</p><h1 className="mt-3 text-5xl font-semibold leading-[.95] tracking-[-.065em]">Invite makers.<br />Ship their work.</h1>
            <form onSubmit={createClass} className="mt-8 border-t border-white/10 pt-5"><label className="block text-xs font-bold text-white/60">New class name</label><div className="mt-2 flex gap-2"><input value={className} onChange={event => setClassName(event.target.value)} placeholder="Friday Makers" className="min-w-0 flex-1 rounded-lg border border-white/12 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-white/25 focus:border-[#edc64e]/50" /><button disabled={busy === 'class'} className="grid w-11 place-items-center rounded-lg bg-[#d8ad3b] text-[#171511]"><Plus size={18} /></button></div></form>
            <div className="mt-8 border-t border-white/10">
              {classes.map(classroom => { const code = classroom.join_code || classroom.joinCode || ''; return <article key={classroom.id} className="border-b border-white/10 py-4"><div className="flex items-center justify-between"><div><strong className="text-sm">{classroom.name}</strong><p className="mt-1 text-xs text-white/40">{classroom.member_count || 0} makers</p></div><button onClick={() => navigator.clipboard.writeText(code)} className="flex items-center gap-2 border border-white/10 px-2 py-1.5 font-mono text-xs text-[#edc64e]"><Copy size={13} />{code}</button></div></article> })}
            </div>
          </aside>
          <div>
            <div className="flex items-end justify-between border-b border-white/10 pb-5"><div><p className="text-xs font-bold uppercase tracking-[.1em] text-white/40">Review and publish</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.05em]">Class creations</h2></div><span className="font-mono text-xs text-white/35">{projects.length} total</span></div>
            {error && <p className="mt-4 border-l-2 border-[#ce5c4b] px-3 text-sm text-[#ef9688]">{error}</p>}
            {loading ? <div className="grid min-h-64 place-items-center"><SpinnerGap className="spin" size={24} /></div> : (
              <div>{projects.map(project => (
                <article key={project.id} className="border-b border-white/10 py-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <button onClick={() => router.push(`/?project=${project.id}`)} className="min-w-0 text-left"><div className="flex items-center gap-2"><h3 className="truncate text-lg font-semibold tracking-[-.035em]">{project.title}</h3>{project.approvedSlug && <CheckCircle size={16} weight="fill" className="text-[#83a96b]" />}</div><p className="mt-1 max-w-xl truncate text-xs text-white/40">{project.summary || 'No successful build yet.'}</p></button>
                    <div className="flex flex-wrap items-center gap-2">
                      {project.unlistedUrl && <a href={project.unlistedUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/55 hover:text-white"><ArrowSquareOut size={16} /></a>}
                      {project.approvedSlug ? <><a href={project.publicUrl || '#'} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-2 rounded-md border border-[#83a96b]/30 px-3 text-xs text-[#a8c995]"><Globe size={15} />{project.approvedSlug}</a><button onClick={() => unpublish(project)} disabled={busy === project.id} className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-white/45 hover:text-[#ef9688]"><X size={15} /></button></> : <><input value={slugs[project.id] || ''} onChange={event => setSlugs(current => ({ ...current, [project.id]: event.target.value }))} placeholder="project-name" className="h-9 w-36 rounded-md border border-white/10 bg-white/5 px-3 font-mono text-xs outline-none placeholder:text-white/20 focus:border-[#edc64e]/50" /><button onClick={() => approve(project)} disabled={busy === project.id || !project.latestDeploymentId} className="flex h-9 items-center gap-2 rounded-md bg-[#d8ad3b] px-3 text-xs font-bold text-[#171511] disabled:opacity-35">{busy === project.id ? <SpinnerGap className="spin" size={15} /> : <Globe size={15} />}Approve</button></>}
                    </div>
                  </div>
                </article>
              ))}</div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
