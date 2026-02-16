'use client'

import { Language } from '@/lib/types'

interface CodeEditorProps {
  code: string
  language: Language
  onChange: (value: string) => void
}

export function CodeEditor({ code, language, onChange }: CodeEditorProps) {
  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="flex-1 relative">
        <textarea
          value={code}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full bg-gray-900 text-gray-100 font-mono text-sm p-4 resize-none focus:outline-none border-none"
          placeholder={`// Start coding in ${language.toUpperCase()}...`}
          spellCheck={false}
          style={{
            tabSize: 2,
            lineHeight: '1.5',
          }}
        />
      </div>
    </div>
  )
}
