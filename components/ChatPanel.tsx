'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '@/lib/types'
import { Send, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface ChatPanelProps {
  messages: ChatMessage[]
  onSendMessage: (message: string) => void
  isProcessing: boolean
}

export function ChatPanel({ messages, onSendMessage, isProcessing }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isProcessing) return

    onSendMessage(input)
    setInput('')
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300">AI Assistent</h2>
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
                        code: ({ className, children, ...props }) => {
                          const match = /language-(\w+)/.exec(className || '')
                          const isInline = !match

                          return isInline ? (
                            <code className="bg-gray-700 px-1 py-0.5 rounded text-xs" {...props}>
                              {children}
                            </code>
                          ) : (
                            <code className={`block bg-gray-950 p-2 rounded text-xs overflow-x-auto ${className}`} {...props}>
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
            <div className="bg-gray-800 rounded-lg px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-[#E1014A]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Vraag iets aan de AI..."
            className="flex-1 bg-gray-800 text-gray-100 text-sm rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#E1014A]"
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
