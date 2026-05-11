import { describe, it, expect } from 'vitest'
import { extractTag, extractEditPatches } from '../parseAI'
import { getBriefReadiness, inferIntent } from '../projectFlow'
import { ChatWorkspaceContext, CodeState, ProjectBrief } from '../types'

describe('extractTag', () => {
  it('extracts a simple tag', () => {
    expect(extractTag('<text>Hallo!</text>', 'text')).toBe('Hallo!')
  })

  it('trims whitespace', () => {
    expect(extractTag('<text>  spatie  </text>', 'text')).toBe('spatie')
  })

  it('handles multiline content', () => {
    const raw = '<html>\n<h1>Titel</h1>\n<p>Paragraaf</p>\n</html>'
    expect(extractTag(raw, 'html')).toBe('<h1>Titel</h1>\n<p>Paragraaf</p>')
  })

  it('returns undefined when tag is missing', () => {
    expect(extractTag('<html>code</html>', 'css')).toBeUndefined()
  })

  it('is case-insensitive', () => {
    expect(extractTag('<TEXT>inhoud</TEXT>', 'text')).toBe('inhoud')
  })
})

describe('extractEditPatches', () => {
  it('extracts a single patch', () => {
    const raw = `<edit file="html"><find>oude tekst</find><replace>nieuwe tekst</replace></edit>`
    const patches = extractEditPatches(raw)
    expect(patches).toHaveLength(1)
    expect(patches[0]).toEqual({ file: 'html', find: 'oude tekst', replace: 'nieuwe tekst' })
  })

  it('extracts multiple patches', () => {
    const raw = `
      <edit file="html"><find>h1</find><replace>h2</replace></edit>
      <edit file="css"><find>red</find><replace>blue</replace></edit>
    `
    const patches = extractEditPatches(raw)
    expect(patches).toHaveLength(2)
    expect(patches[0].file).toBe('html')
    expect(patches[1].file).toBe('css')
  })

  it('handles multiline find/replace', () => {
    const raw = `<edit file="js"><find>const x = 1;\nconst y = 2;</find><replace>const x = 10;\nconst y = 20;</replace></edit>`
    const patches = extractEditPatches(raw)
    expect(patches).toHaveLength(1)
    expect(patches[0].find).toContain('const x = 1;')
    expect(patches[0].replace).toContain('const x = 10;')
  })

  it('returns empty array when no patches', () => {
    expect(extractEditPatches('<text>Geen wijzigingen</text>')).toHaveLength(0)
  })

  it('ignores invalid file attributes', () => {
    const raw = `<edit file="python"><find>x</find><replace>y</replace></edit>`
    expect(extractEditPatches(raw)).toHaveLength(0)
  })
})

describe('AI JSON validation', () => {
  it('rejects code operations in director intent', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key'
    const { parseAndValidateAIResponse } = await import('../groq')

    const result = parseAndValidateAIResponse(
      JSON.stringify({ text: 'Ik pas dit alvast aan.', codeUpdate: { html: '<h1>Nieuw</h1>' } }),
      'director'
    )

    expect(result.result).toBeUndefined()
    expect(result.errors).toContain('Director mag geen codeUpdate, editPatches of image bevatten.')
  })

  it('rejects code operations in inspect intent', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key'
    const { parseAndValidateAIResponse } = await import('../groq')

    const result = parseAndValidateAIResponse(
      JSON.stringify({
        text: 'Ik leg het uit en pas het aan.',
        editPatches: [{ file: 'css', find: 'red', replace: 'blue' }],
      }),
      'inspect'
    )

    expect(result.result).toBeUndefined()
    expect(result.errors).toContain('Inspect mag geen codeUpdate, editPatches of image bevatten.')
  })

  it('accepts adjust patches', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key'
    const { parseAndValidateAIResponse } = await import('../groq')

    const result = parseAndValidateAIResponse(
      JSON.stringify({
        text: 'Ik maak de knop groter.',
        editPatches: [{ file: 'css', find: 'padding: 8px;', replace: 'padding: 14px;' }],
      }),
      'adjust'
    )

    expect(result.errors).toHaveLength(0)
    expect(result.result?.editPatches).toEqual([{ file: 'css', find: 'padding: 8px;', replace: 'padding: 14px;' }])
  })

  it('requires full files for first build', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key'
    const { parseAndValidateAIResponse } = await import('../groq')

    const result = parseAndValidateAIResponse(
      JSON.stringify({ text: 'Eerste build.', codeUpdate: { html: '<main></main>', css: 'body{}' } }),
      'first_build'
    )

    expect(result.result).toBeUndefined()
    expect(result.errors).toContain('codeUpdate moet volledige html, css en javascript bevatten.')
  })
})

describe('project flow helpers', () => {
  const emptyCode: CodeState = { html: '', css: '', javascript: '' }
  const builtCode: CodeState = { html: '<button>Start</button>', css: 'button{}', javascript: 'console.log("hi")' }
  const readyBrief: ProjectBrief = {
    rawIdea: 'Ik wil een game maken waar je uit een chaotische school moet ontsnappen.',
    coreExperience: 'De speler verzamelt sleutels en ontwijkt een bewaker.',
    mustHaves: ['sleutels verzamelen', 'bewaker vermijden'],
    styleNotes: ['chaotische arcade-stijl'],
    constraints: [],
    confirmedChoices: ['timer tot de bel gaat'],
    unresolvedQuestions: [],
  }
  const readyWorkspace: ChatWorkspaceContext = {
    phase: 'ready_for_first_build',
    brief: readyBrief,
    majorBuildCount: 0,
  }

  it('routes empty projects to director', () => {
    expect(inferIntent({
      message: 'ik wil een game met zombies',
      code: emptyCode,
      workspace: { phase: 'empty', brief: { ...readyBrief, rawIdea: '' }, majorBuildCount: 0 },
    })).toBe('director')
  })

  it('routes ready first-build action to first_build', () => {
    expect(inferIntent({
      message: 'Maak eerste build',
      code: emptyCode,
      workspace: readyWorkspace,
      action: 'first_build',
    })).toBe('first_build')
  })

  it('routes questions with existing code to inspect', () => {
    expect(inferIntent({
      message: 'waarom beweegt mijn speler niet?',
      code: builtCode,
      workspace: { ...readyWorkspace, phase: 'built' },
    })).toBe('inspect')
  })

  it('routes small imperative changes to adjust', () => {
    expect(inferIntent({
      message: 'maak de knop groter',
      code: builtCode,
      workspace: { ...readyWorkspace, phase: 'built' },
    })).toBe('adjust')
  })

  it('returns false for shallow brief readiness', () => {
    const readiness = getBriefReadiness({
      rawIdea: 'game',
      mustHaves: [],
      styleNotes: [],
      constraints: [],
      confirmedChoices: [],
      unresolvedQuestions: [],
    })

    expect(readiness.readyForFirstBuild).toBe(false)
    expect(readiness.missing).toContain('een eigen idee in je eigen woorden')
  })

  it('returns true for enough student intent', () => {
    const readiness = getBriefReadiness(readyBrief)

    expect(readiness.readyForFirstBuild).toBe(true)
    expect(readiness.reason).toBe('We weten genoeg om een goede eerste versie te maken.')
  })
})
