'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import React from 'react'
import { ChatMessage, ChatMode, CodeState, ToolResult } from '@/lib/types'
import { Send, Loader2, Check, MessageSquarePlus } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

type ApplyLang = 'html' | 'css' | 'javascript'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSendMessage: (message: string, mode: ChatMode) => void
  isProcessing: boolean
  onApplyCode: (lang: ApplyLang, code: string) => void
  currentCode: CodeState
  prefill?: string
  onPrefillConsumed?: () => void
}

const MODE_CONFIG: { mode: ChatMode; label: string; description: string }[] = [
  { mode: 'agent', label: 'Agent', description: 'Bouw iets nieuws of grote aanpassingen' },
  { mode: 'qa', label: 'Uitleg', description: 'Vragen stellen, code laten uitleggen' },
  { mode: 'edit', label: 'Edits', description: 'Kleine snelle aanpassingen' },
]

const LANG_LABEL: Record<string, string> = {
  html: 'HTML',
  css: 'CSS',
  javascript: 'JS',
}

const LANG_COLOR: Record<string, string> = {
  html: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  css: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  javascript: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
}

function parseCodeBlocks(content: string): Partial<CodeState> {
  const result: Partial<CodeState> = {}
  const regex = /```(html|css|javascript|js)\n([\s\S]*?)```/g
  let match
  while ((match = regex.exec(content)) !== null) {
    const lang = (match[1] === 'js' ? 'javascript' : match[1]) as keyof CodeState
    result[lang] = match[2].replace(/\n$/, '')
  }
  return result
}

function buildSrcDoc(code: CodeState): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${code.css}</style></head><body>${code.html}<script>try{${code.javascript}}catch(e){console.error(e)}</script></body></html>`
}

function MiniPreview({
  currentCode,
  suggested,
  onAccept,
  autoApplied = false,
}: {
  currentCode: CodeState
  suggested: Partial<CodeState>
  onAccept?: () => void
  autoApplied?: boolean
}) {
  const [accepted, setAccepted] = useState(autoApplied)

  const merged: CodeState = {
    html: suggested.html ?? currentCode.html,
    css: suggested.css ?? currentCode.css,
    javascript: suggested.javascript ?? currentCode.javascript,
  }

  const srcDoc = useMemo(() => buildSrcDoc(merged), [merged.html, merged.css, merged.javascript])

  const changedTabs = Object.keys(suggested) as (keyof CodeState)[]

  const handleAccept = () => {
    setAccepted(true)
    onAccept?.()
  }

  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-gray-700 bg-gray-900/50">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-900">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Voorgesteld resultaat</span>
          <div className="flex gap-1">
            {changedTabs.map(lang => (
              <span
                key={lang}
                className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${LANG_COLOR[lang]}`}
              >
                {LANG_LABEL[lang]}
              </span>
            ))}
          </div>
        </div>
        {autoApplied ? (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1 rounded font-medium bg-green-900/40 text-green-400 border border-green-800/60">
            <Check className="w-3 h-3" />
            Automatisch toegepast
          </span>
        ) : (
          <button
            onClick={handleAccept}
            disabled={accepted}
            className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded font-medium transition-all ${
              accepted
                ? 'bg-green-900/40 text-green-400 border border-green-800/60'
                : 'bg-[#E1014A] hover:bg-[#c1013d] text-white'
            }`}
          >
            {accepted ? (
              <>
                <Check className="w-3 h-3" />
                Overgenomen
              </>
            ) : (
              'Overnemen'
            )}
          </button>
        )}
      </div>

      {/* Preview iframe */}
      <div className="relative bg-white" style={{ height: 180 }}>
        <iframe
          srcDoc={srcDoc}
          className="absolute inset-0 w-full h-full border-none"
          sandbox="allow-scripts allow-modals"
          title="Voorgestelde preview"
        />
      </div>
    </div>
  )
}

export function ChatPanel({ messages, onSendMessage, isProcessing, onApplyCode, currentCode, prefill, onPrefillConsumed }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<ChatMode>('agent')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Apply external prefill (e.g. from Asset Library)
  useEffect(() => {
    if (prefill) {
      setInput(prefill)
      inputRef.current?.focus()
      onPrefillConsumed?.()
    }
  }, [prefill])

  const prefillInput = (text: string) => {
    setInput(text)
    inputRef.current?.focus()
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing) return
    onSendMessage(input, mode)
    setInput('')
  }

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-900">
        <h2 className="text-sm font-semibold text-white">AI Assistent</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm mt-8">
            <p>Stel een vraag of vraag om hulp!</p>
            <p className="mt-2 text-xs">Bijvoorbeeld:</p>
            <ul className="mt-2 space-y-1 text-xs">
              <li>&quot;Maak een rode knop&quot;</li>
              <li>&quot;Leg mijn code uit&quot;</li>
              <li>&quot;Waarom werkt dit niet?&quot;</li>
            </ul>
          </div>
        ) : (
          messages.map((message) => {
            const toolResult: ToolResult | undefined = message.toolResult

            // For assistant messages without toolResult, fall back to markdown parsing
            const fallbackSuggested = message.role === 'assistant' && !toolResult
              ? parseCodeBlocks(message.content)
              : {}
            const hasFallbackSuggestion = Object.keys(fallbackSuggested).length > 0

            return (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-[#E1014A] text-white'
                      : 'bg-black text-white'
                  }`}
                >
                  {message.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  ) : (
                    <>
                      <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown
                          components={{
                            pre: ({ children }) => (
                              <pre className="bg-gray-950 p-3 rounded text-xs overflow-x-auto border border-gray-800 my-2">
                                {children}
                              </pre>
                            ),
                            code: ({ className, children, ...props }) => {
                              const isBlock = /language-(\w+)/.exec(className || '')
                              return isBlock ? (
                                <code className={`text-xs ${className ?? ''}`} {...props}>
                                  {children}
                                </code>
                              ) : (
                                <code className="bg-gray-700 px-1 py-0.5 rounded text-xs" {...props}>
                                  {children}
                                </code>
                              )
                            },
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>

                      {/* Tool result: code_update — auto-applied, show MiniPreview */}
                      {toolResult?.type === 'code_update' && (
                        <MiniPreview
                          currentCode={currentCode}
                          suggested={{
                            html: toolResult.html,
                            css: toolResult.css,
                            javascript: toolResult.javascript,
                          }}
                          autoApplied={true}
                        />
                      )}

                      {/* Tool result: image_generated — show inline image */}
                      {toolResult?.type === 'image_generated' && (
                        <div className="mt-3 rounded-lg overflow-hidden border border-gray-700">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={toolResult.url}
                            alt={toolResult.prompt}
                            className="w-full object-contain max-h-48 bg-gray-900"
                          />
                          <div className="flex items-center justify-between px-2 py-1.5 bg-gray-900/50">
                            <p className="text-xs text-gray-500 truncate">{toolResult.prompt}</p>
                            <button
                              onClick={() => prefillInput(`Gebruik de afbeelding "${toolResult.prompt}" en `)}
                              className="ml-2 shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                              title="Gebruik deze afbeelding in je volgende bericht"
                            >
                              <MessageSquarePlus className="w-3 h-3" />
                              Gebruik in chat
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Fallback: markdown code block parsing (no toolResult) */}
                      {hasFallbackSuggestion && (
                        <MiniPreview
                          currentCode={currentCode}
                          suggested={fallbackSuggested}
                          onAccept={() => {
                            Object.entries(fallbackSuggested).forEach(([lang, code]) => {
                              onApplyCode(lang as ApplyLang, code!)
                            })
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-gray-900 rounded-lg px-4 py-3 border border-gray-800">
              <Loader2 className="w-4 h-4 animate-spin text-[#E1014A]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-900 space-y-2">
        {/* Mode selector */}
        <div className="flex gap-1">
          {MODE_CONFIG.map(({ mode: m, label, description }) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              title={description}
              className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                mode === m
                  ? 'bg-[#E1014A] text-white'
                  : 'bg-gray-900 text-gray-500 hover:text-gray-300 border border-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'agent' ? 'Bouw iets of vraag grote aanpassingen...' :
              mode === 'qa' ? 'Stel een vraag over je code...' :
              'Beschrijf een kleine aanpassing...'
            }
            className="flex-1 bg-gray-900 text-gray-100 text-sm rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#E1014A] border border-gray-800"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            className="bg-[#E1014A] hover:bg-[#c1013d] disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded px-4 py-2 transition-colors"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
