import OpenAI from 'openai'
import { generateGameAsset } from './imageGeneration'
import { ChatMode } from './types'

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
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
  imageGenerated?: { url: string; prompt: string }
}

const MODELS = {
  agent: 'moonshotai/kimi-k2.5',
  qa: 'nvidia/nemotron-super-49b-v1',
  edit: 'openai/gpt-4.1-nano',
  fallback: 'nvidia/nemotron-super-49b-v1',
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

  edit: `Je bent een precies code-editor voor beginners. Maak ALLEEN de gevraagde kleine aanpassing — verander niets anders.

Antwoord ALTIJD in het Nederlands met deze exacte tagstructuur:

<text>Kort wat je hebt aangepast</text>
<html>Volledige body HTML inhoud hier</html>
<css>Volledige CSS inhoud hier</css>
<js>Volledige JavaScript inhoud hier</js>

Regels:
- <text> is ALTIJD verplicht — beschrijf in één zin wat je hebt aangepast.
- Voeg <html>, <css>, <js> ALLEEN toe voor het bestand dat je wijzigt. Geef dan ALTIJD de VOLLEDIGE inhoud — nooit een fragment.
- Pas NIETS aan wat niet gevraagd is.
- Geen <image/> tag in deze mode.
- Geef ALLEEN de tags terug, geen extra tekst of markdown buiten de tags.`,
}

const MAX_TOKENS: Record<ChatMode, number> = {
  agent: 8192,
  qa: 2048,
  edit: 4096,
}

function extractTag(raw: string, tag: string): string | undefined {
  const match = raw.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match?.[1]?.trim() || undefined
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

function parseAIResponse(raw: string): AIResponse & { _generateImage?: { prompt: string; assetType: string } } {
  const text = extractTag(raw, 'text') ?? raw
  const html = extractTag(raw, 'html')
  const css = extractTag(raw, 'css')
  const js = extractTag(raw, 'js')
  const imageRequest = extractImageTag(raw)

  return {
    text,
    codeUpdate: (html || css || js) ? { html, css, javascript: js } : undefined,
    _generateImage: imageRequest,
  }
}

async function callModel(
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  maxTokens: number
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.7,
    max_tokens: maxTokens,
  })
  return response.choices[0]?.message?.content || ''
}

export async function generateCodeResponse(
  userMessage: string,
  codeContext: CodeContext,
  chatHistory: ChatMessage[] = [],
  mode: ChatMode = 'agent'
): Promise<AIResponse> {
  const contextBlock = `--- HUIDIGE CODE ---
HTML:
${codeContext.html}

CSS:
${codeContext.css}

JavaScript:
${codeContext.javascript}
--- EINDE CODE ---`

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPTS[mode] },
    // Q&A still gets code context so it can answer questions about it
    { role: 'system', content: contextBlock },
    ...chatHistory.slice(-10).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ]

  let raw: string
  try {
    raw = await callModel(MODELS[mode], messages, MAX_TOKENS[mode])
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status
    if (status === 402 || status === 429) {
      // Out of credits or rate limited — fall back to nemotron
      raw = await callModel(MODELS.fallback, messages, MAX_TOKENS[mode])
    } else {
      throw e
    }
  }

  const result = parseAIResponse(raw)

  // Image generation only in agent mode
  if (result._generateImage && mode === 'agent') {
    const { prompt, assetType } = result._generateImage
    delete result._generateImage

    try {
      const { prisma } = await import('./prisma')
      const dataUrl = await generateGameAsset(prompt, assetType as 'character' | 'background' | 'item' | 'icon')
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
      const asset = await prisma.asset.create({
        data: { prompt, assetType, data: base64, mimeType: 'image/png' },
      })
      const url = `/api/images/${asset.id}`
      result.imageGenerated = { url, prompt }

      const imgTag = `<img src="${url}" alt="${prompt}" style="max-width:100%;">`
      const currentHtml = result.codeUpdate?.html ?? codeContext.html
      result.codeUpdate = { ...result.codeUpdate, html: currentHtml + '\n' + imgTag }
    } catch (e) {
      console.error('Image generation failed:', e)
      result.text += '\n\n(Afbeelding genereren mislukt, probeer de Assets knop.)'
    }
  } else {
    delete result._generateImage
  }

  return result
}
