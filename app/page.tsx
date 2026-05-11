'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Download,
  FileType,
  FolderOpen,
  Image as ImageIcon,
  LogOut,
  MessageSquare,
  PanelRight,
  Save,
  Undo2,
  Upload,
} from 'lucide-react'
import { AssetLibrary } from '@/components/AssetLibrary'
import { ChatPanel } from '@/components/ChatPanel'
import { CodeEditor } from '@/components/CodeEditor'
import { Preview } from '@/components/Preview'
import { ChatAction, ChatMessage, CodeState, CodeUpdateIntent, EditPatch, Language, ProjectBrief, ProjectPhase } from '@/lib/types'
import {
  createEmptyBrief,
  getBriefReadiness,
  isCodeEmpty,
  mergeBriefPatch,
  normalizeBrief,
  phaseFromBriefAndCode,
} from '@/lib/projectFlow'

const DRAFT_KEY = 'vibe-coder-draft-v2'

const INITIAL_CODE: CodeState = {
  html: '',
  css: '',
  javascript: '',
}

interface WorkspaceState {
  code: CodeState
  messages: ChatMessage[]
  currentProjectId: string | null
  currentProjectTitle: string
  phase: ProjectPhase
  brief: ProjectBrief
  firstBuildAcceptedAt?: number
  majorBuildCount: number
}

interface ChatApiData {
  error?: string
  usingFallback?: boolean
  text?: string
  questions?: unknown
  suggestions?: unknown
  findings?: unknown
  suggestedAdjustments?: unknown
  included?: unknown
  notIncludedYet?: unknown
  nextPolishSuggestions?: unknown
  readiness?: { readyForFirstBuild?: boolean; reason?: string }
  intent?: unknown
  codeUpdate?: Partial<CodeState>
  editPatches?: EditPatch[]
  imageGenerated?: { url: string; prompt: string }
  briefPatch?: unknown
}

function defaultWorkspace(): WorkspaceState {
  return {
    code: INITIAL_CODE,
    messages: [],
    currentProjectId: null,
    currentProjectTitle: 'Naamloos project',
    phase: 'empty',
    brief: createEmptyBrief(),
    majorBuildCount: 0,
  }
}

function normalizeCode(value: unknown): CodeState {
  if (!value || typeof value !== 'object') return INITIAL_CODE
  const input = value as Partial<CodeState>
  return {
    html: typeof input.html === 'string' ? input.html : '',
    css: typeof input.css === 'string' ? input.css : '',
    javascript: typeof input.javascript === 'string' ? input.javascript : '',
  }
}

function normalizeTimestamp(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return undefined
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? undefined : time
}

function normalizePhase(value: unknown, code: CodeState, brief: ProjectBrief): ProjectPhase {
  const phases: ProjectPhase[] = ['empty', 'shaping', 'ready_for_first_build', 'built', 'polishing']
  if (typeof value === 'string' && phases.includes(value as ProjectPhase)) {
    if (!isCodeEmpty(code) && (value === 'empty' || value === 'shaping' || value === 'ready_for_first_build')) {
      return 'built'
    }
    return value as ProjectPhase
  }
  return phaseFromBriefAndCode(brief, code, 'empty')
}

function readInitialWorkspace(): WorkspaceState {
  if (typeof window === 'undefined') return defaultWorkspace()

  const opened = sessionStorage.getItem('vibe_open_project')
  if (opened) {
    sessionStorage.removeItem('vibe_open_project')
    try {
      const data = JSON.parse(opened)
      const code = normalizeCode(data.code)
      const brief = normalizeBrief(data.brief)
      return {
        code,
        messages: Array.isArray(data.messages) ? data.messages : [],
        currentProjectId: data.projectId ?? null,
        currentProjectTitle: data.title || 'Naamloos project',
        phase: normalizePhase(data.phase, code, brief),
        brief,
        firstBuildAcceptedAt: normalizeTimestamp(data.firstBuildAcceptedAt),
        majorBuildCount: typeof data.majorBuildCount === 'number' ? Math.max(0, Math.floor(data.majorBuildCount)) : 0,
      }
    } catch {
      return defaultWorkspace()
    }
  }

  try {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (!saved) return defaultWorkspace()
    const data = JSON.parse(saved)
    const code = normalizeCode(data.code)
    const brief = normalizeBrief(data.brief)
    return {
      code,
      messages: Array.isArray(data.messages) ? data.messages : [],
      currentProjectId: data.currentProjectId ?? null,
      currentProjectTitle: data.currentProjectTitle || 'Naamloos project',
      phase: normalizePhase(data.phase, code, brief),
      brief,
      firstBuildAcceptedAt: normalizeTimestamp(data.firstBuildAcceptedAt),
      majorBuildCount: typeof data.majorBuildCount === 'number' ? Math.max(0, Math.floor(data.majorBuildCount)) : 0,
    }
  } catch {
    return defaultWorkspace()
  }
}

function persistDraft(workspace: WorkspaceState) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(workspace))
  } catch {}
}

async function readJsonResponse(response: Response): Promise<ChatApiData> {
  const raw = await response.text()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as ChatApiData : {}
  } catch {
    return { error: raw.slice(0, 240) }
  }
}

function EditorContent() {
  const router = useRouter()
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => defaultWorkspace())
  const [activeTab, setActiveTab] = useState<Language>(Language.CHAT)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(true)
  const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [codeHistory, setCodeHistory] = useState<CodeState[]>([])
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [usingFallbackModel, setUsingFallbackModel] = useState(false)
  const didLoadWorkspaceRef = useRef(false)

  const { code, messages, currentProjectId, currentProjectTitle, phase, brief, firstBuildAcceptedAt, majorBuildCount } = workspace
  const readiness = getBriefReadiness(brief)
  const hasCode = !isCodeEmpty(code)

  useEffect(() => {
    if (didLoadWorkspaceRef.current) return
    didLoadWorkspaceRef.current = true
    setWorkspace(readInitialWorkspace())
  }, [])

  const updateWorkspace = (updater: (current: WorkspaceState) => WorkspaceState) => {
    setWorkspace(current => {
      const next = updater(current)
      persistDraft(next)
      return next
    })
  }

  const handleCodeChange = (lang: Language, value: string) => {
    updateWorkspace(current => ({
      ...current,
      code: { ...current.code, [lang]: value },
      phase: phaseFromBriefAndCode(current.brief, { ...current.code, [lang]: value }, current.phase),
    }))
  }

  const handleTitleChange = (title: string) => {
    updateWorkspace(current => ({ ...current, currentProjectTitle: title }))
  }

  const handleApplyCodeUpdate = (newCode: Partial<CodeState>, intent?: CodeUpdateIntent) => {
    setCodeHistory(prev => [...prev.slice(-19), code])
    updateWorkspace(current => {
      const nextCode = { ...current.code, ...newCode }
      const isFirstBuild = intent === 'first_build' || (isCodeEmpty(current.code) && current.phase === 'ready_for_first_build')
      const isMajorRebuild = intent === 'major_rebuild'

      return {
        ...current,
        code: nextCode,
        phase: isFirstBuild || isMajorRebuild
          ? 'built'
          : isCodeEmpty(nextCode)
            ? phaseFromBriefAndCode(current.brief, nextCode, current.phase)
            : 'polishing',
        firstBuildAcceptedAt: isFirstBuild ? current.firstBuildAcceptedAt ?? Date.now() : current.firstBuildAcceptedAt,
        majorBuildCount: isFirstBuild || isMajorRebuild
          ? Math.max(1, current.majorBuildCount + 1)
          : current.majorBuildCount,
      }
    })
    setSaveStatus('idle')
  }

  const handleApplyPatches = (patches: EditPatch[]) => {
    const newCode: Partial<CodeState> = {}
    for (const patch of patches) {
      const lang = patch.file === 'js' ? 'javascript' : patch.file
      const currentSource = (newCode[lang] ?? code[lang]) as string
      if (currentSource.includes(patch.find)) {
        newCode[lang] = currentSource.replace(patch.find, patch.replace)
      }
    }
    if (Object.keys(newCode).length > 0) handleApplyCodeUpdate(newCode, 'adjust')
  }

  const handleUndo = () => {
    if (codeHistory.length === 0) return
    const previous = codeHistory[codeHistory.length - 1]
    setCodeHistory(prev => prev.slice(0, -1))
    updateWorkspace(current => ({
      ...current,
      code: previous,
      phase: phaseFromBriefAndCode(current.brief, previous, current.phase),
    }))
  }

  const addMessage = (message: ChatMessage) => {
    updateWorkspace(current => ({
      ...current,
      messages: [...current.messages, message],
    }))
  }

  const formatAIResponse = (data: {
    text?: string
    questions?: unknown
    suggestions?: unknown
    findings?: unknown
    suggestedAdjustments?: unknown
    included?: unknown
    notIncludedYet?: unknown
    nextPolishSuggestions?: unknown
    readiness?: { readyForFirstBuild?: boolean; reason?: string }
  }) => {
    const sections = [
      ['Vragen', data.questions],
      ['Suggesties', data.suggestions],
      ['Observaties', data.findings],
      ['Volgende aanpassingen', data.suggestedAdjustments],
      ['In deze build', data.included],
      ['Nog niet', data.notIncludedYet],
      ['Polish hierna', data.nextPolishSuggestions],
    ]
      .map(([title, value]) => {
        if (!Array.isArray(value) || value.length === 0) return ''
        return `\n\n${title}:\n${value.map(item => `- ${String(item)}`).join('\n')}`
      })
      .join('')

    const readinessLine = data.readiness?.readyForFirstBuild && data.readiness.reason
      ? `\n\n${data.readiness.reason}`
      : ''

    return `${data.text ?? ''}${sections}${readinessLine}`.trim()
  }

  const handleSendMessage = async (rawText: string, action?: ChatAction) => {
    const text = rawText.replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]{20,}/g, '[afbeelding]')
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    updateWorkspace(current => {
      const shouldCaptureRawIdea = isCodeEmpty(current.code) && !current.brief.rawIdea.trim() && text.trim().length > 0
      const nextBrief = shouldCaptureRawIdea ? { ...current.brief, rawIdea: text.trim() } : current.brief
      return {
        ...current,
        messages: [...current.messages, userMessage],
        brief: nextBrief,
        phase: phaseFromBriefAndCode(nextBrief, current.code, current.phase),
      }
    })
    setIsProcessing(true)
    setStatusMessage('')
    const requestBrief = isCodeEmpty(code) && !brief.rawIdea.trim() && text.trim().length > 0
      ? { ...brief, rawIdea: text.trim() }
      : brief
    const requestPhase = phaseFromBriefAndCode(requestBrief, code, phase)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          code,
          history: messages.slice(-10).map(message => ({
            role: message.role,
            content: message.content,
          })),
          workspace: {
            phase: requestPhase,
            brief: requestBrief,
            majorBuildCount,
          },
          action,
        }),
      })

      if (response.status === 401) {
        router.push('/enter')
        return
      }

      const data = await readJsonResponse(response)
      if (response.status === 429) {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: typeof data.error === 'string'
            ? data.error
            : 'Je hebt de AI-limiet bereikt. Wacht even en probeer daarna opnieuw.',
          timestamp: Date.now(),
        })
        return
      }

      if (!response.ok) {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: typeof data.error === 'string'
            ? data.error
            : 'De AI is nu niet bereikbaar. Je idee staat nog in de chat; probeer het zo opnieuw.',
          timestamp: Date.now(),
        })
        return
      }

      if (data.usingFallback) setUsingFallbackModel(true)
      const responseText = formatAIResponse(data)
      const codeIntent: CodeUpdateIntent | undefined =
        data.intent === 'first_build' || data.intent === 'adjust' || data.intent === 'major_rebuild'
          ? data.intent
          : undefined

      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: responseText || 'Ik heb geen antwoord ontvangen.',
        timestamp: Date.now(),
        toolResult: data.codeUpdate
          ? { type: 'code_update', intent: codeIntent, ...data.codeUpdate }
          : data.editPatches
            ? { type: 'edit_patches', patches: data.editPatches }
            : data.imageGenerated
              ? { type: 'image_generated', url: data.imageGenerated.url, prompt: data.imageGenerated.prompt }
              : undefined,
      }

      updateWorkspace(current => {
        const nextBrief = data.briefPatch ? mergeBriefPatch(current.brief, data.briefPatch) : current.brief
        const nextPhase = data.readiness?.readyForFirstBuild && isCodeEmpty(current.code)
          ? 'ready_for_first_build'
          : phaseFromBriefAndCode(nextBrief, current.code, current.phase)

        return {
          ...current,
          messages: [...current.messages, botMessage],
          brief: nextBrief,
          phase: nextPhase,
        }
      })
    } catch (error) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: error instanceof Error && error.message
            ? `De AI kon niet antwoorden: ${error.message}`
            : 'De AI is nu niet bereikbaar. Probeer het zo opnieuw.',
        timestamp: Date.now(),
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSaveOpen = () => {
    if (currentProjectId) {
      handleSaveExisting()
      return
    }
    setSaveTitle(currentProjectTitle === 'Naamloos project' ? '' : currentProjectTitle)
    setIsSaveDialogOpen(true)
  }

  const handleSaveExisting = async () => {
    if (!currentProjectId) return
    setSaveStatus('saving')
    setStatusMessage('')

    try {
      const response = await fetch(`/api/projects/${currentProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentProjectTitle.trim() || 'Naamloos project',
          htmlCode: code.html,
          cssCode: code.css,
          jsCode: code.javascript,
          messages,
          phase,
          brief,
          majorBuildCount,
          firstBuildAcceptedAt,
        }),
      })

      if (response.status === 401) {
        router.push('/enter')
        return
      }

      const data = await response.json()
      if (!response.ok) {
        setSaveStatus('error')
        setStatusMessage(data.error || 'Opslaan is mislukt.')
        return
      }

      updateWorkspace(current => ({
        ...current,
        currentProjectTitle: data.project.title,
      }))
      setSaveStatus('saved')
      setStatusMessage('Project opgeslagen.')
    } catch {
      setSaveStatus('error')
      setStatusMessage('Opslaan is mislukt.')
    }
  }

  const handleSaveNew = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!saveTitle.trim()) return
    setSaveStatus('saving')
    setStatusMessage('')

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: saveTitle.trim(),
          htmlCode: code.html,
          cssCode: code.css,
          jsCode: code.javascript,
          messages,
          phase,
          brief,
          majorBuildCount,
          firstBuildAcceptedAt,
        }),
      })

      if (response.status === 401) {
        router.push('/enter')
        return
      }

      const data = await response.json()
      if (!response.ok) {
        setSaveStatus('error')
        setStatusMessage(data.error || 'Opslaan is mislukt.')
        return
      }

      updateWorkspace(current => ({
        ...current,
        currentProjectId: data.project.id,
        currentProjectTitle: data.project.title,
      }))
      setSaveStatus('saved')
      setStatusMessage('Project opgeslagen.')
      setIsSaveDialogOpen(false)
    } catch {
      setSaveStatus('error')
      setStatusMessage('Opslaan is mislukt.')
    }
  }

  const handleDownload = () => {
    const projectData = {
      name: currentProjectTitle || 'vibe-project',
      version: 2,
      timestamp: new Date().toISOString(),
      code,
      messages,
      phase,
      brief,
      firstBuildAcceptedAt,
      majorBuildCount,
    }
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${(currentProjectTitle || 'vibe-project').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (loadEvent) => {
        try {
          const data = JSON.parse(String(loadEvent.target?.result ?? ''))
          const importedCode = normalizeCode(data.code)
          const importedBrief = normalizeBrief(data.brief)
          if (isCodeEmpty(importedCode) && !importedBrief.rawIdea.trim() && !Array.isArray(data.messages)) {
            setStatusMessage('Dit JSON-bestand bevat geen Vibe Coder project.')
            setSaveStatus('error')
            return
          }

          updateWorkspace(() => ({
            code: importedCode,
            messages: Array.isArray(data.messages) ? data.messages : [],
            currentProjectId: null,
            currentProjectTitle: data.name || 'Geimporteerd project',
            phase: normalizePhase(data.phase, importedCode, importedBrief),
            brief: importedBrief,
            firstBuildAcceptedAt: normalizeTimestamp(data.firstBuildAcceptedAt),
            majorBuildCount: typeof data.majorBuildCount === 'number' ? Math.max(0, Math.floor(data.majorBuildCount)) : 0,
          }))
          setSaveStatus('idle')
          setStatusMessage('Project geimporteerd als nieuw draft.')
        } catch {
          setSaveStatus('error')
          setStatusMessage('We konden dit bestand niet lezen.')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    localStorage.removeItem(DRAFT_KEY)
    router.push('/enter')
    router.refresh()
  }

  const saveLabel = saveStatus === 'saving' ? 'Opslaan...' : currentProjectId ? 'Opslaan' : 'Opslaan als'

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#0d0d0d] text-white">
      <header className="h-14 shrink-0 border-b border-white/10 bg-[#111111] px-3">
        <div className="flex h-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Image src="/h20-logo.png" alt="H20" width={42} height={60} className="h-12 w-auto shrink-0" priority />
            <div className="hidden min-w-0 sm:block">
              <input
                value={currentProjectTitle}
                onChange={(event) => handleTitleChange(event.target.value)}
                className="focus-ring w-full rounded bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/25"
                placeholder="Naamloos project"
              />
              <p className="text-[11px] text-white/35">{currentProjectId ? 'Opgeslagen project' : 'Lokaal draft'}</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 rounded-md border border-white/10 bg-black/25 p-1">
            {[
              { lang: Language.CHAT, label: 'AI', icon: MessageSquare },
              { lang: Language.HTML, label: 'HTML', icon: FileType },
              { lang: Language.CSS, label: 'CSS', icon: FileType },
              { lang: Language.JAVASCRIPT, label: 'JS', icon: FileType },
            ].map(({ lang, label, icon: Icon }) => (
              <button
                key={lang}
                onClick={() => setActiveTab(lang)}
                className={`focus-ring flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold transition active:translate-y-px ${
                  activeTab === lang ? 'bg-[#F9CD00] text-black' : 'text-white/45 hover:bg-white/8 hover:text-white'
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button onClick={() => router.push('/projects')} className="focus-ring rounded-md bg-white/8 p-2 text-white/75 transition hover:bg-white/12 hover:text-white" title="Projecten">
              <FolderOpen size={16} />
            </button>
            <button onClick={handleSaveOpen} disabled={saveStatus === 'saving'} className="focus-ring hidden items-center gap-2 rounded-md bg-[#F9CD00] px-3 py-2 text-xs font-semibold text-black transition hover:bg-[#e8bd00] active:translate-y-px disabled:opacity-55 md:flex" title={saveLabel}>
              <Save size={15} />
              {saveLabel}
            </button>
            <button onClick={handleDownload} className="focus-ring rounded-md bg-white/8 p-2 text-white/75 transition hover:bg-white/12 hover:text-white" title="Download JSON">
              <Download size={16} />
            </button>
            <button onClick={handleUpload} className="focus-ring rounded-md bg-white/8 p-2 text-white/75 transition hover:bg-white/12 hover:text-white" title="Upload JSON">
              <Upload size={16} />
            </button>
            <button onClick={() => setIsAssetLibraryOpen(true)} className="focus-ring rounded-md bg-[#DD084B] p-2 text-white transition hover:bg-[#B8063F]" title="Assets">
              <ImageIcon size={16} />
            </button>
            <button onClick={handleUndo} disabled={codeHistory.length === 0} className="focus-ring rounded-md bg-white/8 p-2 text-white/60 transition hover:bg-white/12 hover:text-white disabled:opacity-30" title="Ongedaan maken">
              <Undo2 size={16} />
            </button>
            <button onClick={() => setIsPreviewOpen(value => !value)} className={`focus-ring rounded-md p-2 transition ${isPreviewOpen ? 'bg-[#3EBAC8]/15 text-[#8ce9f1]' : 'bg-white/8 text-white/60 hover:text-white'}`} title="Preview">
              <PanelRight size={16} />
            </button>
            <button onClick={handleLogout} className="focus-ring rounded-md bg-white/8 p-2 text-white/60 transition hover:bg-white/12 hover:text-white" title="Uitloggen">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {statusMessage && (
        <div className={`shrink-0 border-b px-4 py-2 text-sm ${saveStatus === 'error' ? 'border-[#DD084B]/35 bg-[#DD084B]/10 text-white' : 'border-[#F9CD00]/25 bg-[#F9CD00]/10 text-[#F9CD00]'}`}>
          {statusMessage}
        </div>
      )}

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <section className={`${isPreviewOpen ? 'w-[42%] min-w-[340px] max-w-[56%]' : 'w-full'} flex min-h-0 flex-col border-r border-white/10 bg-[#0d0d0d]`}>
          {activeTab === Language.CHAT ? (
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              isProcessing={isProcessing}
              onApplyCodeUpdate={handleApplyCodeUpdate}
              onApplyPatches={handleApplyPatches}
              currentCode={code}
              input={chatInput}
              onInputChange={setChatInput}
              usingFallbackModel={usingFallbackModel}
              phase={phase}
              readiness={readiness}
              hasCode={hasCode}
            />
          ) : (
            <CodeEditor
              code={code[activeTab]}
              onChange={(value) => handleCodeChange(activeTab, value)}
              language={activeTab}
            />
          )}
        </section>

        {isPreviewOpen && (
          <aside className="min-w-0 flex-1 bg-[#101010]">
            <Preview code={code} phase={phase} brief={brief} />
          </aside>
        )}
      </main>

      <AssetLibrary
        isOpen={isAssetLibraryOpen}
        onClose={() => setIsAssetLibraryOpen(false)}
        onUseInChat={(prompt) => {
          setChatInput(`Gebruik de afbeelding "${prompt}" en `)
          setActiveTab(Language.CHAT)
        }}
      />

      {isSaveDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-white/10 bg-[#161616] p-5">
            <h2 className="text-lg font-semibold text-white">Project opslaan</h2>
            <form onSubmit={handleSaveNew} className="mt-4 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-white/70">Projectnaam</span>
                <input
                  value={saveTitle}
                  onChange={(event) => setSaveTitle(event.target.value)}
                  placeholder="Bijvoorbeeld: mijn eerste game"
                  className="focus-ring w-full rounded-md border border-white/10 bg-black/35 px-4 py-2 text-white placeholder:text-white/25"
                  autoFocus
                  disabled={saveStatus === 'saving'}
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSaveDialogOpen(false)}
                  className="focus-ring flex-1 rounded-md border border-white/10 px-4 py-2 font-semibold text-white/70 transition hover:bg-white/8 hover:text-white"
                  disabled={saveStatus === 'saving'}
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={saveStatus === 'saving' || !saveTitle.trim()}
                  className="focus-ring flex-1 rounded-md bg-[#F9CD00] px-4 py-2 font-semibold text-black transition hover:bg-[#e8bd00] active:translate-y-px disabled:opacity-45"
                >
                  {saveStatus === 'saving' ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex h-[100dvh] items-center justify-center bg-[#0d0d0d] text-white">
        Laden...
      </div>
    }>
      <EditorContent />
    </Suspense>
  )
}
