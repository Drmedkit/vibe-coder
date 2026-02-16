'use client'

import { Language } from '@/lib/types'
import { useEffect, useRef, useState } from 'react'

interface CodeEditorProps {
  code: string
  language: Language
  onChange: (value: string) => void
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function highlightCode(code: string, language: Language): string {
  // First escape HTML
  let highlighted = escapeHtml(code)

  if (language === Language.HTML) {
    // HTML tags in PAUSE BLUE
    highlighted = highlighted.replace(/(&lt;\/?)([a-zA-Z0-9]+)/g, '$1<span style="color: #60C2D2; font-weight: 500">$2</span>')
    // Attributes in PLAY RED
    highlighted = highlighted.replace(/\s([a-zA-Z-]+)=/g, ' <span style="color: #E1014A">$1</span>=')
    // String values in LIVE YELLOW
    highlighted = highlighted.replace(/=&quot;([^&]*)&quot;/g, '=<span style="color: #FEC603">&quot;$1&quot;</span>')
  } else if (language === Language.CSS) {
    // Selectors and keywords in PAUSE BLUE
    highlighted = highlighted.replace(/^([.#]?[a-zA-Z0-9_-]+)(\s*\{)/gm, '<span style="color: #60C2D2; font-weight: 500">$1</span>$2')
    highlighted = highlighted.replace(/(@[a-zA-Z-]+)/g, '<span style="color: #60C2D2">$1</span>')
    // Properties in PLAY RED
    highlighted = highlighted.replace(/\s+([a-zA-Z-]+):/g, ' <span style="color: #E1014A">$1</span>:')
    // Values and units in LIVE YELLOW
    highlighted = highlighted.replace(/:([^;{}\n]+)/g, (match, value) => {
      return ':<span style="color: #FEC603">' + value + '</span>'
    })
    // Comments
    highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color: #888; font-style: italic">$1</span>')
  } else if (language === Language.JAVASCRIPT) {
    // Comments first (to avoid highlighting keywords in comments)
    highlighted = highlighted.replace(/(\/\/.*$)/gm, '<span style="color: #888; font-style: italic">$1</span>')
    highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color: #888; font-style: italic">$1</span>')

    // Keywords in QUIT BLUE
    const keywords = ['const', 'let', 'var', 'function', 'if', 'else', 'for', 'while', 'return', 'class', 'new', 'this', 'async', 'await', 'try', 'catch', 'throw', 'import', 'export', 'from', 'default']
    keywords.forEach(keyword => {
      highlighted = highlighted.replace(new RegExp(`\\b(${keyword})\\b(?![^<]*<\/span>)`, 'g'), '<span style="color: #364B9B; font-weight: 500">$1</span>')
    })

    // Function names in PAUSE BLUE
    highlighted = highlighted.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, '<span style="color: #60C2D2">$1</span>(')

    // Strings in LIVE YELLOW (avoid already highlighted content)
    highlighted = highlighted.replace(/&quot;([^&]*?)&quot;/g, '<span style="color: #FEC603">&quot;$1&quot;</span>')
    highlighted = highlighted.replace(/&#039;([^&]*?)&#039;/g, '<span style="color: #FEC603">&#039;$1&#039;</span>')

    // Numbers in LIVE YELLOW
    highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span style="color: #FEC603">$1</span>')
  }

  return highlighted
}

export function CodeEditor({ code, language, onChange }: CodeEditorProps) {
  const [highlightedCode, setHighlightedCode] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    setHighlightedCode(highlightCode(code, language))
  }, [code, language])

  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="flex-1 relative overflow-hidden">
        {/* Syntax highlighting layer */}
        <pre
          ref={highlightRef}
          className="absolute inset-0 w-full h-full bg-gray-900 text-transparent font-mono text-sm p-4 overflow-auto pointer-events-none"
          style={{
            tabSize: 2,
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />

        {/* Editable textarea */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          className="absolute inset-0 w-full h-full bg-transparent font-mono text-sm p-4 resize-none focus:outline-none border-none"
          placeholder={`// Start coding in ${language.toUpperCase()}...`}
          spellCheck={false}
          style={{
            tabSize: 2,
            lineHeight: '1.5',
            color: 'transparent',
            caretColor: '#60C2D2',
            WebkitTextFillColor: 'transparent',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
        />
      </div>
    </div>
  )
}
