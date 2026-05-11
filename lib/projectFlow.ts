import { AIIntent, BriefReadiness, ChatAction, ChatWorkspaceContext, CodeState, ProjectBrief, ProjectPhase } from './types'

export function createEmptyBrief(): ProjectBrief {
  return {
    rawIdea: '',
    mustHaves: [],
    styleNotes: [],
    constraints: [],
    confirmedChoices: [],
    unresolvedQuestions: [],
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map(item => item.trim())
}

function mergeStringArrays(current: string[], patch: unknown): string[] {
  const merged = [...current]
  for (const item of normalizeStringArray(patch)) {
    if (!merged.some(existing => existing.toLowerCase() === item.toLowerCase())) {
      merged.push(item)
    }
  }
  return merged
}

export function normalizeBrief(value: unknown): ProjectBrief {
  if (!value || typeof value !== 'object') return createEmptyBrief()
  const input = value as Partial<ProjectBrief>

  return {
    rawIdea: typeof input.rawIdea === 'string' ? input.rawIdea : '',
    goal: stringOrUndefined(input.goal),
    coreExperience: stringOrUndefined(input.coreExperience),
    mustHaves: normalizeStringArray(input.mustHaves),
    styleNotes: normalizeStringArray(input.styleNotes),
    constraints: normalizeStringArray(input.constraints),
    confirmedChoices: normalizeStringArray(input.confirmedChoices),
    unresolvedQuestions: normalizeStringArray(input.unresolvedQuestions),
    qualityBar: stringOrUndefined(input.qualityBar),
  }
}

export function mergeBriefPatch(current: ProjectBrief, patch: unknown): ProjectBrief {
  if (!patch || typeof patch !== 'object') return normalizeBrief(current)
  const input = patch as Partial<ProjectBrief>
  const base = normalizeBrief(current)

  return {
    rawIdea: typeof input.rawIdea === 'string' ? input.rawIdea : base.rawIdea,
    goal: input.goal !== undefined ? stringOrUndefined(input.goal) : base.goal,
    coreExperience: input.coreExperience !== undefined ? stringOrUndefined(input.coreExperience) : base.coreExperience,
    mustHaves: input.mustHaves !== undefined ? mergeStringArrays(base.mustHaves, input.mustHaves) : base.mustHaves,
    styleNotes: input.styleNotes !== undefined ? mergeStringArrays(base.styleNotes, input.styleNotes) : base.styleNotes,
    constraints: input.constraints !== undefined ? mergeStringArrays(base.constraints, input.constraints) : base.constraints,
    confirmedChoices: input.confirmedChoices !== undefined ? mergeStringArrays(base.confirmedChoices, input.confirmedChoices) : base.confirmedChoices,
    unresolvedQuestions: input.unresolvedQuestions !== undefined ? normalizeStringArray(input.unresolvedQuestions) : base.unresolvedQuestions,
    qualityBar: input.qualityBar !== undefined ? stringOrUndefined(input.qualityBar) : base.qualityBar,
  }
}

export function isCodeEmpty(code: CodeState): boolean {
  return !code.html.trim() && !code.css.trim() && !code.javascript.trim()
}

export function getBriefReadiness(briefInput: ProjectBrief): BriefReadiness {
  const brief = normalizeBrief(briefInput)
  const missing: string[] = []
  const hasRawIdea = brief.rawIdea.trim().length >= 20
  const hasConcreteThing = Boolean(brief.coreExperience) || brief.mustHaves.length >= 1 || brief.confirmedChoices.length >= 1
  const hasDirection = brief.styleNotes.length >= 1 || brief.mustHaves.length >= 1 || Boolean(brief.qualityBar)

  if (!hasRawIdea) missing.push('een eigen idee in je eigen woorden')
  if (!hasConcreteThing) missing.push('een concrete actie of onderdeel')
  if (!hasDirection) missing.push('een richting voor stijl of werking')

  const checks = [hasRawIdea, hasConcreteThing, hasDirection]
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100)

  return {
    score,
    readyForFirstBuild: missing.length === 0,
    missing,
    reason: missing.length === 0
      ? 'We weten genoeg voor een kleine eerste build.'
      : `Nog nodig: ${missing.join(', ')}.`,
  }
}

export function phaseFromBriefAndCode(brief: ProjectBrief, code: CodeState, currentPhase: ProjectPhase): ProjectPhase {
  if (!isCodeEmpty(code)) {
    return currentPhase === 'polishing' ? 'polishing' : 'built'
  }

  const readiness = getBriefReadiness(brief)
  if (readiness.readyForFirstBuild) return 'ready_for_first_build'
  if (brief.rawIdea.trim() || brief.confirmedChoices.length > 0 || brief.mustHaves.length > 0) return 'shaping'
  return 'empty'
}

export function looksLikeQuestion(message: string): boolean {
  const text = message.toLowerCase()
  if (text.includes('?')) return true
  return [
    'waarom',
    'wat doet',
    'hoe werkt',
    'leg uit',
    'uitleg',
    'waar zit',
    'wat mist',
    'is dit goed',
    'hoe kan dit beter',
  ].some(marker => text.includes(marker))
}

function looksLikeMajorRebuild(message: string): boolean {
  const text = message.toLowerCase()
  return [
    'helemaal anders',
    'opnieuw',
    'andere richting',
    'grote wijziging',
    'rebuild',
    'begin opnieuw',
  ].some(marker => text.includes(marker))
}

export function inferIntent(input: {
  message: string
  code: CodeState
  workspace: ChatWorkspaceContext
  action?: ChatAction
}): AIIntent {
  const { action, code, message, workspace } = input

  if (action === 'first_build' && workspace.phase === 'ready_for_first_build') return 'first_build'
  if (action === 'major_rebuild') return 'major_rebuild'
  if (action === 'inspect') return 'inspect'
  if (action === 'adjust') return 'adjust'

  if (isCodeEmpty(code) && workspace.phase !== 'ready_for_first_build') return 'director'
  if (workspace.phase === 'ready_for_first_build' && /maak.*eerste.*build|first build/i.test(message)) return 'first_build'
  if (!isCodeEmpty(code) && looksLikeMajorRebuild(message)) return 'major_rebuild'
  if (!isCodeEmpty(code) && looksLikeQuestion(message)) return 'inspect'
  if (isCodeEmpty(code)) return 'director'
  return 'adjust'
}
