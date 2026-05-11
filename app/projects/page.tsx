'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Clock, Copy, FolderOpen, Plus, Trash2 } from 'lucide-react'
import { ProjectBrief, ProjectPhase } from '@/lib/types'

interface Project {
  id: string
  title: string
  htmlCode: string
  cssCode: string
  jsCode: string
  messages?: unknown[]
  phase?: ProjectPhase
  brief?: ProjectBrief
  majorBuildCount?: number
  firstBuildAcceptedAt?: string | null
  createdAt: string
  updatedAt: string
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)

  const loadProjects = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/projects')
      if (response.status === 401) {
        router.push('/enter')
        return
      }

      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Projecten laden is mislukt.')
        return
      }

      setProjects(data.projects)
    } catch {
      setError('Projecten laden is mislukt.')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const openInEditor = (project: Project, fork = false) => {
    sessionStorage.setItem('vibe_open_project', JSON.stringify({
      projectId: fork ? null : project.id,
      title: fork ? `${project.title} kopie` : project.title,
      code: {
        html: project.htmlCode,
        css: project.cssCode,
        javascript: project.jsCode,
      },
      messages: fork ? [] : project.messages ?? [],
      phase: project.phase,
      brief: project.brief,
      majorBuildCount: project.majorBuildCount ?? 0,
      firstBuildAcceptedAt: project.firstBuildAcceptedAt,
    }))
    router.push('/')
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!newProjectTitle.trim()) {
      setError('Voer een titel in.')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newProjectTitle.trim(),
          htmlCode: '',
          cssCode: '',
          jsCode: '',
          messages: [],
          phase: 'empty',
          brief: {
            rawIdea: '',
            mustHaves: [],
            styleNotes: [],
            constraints: [],
            confirmedChoices: [],
            unresolvedQuestions: [],
          },
          majorBuildCount: 0,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Project maken is mislukt.')
        return
      }

      openInEditor(data.project)
    } catch {
      setError('Project maken is mislukt.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!deleteTarget) return

    try {
      const response = await fetch(`/api/projects/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error || 'Project verwijderen is mislukt.')
        return
      }

      setProjects(prev => prev.filter(project => project.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      setError('Project verwijderen is mislukt.')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <main className="min-h-[100dvh] bg-[#0d0d0d] h20-square-texture">
      <header className="border-b border-white/10 bg-[#111111]/95 px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <button onClick={() => router.push('/')} className="focus-ring flex items-center gap-3 rounded-md">
            <Image src="/h20-logo.png" alt="H20" width={38} height={54} className="h-10 w-auto" />
            <div className="text-left">
              <p className="font-display text-2xl font-black leading-none text-white">PROJECTEN</p>
              <p className="text-xs text-white/45">Jouw opgeslagen werk</p>
            </div>
          </button>

          <button
            onClick={() => setShowCreateForm(value => !value)}
            className="focus-ring flex items-center gap-2 rounded-md bg-[#F9CD00] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e8bd00] active:translate-y-px"
          >
            <Plus size={16} />
            Nieuw project
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6">
        {showCreateForm && (
          <form onSubmit={handleCreateProject} className="mb-6 rounded-lg border border-white/10 bg-[#161616] p-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-white/70">Projectnaam</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="Bijvoorbeeld: Space runner"
                  className="focus-ring min-w-0 flex-1 rounded-md border border-white/10 bg-black/35 px-4 py-2 text-white placeholder:text-white/25"
                  disabled={isCreating}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isCreating}
                  className="focus-ring rounded-md bg-[#DD084B] px-5 py-2 font-semibold text-white transition hover:bg-[#B8063F] active:translate-y-px disabled:opacity-45"
                >
                  {isCreating ? 'Maken...' : 'Aanmaken'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateForm(false); setError(''); setNewProjectTitle('') }}
                  className="focus-ring rounded-md border border-white/10 px-4 py-2 font-semibold text-white/70 transition hover:bg-white/8 hover:text-white"
                >
                  Annuleren
                </button>
              </div>
            </label>
          </form>
        )}

        {error && (
          <div className="mb-4 rounded-md border border-[#DD084B]/45 bg-[#DD084B]/10 px-4 py-3 text-sm text-white">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map(item => (
              <div key={item} className="h-24 animate-pulse rounded-lg border border-white/10 bg-[#161616]" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/12 bg-[#161616] p-12 text-center">
            <p className="font-display text-3xl font-black leading-none text-white">NOG GEEN PROJECTEN</p>
            <p className="mt-3 text-white/45">Maak je eerste project of ga terug naar de editor en sla je draft op.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map(project => (
              <article key={project.id} className="rounded-lg border border-white/10 bg-[#161616] p-4 transition hover:border-[#F9CD00]/45">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-white">{project.title}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40">
                      <span>{project.phase === 'built' || project.phase === 'polishing' ? 'Gebouwd' : 'Idee vormen'}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={13} />
                        Aangemaakt: {formatDate(project.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={13} />
                        Bijgewerkt: {formatDate(project.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => openInEditor(project)}
                      className="focus-ring flex items-center gap-2 rounded-md bg-[#F9CD00] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e8bd00] active:translate-y-px"
                    >
                      <FolderOpen size={16} />
                      Openen
                    </button>
                    <button
                      onClick={() => openInEditor(project, true)}
                      className="focus-ring flex items-center gap-2 rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/8 hover:text-white active:translate-y-px"
                    >
                      <Copy size={16} />
                      Kopie
                    </button>
                    <button
                      onClick={() => setDeleteTarget(project)}
                      className="focus-ring flex items-center gap-2 rounded-md border border-[#DD084B]/35 bg-[#DD084B]/10 px-4 py-2 text-sm font-semibold text-[#ff8db2] transition hover:bg-[#DD084B]/16 active:translate-y-px"
                    >
                      <Trash2 size={16} />
                      Verwijderen
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#161616] p-5">
            <h2 className="text-lg font-semibold text-white">Project verwijderen?</h2>
            <p className="mt-2 text-sm text-white/55">
              Je verwijdert <span className="text-white">{deleteTarget.title}</span>. Dit kan niet worden teruggedraaid.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="focus-ring flex-1 rounded-md border border-white/10 px-4 py-2 font-semibold text-white/70 transition hover:bg-white/8 hover:text-white"
              >
                Annuleren
              </button>
              <button
                onClick={handleDeleteProject}
                className="focus-ring flex-1 rounded-md bg-[#DD084B] px-4 py-2 font-semibold text-white transition hover:bg-[#B8063F] active:translate-y-px"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
