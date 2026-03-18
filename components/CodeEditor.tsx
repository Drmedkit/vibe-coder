'use client'

import { Language } from '@/lib/types'
import { useEffect, useRef, useState } from 'react'

interface CodeEditorProps {
  code: string
  language: Language
  onChange: (value: string) => void
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function span(color: string, text: string, bold = false): string {
  const weight = bold ? '; font-weight: 500' : ''
  return `<span style="color:${color}${weight}">${text}</span>`
}

const BLUE = '#60C2D2'
const RED = '#E1014A'
const YELLOW = '#FEC603'
const DARK_BLUE = '#364B9B'
const GRAY = '#888'

// Single-pass CSS tokenizer — avoids regex-on-HTML corruption
function highlightCSS(code: string): string {
  let out = ''
  let i = 0
  let depth = 0 // 0 = selector area, >0 = inside block

  while (i < code.length) {
    // Block comment
    if (code[i] === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      const stop = end === -1 ? code.length : end + 2
      out += `<span style="color:${GRAY};font-style:italic">${esc(code.slice(i, stop))}</span>`
      i = stop
      continue
    }

    if (code[i] === '{') { out += '{'; depth++; i++; continue }
    if (code[i] === '}') { out += '}'; depth--; i++; continue }

    if (depth === 0) {
      // Selector: collect until '{'
      let j = i
      while (j < code.length && code[j] !== '{' && !(code[j] === '/' && code[j + 1] === '*')) j++
      if (j > i) { out += span(BLUE, esc(code.slice(i, j)), true); i = j }
      continue
    }

    // Inside block: whitespace passthrough
    if (/\s/.test(code[i])) { out += code[i]; i++; continue }

    // Property name — read until ':' or '}'
    let j = i
    while (j < code.length && code[j] !== ':' && code[j] !== '}' && code[j] !== '\n') j++

    if (j < code.length && code[j] === ':') {
      out += span(RED, esc(code.slice(i, j)))
      out += ':'
      i = j + 1
      // Value — read until ';' or '}'
      let k = i
      while (k < code.length && code[k] !== ';' && code[k] !== '}') k++
      out += span(YELLOW, esc(code.slice(i, k)))
      if (k < code.length && code[k] === ';') { out += ';'; k++ }
      i = k
    } else {
      out += esc(code.slice(i, j))
      i = j
    }
  }
  return out
}

// Single-pass HTML tokenizer
function highlightHTML(code: string): string {
  let out = ''
  let i = 0

  while (i < code.length) {
    if (code[i] !== '<') {
      // Text content
      let j = i
      while (j < code.length && code[j] !== '<') j++
      out += esc(code.slice(i, j))
      i = j
      continue
    }

    // Tag: collect everything until '>'
    let j = i + 1
    while (j < code.length && code[j] !== '>') {
      if (code[j] === '"') { j++; while (j < code.length && code[j] !== '"') j++ }
      j++
    }
    const tag = code.slice(i, j + 1) // includes < and >
    out += colorizeHTMLTag(tag)
    i = j + 1
  }
  return out
}

function colorizeHTMLTag(tag: string): string {
  // tag is e.g. '<div class="foo">' or '</div>'
  let out = ''
  let i = 0

  // Opening '<' and optional '/'
  out += '&lt;'
  i = 1
  if (i < tag.length && tag[i] === '/') { out += '/'; i++ }

  // Tag name
  let j = i
  while (j < tag.length && /[a-zA-Z0-9]/.test(tag[j])) j++
  out += span(BLUE, esc(tag.slice(i, j)), true)
  i = j

  // Attributes
  while (i < tag.length && tag[i] !== '>' && tag[i] !== '/') {
    // Whitespace
    if (/\s/.test(tag[i])) { out += tag[i]; i++; continue }

    // Attribute name
    let k = i
    while (k < tag.length && tag[k] !== '=' && tag[k] !== '>' && tag[k] !== ' ') k++
    const attrName = tag.slice(i, k)
    i = k

    if (tag[i] === '=') {
      out += span(RED, esc(attrName))
      out += '='
      i++
      // Attribute value
      if (tag[i] === '"') {
        let m = i + 1
        while (m < tag.length && tag[m] !== '"') m++
        out += span(YELLOW, `&quot;${esc(tag.slice(i + 1, m))}&quot;`)
        i = m + 1
      }
    } else {
      out += esc(attrName)
    }
  }

  if (i < tag.length && tag[i] === '/') { out += '/'; i++ }
  out += '&gt;'
  return out
}

// Single-pass JS tokenizer
function highlightJS(code: string): string {
  const KEYWORDS = new Set(['const', 'let', 'var', 'function', 'if', 'else', 'for', 'while',
    'return', 'class', 'new', 'this', 'async', 'await', 'try', 'catch', 'throw',
    'import', 'export', 'from', 'default', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined'])
  let out = ''
  let i = 0

  while (i < code.length) {
    // Line comment
    if (code[i] === '/' && code[i + 1] === '/') {
      let j = i
      while (j < code.length && code[j] !== '\n') j++
      out += `<span style="color:${GRAY};font-style:italic">${esc(code.slice(i, j))}</span>`
      i = j
      continue
    }
    // Block comment
    if (code[i] === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      const stop = end === -1 ? code.length : end + 2
      out += `<span style="color:${GRAY};font-style:italic">${esc(code.slice(i, stop))}</span>`
      i = stop
      continue
    }
    // String
    if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
      const quote = code[i]
      let j = i + 1
      while (j < code.length && code[j] !== quote) {
        if (code[j] === '\\') j++ // skip escape
        j++
      }
      out += span(YELLOW, esc(code.slice(i, j + 1)))
      i = j + 1
      continue
    }
    // Number
    if (/\d/.test(code[i]) && (i === 0 || /\W/.test(code[i - 1]))) {
      let j = i
      while (j < code.length && /[\d.]/.test(code[j])) j++
      out += span(YELLOW, esc(code.slice(i, j)))
      i = j
      continue
    }
    // Word (keyword or identifier)
    if (/[a-zA-Z_$]/.test(code[i])) {
      let j = i
      while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j])) j++
      const word = code.slice(i, j)
      // Check if followed by '(' — function call
      let k = j
      while (k < code.length && code[k] === ' ') k++
      if (code[k] === '(') {
        out += KEYWORDS.has(word) ? span(DARK_BLUE, esc(word), true) : span(BLUE, esc(word))
      } else if (KEYWORDS.has(word)) {
        out += span(DARK_BLUE, esc(word), true)
      } else {
        out += esc(word)
      }
      i = j
      continue
    }
    out += esc(code[i])
    i++
  }
  return out
}

function highlightCode(code: string, language: Language): string {
  if (language === Language.CSS) return highlightCSS(code)
  if (language === Language.HTML) return highlightHTML(code)
  if (language === Language.JAVASCRIPT) return highlightJS(code)
  return esc(code)
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
          className="absolute inset-0 w-full h-full bg-gray-900 text-gray-300 font-mono text-sm p-4 overflow-auto pointer-events-none"
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
