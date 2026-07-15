import OpenAI from 'openai'
import { jsonrepair } from 'jsonrepair'
import { GeneratedProject, ProjectCapabilities, SourceFile } from '@/lib/v2/types'
import { RUNTIME_GUIDE } from '@/lib/v2/runtime-catalog'

const useXAI = Boolean(process.env.XAI_API_KEY)

function getClient(): OpenAI | null {
  const apiKey = useXAI ? process.env.XAI_API_KEY : process.env.OPENROUTER_API_KEY
  if (!apiKey) return null
  return new OpenAI({
    baseURL: useXAI ? 'https://api.x.ai/v1' : 'https://openrouter.ai/api/v1',
    apiKey,
  })
}

const SYSTEM_PROMPT = `You are the build engine for a creation platform used by students aged 10-16.
Turn one idea into a striking, genuinely interactive product. This is not a coding lesson.
The first version must feel specific, complete, and fun to use within seconds.

${RUNTIME_GUIDE}

Return one JSON object with this exact shape:
{
  "title": "short memorable project title",
  "summary": "one concrete sentence",
  "files": [{"path":"src/App.tsx","content":"..."},{"path":"src/styles.css","content":"..."}],
  "assets": [{"key":"hero","prompt":"English image prompt","aspect":"landscape"}],
  "capabilities": {
    "collections": [{
      "name":"votes",
      "label":"Votes",
      "operations":["list","create","increment"],
      "fields":[{"name":"choice","type":"text","required":true,"maxLength":80}],
      "maxRecords":200
    }],
    "textAI": false,
    "imageAI": false
  }
}

Rules:
- Return JSON only.
- Make at least one meaningful interaction, not a static landing page.
- Build a small world or toy, not a generic dashboard, feature grid, or three-card landing page.
- Prefer one visually dominant interactive composition with depth, motion, and a clear play loop.
- Give the visitor at least three meaningful things to try, or one deep interaction that keeps changing.
- Make controls semantic and obvious: real buttons, useful labels, visible focus, and immediate feedback.
- Do not create login, payments, chat between strangers, uploads, or personal-data fields.
- Use at most 3 image assets and only when they materially improve the result.
- Every requested asset is a still image. Never request audio, video, fonts, or sound effects as assets.
- If sound matters, synthesize small effects with the Web Audio API; never point Howler at an image asset.
- Use an empty assets array when CSS and typography are enough.
- Do not use emojis or generic startup copy.
- Do not use fetch, WebSocket, localStorage, sessionStorage, cookies, eval, or dynamic imports.
- Keep temporary interaction state in the component; use window.vibe.data only when the project needs shared persistence.
- Use one coherent accent color and excellent responsive CSS.
- Declare only capabilities actually used in the source.
- Runtime AI must be a deliberate feature, not decorative.
- Every data call must handle loading, empty, and error states.
- Keep the total source compact enough to understand and rebuild quickly.`

function stripFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
}

function normalizeCapabilities(value: unknown): ProjectCapabilities {
  const input = value && typeof value === 'object' ? value as Partial<ProjectCapabilities> : {}
  return {
    collections: Array.isArray(input.collections) ? input.collections.slice(0, 6) : [],
    textAI: input.textAI === true,
    imageAI: input.imageAI === true,
  }
}

function normalizeGeneratedProject(value: unknown): GeneratedProject {
  if (!value || typeof value !== 'object') throw new Error('The model returned an invalid project.')
  const input = value as Partial<GeneratedProject>
  const files = Array.isArray(input.files)
    ? input.files.filter((file): file is SourceFile => Boolean(
      file && typeof file.path === 'string' && typeof file.content === 'string',
    ))
    : []
  if (!files.some(file => file.path === 'src/App.tsx')) throw new Error('The model did not create src/App.tsx.')
  return {
    title: typeof input.title === 'string' && input.title.trim() ? input.title.trim().slice(0, 80) : 'Untitled creation',
    summary: typeof input.summary === 'string' ? input.summary.trim().slice(0, 240) : '',
    files,
    assets: Array.isArray(input.assets)
      ? input.assets.filter(asset => asset && typeof asset.key === 'string' && typeof asset.prompt === 'string')
        .slice(0, 3)
        .map(asset => ({
          key: asset.key.replace(/[^a-z0-9_-]/gi, '').slice(0, 32),
          prompt: asset.prompt.slice(0, 500),
          aspect: ['square', 'portrait', 'landscape'].includes(asset.aspect) ? asset.aspect : 'landscape',
        }))
      : [],
    capabilities: normalizeCapabilities(input.capabilities),
  }
}

function fallbackProject(prompt: string): GeneratedProject {
  const cleanedIdea = prompt.replace(/[<>{}]/g, '').replace(/\s+/g, ' ').trim()
  const safeIdea = cleanedIdea.length > 110
    ? `${cleanedIdea.slice(0, 106).replace(/\s+\S*$/, '')}…`
    : cleanedIdea || 'a new idea'
  return {
    title: 'Idea Atlas',
    summary: `An interactive visual atlas inspired by ${safeIdea}.`,
    assets: [],
    capabilities: { collections: [], textAI: false, imageAI: false },
    files: [
      {
        path: 'src/App.tsx',
        content: `import { useMemo, useState } from 'preact/hooks';
import { ArrowRight, Shuffle, Sparkle } from '@phosphor-icons/react';

const seed = ${JSON.stringify(safeIdea)};
const lenses = [
  ['Make it tiny', 'What is the smallest version someone could use today?'],
  ['Make it strange', 'Combine it with a place, ritual, or object nobody expects.'],
  ['Make it useful', 'Who has this problem every week, and what could disappear?'],
  ['Make it social', 'What could two people create together without an account?'],
];

export default function App() {
  const [active, setActive] = useState(0);
  const [notes, setNotes] = useState('');
  const words = useMemo(() => seed.split(/\\s+/).filter(Boolean).slice(0, 8), []);
  const rotate = () => setActive((active + 1) % lenses.length);
  return <main>
    <header><span class="mark"><Sparkle size={18} weight="fill" /></span><span>Idea Atlas / 01</span></header>
    <section class="hero">
      <div class="intro"><p class="eyebrow">A live experiment about</p><h1>{seed}</h1><p class="lede">Pull the idea apart. Turn it around. Find the version worth making.</p></div>
      <div class="orbit" aria-hidden="true">{words.map((word, index) => <span style={{'--i': index}}>{word}</span>)}</div>
    </section>
    <section class="workbench">
      <nav>{lenses.map((lens, index) => <button class={index === active ? 'active' : ''} onClick={() => setActive(index)}><span>0{index + 1}</span>{lens[0]}</button>)}</nav>
      <article><p>Current lens</p><h2>{lenses[active][0]}</h2><blockquote>{lenses[active][1]}</blockquote><textarea value={notes} onInput={(event) => setNotes(event.currentTarget.value)} placeholder="Write the first thought that feels slightly risky..." /><button class="next" onClick={rotate}>Try another angle <ArrowRight size={19} /></button></article>
    </section>
    <button class="shuffle" onClick={rotate}><Shuffle size={19} /> Shuffle the lens</button>
  </main>;
}`,
      },
      {
        path: 'src/styles.css',
        content: `:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#25231f;background:#f0ece3;font-synthesis:none}*{box-sizing:border-box}body{margin:0;min-width:320px}button,textarea{font:inherit}button{cursor:pointer}main{min-height:100dvh;padding:24px 28px 48px;overflow:hidden;background:radial-gradient(circle at 78% 18%,rgba(210,92,61,.16),transparent 28rem),#f0ece3}header{display:flex;align-items:center;gap:12px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.mark{display:grid;place-items:center;width:36px;height:36px;background:#c9583d;color:#fff;border-radius:10px}.hero{display:grid;grid-template-columns:1.25fr .75fr;min-height:46vh;align-items:center;gap:7vw}.eyebrow,article>p{font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#716b61}h1{font-size:clamp(42px,6.6vw,94px);line-height:.93;letter-spacing:-.07em;max-width:12ch;margin:16px 0 24px;text-wrap:balance}.lede{font-size:18px;line-height:1.6;max-width:48ch;color:#5d574e}.orbit{position:relative;aspect-ratio:1;max-width:360px;border:1px solid rgba(37,35,31,.18);border-radius:50%}.orbit:after{content:'';position:absolute;inset:28%;background:#c9583d;border-radius:42% 58% 64% 36%;animation:turn 12s linear infinite}.orbit span{position:absolute;left:50%;top:50%;font-size:12px;font-weight:700;transform:rotate(calc(var(--i)*45deg)) translateX(150px) rotate(calc(var(--i)*-45deg))}.workbench{display:grid;grid-template-columns:minmax(220px,.65fr) 1.35fr;max-width:1180px;margin-left:auto;border-top:1px solid rgba(37,35,31,.22)}nav{display:flex;flex-direction:column;padding:18px 24px 0 0;border-right:1px solid rgba(37,35,31,.22)}nav button{display:grid;grid-template-columns:32px 1fr;text-align:left;border:0;border-bottom:1px solid rgba(37,35,31,.12);background:transparent;padding:15px 4px;color:#817a70}nav button.active{color:#25231f;font-weight:700}nav span{font:11px ui-monospace,monospace;color:#a39b90}article{padding:34px 0 0 48px}h2{font-size:clamp(30px,4vw,56px);letter-spacing:-.05em;margin:10px 0}blockquote{font-size:20px;line-height:1.45;max-width:42ch;margin:0 0 24px;color:#5d574e}textarea{width:100%;min-height:110px;border:0;border-bottom:2px solid #25231f;background:rgba(255,255,255,.32);padding:16px;resize:vertical;outline:none}.next,.shuffle{display:flex;align-items:center;gap:10px;border:0;background:#25231f;color:#fff;padding:13px 18px;margin-top:18px;border-radius:9px;font-weight:700}.shuffle{position:fixed;right:24px;bottom:20px;background:#c9583d}.next:active,.shuffle:active{transform:translateY(1px)}@keyframes turn{to{transform:rotate(360deg)}}@media(max-width:760px){main{padding:18px 18px 90px}.hero{grid-template-columns:1fr;padding:64px 0}.orbit{display:none}.workbench{grid-template-columns:1fr}nav{border-right:0;padding-right:0;display:grid;grid-template-columns:1fr 1fr}nav button{grid-template-columns:24px 1fr}article{padding:32px 0 0}.shuffle{left:18px;right:18px;justify-content:center}}@media(prefers-reduced-motion:reduce){.orbit:after{animation:none}}`,
      },
    ],
  }
}

async function callModel(messages: Array<{ role: 'system' | 'user'; content: string }>): Promise<GeneratedProject> {
  const client = getClient()
  if (!client || process.env.VIBE_FAKE_AI === '1') {
    const last = messages.at(-1)?.content || ''
    return fallbackProject(last)
  }
  const response = await client.chat.completions.create({
    model: process.env.BUILD_MODEL || (useXAI ? 'grok-4.3' : 'google/gemini-2.5-flash'),
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.55,
    max_tokens: 16_000,
  })
  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('The build model returned an empty response.')
  const raw = stripFence(content)
  try {
    return normalizeGeneratedProject(JSON.parse(raw))
  } catch {
    return normalizeGeneratedProject(JSON.parse(jsonrepair(raw)))
  }
}

export async function generateProject(input: {
  prompt: string
  existingFiles?: SourceFile[]
  currentTitle?: string
  currentSummary?: string
}): Promise<GeneratedProject> {
  const existing = input.existingFiles?.length
    ? `\nCurrent project (${input.currentTitle || 'Untitled'}):\n${input.existingFiles
      .map(file => `--- ${file.path} ---\n${file.content}`)
      .join('\n')
      .slice(0, 80_000)}\n\nPreserve what works and implement the requested remix.`
    : ''
  try {
    return await callModel([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `${input.prompt}${existing}` },
    ])
  } catch (error) {
    console.error('Build model failed; using the resilient local builder:', error)
    return fallbackProject(input.prompt)
  }
}

export async function repairProject(input: {
  project: GeneratedProject
  error: string
}): Promise<GeneratedProject> {
  try {
    return await callModel([
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Repair this project. Keep its idea and design. The compiler reported:\n${input.error.slice(0, 5000)}\n\nProject JSON:\n${JSON.stringify(input.project).slice(0, 90_000)}`,
      },
    ])
  } catch (error) {
    console.error('Repair model failed; rebuilding from the project idea:', error)
    return fallbackProject(`${input.project.title}: ${input.project.summary}`)
  }
}
