'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CodeState, Language, ChatMessage } from '@/lib/types'
import { CodeEditor } from '@/components/CodeEditor'
import { Preview } from '@/components/Preview'
import { ChatPanel } from '@/components/ChatPanel'
import { AssetLibrary } from '@/components/AssetLibrary'
import Image from 'next/image'
import {
  FileType,
  PanelRight,
  Download,
  Upload,
  Save,
  Share2,
  Image as ImageIcon,
  MessageSquare,
  FolderOpen,
  LogOut,
  Check
} from 'lucide-react'

const INITIAL_CODE: CodeState = {
  html: `<h1>Welkom bij Vibe Coder!</h1>
<p>Begin met bouwen!</p>
<button id="myButton">Klik hier!</button>`,
  css: `body {
  font-family: Arial, sans-serif;
  padding: 20px;
  background: linear-gradient(to right, #667eea, #764ba2);
  color: white;
}

button {
  background-color: #ff6b6b;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
}

button:hover {
  background-color: #ff5252;
}`,
  javascript: `// Klik event toevoegen
const button = document.getElementById('myButton');
if (button) {
  button.addEventListener('click', () => {
    alert('Je hebt geklikt!');
  });
}`
}

export default function Home() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [code, setCode] = useState<CodeState>(INITIAL_CODE)
  const [activeTab, setActiveTab] = useState<Language>(Language.CHAT)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(true)
  const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false)
  const [projectTitle, setProjectTitle] = useState('Nieuw Project')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Load project if projectId in URL
  useEffect(() => {
    if (projectId) {
      loadProject(projectId)
    }
  }, [projectId])

  // Auto-save every 10 seconds if there are changes
  useEffect(() => {
    if (!projectId || !hasUnsavedChanges) return

    const interval = setInterval(() => {
      saveProject()
    }, 10000) // 10 seconds

    return () => clearInterval(interval)
  }, [projectId, hasUnsavedChanges, code])

  const loadProject = async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${id}`)
      const data = await response.json()

      if (response.ok && data.project) {
        setCode({
          html: data.project.htmlCode,
          css: data.project.cssCode,
          javascript: data.project.jsCode,
        })
        setProjectTitle(data.project.title)
        setHasUnsavedChanges(false)
      }
    } catch (error) {
      console.error('Load project error:', error)
    }
  }

  const saveProject = async () => {
    if (!projectId) return

    setIsSaving(true)

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlCode: code.html,
          cssCode: code.css,
          jsCode: code.javascript,
          saveVersion: false, // Don't create version on auto-save
        }),
      })

      if (response.ok) {
        setLastSaved(new Date())
        setHasUnsavedChanges(false)
      }
    } catch (error) {
      console.error('Save error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCodeChange = (lang: Language, value: string) => {
    setCode(prev => ({ ...prev, [lang]: value }))
    setHasUnsavedChanges(true)
  }

  const handleSendMessage = async (text: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, newMessage])
    setIsProcessing(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          code,
          history: messages.slice(-10)
        })
      })

      const data = await response.json()

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Sorry, er ging iets mis.',
        timestamp: Date.now()
      }

      setMessages(prev => [...prev, botMessage])
    } catch (error) {
      console.error('Failed to generate response:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, er ging iets mis bij het verbinden met de AI.',
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownload = () => {
    const projectData = {
      name: projectTitle,
      version: 1,
      timestamp: new Date().toISOString(),
      code
    }
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectTitle.replace(/\s+/g, '-')}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          if (data.code) {
            setCode(data.code)
            setMessages([])
            setHasUnsavedChanges(true)
          }
        } catch (error) {
          alert('Kon het bestand niet lezen.')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-gray-100 overflow-hidden">
      {/* Top Bar */}
      <header className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-[#0a0a0a] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Image src="/h20-logo.png" alt="H20 Logo" width={48} height={48} className="h-12 w-auto" />
            <div>
              <h1 className="font-bold text-base text-white">{projectTitle}</h1>
              {lastSaved && (
                <p className="text-xs text-gray-500">
                  {isSaving ? 'Opslaan...' : hasUnsavedChanges ? 'Niet opgeslagen' : `Opgeslagen ${lastSaved.toLocaleTimeString('nl-NL')}`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Center Tabs */}
        <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
          <button
            onClick={() => setActiveTab(Language.CHAT)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeTab === Language.CHAT ? 'bg-[#E1014A] text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
          >
            <MessageSquare size={12} /> AI
          </button>
          <button
            onClick={() => setActiveTab(Language.HTML)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeTab === Language.HTML ? 'bg-[#60C2D2] text-black' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
          >
            <PanelRight size={12} /> HTML
          </button>
          <button
            onClick={() => setActiveTab(Language.CSS)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeTab === Language.CSS ? 'bg-[#60C2D2] text-black' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
          >
            <FileType size={12} /> CSS
          </button>
          <button
            onClick={() => setActiveTab(Language.JAVASCRIPT)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeTab === Language.JAVASCRIPT ? 'bg-[#364B9B] text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
          >
            <FileType size={12} /> JS
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/projects')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium transition-colors"
          >
            <FolderOpen size={14} />
            <span className="hidden sm:inline">Projecten</span>
          </button>

          {projectId && (
            <button
              onClick={saveProject}
              disabled={isSaving || !hasUnsavedChanges}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#60C2D2] hover:bg-[#4ba9b8] disabled:bg-gray-700 disabled:cursor-not-allowed text-black text-xs font-medium transition-colors"
            >
              {isSaving ? (
                <>
                  <Save size={14} className="animate-spin" />
                  <span className="hidden sm:inline">Opslaan...</span>
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <Save size={14} />
                  <span className="hidden sm:inline">Opslaan</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span className="hidden sm:inline">Opgeslagen</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#364B9B] hover:bg-[#2a3a7a] text-white text-xs font-medium transition-colors"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Download</span>
          </button>

          <button
            onClick={handleUpload}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#364B9B] hover:bg-[#2a3a7a] text-white text-xs font-medium transition-colors"
          >
            <Upload size={14} />
            <span className="hidden sm:inline">Upload</span>
          </button>

          <button
            onClick={() => setIsAssetLibraryOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#E1014A] hover:bg-[#c1013d] text-white text-xs font-medium transition-colors"
            title="Maak afbeeldingen met AI"
          >
            <ImageIcon size={14} />
            <span className="hidden sm:inline">Assets</span>
          </button>

          <button
            onClick={() => setIsPreviewOpen(!isPreviewOpen)}
            className={`p-1.5 rounded-md transition-colors ${isPreviewOpen ? 'bg-[#FEC603]/30 text-[#FEC603]' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'}`}
          >
            <PanelRight size={18} />
          </button>

          {/* User Menu */}
          <div className="ml-2 pl-2 border-l border-gray-800 flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {session?.user?.displayName || session?.user?.username}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              title="Uitloggen"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel: Code Editor or AI Chat */}
        <section className="w-[40%] min-w-[320px] max-w-[50%] flex flex-col bg-black">
          {activeTab === Language.CHAT ? (
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              isProcessing={isProcessing}
            />
          ) : (
            <CodeEditor
              code={code[activeTab]}
              onChange={(val) => handleCodeChange(activeTab, val)}
              language={activeTab}
            />
          )}
        </section>

        {/* Right Panel: Preview */}
        {isPreviewOpen && (
          <aside className="flex-1 border-l border-gray-800 bg-gray-950 flex flex-col">
            <Preview code={code} />
          </aside>
        )}
      </main>

      {/* Asset Library Modal */}
      <AssetLibrary
        isOpen={isAssetLibraryOpen}
        onClose={() => setIsAssetLibraryOpen(false)}
      />
    </div>
  )
}
