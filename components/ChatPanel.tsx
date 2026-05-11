'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { BookOpen, Check, Hammer, Loader2, MessageSquarePlus, RefreshCw, Send, Wand2 } from 'lucide-react'
import { BriefReadiness, ChatAction, ChatMessage, CodeState, CodeUpdateIntent, EditPatch, ProjectPhase, ToolResult } from '@/lib/types'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSendMessage: (message: string, action?: ChatAction) => void
  isProcessing: boolean
  onApplyCodeUpdate: (code: Partial<CodeState>, intent?: CodeUpdateIntent) => void
  onApplyPatches: (patches: EditPatch[]) => void
  currentCode: CodeState
  input: string
  onInputChange: (value: string) => void
  usingFallbackModel?: boolean
  phase: ProjectPhase
  readiness: BriefReadiness
  hasCode: boolean
}

const LANG_LABEL: Record<string, string> = {
  html: 'HTML',
  css: 'CSS',
  javascript: 'JS',
}

const LANG_COLOR: Record<string, string> = {
  html: 'bg-[#F06A01]/18 text-[#ffb078] border-[#F06A01]/35',
  css: 'bg-[#3EBAC8]/16 text-[#9ceaf1] border-[#3EBAC8]/35',
  javascript: 'bg-[#F9CD00]/16 text-[#ffe46a] border-[#F9CD00]/35',
}

const PROCESSING_HINTS = [
  { afterMs: 0, text: 'AI denkt mee' },
  { afterMs: 12000, text: 'Grote builds kunnen even duren. Wacht met opnieuw klikken.' },
  { afterMs: 30000, text: 'Nog bezig. De AI maakt of controleert meerdere bestanden.' },
  { afterMs: 50000, text: 'Dit duurt lang. Als het stopt, probeer dan een kleinere vraag.' },
]

function buildSrcDoc(code: CodeState): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${code.css}</style></head><body>${code.html}<script>try{${code.javascript.replace(/<\/script/gi, '<\\/script')}}catch(e){console.error(e)}</script></body></html>`
}

function MiniPreview({
  currentCode,
  suggested,
  intent,
  onAccept,
}: {
  currentCode: CodeState
  suggested: Partial<CodeState>
  intent?: CodeUpdateIntent
  onAccept: (intent?: CodeUpdateIntent) => void
}) {
  const [accepted, setAccepted] = useState(false)

  const merged: CodeState = {
    html: suggested.html ?? currentCode.html,
    css: suggested.css ?? currentCode.css,
    javascript: suggested.javascript ?? currentCode.javascript,
  }
  const srcDoc = buildSrcDoc(merged)
  const changedTabs = Object.keys(suggested).filter(key => suggested[key as keyof CodeState] !== undefined) as (keyof CodeState)[]

  const handleAccept = () => {
    setAccepted(true)
    onAccept(intent)
  }

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-white/10 bg-[#161616]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#111111] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs text-white/50">Voorgesteld resultaat</span>
          <div className="flex gap-1">
            {changedTabs.map(lang => (
              <span
                key={lang}
                className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${LANG_COLOR[lang]}`}
              >
                {LANG_LABEL[lang]}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={handleAccept}
          disabled={accepted}
          className={`focus-ring flex shrink-0 items-center gap-1.5 rounded px-3 py-1 text-xs font-semibold transition active:translate-y-px ${
            accepted
              ? 'border border-[#7AC300]/40 bg-[#7AC300]/12 text-[#b6ef77]'
              : 'bg-[#F9CD00] text-black hover:bg-[#e8bd00]'
          }`}
        >
          <Check className="h-3 w-3" />
          {accepted ? 'Overgenomen' : 'Overnemen'}
        </button>
      </div>

      <div className="relative h-44 bg-white">
        <iframe
          srcDoc={srcDoc}
          className="absolute inset-0 h-full w-full border-none"
          sandbox="allow-scripts allow-modals"
          title="Voorgestelde preview"
        />
      </div>
    </div>
  )
}

function EditPreview({
  patches,
  currentCode,
  onAccept,
}: {
  patches: EditPatch[]
  currentCode: CodeState
  onAccept: () => void
}) {
  const [accepted, setAccepted] = useState(false)
  const patchStatus = patches.map(patch => {
    const source = patch.file === 'js' ? currentCode.javascript : currentCode[patch.file]
    return { ...patch, found: source.includes(patch.find) }
  })
  const anyFound = patchStatus.some(patch => patch.found)

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-white/10 bg-[#161616] text-xs">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#111111] px-3 py-2">
        <span className="text-white/50">Voorgestelde aanpassing</span>
        {anyFound ? (
          <button
            onClick={() => { setAccepted(true); onAccept() }}
            disabled={accepted}
            className={`focus-ring flex items-center gap-1.5 rounded px-3 py-1 font-semibold transition active:translate-y-px ${
              accepted
                ? 'border border-[#7AC300]/40 bg-[#7AC300]/12 text-[#b6ef77]'
                : 'bg-[#F9CD00] text-black hover:bg-[#e8bd00]'
            }`}
          >
            <Check className="h-3 w-3" />
            {accepted ? 'Overgenomen' : 'Overnemen'}
          </button>
        ) : (
          <span className="text-[#ff7aa5]">Niet gevonden in huidige code</span>
        )}
      </div>
      <div className="divide-y divide-white/10">
        {patchStatus.map((patch, index) => (
          <div key={`${patch.file}-${index}`} className={`space-y-1 p-2 ${patch.found ? '' : 'opacity-45'}`}>
            <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${LANG_COLOR[patch.file === 'js' ? 'javascript' : patch.file]}`}>
              {patch.file === 'js' ? 'JS' : patch.file.toUpperCase()}
            </span>
            <div className="rounded border border-[#DD084B]/25 bg-[#DD084B]/10 px-2 py-1 font-mono whitespace-pre-wrap text-[#ff9abb]">
              - {patch.find}
            </div>
            <div className="rounded border border-[#7AC300]/25 bg-[#7AC300]/10 px-2 py-1 font-mono whitespace-pre-wrap text-[#c9f99a]">
              + {patch.replace}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChatPanel({
  messages,
  onSendMessage,
  isProcessing,
  onApplyCodeUpdate,
  onApplyPatches,
  currentCode,
  input,
  onInputChange,
  usingFallbackModel,
  phase,
  readiness,
  hasCode,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [processingHint, setProcessingHint] = useState(PROCESSING_HINTS[0].text)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isProcessing])

  useEffect(() => {
    if (!isProcessing) return

    const startedAt = Date.now()
    const reset = window.setTimeout(() => {
      setProcessingHint(PROCESSING_HINTS[0].text)
    }, 0)
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      const nextHint = PROCESSING_HINTS
        .filter(hint => elapsed >= hint.afterMs)
        .at(-1)?.text ?? PROCESSING_HINTS[0].text
      setProcessingHint(nextHint)
    }, 1000)

    return () => {
      window.clearTimeout(reset)
      window.clearInterval(interval)
    }
  }, [isProcessing])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing) return
    onSendMessage(input)
    onInputChange('')
  }

  const sendAction = (message: string, action?: ChatAction) => {
    if (isProcessing) return
    onInputChange('')
    onSendMessage(message, action)
  }

  const prefillAction = (message: string) => {
    onInputChange(message)
    inputRef.current?.focus()
  }

  const prefillImageInChat = (prompt: string) => {
    onInputChange(`Gebruik de afbeelding "${prompt}" en `)
    inputRef.current?.focus()
  }

  return (
    <div className="flex h-full flex-col bg-[#0d0d0d]">
      <div className="border-b border-white/10 bg-[#111111] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">AI assistent</h2>
          {usingFallbackModel && (
            <span className="rounded border border-[#F9CD00]/25 bg-[#F9CD00]/10 px-2 py-0.5 text-[10px] text-[#F9CD00]">
              gratis model
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="mt-6 rounded-md border border-white/10 bg-[#161616] p-4">
            <p className="font-display text-2xl font-black leading-none text-white">BEGIN MET JOUW IDEE</p>
            <p className="mt-3 text-sm leading-relaxed text-white/55">
              Beschrijf rommelig wat je wilt maken. De AI stelt vragen, scherpt keuzes aan en bouwt pas wanneer er genoeg richting is.
            </p>
            <div className="mt-4 border-t border-white/10 pt-3 text-xs leading-relaxed text-white/40">
              De eerste build wordt beter als jij keuzes maakt over wat iemand doet, wat erin moet en hoe het moet voelen.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map(message => {
              const toolResult: ToolResult | undefined = message.toolResult
              return (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[92%] rounded-md px-4 py-3 ${message.role === 'user' ? 'bg-[#DD084B] text-white' : 'bg-[#161616] text-white border border-white/10'}`}>
                    <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-2">
                      <ReactMarkdown
                        components={{
                          code: ({ children, ...props }) => (
                            <code className="rounded bg-black/45 px-1 py-0.5 text-xs" {...props}>
                              {children}
                            </code>
                          ),
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>

                    {toolResult?.type === 'code_update' && (
                      <MiniPreview
                        currentCode={currentCode}
                        intent={toolResult.intent}
                        suggested={{
                          html: toolResult.html,
                          css: toolResult.css,
                          javascript: toolResult.javascript,
                        }}
                        onAccept={(intent) => {
                          onApplyCodeUpdate({
                            html: toolResult.html,
                            css: toolResult.css,
                            javascript: toolResult.javascript,
                          }, intent)
                        }}
                      />
                    )}

                    {toolResult?.type === 'edit_patches' && (
                      <EditPreview
                        patches={toolResult.patches}
                        currentCode={currentCode}
                        onAccept={() => onApplyPatches(toolResult.patches)}
                      />
                    )}

                    {toolResult?.type === 'image_generated' && (
                      <div className="mt-3 overflow-hidden rounded-md border border-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={toolResult.url} alt={toolResult.prompt} className="max-h-52 w-full bg-[#111111] object-contain" />
                        <div className="flex items-center justify-between gap-2 bg-[#111111] px-2 py-1.5">
                          <p className="truncate text-xs text-white/45">{toolResult.prompt}</p>
                          <button
                            onClick={() => prefillImageInChat(toolResult.prompt)}
                            className="focus-ring flex shrink-0 items-center gap-1 rounded bg-white/8 px-2 py-1 text-xs text-white/70 transition hover:bg-white/12 hover:text-white"
                          >
                            <MessageSquarePlus size={12} />
                            Gebruik
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {isProcessing && (
          <div className="mt-4 flex justify-start">
            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-[#161616] px-4 py-3 text-sm text-white/60">
              <Loader2 className="h-4 w-4 animate-spin text-[#F9CD00]" />
              {processingHint}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-white/10 bg-[#111111] p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {!hasCode ? (
            <button
              type="button"
              onClick={() => sendAction('Maak eerste build', 'first_build')}
              disabled={!readiness.readyForFirstBuild || isProcessing}
              title={readiness.readyForFirstBuild ? 'Maak de eerste werkende versie' : readiness.reason}
              className="focus-ring flex items-center gap-1.5 rounded-md bg-[#F9CD00] px-3 py-2 text-xs font-semibold text-black transition hover:bg-[#e8bd00] active:translate-y-px disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-[#161616] disabled:text-white/35"
            >
              <Hammer size={13} />
              Maak eerste build
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => sendAction('Leg uit hoe dit project werkt en wat ik als volgende kan verbeteren.', 'inspect')}
                disabled={isProcessing}
                className="focus-ring flex items-center gap-1.5 rounded-md border border-white/10 bg-[#161616] px-3 py-2 text-xs font-semibold text-white/65 transition hover:text-white active:translate-y-px disabled:opacity-45"
              >
                <BookOpen size={13} />
                Leg dit uit
              </button>
              <button
                type="button"
                onClick={() => sendAction('Kijk kritisch naar mijn project en stel de beste kleine verbetering voor.', 'inspect')}
                disabled={isProcessing}
                className="focus-ring flex items-center gap-1.5 rounded-md border border-white/10 bg-[#161616] px-3 py-2 text-xs font-semibold text-white/65 transition hover:text-white active:translate-y-px disabled:opacity-45"
              >
                <Wand2 size={13} />
                Verbeter dit
              </button>
              <button
                type="button"
                onClick={() => prefillAction('Ik wil een grote wijziging. Behoud: ... Verander: ... Omdat: ...')}
                disabled={isProcessing}
                className="focus-ring flex items-center gap-1.5 rounded-md border border-white/10 bg-[#161616] px-3 py-2 text-xs font-semibold text-white/65 transition hover:text-white active:translate-y-px disabled:opacity-45"
              >
                <RefreshCw size={13} />
                Maak grote wijziging
              </button>
            </>
          )}
          {!hasCode && phase !== 'empty' && !readiness.readyForFirstBuild && (
            <span className="min-w-0 flex-1 self-center text-xs text-white/35">{readiness.reason}</span>
          )}
        </div>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={hasCode
              ? 'Vraag om uitleg, een kleine verbetering of een bugfix...'
              : 'Beschrijf wat je wilt maken. Begin rommelig; de AI helpt je het scherp te krijgen.'}
            className="focus-ring min-w-0 flex-1 rounded-md border border-white/10 bg-black/35 px-3 py-2 text-sm text-white placeholder:text-white/25"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            className="focus-ring rounded-md bg-[#DD084B] px-4 py-2 text-white transition hover:bg-[#B8063F] active:translate-y-px disabled:opacity-45"
            title="Verstuur"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  )
}
