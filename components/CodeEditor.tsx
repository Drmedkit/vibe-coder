'use client'

import CodeMirror from '@uiw/react-codemirror'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { useMemo } from 'react'
import { Language } from '@/lib/types'

interface CodeEditorProps {
  code: string
  language: Language
  onChange: (value: string) => void
}

const LANGUAGE_LABEL: Record<Language.HTML | Language.CSS | Language.JAVASCRIPT, string> = {
  [Language.HTML]: 'HTML',
  [Language.CSS]: 'CSS',
  [Language.JAVASCRIPT]: 'JavaScript',
}

export function CodeEditor({ code, language, onChange }: CodeEditorProps) {
  const extensions = useMemo(() => {
    if (language === Language.HTML) return [html()]
    if (language === Language.CSS) return [css()]
    return [javascript({ jsx: false, typescript: false })]
  }, [language])

  return (
    <div className="flex h-full flex-col bg-[#111111]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 bg-[#161616] px-4">
        <span className="font-mono text-xs font-semibold text-white/70">
          {LANGUAGE_LABEL[language as Language.HTML | Language.CSS | Language.JAVASCRIPT]}
        </span>
        <span className="text-xs text-white/35">live preview actief</span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeMirror
          value={code}
          height="100%"
          theme={oneDark}
          extensions={extensions}
          onChange={onChange}
          basicSetup={{
            autocompletion: true,
            bracketMatching: true,
            closeBrackets: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            lineNumbers: true,
          }}
        />
      </div>
    </div>
  )
}
