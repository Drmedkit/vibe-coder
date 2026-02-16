'use client'

import { useEffect, useRef } from 'react'
import { CodeState } from '@/lib/types'

interface PreviewProps {
  code: CodeState
}

export function Preview({ code }: PreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const document = iframe.contentDocument
    if (!document) return

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>${code.css}</style>
        </head>
        <body>
          ${code.html}
          <script>
            try {
              ${code.javascript}
            } catch (error) {
              console.error('JavaScript Error:', error);
            }
          </script>
        </body>
      </html>
    `

    document.open()
    document.write(html)
    document.close()
  }, [code])

  return (
    <div className="h-full flex flex-col bg-gray-950">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-300">Preview</h2>
      </div>
      <div className="flex-1 relative bg-white">
        <iframe
          ref={iframeRef}
          className="absolute inset-0 w-full h-full border-none"
          sandbox="allow-scripts allow-modals"
          title="Preview"
        />
      </div>
    </div>
  )
}
