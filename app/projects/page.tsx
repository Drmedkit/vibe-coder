'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Plus, Trash2, Edit2, Clock } from 'lucide-react'

interface Project {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export default function ProjectsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const [error, setError] = useState('')

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

      // Redirect to editor with new project
      router.push(`/?projectId=${data.project.id}`)
    } catch (error) {
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
          <h1 className="text-xl font-bold text-white">Mijn Projecten</h1>
        </div>
        <div className="flex items-center gap-3 text-gray-300 text-sm">
          <span>👤 {session?.user?.displayName || session?.user?.username}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8">
        {/* Create New Project */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Nieuw Project Maken
          </h2>

          {projects.length >= 3 ? (
            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 text-yellow-500 text-sm">
              ⚠️ Je hebt al 3 projecten. Verwijder er eerst een om een nieuwe te maken.
            </div>
          ) : (
            <form onSubmit={handleCreateProject} className="flex gap-3">
              <input
                type="text"
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                placeholder="Project naam..."
                className="flex-1 bg-gray-800 text-white rounded px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#E1014A] border border-gray-700"
                disabled={isCreating}
              />
              <button
                type="submit"
                disabled={isCreating}
                className="bg-[#E1014A] hover:bg-[#c1013d] disabled:bg-gray-700 text-white font-medium rounded px-6 py-2.5 transition-colors flex items-center gap-2"
              >
                <Plus size={18} />
                {isCreating ? 'Maken...' : 'Aanmaken'}
              </button>
            </form>
          )}

          {error && (
            <div className="mt-3 bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-500 text-sm">
              {error}
            </div>
          )}

          <p className="text-gray-500 text-xs mt-3">
            Je kunt maximaal 3 projecten hebben
          </p>
        </div>

        {/* Projects List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white mb-4">
            Jouw Projecten ({projects.length}/3)
          </h2>

          {isLoading ? (
            <div className="text-center text-gray-500 py-12">Laden...</div>
          ) : projects.length === 0 ? (
            <div className="bg-gray-900 rounded-lg p-12 border border-gray-800 text-center">
              <p className="text-gray-400 mb-2">Je hebt nog geen projecten</p>
              <p className="text-gray-600 text-sm">Maak je eerste project hierboven!</p>
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
                        Laatst gewijzigd: {formatDate(project.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/?projectId=${project.id}`)}
                      className="bg-[#60C2D2] hover:bg-[#4ba9b8] text-black font-medium rounded px-4 py-2 transition-colors flex items-center gap-2"
                    >
                      <Edit2 size={16} />
                      Bewerken
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
