'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Monitor } from 'lucide-react'
import { CodeState, ProjectBrief, ProjectPhase } from '@/lib/types'
import { isCodeEmpty } from '@/lib/projectFlow'

interface PreviewProps {
  code: CodeState
  phase?: ProjectPhase
  brief?: ProjectBrief
}

interface PreviewMessage {
  id: number
  level: 'error' | 'log'
  text: string
}

function escapeScript(code: string): string {
  return code.replace(/<\/script/gi, '<\\/script')
}

function buildSrcDoc(code: CodeState): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${code.css}</style>
  </head>
  <body>
    ${code.html}
    <script>
      (function () {
        var send = function (level, args) {
          try {
            window.parent.postMessage({
              source: 'vibe-preview',
              level: level,
              text: Array.prototype.slice.call(args).map(function (item) {
                if (item && item.message) return item.message;
                if (typeof item === 'object') return JSON.stringify(item);
                return String(item);
              }).join(' ')
            }, '*');
          } catch (error) {}
        };
        var originalLog = console.log;
        var originalError = console.error;
        console.log = function () {
          send('log', arguments);
          originalLog.apply(console, arguments);
        };
        console.error = function () {
          send('error', arguments);
          originalError.apply(console, arguments);
        };
        window.addEventListener('error', function (event) {
          send('error', [event.message]);
        });
        window.addEventListener('unhandledrejection', function (event) {
          send('error', [event.reason && event.reason.message ? event.reason.message : event.reason]);
        });
      })();
      try {
        ${escapeScript(code.javascript)}
      } catch (error) {
        console.error('JavaScript Error:', error);
      }
    </script>
  </body>
</html>`
}

export function Preview({ code, phase, brief }: PreviewProps) {
  const [messages, setMessages] = useState<PreviewMessage[]>([])
  const srcDoc = useMemo(() => buildSrcDoc(code), [code])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.source !== 'vibe-preview') return
      setMessages(prev => [
        ...prev.slice(-7),
        {
          id: Date.now() + Math.random(),
          level: event.data.level === 'error' ? 'error' : 'log',
          text: String(event.data.text || ''),
        },
      ])
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const errors = messages.filter(message => message.level === 'error')
  const empty = isCodeEmpty(code)

  return (
    <div className="flex h-full flex-col bg-[#101010]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 bg-[#161616] px-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white/75">
          <Monitor size={16} />
          Preview
        </div>
        {errors.length > 0 && (
          <span className="flex items-center gap-1 rounded bg-[#DD084B]/15 px-2 py-1 text-xs text-white">
            <AlertTriangle size={13} />
            {errors.length} fout{errors.length === 1 ? '' : 'en'}
          </span>
        )}
      </div>

      <div className={`relative min-h-0 flex-1 ${empty ? 'bg-[#101010] h20-square-texture' : 'bg-white'}`}>
        {empty ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-sm rounded-md border border-white/10 bg-[#161616]/90 p-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <p className="font-display text-2xl font-black leading-none text-white">NOG GEEN BUILD</p>
              <p className="mt-3 text-sm leading-relaxed text-white/50">
                Beschrijf eerst je idee. De eerste build wordt beter als jij keuzes maakt.
              </p>
              {brief?.rawIdea && phase !== 'empty' && (
                <p className="mt-4 rounded border border-white/10 bg-black/25 px-3 py-2 text-left text-xs leading-relaxed text-white/45">
                  {brief.rawIdea}
                </p>
              )}
            </div>
          </div>
        ) : (
          <iframe
            key={srcDoc}
            srcDoc={srcDoc}
            className="absolute inset-0 h-full w-full border-none"
            sandbox="allow-scripts allow-modals"
            title="Preview"
          />
        )}
      </div>

      {!empty && messages.length > 0 && (
        <div className="max-h-32 overflow-y-auto border-t border-white/10 bg-[#111111] px-3 py-2 font-mono text-[11px]">
          {messages.map(message => (
            <div
              key={message.id}
              className={message.level === 'error' ? 'text-[#ff7aa5]' : 'text-white/55'}
            >
              {message.level === 'error' ? 'error' : 'log'}: {message.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
