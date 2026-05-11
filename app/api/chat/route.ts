import { NextRequest, NextResponse } from 'next/server'
import { generateCodeResponse } from '@/lib/groq'
import { ChatAction, CodeState, ProjectPhase } from '@/lib/types'
import { isUnauthorized, requireUser } from '@/lib/auth'
import { inferIntent, normalizeBrief, phaseFromBriefAndCode } from '@/lib/projectFlow'
import { checkAIRateLimit, recordAIUsage } from '@/lib/aiLimits'

export const maxDuration = 60

const PROJECT_PHASES = new Set<ProjectPhase>(['empty', 'shaping', 'ready_for_first_build', 'built', 'polishing'])
const CHAT_ACTIONS = new Set<ChatAction>(['first_build', 'inspect', 'adjust', 'major_rebuild'])

function normalizePhase(value: unknown, code: CodeState, brief: unknown): ProjectPhase {
  if (typeof value === 'string' && PROJECT_PHASES.has(value as ProjectPhase)) {
    if ((code.html.trim() || code.css.trim() || code.javascript.trim()) &&
      (value === 'empty' || value === 'shaping' || value === 'ready_for_first_build')) {
      return 'built'
    }
    return value as ProjectPhase
  }
  return phaseFromBriefAndCode(normalizeBrief(brief), code, 'empty')
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const { message, code, history, workspace, action, mode } = await request.json() as {
      message: string
      code: CodeState
      history: Array<{ role: 'user' | 'assistant'; content: string }>
      workspace?: {
        phase?: ProjectPhase
        brief?: unknown
        majorBuildCount?: number
      }
      action?: ChatAction
      mode?: 'plan' | 'build' | 'explain'
    }

    if (!message || !code) {
      return NextResponse.json({ error: 'Message and code context are required' }, { status: 400 })
    }

    const brief = normalizeBrief(workspace?.brief)
    const safeAction: ChatAction | undefined = action && CHAT_ACTIONS.has(action)
      ? action
      : mode === 'explain'
        ? 'inspect'
        : undefined
    const workspaceContext = {
      phase: normalizePhase(workspace?.phase, code, brief),
      brief,
      majorBuildCount: typeof workspace?.majorBuildCount === 'number' ? workspace.majorBuildCount : 0,
    }
    const intent = inferIntent({ message, code, workspace: workspaceContext, action: safeAction })
    const rateLimit = await checkAIRateLimit(user.id, intent)

    if (!rateLimit.allowed) {
      return NextResponse.json({
        error: rateLimit.message,
        code: 'AI_RATE_LIMIT',
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      }, {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      })
    }

    const result = await generateCodeResponse({
      userMessage: message,
      codeContext: code,
      chatHistory: history ?? [],
      workspace: workspaceContext,
      action: safeAction,
      ownerId: user.id,
    })
    await recordAIUsage(user.id, result.intent).catch(error => {
      console.error('AI usage logging failed:', error)
    })

    return NextResponse.json(result)
  } catch (error) {
    if (isUnauthorized(error)) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }
    console.error('Chat API Error:', error)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}
