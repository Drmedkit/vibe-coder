'use client'

import { useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { css } from '@codemirror/lang-css'
import { oneDark } from '@codemirror/theme-one-dark'
import { SourceFile } from '@/lib/v2/types'

export function SourceEditor({
  file,
  onChange,
}: {
  file: SourceFile
  onChange: (content: string) => void
}) {
  const extensions = useMemo(() => file.path.endsWith('.css')
    ? [css()]
    : [javascript({ jsx: true, typescript: file.path.endsWith('.ts') || file.path.endsWith('.tsx') })], [file.path])

  return (
    <CodeMirror
      value={file.content}
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
        lineNumbers: true,
      }}
    />
  )
}
