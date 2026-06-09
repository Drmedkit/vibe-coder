import OpenAI from 'openai'
import { generateGameAsset } from './imageGeneration'
import {
  AIIntent,
  BriefReadiness,
  ChatAction,
  ChatWorkspaceContext,
  EditPatch,
  ProjectBrief,
} from './types'
import { getBriefReadiness, inferIntent, mergeBriefPatch, normalizeBrief } from './projectFlow'

export { extractTag, extractEditPatches } from './parseAI'

const useXAI = Boolean(process.env.XAI_API_KEY)

const client = new OpenAI({
  baseURL: useXAI ? 'https://api.x.ai/v1' : 'https://openrouter.ai/api/v1',
  apiKey: useXAI ? process.env.XAI_API_KEY : process.env.OPENROUTER_API_KEY,
})

// A 402 means the provider credits are exhausted. Skip paid models for a
// cooldown window instead of permanently, so the app heals itself after a
// top-up and one student's 402 doesn't degrade the whole class forever.
const PAID_MODEL_COOLDOWN_MS = 10 * 60 * 1000
let paidModelsDisabledUntil = 0

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
  intent: AIIntent
  text: string
  codeUpdate?: { html?: string; css?: string; javascript?: string }
  editPatches?: EditPatch[]
  imageGenerated?: { url: string; prompt: string }
  questions?: string[]
  suggestions?: string[]
  briefPatch?: Partial<ProjectBrief>
  readiness?: BriefReadiness
  included?: string[]
  notIncludedYet?: string[]
  nextPolishSuggestions?: string[]
  findings?: string[]
  suggestedAdjustments?: string[]
  usingFallback?: boolean
}

const XAI_MODEL = 'grok-4.3'
const OPENROUTER_FREE_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free'
const OPENROUTER_FAST_MODEL = 'google/gemini-2.5-flash-lite'
const OPENROUTER_BUILD_MODEL = 'google/gemini-2.5-flash'

const OPENROUTER_MODEL_CHAIN: Record<AIIntent, readonly string[]> = {
  director: [OPENROUTER_FAST_MODEL, OPENROUTER_FREE_MODEL],
  inspect: [OPENROUTER_FAST_MODEL, OPENROUTER_FREE_MODEL],
  adjust: [OPENROUTER_FAST_MODEL, OPENROUTER_BUILD_MODEL],
  first_build: [OPENROUTER_BUILD_MODEL, OPENROUTER_FAST_MODEL],
  major_rebuild: [OPENROUTER_BUILD_MODEL, OPENROUTER_FAST_MODEL],
}

const SYSTEM_PROMPTS: Record<AIIntent, string> = {
  director: `Je bent creative director voor jongeren die digitale projecten bouwen.
Je taak is om snel genoeg richting te krijgen voor een kleine eerste build. Maak het proces licht.

Antwoord ALLEEN met geldig JSON:
{
  "text": "Korte Nederlandse reactie. Benoem wat scherp is en wat nog generiek voelt.",
  "questions": ["maximaal 1 gerichte vraag, leeg als er genoeg is voor een kleine build"],
  "suggestions": ["maximaal 2 concrete richtingen waar de student op kan reageren"],
  "briefPatch": {
    "rawIdea": "alleen de eigen woorden of bevestigde richting van de student",
    "goal": "optioneel",
    "coreExperience": "optioneel",
    "mustHaves": ["alleen bevestigde must-haves"],
    "styleNotes": ["alleen bevestigde stijl of gevoel"],
    "constraints": ["optioneel"],
    "confirmedChoices": ["alleen keuzes die de student bevestigde"],
    "unresolvedQuestions": ["open vragen"],
    "qualityBar": "optioneel"
  }
}

Regels:
- Geef geen code, geen codeUpdate, geen editPatches en geen image.
- Stel niet standaard meerdere vragen.
- Als het idee een duidelijke actie of object heeft, is dat genoeg voor een kleine eerste build.
- Gebruik suggesties om ontbrekende details zelf licht in te vullen, niet om de student te ondervragen.
- Benoem kort wanneer iets generiek voelt, zonder af te kraken.
- Vat alleen bevestigde keuzes samen.
- Push snel richting een eerste build die klein genoeg is om op door te werken.
- Als de brief klaar is, zeg: "We weten genoeg voor een kleine eerste build."
- Gebruik duidelijke taal voor 10-16 jaar, maar niet kinderachtig.
- Geen markdown, geen tekst buiten JSON.`,

  first_build: `Je bouwt nu de eerste werkende versie voor een student.
Doel: klein maar werkend. Maak een compacte eerste versie die direct speelbaar of bruikbaar voelt.
Gebruik de projectbrief als bron van waarheid.

Antwoord ALLEEN met geldig JSON:
{
  "text": "Korte Nederlandse uitleg van de eerste build.",
  "codeUpdate": {
    "html": "volledige body HTML, zonder html/head/body tags",
    "css": "volledige CSS",
    "javascript": "volledige JavaScript"
  },
  "included": ["wat zit erin"],
  "notIncludedYet": ["wat bewust nog niet"],
  "nextPolishSuggestions": ["logische volgende verbeteringen"]
}

Regels:
- codeUpdate is verplicht en bevat altijd html, css en javascript.
- Gebruik geen editPatches voor de eerste build.
- Vul ontbrekende details zelf simpel in wanneer de student een duidelijke vibe of kernactie geeft.
- Bouw maximaal 1 duidelijke kernactie en 1 simpele feedback-loop.
- Geen menu's, levels, shop, complexe assets of extra schermen tenzij de student dat expliciet vraagt.
- Houd de code compact en begrijpelijk voor beginners.
- Maak UI en interactie af genoeg om meteen te testen.
- HTML is alleen body-inhoud, geen html/head/body tags.
- Gebruik geen image request in de eerste build. Gebruik CSS, tekst, simpele vormen of bestaande emoji/tekens.
- Geen markdown, geen tekst buiten JSON.`,

  inspect: `Je onderzoekt het project van de student.
Leg uit wat gebeurt, wat sterk is, wat zwak is en welke volgende verbetering zinvol is.

Antwoord ALLEEN met geldig JSON:
{
  "text": "Heldere Nederlandse uitleg.",
  "findings": ["concrete observaties"],
  "suggestedAdjustments": ["zinvolle volgende kleine verbeteringen"]
}

Regels:
- Inspect verandert nooit code.
- Geef geen codeUpdate, editPatches of image.
- Leg concreet uit wat er in HTML/CSS/JS gebeurt wanneer dat relevant is.
- Geef advies rond het project van de student, geen los lesverhaal.
- Geen markdown, geen tekst buiten JSON.`,

  adjust: `Je maakt een kleine verbetering aan het bestaande project.
Gebruik patches als het kan. Verander alleen wat gevraagd is.

Antwoord ALLEEN met geldig JSON:
{
  "text": "Korte Nederlandse uitleg van wat verandert.",
  "editPatches": [
    { "file": "html", "find": "exacte bestaande tekst", "replace": "nieuwe tekst" }
  ],
  "codeUpdate": {
    "html": "volledige HTML als patches niet betrouwbaar zijn",
    "css": "volledige CSS als patches niet betrouwbaar zijn",
    "javascript": "volledige JavaScript als patches niet betrouwbaar zijn"
  },
  "image": { "prompt": "English image description", "assetType": "item" }
}

Regels:
- Patches hebben voorkeur bij kleine aanpassingen.
- Gebruik codeUpdate alleen als de wijziging groter is of patches te fragiel zijn.
- Behoud stijl, idee en bestaande werking van de student.
- Verander alleen wat gevraagd is.
- HTML is alleen body-inhoud, geen html/head/body tags.
- Gebruik image alleen als de student om een afbeelding/asset vraagt.
- Geen markdown, geen tekst buiten JSON.`,

  major_rebuild: `Je mag een grotere rebuild voorstellen of uitvoeren, maar alleen met preserve/replace context.
Behoud expliciet genoemde onderdelen. Maak opnieuw structuur als dat nodig is.

Antwoord ALLEEN met geldig JSON:
{
  "text": "Korte Nederlandse uitleg van de rebuild of waarom bevestiging nodig is.",
  "codeUpdate": {
    "html": "volledige body HTML als je de rebuild uitvoert",
    "css": "volledige CSS als je de rebuild uitvoert",
    "javascript": "volledige JavaScript als je de rebuild uitvoert"
  },
  "included": ["wat blijft of nieuw is"],
  "notIncludedYet": ["wat bewust nog niet"],
  "nextPolishSuggestions": ["logische volgende verbeteringen"]
}

Regels:
- Vraag om bevestiging als preserve/replace niet duidelijk is.
- Als je codeUpdate geeft, geef volledige html, css en javascript.
- Behoud expliciet genoemde onderdelen.
- Geen markdown, geen tekst buiten JSON.`,
}

const MAX_TOKENS: Record<AIIntent, number> = {
  director: 900,
  first_build: 3000,
  inspect: 1800,
  adjust: 2200,
  major_rebuild: 3400,
}

type AIJson = {
  text?: string
  questions?: unknown
  suggestions?: unknown
  briefPatch?: unknown
  readiness?: unknown
  included?: unknown
  notIncludedYet?: unknown
  nextPolishSuggestions?: unknown
  findings?: unknown
  suggestedAdjustments?: unknown
  codeUpdate?: {
    html?: unknown
    css?: unknown
    javascript?: unknown
    js?: unknown
  }
  editPatches?: unknown
  image?: {
    prompt?: string
    assetType?: string
    type?: string
  }
}

type ParsedAIResponse = AIResponse & { _generateImage?: { prompt: string; assetType: string } }

const VALID_ASSET_TYPES = new Set(['character', 'background', 'item', 'icon'])

function normalizeStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map(item => item.trim())
    .slice(0, maxItems)
}

function normalizeEditPatches(value: unknown): EditPatch[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((patch): patch is EditPatch => {
      if (!patch || typeof patch !== 'object') return false
      const candidate = patch as Partial<EditPatch>
      return (
        (candidate.file === 'html' || candidate.file === 'css' || candidate.file === 'js') &&
        typeof candidate.find === 'string' &&
        typeof candidate.replace === 'string' &&
        candidate.find.length > 0
      )
    })
    .map(patch => ({ file: patch.file, find: patch.find, replace: patch.replace }))
}

function normalizeBriefPatch(value: unknown): Partial<ProjectBrief> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Partial<ProjectBrief>
  const patch: Partial<ProjectBrief> = {}

  if (typeof input.rawIdea === 'string' && input.rawIdea.trim()) patch.rawIdea = input.rawIdea.trim()
  if (typeof input.goal === 'string' && input.goal.trim()) patch.goal = input.goal.trim()
  if (typeof input.coreExperience === 'string' && input.coreExperience.trim()) patch.coreExperience = input.coreExperience.trim()
  if (Array.isArray(input.mustHaves)) patch.mustHaves = normalizeStringArray(input.mustHaves, 8)
  if (Array.isArray(input.styleNotes)) patch.styleNotes = normalizeStringArray(input.styleNotes, 6)
  if (Array.isArray(input.constraints)) patch.constraints = normalizeStringArray(input.constraints, 6)
  if (Array.isArray(input.confirmedChoices)) patch.confirmedChoices = normalizeStringArray(input.confirmedChoices, 8)
  if (Array.isArray(input.unresolvedQuestions)) patch.unresolvedQuestions = normalizeStringArray(input.unresolvedQuestions, 8)
  if (typeof input.qualityBar === 'string' && input.qualityBar.trim()) patch.qualityBar = input.qualityBar.trim()

  return Object.keys(patch).length > 0 ? patch : undefined
}

function parseJsonResponse(raw: string): AIJson | undefined {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  const candidate = fenced?.[1] ?? (start >= 0 && end > start ? trimmed.slice(start, end + 1) : '')
  if (!candidate) return undefined

  try {
    return JSON.parse(candidate) as AIJson
  } catch {
    return undefined
  }
}

function validateCodeUpdate(
  value: AIJson['codeUpdate'],
  errors: string[],
  options: { requireFull: boolean }
) {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object') {
    errors.push('codeUpdate moet een object zijn.')
    return undefined
  }

  const html = typeof value.html === 'string' ? value.html : undefined
  const css = typeof value.css === 'string' ? value.css : undefined
  const jsValue = value.javascript ?? value.js
  const javascript = typeof jsValue === 'string' ? jsValue : undefined

  if (options.requireFull && (html === undefined || css === undefined || javascript === undefined)) {
    errors.push('codeUpdate moet volledige html, css en javascript bevatten.')
    return undefined
  }

  if (!html?.trim() && !css?.trim() && !javascript?.trim()) {
    errors.push('codeUpdate moet minimaal een niet-lege html, css of javascript string bevatten.')
    return undefined
  }

  return { html, css, javascript }
}

function validateImageRequest(value: AIJson['image'], errors: string[]) {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object') {
    errors.push('image moet een object zijn.')
    return undefined
  }

  const prompt = value.prompt?.trim()
  const assetType = value.assetType ?? value.type

  if (!prompt) errors.push('image.prompt is verplicht wanneer image wordt gebruikt.')
  if (!assetType || !VALID_ASSET_TYPES.has(assetType)) {
    errors.push('image.assetType moet character, background, item of icon zijn.')
  }

  return prompt && assetType && VALID_ASSET_TYPES.has(assetType)
    ? { prompt, assetType }
    : undefined
}

export function parseAndValidateAIResponse(raw: string, intent: AIIntent): {
  result?: ParsedAIResponse
  errors: string[]
} {
  const errors: string[] = []
  const parsed = parseJsonResponse(raw)
  if (!parsed) {
    return { errors: ['Antwoord is geen geldig JSON-object.'] }
  }

  const text = parsed.text?.trim()
  if (!text) errors.push('text is verplicht en moet een niet-lege string zijn.')

  const questions = normalizeStringArray(parsed.questions, intent === 'director' ? 1 : 3)
  const suggestions = normalizeStringArray(parsed.suggestions, intent === 'director' ? 2 : 4)
  const included = normalizeStringArray(parsed.included, 6)
  const notIncludedYet = normalizeStringArray(parsed.notIncludedYet, 6)
  const nextPolishSuggestions = normalizeStringArray(parsed.nextPolishSuggestions, 6)
  const findings = normalizeStringArray(parsed.findings, 8)
  const suggestedAdjustments = normalizeStringArray(parsed.suggestedAdjustments, 6)

  const editPatches = normalizeEditPatches(parsed.editPatches)
  const codeUpdate = validateCodeUpdate(parsed.codeUpdate, errors, {
    requireFull: intent === 'first_build' || intent === 'major_rebuild',
  })
  const imageRequest = validateImageRequest(parsed.image, errors)
  const briefPatch = parsed.briefPatch !== undefined ? normalizeBriefPatch(parsed.briefPatch) : undefined

  if (parsed.editPatches !== undefined && editPatches.length === 0) {
    errors.push('editPatches moet een array met geldige patches zijn.')
  }

  if (intent === 'director') {
    if (codeUpdate || editPatches.length > 0 || imageRequest) {
      errors.push('Director mag geen codeUpdate, editPatches of image bevatten.')
    }
  }

  if (intent === 'inspect' && (codeUpdate || editPatches.length > 0 || imageRequest)) {
    errors.push('Inspect mag geen codeUpdate, editPatches of image bevatten.')
  }

  if (intent === 'first_build') {
    if (!codeUpdate) {
      errors.push('First Build moet volledige codeUpdate bevatten.')
    }
    if (editPatches.length > 0) {
      errors.push('First Build gebruikt geen editPatches.')
    }
    if (imageRequest) {
      errors.push('First Build gebruikt geen image request.')
    }
  }

  if (errors.length > 0 || !text) return { errors }

  return {
    result: {
      intent,
      text,
      questions: questions.length > 0 ? questions : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      briefPatch,
      codeUpdate,
      editPatches: editPatches.length > 0 ? editPatches : undefined,
      _generateImage: imageRequest,
      included: included.length > 0 ? included : undefined,
      notIncludedYet: notIncludedYet.length > 0 ? notIncludedYet : undefined,
      nextPolishSuggestions: nextPolishSuggestions.length > 0 ? nextPolishSuggestions : undefined,
      findings: findings.length > 0 ? findings : undefined,
      suggestedAdjustments: suggestedAdjustments.length > 0 ? suggestedAdjustments : undefined,
    },
    errors: [],
  }
}

function buildRepairPrompt(intent: AIIntent, errors: string[]): string {
  const shape: Record<AIIntent, string> = {
    director: `{"text":"...","questions":["..."],"suggestions":["..."],"briefPatch":{"rawIdea":"...","mustHaves":[],"styleNotes":[],"constraints":[],"confirmedChoices":[],"unresolvedQuestions":[]}}`,
    first_build: `{"text":"...","codeUpdate":{"html":"...","css":"...","javascript":"..."},"included":["..."],"notIncludedYet":["..."],"nextPolishSuggestions":["..."]}`,
    inspect: `{"text":"...","findings":["..."],"suggestedAdjustments":["..."]}`,
    adjust: `{"text":"...","editPatches":[{"file":"html","find":"...","replace":"..."}]}`,
    major_rebuild: `{"text":"...","codeUpdate":{"html":"...","css":"...","javascript":"..."},"included":["..."],"notIncludedYet":["..."],"nextPolishSuggestions":["..."]}`,
  }

  return `Je vorige antwoord voldeed niet aan het JSON-contract.
Fouten:
${errors.map(error => `- ${error}`).join('\n')}

Geef nu opnieuw antwoord. Alleen geldig JSON, geen markdown, geen codeblok, geen tekst buiten JSON.
Schema voor deze intent:
${shape[intent]}`
}

function fallbackInvalidResponse(intent: AIIntent, errors: string[]): ParsedAIResponse {
  const detail = errors.length > 0 ? ` Technische reden: ${errors[0]}` : ''
  if (intent === 'director') {
    return {
      intent,
      text: `Ik kon het AI-antwoord niet betrouwbaar lezen. Laten we je idee in een kleinere stap scherper maken.${detail}`,
      questions: ['Wat moet iemand als eerste kunnen doen in jouw project?'],
      suggestions: ['Maak duidelijk wat spannend, grappig of handig moet voelen.'],
    }
  }

  return {
    intent,
    text: `Ik kon het AI-antwoord niet betrouwbaar lezen. Probeer je vraag iets korter of specifieker te maken.${detail}`,
  }
}

async function callModelWithValidatedResponse(
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  maxTokens: number,
  intent: AIIntent
): Promise<{ result: ParsedAIResponse; repaired: boolean }> {
  let attemptMessages = messages
  let lastErrors: string[] = []

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callModel(model, attemptMessages, maxTokens)
    const parsed = parseAndValidateAIResponse(raw, intent)

    if (parsed.result) {
      return { result: parsed.result, repaired: attempt > 0 }
    }

    lastErrors = parsed.errors
    attemptMessages = [
      ...messages,
      { role: 'assistant', content: raw },
      { role: 'user', content: buildRepairPrompt(intent, parsed.errors) },
    ]
  }

  return { result: fallbackInvalidResponse(intent, lastErrors), repaired: true }
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
  return response.choices?.[0]?.message?.content || ''
}

function buildContextBlock(intent: AIIntent, code: CodeContext, workspace: ChatWorkspaceContext): string {
  const brief = normalizeBrief(workspace.brief)
  const readiness = getBriefReadiness(brief)
  const workspaceBlock = JSON.stringify({
    phase: workspace.phase,
    majorBuildCount: workspace.majorBuildCount,
    brief,
    readiness,
  }, null, 2)

  if (intent === 'director') {
    return `--- WORKSPACE ---
${workspaceBlock}
--- EINDE WORKSPACE ---

Gebruik alleen de brief en recente berichten. Vraag door; bouw nog niets.`
  }

  if (intent === 'first_build') {
    return `--- PROJECTBRIEF VOOR EERSTE BUILD ---
${workspaceBlock}
--- EINDE PROJECTBRIEF ---

Gebruik de brief als bron van waarheid. Gebruik de volledige planning-chat niet als extra scope.`
  }

  return `--- WORKSPACE ---
${workspaceBlock}
--- EINDE WORKSPACE ---

--- HUIDIGE CODE ---
HTML:
${code.html}

CSS:
${code.css}

JavaScript:
${code.javascript}
--- EINDE CODE ---`
}

async function generateWithModelChain(
  intent: AIIntent,
  messages: OpenAI.Chat.ChatCompletionMessageParam[]
): Promise<{ result: ParsedAIResponse; usingFallback: boolean }> {
  const configuredChain = useXAI ? [XAI_MODEL] : OPENROUTER_MODEL_CHAIN[intent]
  const candidates = Date.now() >= paidModelsDisabledUntil
    ? configuredChain
    : configuredChain.filter(model => model === OPENROUTER_FREE_MODEL)
  const chain = candidates.length > 0 ? candidates : [OPENROUTER_FREE_MODEL]
  let lastError: unknown

  for (const model of chain) {
    try {
      const validated = await callModelWithValidatedResponse(model, messages, MAX_TOKENS[intent], intent)
      return {
        result: validated.result,
        usingFallback: model !== configuredChain[0],
      }
    } catch (error: unknown) {
      lastError = error
      const status = (error as { status?: number })?.status
      if (!useXAI && status === 402) paidModelsDisabledUntil = Date.now() + PAID_MODEL_COOLDOWN_MS
      if (status === 402 || status === 429 || status === 404) {
        console.error(`AI model candidate failed (${model}):`, error)
        continue
      }
      console.error(`AI model candidate failed (${model}):`, error)
      break
    }
  }

  if (lastError) console.error('All AI model candidates failed:', lastError)
  return {
    result: fallbackInvalidResponse(intent, ['Alle modelpogingen faalden.']),
    usingFallback: true,
  }
}

export async function generateCodeResponse({
  userMessage,
  codeContext,
  chatHistory = [],
  workspace,
  action,
  ownerId,
}: {
  userMessage: string
  codeContext: CodeContext
  chatHistory?: ChatMessage[]
  workspace: ChatWorkspaceContext
  action?: ChatAction
  ownerId?: string
}): Promise<AIResponse> {
  const normalizedWorkspace: ChatWorkspaceContext = {
    phase: workspace.phase,
    brief: normalizeBrief(workspace.brief),
    majorBuildCount: Number.isFinite(workspace.majorBuildCount) ? workspace.majorBuildCount : 0,
  }
  const intent = inferIntent({ message: userMessage, code: codeContext, workspace: normalizedWorkspace, action })
  const contextBlock = buildContextBlock(intent, codeContext, normalizedWorkspace)
  const includeHistory = intent !== 'first_build'

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPTS[intent] },
    { role: 'system', content: contextBlock },
    ...(includeHistory
      ? chatHistory.slice(-8).map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }))
      : []),
    { role: 'user', content: userMessage },
  ]

  const { result, usingFallback } = await generateWithModelChain(intent, messages)
  result.intent = intent
  result.usingFallback = usingFallback

  if (intent === 'director') {
    const mergedBrief = mergeBriefPatch(normalizedWorkspace.brief, result.briefPatch)
    result.readiness = getBriefReadiness(mergedBrief)
    delete result.codeUpdate
    delete result.editPatches
    delete result._generateImage
    return result
  }

  if (intent === 'inspect') {
    delete result.codeUpdate
    delete result.editPatches
    delete result._generateImage
    return result
  }

  if (result._generateImage && ownerId) {
    const { prompt, assetType } = result._generateImage
    delete result._generateImage

    const { reserveImageUsage } = await import('./aiLimits')
    const reservation = await reserveImageUsage(ownerId).catch(error => {
      console.error('Image usage reservation failed:', error)
      return undefined
    })
    if (!reservation) {
      result.text += '\n\n(Afbeelding genereren mislukt, probeer de Assets knop.)'
      return result
    }
    if (!reservation.allowed) {
      result.text += `\n\n(${reservation.message ?? 'Je hebt je afbeeldingen-limiet voor dit uur bereikt.'})`
      return result
    }

    try {
      const { prisma } = await import('./prisma')
      const dataUrl = await generateGameAsset(prompt, assetType as 'character' | 'background' | 'item' | 'icon')
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
      const asset = await prisma.asset.create({
        data: { ownerId, prompt, assetType, data: base64, mimeType: 'image/png' },
      })

      const count = await prisma.asset.count({ where: { ownerId } })
      if (count > 100) {
        const oldest = await prisma.asset.findMany({
          where: { ownerId },
          orderBy: { createdAt: 'asc' },
          take: count - 100,
          select: { id: true },
        })
        await prisma.asset.deleteMany({ where: { id: { in: oldest.map(a => a.id) }, ownerId } })
      }

      const url = `/api/images/${asset.id}`
      result.imageGenerated = { url, prompt }

      const imgTag = `<img src="${url}" alt="${prompt}" style="max-width:100%;">`
      const currentHtml = result.codeUpdate?.html ?? codeContext.html
      result.codeUpdate = { ...result.codeUpdate, html: `${currentHtml}\n${imgTag}` }
    } catch (error) {
      await reservation.release()
      console.error('Image generation failed:', error)
      result.text += '\n\n(Afbeelding genereren mislukt, probeer de Assets knop.)'
    }
  } else {
    delete result._generateImage
  }

  return result
}
