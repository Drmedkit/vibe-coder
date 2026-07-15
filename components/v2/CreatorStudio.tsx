'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  CheckCircle,
  ClockCounterClockwise,
  Code,
  Copy,
  Database,
  Eye,
  FloppyDisk,
  Globe,
  Lightning,
  LinkSimple,
  PaperPlaneRight,
  ShareNetwork,
  Sparkle,
  SpinnerGap,
  Stack,
  X,
} from '@phosphor-icons/react'
import { SourceEditor } from '@/components/v2/SourceEditor'
import {
  BuildEventRecord,
  BuildJobRecord,
  DeploymentRecord,
  ProjectCapabilities,
  ProjectRecord,
  SourceFile,
  UserRole,
} from '@/lib/v2/types'

type StudioView = 'preview' | 'code' | 'data' | 'versions'

interface UserInfo {
  id: string
  username: string
  role: UserRole
  classId: string | null
}

interface Credits {
  used: number
  remaining: number
  total: number
}

interface ProjectListItem extends ProjectRecord {
  deployment?: DeploymentRecord | null
  unlistedUrl?: string | null
  publicUrl?: string | null
}

interface ProjectDetail {
  project: ProjectRecord
  files: SourceFile[]
  capabilities: ProjectCapabilities
  checkpoints: Array<{ id: string; label: string; prompt: string; createdAt: string }>
  deployment: DeploymentRecord | null
  urls: { unlistedUrl: string | null; publicUrl: string | null }
  permissions: { canApprove: boolean }
}

const STARTERS = [
  {
    label: 'A tiny internet museum',
    prompt: 'Build an interactive internet museum for ordinary objects with dramatic exhibit cards, surprising facts, and a way for visitors to vote for the next object.',
  },
  {
    label: 'A decision machine',
    prompt: 'Make a beautiful decision machine that turns a difficult choice into unusual questions, then reveals a bold recommendation with animated evidence.',
  },
  {
    label: 'A visual sound toy',
    prompt: 'Create a visual sound toy where clicks, drags, and keyboard presses build a living composition of shapes, rhythm, and color.',
  },
  {
    label: 'Something nobody expects',
    prompt: 'Invent a strange but useful interactive website that feels like it came from five years in the future. Make every click change the experience.',
  },
]

const REMIX_IDEAS = [
  'Make the first ten seconds more surprising',
  'Add one feature people will want to share',
  'Give it a completely different visual direction',
]

function productName() {
  return process.env.NEXT_PUBLIC_PRODUCT_NAME || 'Vibe'
}

function relativeTime(value: string) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

async function jsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.')
  return data as T
}

function absoluteUrl(value: string): string {
  if (typeof window === 'undefined') return value
  return new URL(value, window.location.origin).href
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

function CreditMeter({ credits }: { credits: Credits | null }) {
  if (!credits) return null
  const percentage = Math.max(0, Math.min(100, (credits.remaining / credits.total) * 100))
  return (
    <div className="credit-meter" title={`${credits.remaining} build credits left today`}>
      <div><span>credits</span><strong>{credits.remaining}</strong></div>
      <div className="credit-track"><span style={{ transform: `scaleX(${percentage / 100})` }} /></div>
    </div>
  )
}

function LaunchVisual() {
  return (
    <div className="launch-visual" aria-hidden="true">
      <div className="launch-orbit launch-orbit-one" />
      <div className="launch-orbit launch-orbit-two" />
      <div className="launch-canvas">
        <div className="canvas-bar"><i /><i /><i /><span>live creation</span></div>
        <div className="canvas-scene">
          <div className="scene-word">MAKE</div>
          <div className="scene-shape scene-shape-one" />
          <div className="scene-shape scene-shape-two" />
          <div className="scene-panel"><span>idea</span><strong>turned into something real</strong></div>
        </div>
      </div>
      <div className="floating-note floating-note-one"><Lightning size={16} weight="fill" /> first click works</div>
      <div className="floating-note floating-note-two"><Globe size={16} weight="fill" /> link is live</div>
    </div>
  )
}

function Launcher({
  user,
  credits,
  projects,
  prompt,
  onPromptChange,
  onBuild,
  isSubmitting,
  error,
}: {
  user: UserInfo | null
  credits: Credits | null
  projects: ProjectListItem[]
  prompt: string
  onPromptChange: (value: string) => void
  onBuild: () => void
  isSubmitting: boolean
  error: string
}) {
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const chooseStarter = (value: string) => {
    onPromptChange(value)
    textareaRef.current?.focus()
  }

  return (
    <main className="launcher-shell">
      <header className="launcher-header">
        <button className="brand-button" onClick={() => router.push('/')}>
          <BrandMark />
          <span>{productName()}</span>
        </button>
        <nav>
          <button onClick={() => router.push('/projects')}>Your creations</button>
          {(user?.role === 'teacher' || user?.role === 'admin') && (
            <button onClick={() => router.push('/teacher')}>Teacher view</button>
          )}
          <CreditMeter credits={credits} />
          <button className="user-chip" onClick={() => router.push('/account')}>{user?.username || 'maker'}</button>
        </nav>
      </header>

      <section className="launcher-grid">
        <div className="launcher-copy">
          <p className="section-kicker"><Sparkle size={15} weight="fill" /> From thought to live link</p>
          <h1>Make the thing you can&apos;t stop thinking about.</h1>
          <p className="launcher-lede">Describe it once. We&apos;ll build the interface, interactions, images, data, and a real link. You take it somewhere unexpected.</p>

          <div className="launch-composer">
            <label htmlFor="launch-prompt">What should exist five minutes from now?</label>
            <textarea
              ref={textareaRef}
              id="launch-prompt"
              value={prompt}
              onChange={event => onPromptChange(event.target.value)}
              onKeyDown={event => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') onBuild()
              }}
              placeholder="I want to make..."
              maxLength={4000}
              disabled={isSubmitting}
              autoFocus
            />
            <div className="composer-footer">
              <span>{prompt.trim().length < 8 ? 'Give us the rough idea. Details can come later.' : 'Ready to build. You can remix everything afterward.'}</span>
              <button onClick={onBuild} disabled={isSubmitting || prompt.trim().length < 8}>
                {isSubmitting ? <SpinnerGap className="spin" size={20} /> : <Lightning size={20} weight="fill" />}
                {isSubmitting ? 'Starting build' : 'Build it now'}
                {!isSubmitting && <ArrowRight size={18} />}
              </button>
            </div>
          </div>
          {error && <p className="inline-error">{error}</p>}

          <div className="starter-strip">
            <span>Start from a spark</span>
            <div>
              {STARTERS.map(starter => (
                <button key={starter.label} onClick={() => chooseStarter(starter.prompt)}>{starter.label}</button>
              ))}
            </div>
          </div>
        </div>
        <LaunchVisual />
      </section>

      <section className="recent-section">
        <div className="recent-heading">
          <div><p>Keep making</p><h2>Your recent worlds</h2></div>
          <button onClick={() => router.push('/projects')}>See all <ArrowRight size={16} /></button>
        </div>
        {projects.length === 0 ? (
          <div className="recent-empty"><span>01</span><p>Your first creation will appear here with its live link and checkpoints.</p></div>
        ) : (
          <div className="recent-rail">
            {projects.slice(0, 5).map((project, index) => (
              <button key={project.id} onClick={() => router.push(`/?project=${project.id}`)} className="recent-project">
                <span className="recent-number">0{index + 1}</span>
                <div><strong>{project.title}</strong><p>{project.summary || 'Ready for the next idea.'}</p></div>
                <span className={`project-state state-${project.status}`}>{project.status}</span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function BuildProgress({ events, build }: { events: BuildEventRecord[]; build: BuildJobRecord | null }) {
  const progress = events.at(-1)?.progress ?? build?.progress ?? 0
  const latest = events.at(-1)?.message || 'Waking up the build engine'
  return (
    <div className="build-progress">
      <div className="build-progress-top">
        <span className="build-pulse"><i /></span>
        <div><p>Building live</p><strong>{latest}</strong></div>
        <span className="progress-number">{progress}%</span>
      </div>
      <div className="build-track"><span style={{ transform: `scaleX(${progress / 100})` }} /></div>
      <div className="build-event-list">
        {events.slice(-4).map(event => (
          <div key={event.id} className={event.type === 'error' ? 'event-error' : ''}>
            {event.type === 'error' ? <X size={15} /> : <CheckCircle size={15} weight="fill" />}
            <span>{event.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyPreview() {
  return (
    <div className="empty-preview">
      <div className="empty-preview-shape" />
      <p>Your creation will take over this space.</p>
      <span>One prompt. A working product. A link anyone can open.</span>
    </div>
  )
}

function PreviewPanel({ detail, isBuilding, events, build }: {
  detail: ProjectDetail | null
  isBuilding: boolean
  events: BuildEventRecord[]
  build: BuildJobRecord | null
}) {
  const [frameKey, setFrameKey] = useState(0)
  const url = detail?.urls.unlistedUrl
  return (
    <section className="preview-stage">
      <div className="browser-chrome">
        <div className="browser-dots"><i /><i /><i /></div>
        <div className="browser-address"><LinkSimple size={14} /><span>{url || 'Your live link will appear here'}</span></div>
        <button onClick={() => setFrameKey(value => value + 1)} disabled={!url} title="Reload preview">
          <ClockCounterClockwise size={17} />
        </button>
      </div>
      <div className="preview-viewport">
        {url ? (
          <iframe
            key={`${url}-${frameKey}`}
            src={url}
            title={detail?.project.title || 'Creation preview'}
            sandbox="allow-scripts allow-forms allow-modals"
          />
        ) : <EmptyPreview />}
        {isBuilding && <BuildProgress events={events} build={build} />}
      </div>
    </section>
  )
}

function CodePanel({ detail, onBuildStarted }: {
  detail: ProjectDetail
  onBuildStarted: (build: BuildJobRecord) => void
}) {
  const [files, setFiles] = useState<SourceFile[]>(detail.files)
  const [activePath, setActivePath] = useState(detail.files[0]?.path || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const activeFile = files.find(file => file.path === activePath) || files[0]

  useEffect(() => {
    setFiles(detail.files)
    setActivePath(current => detail.files.some(file => file.path === current) ? current : detail.files[0]?.path || '')
    setDirty(false)
  }, [detail.files])

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const data = await jsonResponse<{ build: BuildJobRecord }>(await fetch(`/api/v2/projects/${detail.project.id}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      }))
      setDirty(false)
      onBuildStarted(data.build)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Code could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  if (!activeFile) return <div className="panel-empty">No source files yet.</div>
  return (
    <section className="code-workspace">
      <aside className="file-tree">
        <div><span>Source</span><strong>{files.length} files</strong></div>
        {files.map(file => (
          <button key={file.path} className={file.path === activeFile.path ? 'active' : ''} onClick={() => setActivePath(file.path)}>
            <Code size={15} />{file.path.replace(/^src\//, '')}
          </button>
        ))}
      </aside>
      <div className="editor-column">
        <header>
          <div><strong>{activeFile.path}</strong><span>{activeFile.content.split('\n').length} lines</span></div>
          <button onClick={save} disabled={!dirty || saving}>
            {saving ? <SpinnerGap className="spin" size={16} /> : <FloppyDisk size={16} />}
            {saving ? 'Compiling' : 'Save checkpoint'}
          </button>
        </header>
        {error && <p className="editor-error">{error}</p>}
        <div className="editor-frame">
          <SourceEditor
            file={activeFile}
            onChange={content => {
              setFiles(current => current.map(file => file.path === activeFile.path ? { ...file, content } : file))
              setDirty(true)
            }}
          />
        </div>
      </div>
    </section>
  )
}

function DataPanel({ detail }: { detail: ProjectDetail }) {
  const { capabilities } = detail
  const enabledCount = capabilities.collections.length + Number(capabilities.textAI) + Number(capabilities.imageAI)
  return (
    <section className="capability-panel">
      <header><p>Inside the product</p><h2>{enabledCount > 0 ? `${enabledCount} live capabilities` : 'No backend needed yet'}</h2></header>
      <div className="capability-list">
        {capabilities.collections.map(collection => (
          <article key={collection.name}>
            <span className="capability-icon"><Database size={19} /></span>
            <div><strong>{collection.label}</strong><p>{collection.fields.map(field => field.name).join(', ') || 'Counter data'} · up to {collection.maxRecords || 500} records</p></div>
            <span>{collection.operations.join(' · ')}</span>
          </article>
        ))}
        {capabilities.textAI && (
          <article><span className="capability-icon"><Sparkle size={19} /></span><div><strong>Text AI</strong><p>Capped, filtered responses through the Vibe SDK.</p></div><span>50 calls / day</span></article>
        )}
        {capabilities.imageAI && (
          <article><span className="capability-icon"><Stack size={19} /></span><div><strong>Image AI</strong><p>Generated images stored with this project.</p></div><span>3 calls / day</span></article>
        )}
        {enabledCount === 0 && (
          <div className="capability-empty"><Database size={24} /><p>Ask for saved votes, scores, submissions, text AI, or image generation in your next remix.</p></div>
        )}
      </div>
    </section>
  )
}

function VersionsPanel({ detail, onRestore }: { detail: ProjectDetail; onRestore: (checkpointId: string) => void }) {
  return (
    <section className="versions-panel">
      <header><p>Every good turn is saved</p><h2>Version history</h2></header>
      {detail.checkpoints.length === 0 ? (
        <div className="panel-empty">The first checkpoint appears after a successful build.</div>
      ) : (
        <div className="version-list">
          {detail.checkpoints.map((checkpoint, index) => (
            <article key={checkpoint.id}>
              <span className="version-index">{String(detail.checkpoints.length - index).padStart(2, '0')}</span>
              <div><strong>{checkpoint.label}</strong><p>{relativeTime(checkpoint.createdAt)}{checkpoint.prompt ? ` · ${checkpoint.prompt}` : ''}</p></div>
              <button onClick={() => onRestore(checkpoint.id)}><ClockCounterClockwise size={16} /> Restore</button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function SharePopover({ detail, onClose }: { detail: ProjectDetail; onClose: () => void }) {
  const [copied, setCopied] = useState('')
  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(absoluteUrl(value))
    setCopied(label)
    window.setTimeout(() => setCopied(''), 1600)
  }
  return (
    <div className="share-popover">
      <header><div><p>Share the real thing</p><h3>Live links</h3></div><button onClick={onClose}><X size={18} /></button></header>
      {detail.urls.unlistedUrl && (
        <div className="share-row"><span><LinkSimple size={17} /><i>Unlisted</i></span><p>{absoluteUrl(detail.urls.unlistedUrl)}</p><button onClick={() => copy(detail.urls.unlistedUrl as string, 'unlisted')}>{copied === 'unlisted' ? <CheckCircle size={17} weight="fill" /> : <Copy size={17} />}</button></div>
      )}
      {detail.urls.publicUrl ? (
        <div className="share-row public"><span><Globe size={17} /><i>Public domain</i></span><p>{detail.urls.publicUrl}</p><button onClick={() => copy(detail.urls.publicUrl as string, 'public')}>{copied === 'public' ? <CheckCircle size={17} weight="fill" /> : <Copy size={17} />}</button></div>
      ) : (
        <p className="share-note">This unlisted link already works anywhere. A school with a connected domain can also approve memorable public addresses.</p>
      )}
    </div>
  )
}

function Studio({
  detail,
  setDetail,
  user,
  credits,
  build,
  events,
  view,
  setView,
  remixPrompt,
  setRemixPrompt,
  onRemix,
  onBuildStarted,
  error,
}: {
  detail: ProjectDetail
  setDetail: (detail: ProjectDetail) => void
  user: UserInfo | null
  credits: Credits | null
  build: BuildJobRecord | null
  events: BuildEventRecord[]
  view: StudioView
  setView: (view: StudioView) => void
  remixPrompt: string
  setRemixPrompt: (value: string) => void
  onRemix: () => void
  onBuildStarted: (build: BuildJobRecord) => void
  error: string
}) {
  const router = useRouter()
  const [shareOpen, setShareOpen] = useState(false)
  const [title, setTitle] = useState(detail.project.title)
  const isBuilding = Boolean(build && !['complete', 'failed'].includes(build.status))

  const saveTitle = async () => {
    const cleanTitle = title.trim()
    if (!cleanTitle || cleanTitle === detail.project.title) return
    try {
      const data = await jsonResponse<{ project: ProjectRecord }>(await fetch(`/api/v2/projects/${detail.project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: cleanTitle }),
      }))
      setDetail({ ...detail, project: data.project })
    } catch {
      setTitle(detail.project.title)
    }
  }

  const restore = async (checkpointId: string) => {
    try {
      const data = await jsonResponse<{ build: BuildJobRecord }>(await fetch(`/api/v2/projects/${detail.project.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpointId }),
      }))
      onBuildStarted(data.build)
      setView('preview')
    } catch {}
  }

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <button className="brand-button compact" onClick={() => router.push('/')}><BrandMark /><span>{productName()}</span></button>
        <div className="project-title-control">
          <span>{detail.project.status === 'building' ? 'building' : detail.project.approvedSlug ? 'public' : 'unlisted'}</span>
          <input value={title} onChange={event => setTitle(event.target.value)} onBlur={saveTitle} onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()} />
        </div>
        <nav className="studio-tabs">
          {([
            ['preview', Eye, 'Preview'],
            ['code', Code, 'Code'],
            ['data', Database, 'Data'],
            ['versions', ClockCounterClockwise, 'Versions'],
          ] as const).map(([key, Icon, label]) => (
            <button key={key} className={view === key ? 'active' : ''} onClick={() => setView(key)}><Icon size={17} />{label}</button>
          ))}
        </nav>
        <div className="studio-actions">
          <CreditMeter credits={credits} />
          <button className="icon-action" onClick={() => router.push('/projects')} title="All creations"><Stack size={19} /></button>
          <div className="share-wrap">
            <button className="share-button" onClick={() => setShareOpen(value => !value)} disabled={!detail.urls.unlistedUrl}><ShareNetwork size={18} /> Share</button>
            {shareOpen && <SharePopover detail={detail} onClose={() => setShareOpen(false)} />}
          </div>
          {(user?.role === 'teacher' || user?.role === 'admin') && <button className="icon-action" onClick={() => router.push('/teacher')} title="Teacher view"><Globe size={19} /></button>}
        </div>
      </header>

      <div className="studio-grid">
        <aside className="remix-column">
          <div className="remix-heading"><p>Current creation</p><h1>{detail.project.title}</h1><span>{detail.project.summary || 'Build the first version, then push it somewhere stranger.'}</span></div>
          <div className="activity-stream">
            {events.length === 0 ? (
              <div className="activity-empty"><Sparkle size={20} /><p>Every build decision and checkpoint appears here while you make.</p></div>
            ) : events.map(event => (
              <div key={event.id} className={`activity-event activity-${event.type}`}>
                <span>{event.type === 'error' ? <X size={14} /> : <i />}</span>
                <div><p>{event.message}</p><small>{event.progress}%</small></div>
              </div>
            ))}
          </div>
          <form className="remix-composer" onSubmit={event => { event.preventDefault(); onRemix() }}>
            <label htmlFor="remix-prompt">Take it further</label>
            <textarea id="remix-prompt" value={remixPrompt} onChange={event => setRemixPrompt(event.target.value)} placeholder="Add, remove, restyle, or rethink anything..." maxLength={4000} disabled={isBuilding} />
            <div className="remix-suggestions">
              {REMIX_IDEAS.map(idea => <button key={idea} type="button" onClick={() => setRemixPrompt(idea)}>{idea}</button>)}
            </div>
            {error && <p className="inline-error">{error}</p>}
            <button className="remix-submit" type="submit" disabled={isBuilding || remixPrompt.trim().length < 4}>
              {isBuilding ? <SpinnerGap className="spin" size={18} /> : <PaperPlaneRight size={18} weight="fill" />}
              {isBuilding ? 'Building' : 'Remix now'}
            </button>
          </form>
        </aside>

        <div className="stage-column">
          {view === 'preview' && <PreviewPanel detail={detail} isBuilding={isBuilding} events={events} build={build} />}
          {view === 'code' && <CodePanel detail={detail} onBuildStarted={onBuildStarted} />}
          {view === 'data' && <DataPanel detail={detail} />}
          {view === 'versions' && <VersionsPanel detail={detail} onRestore={restore} />}
        </div>
      </div>
    </main>
  )
}

export function CreatorStudio() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const projectId = searchParams.get('project')
  const [user, setUser] = useState<UserInfo | null>(null)
  const [credits, setCredits] = useState<Credits | null>(null)
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [prompt, setPrompt] = useState('')
  const [remixPrompt, setRemixPrompt] = useState('')
  const [build, setBuild] = useState<BuildJobRecord | null>(null)
  const [events, setEvents] = useState<BuildEventRecord[]>([])
  const [view, setView] = useState<StudioView>('preview')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const eventSourceRef = useRef<EventSource | null>(null)

  const loadProject = useCallback(async (id: string) => {
    const data = await jsonResponse<ProjectDetail>(await fetch(`/api/v2/projects/${id}`, { cache: 'no-store' }))
    setDetail(data)
    return data
  }, [])

  const refreshBuild = useCallback(async (buildId: string) => {
    const data = await jsonResponse<{
      build: BuildJobRecord
      deployment: DeploymentRecord | null
      urls: { unlistedUrl: string | null; publicUrl: string | null }
    }>(await fetch(`/api/v2/builds/${buildId}`, { cache: 'no-store' }))
    setBuild(data.build)
    if (data.build.status === 'complete' || data.build.status === 'failed') {
      setSubmitting(false)
      if (data.build.status === 'failed') setError(data.build.error || 'The build stopped.')
      await loadProject(data.build.projectId)
      const projectData = await jsonResponse<{ projects: ProjectListItem[]; credits: Credits; user: UserInfo }>(await fetch('/api/v2/projects', { cache: 'no-store' }))
      setCredits(projectData.credits)
      setProjects(projectData.projects)
    }
  }, [loadProject])

  const watchBuild = useCallback((nextBuild: BuildJobRecord) => {
    eventSourceRef.current?.close()
    setBuild(nextBuild)
    setEvents([])
    setSubmitting(true)
    setError('')
    const source = new EventSource(`/api/v2/builds/${nextBuild.id}/events`)
    eventSourceRef.current = source
    source.onmessage = event => {
      const nextEvent = JSON.parse(event.data) as BuildEventRecord
      setEvents(current => current.some(item => item.id === nextEvent.id) ? current : [...current, nextEvent])
      if (nextEvent.type === 'complete' || nextEvent.type === 'error') {
        source.close()
        void refreshBuild(nextBuild.id)
      }
    }
    source.onerror = () => {
      source.close()
      void refreshBuild(nextBuild.id)
    }
  }, [refreshBuild])

  useEffect(() => () => eventSourceRef.current?.close(), [])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/v2/projects', { cache: 'no-store' })
        .then(response => jsonResponse<{ projects: ProjectListItem[]; credits: Credits; user: UserInfo }>(response)),
      projectId
        ? fetch(`/api/v2/projects/${projectId}`, { cache: 'no-store' }).then(response => jsonResponse<ProjectDetail>(response))
        : Promise.resolve(null),
    ]).then(([projectData, projectDetail]) => {
      if (cancelled) return
      setProjects(projectData.projects)
      setCredits(projectData.credits)
      setUser(projectData.user)
      if (projectDetail) setDetail(projectDetail)
    }).catch(loadError => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'The studio could not load.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [projectId])

  const buildFromPrompt = async () => {
    const value = projectId ? remixPrompt.trim() : prompt.trim()
    if (value.length < (projectId ? 4 : 8) || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const data = await jsonResponse<{ project: ProjectRecord; build: BuildJobRecord; credits: Credits }>(await fetch('/api/v2/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: projectId || undefined, prompt: value }),
      }))
      setCredits(data.credits)
      if (!projectId) {
        setDetail({
          project: data.project,
          files: [],
          capabilities: { collections: [], textAI: false, imageAI: false },
          checkpoints: [],
          deployment: null,
          urls: { unlistedUrl: null, publicUrl: null },
          permissions: { canApprove: user?.role === 'teacher' || user?.role === 'admin' },
        })
        router.replace(`/?project=${data.project.id}`)
      } else {
        setRemixPrompt('')
      }
      setView('preview')
      watchBuild(data.build)
    } catch (buildError) {
      setSubmitting(false)
      setError(buildError instanceof Error ? buildError.message : 'The build could not start.')
    }
  }

  if (loading) {
    return <main className="studio-loading"><BrandMark /><div><span /><span /><span /></div><p>Opening the workshop</p></main>
  }

  if (!projectId) {
    return (
      <Launcher
        user={user}
        credits={credits}
        projects={projects}
        prompt={prompt}
        onPromptChange={setPrompt}
        onBuild={buildFromPrompt}
        isSubmitting={submitting}
        error={error}
      />
    )
  }

  if (!detail) {
    return <main className="project-missing"><BrandMark /><h1>We couldn&apos;t open this creation.</h1><button onClick={() => router.push('/')}>Back to the workshop</button></main>
  }

  return (
    <Studio
      key={`${detail.project.id}-${detail.project.title}`}
      detail={detail}
      setDetail={setDetail}
      user={user}
      credits={credits}
      build={build}
      events={events}
      view={view}
      setView={setView}
      remixPrompt={remixPrompt}
      setRemixPrompt={setRemixPrompt}
      onRemix={buildFromPrompt}
      onBuildStarted={watchBuild}
      error={error}
    />
  )
}
