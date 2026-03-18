'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChatMode, CodeState, Language, ChatMessage, EditPatch } from '@/lib/types'
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
  Image as ImageIcon,
  MessageSquare,
  FolderOpen,
  LogOut,
  Undo2,
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

function EditorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [code, setCode] = useState<CodeState>(() => {
    if (typeof window === 'undefined') return INITIAL_CODE
    try {
      const saved = localStorage.getItem('vibe-coder-code')
      return saved ? JSON.parse(saved) : INITIAL_CODE
    } catch {
      return INITIAL_CODE
    }
  })
  const [activeTab, setActiveTab] = useState<Language>(Language.CHAT)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(true)
  const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false)
  const [chatPrefill, setChatPrefill] = useState('')
  const [codeHistory, setCodeHistory] = useState<CodeState[]>([])
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Load forked code from sessionStorage or query params on mount
  useEffect(() => {
    // Check sessionStorage for forked project
    const forked = sessionStorage.getItem('vibe_fork')
    if (forked) {
      sessionStorage.removeItem('vibe_fork')
      try {
        const data = JSON.parse(forked)
        if (data.code) {
          setCode(data.code)
          try { localStorage.setItem('vibe-coder-code', JSON.stringify(data.code)) } catch {}
        }
      } catch {
        // ignore
      }
    }
  }, [])

  const handleCodeChange = (lang: Language, value: string) => {
    setCode(prev => {
      const next = { ...prev, [lang]: value }
      try { localStorage.setItem('vibe-coder-code', JSON.stringify(next)) } catch {}
      return next
    })
  }

  // Apply AI-suggested code update — pushes current state to undo stack first
  const handleApplyCodeUpdate = (newCode: Partial<CodeState>) => {
    setCodeHistory(prev => [...prev.slice(-19), code])
    setCode(prev => {
      const next = { ...prev, ...newCode }
      try { localStorage.setItem('vibe-coder-code', JSON.stringify(next)) } catch {}
      return next
    })
  }

  // Apply edit patches from edits mode
  const handleApplyPatches = (patches: EditPatch[]) => {
    const newCode: Partial<CodeState> = {}
    for (const patch of patches) {
      const lang = patch.file === 'js' ? 'javascript' : patch.file as keyof CodeState
      const current = (newCode[lang] ?? code[lang]) as string
      if (current.includes(patch.find)) {
        newCode[lang] = current.replace(patch.find, patch.replace)
      }
    }
    if (Object.keys(newCode).length > 0) handleApplyCodeUpdate(newCode)
  }

  const handleUndo = () => {
    if (codeHistory.length === 0) return
    const previous = codeHistory[codeHistory.length - 1]
    setCodeHistory(prev => prev.slice(0, -1))
    setCode(previous)
    try { localStorage.setItem('vibe-coder-code', JSON.stringify(previous)) } catch {}
  }

  const handleSendMessage = async (rawText: string, mode: ChatMode = 'agent') => {
    // Strip any base64 data URLs — replace with readable placeholder
    const text = rawText.replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]{20,}/g, '[afbeelding]')

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
          mode,
          history: messages.slice(-10).map(m => ({
            role: m.role,
            // Strip base64 image data from history — replace with text reference
            content: m.toolResult?.type === 'image_generated'
              ? `${m.content}\n[Afbeelding gegenereerd: "${m.toolResult.prompt}"]`
              : m.content,
          }))
        })
      })

      const data = await response.json()

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.text || data.response || 'Sorry, er ging iets mis.',
        timestamp: Date.now(),
        toolResult: data.codeUpdate
          ? { type: 'code_update', ...data.codeUpdate }
          : data.editPatches
            ? { type: 'edit_patches', patches: data.editPatches }
            : data.imageGenerated
              ? { type: 'image_generated', url: data.imageGenerated.url, prompt: data.imageGenerated.prompt }
              : undefined,
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
      name: 'vibe-project',
      version: 1,
      timestamp: new Date().toISOString(),
      code
    }
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vibe-project-${Date.now()}.json`
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
            try { localStorage.setItem('vibe-coder-code', JSON.stringify(data.code)) } catch {}
            setMessages([])
          }
        } catch {
          alert('Kon het bestand niet lezen.')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleSaveOpen = () => {
    setSaveTitle('')
    setSaveSuccess(false)
    setIsSaveDialogOpen(true)
  }

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!saveTitle.trim()) return

    setIsSaving(true)

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: saveTitle.trim(),
          htmlCode: code.html,
          cssCode: code.css,
          jsCode: code.javascript,
        }),
      })

      if (response.ok) {
        setSaveSuccess(true)
        setTimeout(() => {
          setIsSaveDialogOpen(false)
          setSaveSuccess(false)
        }, 1500)
      } else {
        const data = await response.json()
        alert(data.error || 'Er ging iets mis bij het opslaan.')
      }
    } catch {
      alert('Er ging iets mis bij het opslaan.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/leave', { method: 'POST' })
    router.push('/enter')
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-gray-100 overflow-hidden">
      {/* Top Bar */}
      <header className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-[#0a0a0a] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Image src="/h20-logo.png" alt="H20 Logo" width={48} height={48} className="h-12 w-auto" />
            <h1 className="font-bold text-base text-white">Vibe Coder</h1>
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
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeTab === Language.HTML ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
          >
            <FileType size={12} /> HTML
          </button>
          <button
            onClick={() => setActiveTab(Language.CSS)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeTab === Language.CSS ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
          >
            <FileType size={12} /> CSS
          </button>
          <button
            onClick={() => setActiveTab(Language.JAVASCRIPT)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${activeTab === Language.JAVASCRIPT ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
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

          <button
            onClick={handleSaveOpen}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#60C2D2] hover:bg-[#4ba9b8] text-black text-xs font-medium transition-colors"
          >
            <Save size={14} />
            <span className="hidden sm:inline">Opslaan</span>
          </button>

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
            onClick={handleUndo}
            disabled={codeHistory.length === 0}
            className="p-1.5 rounded-md transition-colors text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
            title={codeHistory.length > 0 ? `Ongedaan maken (${codeHistory.length})` : 'Niets om ongedaan te maken'}
          >
            <Undo2 size={18} />
          </button>

          <button
            onClick={() => setIsPreviewOpen(!isPreviewOpen)}
            className={`p-1.5 rounded-md transition-colors ${isPreviewOpen ? 'bg-[#FEC603]/30 text-[#FEC603]' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'}`}
          >
            <PanelRight size={18} />
          </button>

          {/* Logout */}
          <div className="ml-2 pl-2 border-l border-gray-800">
            <button
              onClick={handleLogout}
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
              onApplyCode={(lang, codeStr) => handleCodeChange(lang as Language, codeStr)}
              onApplyCodeUpdate={handleApplyCodeUpdate}
              onApplyPatches={handleApplyPatches}
              currentCode={code}
              prefill={chatPrefill}
              onPrefillConsumed={() => setChatPrefill('')}
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
        onUseInChat={(prompt) => {
          setChatPrefill(`Gebruik de afbeelding "${prompt}" en `)
          setActiveTab(Language.CHAT)
        }}
      />

      {/* Save Dialog */}
      {isSaveDialogOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 w-full max-w-sm">
            <h2 className="text-lg font-semibold text-white mb-4">Project opslaan</h2>

            {saveSuccess ? (
              <div className="text-center py-4">
                <div className="text-[#60C2D2] text-4xl mb-2">✓</div>
                <p className="text-white">Project opgeslagen!</p>
              </div>
            ) : (
              <form onSubmit={handleSaveSubmit} className="space-y-4">
                <div>
                  <label htmlFor="saveTitle" className="block text-sm font-medium text-gray-300 mb-2">
                    Projectnaam
                  </label>
                  <input
                    id="saveTitle"
                    type="text"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    placeholder="Bijv. Mijn eerste website"
                    className="w-full bg-gray-800 text-white rounded px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#60C2D2] border border-gray-700"
                    autoFocus
                    disabled={isSaving}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSaveDialogOpen(false)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded px-4 py-2.5 transition-colors"
                    disabled={isSaving}
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !saveTitle.trim()}
                    className="flex-1 bg-[#60C2D2] hover:bg-[#4ba9b8] disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-medium rounded px-4 py-2.5 transition-colors"
                  >
                    {isSaving ? 'Opslaan...' : 'Opslaan'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a] text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E1014A] mx-auto mb-4"></div>
          <p>Laden...</p>
        </div>
      </div>
    }>
      <EditorContent />
    </Suspense>
  )
}
