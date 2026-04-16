'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Plus, Trash2, Clock, GitFork, FolderOpen } from 'lucide-react'

interface Project {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

interface FullProject extends Project {
  htmlCode: string
  cssCode: string
  jsCode: string
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const [error, setError] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      const data = await response.json()

      if (response.ok) {
        setProjects(data.projects)
      }
    } catch (error) {
      console.error('Load projects error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!newProjectTitle.trim()) {
      setError('Voer een titel in')
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newProjectTitle,
          htmlCode: '',
          cssCode: '',
          jsCode: '',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Er ging iets mis')
        setIsCreating(false)
        return
      }

      // Fork the empty project into the editor
      sessionStorage.setItem('vibe_fork', JSON.stringify({
        code: {
          html: data.project.htmlCode,
          css: data.project.cssCode,
          javascript: data.project.jsCode,
        }
      }))
      router.push('/')
    } catch {
      setError('Er ging iets mis. Probeer het opnieuw.')
      setIsCreating(false)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Weet je zeker dat je dit project wilt verwijderen?')) {
      return
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setProjects(projects.filter(p => p.id !== projectId))
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Er ging iets mis bij het verwijderen.')
    }
  }

  const openWithFullContent = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`)
      const data = await response.json()
      if (!response.ok || !data.project) {
        alert('Project kon niet worden geladen.')
        return
      }
      const project = data.project as FullProject
      sessionStorage.setItem('vibe_fork', JSON.stringify({
        code: {
          html: project.htmlCode,
          css: project.cssCode,
          javascript: project.jsCode,
        }
      }))
      router.push('/')
    } catch (error) {
      console.error('Open project error:', error)
      alert('Er ging iets mis bij het openen.')
    }
  }

  const handleForkProject = (project: Project) => {
    openWithFullContent(project.id)
  }

  const handleOpenProject = (project: Project) => {
    openWithFullContent(project.id)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900">
        <div className="flex items-center gap-4">
          <Image src="/h20-logo.png" alt="H20 Logo" width={40} height={40} />
          <h1 className="text-xl font-bold text-white">Alle Projecten</h1>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 bg-[#E1014A] hover:bg-[#c1013d] text-white font-medium rounded px-4 py-2 transition-colors text-sm"
        >
          <Plus size={16} />
          Nieuw project
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-8">
        {/* Create New Project Form */}
        {showCreateForm && (
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              Nieuw Project Maken
            </h2>
            <form onSubmit={handleCreateProject} className="flex gap-3">
              <input
                type="text"
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                placeholder="Project naam..."
                className="flex-1 bg-gray-800 text-white rounded px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#E1014A] border border-gray-700"
                disabled={isCreating}
                autoFocus
              />
              <button
                type="submit"
                disabled={isCreating}
                className="bg-[#E1014A] hover:bg-[#c1013d] disabled:bg-gray-700 text-white font-medium rounded px-6 py-2.5 transition-colors flex items-center gap-2"
              >
                <Plus size={18} />
                {isCreating ? 'Maken...' : 'Aanmaken'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreateForm(false); setError(''); setNewProjectTitle('') }}
                className="bg-gray-800 hover:bg-gray-700 text-white font-medium rounded px-4 py-2.5 transition-colors"
              >
                Annuleren
              </button>
            </form>

            {error && (
              <div className="mt-3 bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-500 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Projects List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white mb-4">
            Projecten ({projects.length})
          </h2>

          {isLoading ? (
            <div className="text-center text-gray-500 py-12">Laden...</div>
          ) : projects.length === 0 ? (
            <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
              <p className="text-gray-400 mb-2">Nog geen projecten</p>
              <p className="text-gray-600 text-sm">Maak het eerste project aan!</p>
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className="bg-gray-900 rounded-lg p-5 border border-gray-800 hover:border-[#E1014A] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-white font-medium text-lg mb-2">
                      {project.title}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        Aangemaakt: {formatDate(project.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        Bijgewerkt: {formatDate(project.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenProject(project)}
                      className="bg-[#60C2D2] hover:bg-[#4ba9b8] text-black font-medium rounded px-4 py-2 transition-colors flex items-center gap-2"
                    >
                      <FolderOpen size={16} />
                      Openen
                    </button>
                    <button
                      onClick={() => handleForkProject(project)}
                      className="bg-[#364B9B] hover:bg-[#2a3a7a] text-white font-medium rounded px-4 py-2 transition-colors flex items-center gap-2"
                      title="Fork: laad dit project in de editor als nieuw project"
                    >
                      <GitFork size={16} />
                      Fork
                    </button>
                    <button
                      onClick={() => handleDeleteProject(project.id)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-500 font-medium rounded px-4 py-2 transition-colors flex items-center gap-2 border border-red-500/50"
                    >
                      <Trash2 size={16} />
                      Verwijderen
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Back to Editor */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            ← Terug naar editor
          </button>
        </div>
      </main>
    </div>
  )
}
