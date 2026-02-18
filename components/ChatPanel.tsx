'use client'

import { useState, useRef, useEffect } from 'react'
import React from 'react'
import { ChatMessage } from '@/lib/types'

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (React.isValidElement(node)) return extractText((node.props as { children?: React.ReactNode }).children)
  return ''
}
import { Send, Loader2, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

type ApplyLang = 'html' | 'css' | 'javascript'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSendMessage: (message: string) => void
  isProcessing: boolean
  onApplyCode: (lang: ApplyLang, code: string) => void
}

const LANG_LABEL: Record<string, string> = {
  html: 'HTML',
  css: 'CSS',
  javascript: 'JavaScript',
  js: 'JavaScript',
}

export function ChatPanel({ messages, onSendMessage, isProcessing, onApplyCode }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [appliedBlocks, setAppliedBlocks] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing) return
    onSendMessage(input)
    setInput('')
  }

  const handleApply = (lang: ApplyLang, code: string, blockId: string) => {
    onApplyCode(lang, code)
    setAppliedBlocks(prev => new Set([...prev, blockId]))
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
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-[#E1014A] text-white'
                    : 'bg-black text-white'
                }`}
              >
                {message.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown
                      components={{
                        pre: ({ children }) => {
                          // Haal taal en code op uit het <code> element binnen <pre>
                          const child = React.Children.toArray(children).find(
                            c => React.isValidElement(c) && (c as React.ReactElement).type === 'code'
                          ) as React.ReactElement<{ className?: string; children?: React.ReactNode }> | undefined

                          const className = child?.props?.className || ''
                          const match = /language-(\w+)/.exec(className)
                          const lang = match?.[1]
                          const rawCode = extractText(child?.props?.children).replace(/\n$/, '')

                          const applyLang = (lang === 'js' ? 'javascript' : lang) as ApplyLang
                          const canApply = !!lang && ['html', 'css', 'javascript', 'js'].includes(lang)
                          const blockId = `${message.id}-${lang}-${rawCode.slice(0, 30)}`
                          const isApplied = appliedBlocks.has(blockId)

                          return (
                            <div className="my-2">
                              <pre className="bg-gray-950 p-3 rounded text-xs overflow-x-auto border border-gray-800">
                                {children}
                              </pre>
                              {canApply && (
                                <button
                                  onClick={() => handleApply(applyLang, rawCode, blockId)}
                                  className={`mt-1 w-full text-xs py-2 px-3 rounded transition-all flex items-center gap-1.5 justify-center font-medium ${
                                    isApplied
                                      ? 'bg-green-900/40 text-green-400 border border-green-800/60'
                                      : 'bg-[#E1014A]/10 hover:bg-[#E1014A]/25 text-[#E1014A] border border-[#E1014A]/30'
                                  }`}
                                >
                                  {isApplied ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      Toegepast in {LANG_LABEL[lang!]}
                                    </>
                                  ) : (
                                    `▶ Toepassen in ${LANG_LABEL[lang!]}`
                                  )}
                                </button>
                              )}
                            </div>
                          )
                        },
                        code: ({ className, children, ...props }) => {
                          const isBlock = /language-(\w+)/.exec(className || '')
                          // Block code styling wordt door `pre` afgehandeld
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
                )}
              </div>
            </div>
          ))
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

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-900">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Vraag iets aan de AI..."
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
