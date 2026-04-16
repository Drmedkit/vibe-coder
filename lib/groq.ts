import OpenAI from 'openai'
import { ChatMode, EditPatch } from './types'

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  timeout: 55000,
})

export interface CodeContext {
  html: string
  css: string
  javascript: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIResponse {
  text: string
  codeUpdate?: { html?: string; css?: string; javascript?: string }
  editPatches?: EditPatch[]
  imageGenerated?: { url: string; prompt: string }
  imageRequest?: { prompt: string; assetType: string }
}

const MODELS = {
  agent: 'moonshotai/kimi-k2.5',
  qa: 'nvidia/nemotron-3-super-120b-a12b:free',
  edit: 'openai/gpt-5.4-nano',
  fallback: 'nvidia/nemotron-3-super-120b-a12b:free',
} as const

const SYSTEM_PROMPTS: Record<ChatMode, string> = {
  agent: `Je bent een vriendelijke AI programmeer-tutor voor beginners die leren werken met HTML, CSS en JavaScript.

Antwoord ALTIJD in het Nederlands met deze exacte tagstructuur:

<text>Jouw uitleg hier in het Nederlands</text>
<html>Volledige body HTML inhoud hier</html>
<css>Volledige CSS inhoud hier</css>
<js>Volledige JavaScript inhoud hier</js>
<image prompt="English image description" type="character|background|item|icon"/>

Regels:
- <text> is ALTIJD verplicht.
- Voeg <html>, <css>, <js> ALLEEN toe als je die code aanpast. Geef dan ALTIJD de VOLLEDIGE inhoud — nooit een fragment. HTML: alleen de body-inhoud, geen <html> of <head> tags.
- Voeg <image .../> ALLEEN toe als de student een afbeelding wil genereren.
- Gebruik je/jij, niet u. Houd het simpel en bemoedigend. Stel altijd een volgende stap voor.
- Geef ALLEEN de tags terug, geen extra tekst of markdown buiten de tags.`,

  qa: `Je bent een vriendelijke AI programmeer-tutor voor beginners die leren werken met HTML, CSS en JavaScript.

Antwoord ALTIJD in het Nederlands met deze exacte tagstructuur:

<text>Jouw uitleg hier in het Nederlands</text>

Regels:
- Alleen uitleg en antwoorden — pas NOOIT code aan.
- Houd het simpel, duidelijk en bemoedigend.
- Gebruik je/jij, niet u.
- Geef ALLEEN de <text> tag terug, niets anders buiten de tag.`,

  edit: `Je bent een precies code-editor voor beginners. Maak ALLEEN de gevraagde kleine aanpassing via zoek-en-vervang — verander NIETS anders.

Antwoord ALTIJD in het Nederlands met deze exacte tagstructuur:

<text>Korte uitleg van wat je hebt aangepast</text>
<edit file="html"><find>exacte tekst die vervangen moet worden</find><replace>nieuwe tekst</replace></edit>
<edit file="css"><find>exacte tekst die vervangen moet worden</find><replace>nieuwe tekst</replace></edit>
<edit file="js"><find>exacte tekst die vervangen moet worden</find><replace>nieuwe tekst</replace></edit>

Regels:
- <text> is ALTIJD verplicht.
- Gebruik <edit> tags — geef NOOIT de volledige bestandsinhoud terug.
- De <find> waarde moet EXACT overeenkomen met de huidige code (inclusief spaties en inspringing).
- Neem genoeg context op zodat de zoekterm uniek is (bijv. 1-2 omliggende regels).
- Meerdere <edit> tags zijn toegestaan.
- Alleen file="html", file="css" of file="js" — niets anders.
- Geef ALLEEN de tags terug, geen extra tekst of markdown buiten de tags.`,
}

// Reduced from 8192 — large completions were the primary cause of Vercel timeouts
const MAX_TOKENS: Record<ChatMode, number> = {
  agent: 4096,
  qa: 2048,
  edit: 4096,
}

function extractTag(raw: string, tag: string): string | undefined {
  const match = raw.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match?.[1]?.trim() || undefined
}

function extractEditPatches(raw: string): EditPatch[] {
  const patches: EditPatch[] = []
  const editRegex = /<edit\s+file="(html|css|js)">\s*<find>([\s\S]*?)<\/find>\s*<replace>([\s\S]*?)<\/replace>\s*<\/edit>/gi
  let match
  while ((match = editRegex.exec(raw)) !== null) {
    patches.push({
      file: match[1] as 'html' | 'css' | 'js',
      find: match[2],
      replace: match[3],
    })
  }
  return patches
}

function extractImageTag(raw: string): { prompt: string; assetType: string } | undefined {
  const match = raw.match(/<image\s+prompt="([^"]+)"\s+type="([^"]+)"\s*\/>/i)
    ?? raw.match(/<image\s+type="([^"]+)"\s+prompt="([^"]+)"\s*\/>/i)
  if (!match) return undefined
  const isPromptFirst = raw.match(/<image\s+prompt=/) !== null
  return isPromptFirst
    ? { prompt: match[1], assetType: match[2] }
    : { prompt: match[2], assetType: match[1] }
}

function buildMessages(
  userMessage: string,
  codeContext: CodeContext,
  chatHistory: ChatMessage[],
  mode: ChatMode
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const contextBlock = `--- HUIDIGE CODE ---
HTML:
${codeContext.html}

CSS:
${codeContext.css}

JavaScript:
${codeContext.javascript}
--- EINDE CODE ---`

  return [
    { role: 'system', content: SYSTEM_PROMPTS[mode] },
    { role: 'system', content: contextBlock },
    ...chatHistory.slice(-10).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ]
}

function parseRawResponse(raw: string, mode: ChatMode): AIResponse {
  if (mode === 'edit') {
    const text = extractTag(raw, 'text') ?? raw
    const patches = extractEditPatches(raw)
    return { text, editPatches: patches.length > 0 ? patches : undefined }
  }

  const text = extractTag(raw, 'text') ?? raw
  const html = extractTag(raw, 'html')
  const css = extractTag(raw, 'css')
  const js = extractTag(raw, 'js')
  const imageTag = extractImageTag(raw)

  const result: AIResponse = {
    text,
    codeUpdate: (html || css || js) ? { html, css, javascript: js } : undefined,
  }

  // Return image as a request for the frontend to handle asynchronously —
  // previously this was generated inline, which added 10-20s to every chat response
  if (imageTag && mode === 'agent') {
    result.imageRequest = { prompt: imageTag.prompt, assetType: imageTag.assetType }
  }

  return result
}

async function callModel(
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  maxTokens: number,
  signal?: AbortSignal
): Promise<string> {
  const response = await client.chat.completions.create(
    {
      model,
      messages,
      temperature: 0.7,
      max_tokens: maxTokens,
    },
    signal ? { signal } : undefined,
  )
  return response.choices[0]?.message?.content || ''
}

/**
 * Streams the AI response token-by-token, calling onDelta for each chunk.
 * Returns the fully parsed AIResponse once the stream completes.
 * Falls back to a non-streaming call if the primary model returns 402/429/404.
 */
export async function streamCodeResponse(
  userMessage: string,
  codeContext: CodeContext,
  chatHistory: ChatMessage[] = [],
  mode: ChatMode = 'agent',
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<AIResponse> {
  const messages = buildMessages(userMessage, codeContext, chatHistory, mode)
  let raw = ''

  try {
    const stream = await client.chat.completions.create(
      {
        model: MODELS[mode],
        messages,
        temperature: 0.7,
        max_tokens: MAX_TOKENS[mode],
        stream: true,
      },
      signal ? { signal } : undefined,
    )

    for await (const chunk of stream) {
      if (signal?.aborted) break
      const delta = chunk.choices[0]?.delta?.content || ''
      if (delta) {
        raw += delta
        onDelta(delta)
      }
    }
  } catch (e: unknown) {
    if (signal?.aborted) throw e
    const status = (e as { status?: number })?.status
    if (status === 402 || status === 429 || status === 404) {
      raw = await callModel(MODELS.fallback, messages, MAX_TOKENS[mode], signal)
    } else {
      throw e
    }
  }

  return parseRawResponse(raw, mode)
}

export async function generateCodeResponse(
  userMessage: string,
  codeContext: CodeContext,
  chatHistory: ChatMessage[] = [],
  mode: ChatMode = 'agent'
): Promise<AIResponse> {
  const messages = buildMessages(userMessage, codeContext, chatHistory, mode)
  let raw: string

  try {
    raw = await callModel(MODELS[mode], messages, MAX_TOKENS[mode])
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status
    if (status === 402 || status === 429 || status === 404) {
      raw = await callModel(MODELS.fallback, messages, MAX_TOKENS[mode])
    } else {
      throw e
    }
  }

  return parseRawResponse(raw, mode)
}
