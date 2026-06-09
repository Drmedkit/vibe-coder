import { NextRequest, NextResponse } from 'next/server'
import { generateCodeResponse } from '@/lib/groq'
import { ChatAction, CodeState, ProjectPhase } from '@/lib/types'
import { isUnauthorized, requireUser } from '@/lib/auth'
import { inferIntent, normalizeBrief, phaseFromBriefAndCode } from '@/lib/projectFlow'
import { reserveAIUsage } from '@/lib/aiLimits'
import { AIQueueBusyError, withAISlot } from '@/lib/aiQueue'

export const maxDuration = 300

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
    const reservation = await reserveAIUsage(user.id, intent)

    if (!reservation.allowed) {
      return NextResponse.json({
        error: reservation.message,
        code: 'AI_RATE_LIMIT',
        retryAfterSeconds: reservation.retryAfterSeconds,
      }, {
        status: 429,
        headers: { 'Retry-After': String(reservation.retryAfterSeconds) },
      })
    }

    try {
      const result = await withAISlot(() => generateCodeResponse({
        userMessage: message,
        codeContext: code,
        chatHistory: history ?? [],
        workspace: workspaceContext,
        action: safeAction,
        ownerId: user.id,
      }))
      return NextResponse.json(result)
    } catch (error) {
      await reservation.release()
      if (error instanceof AIQueueBusyError) {
        return NextResponse.json({
          error: 'Het is nu erg druk met AI-verzoeken in de klas. Wacht een paar tellen en probeer het opnieuw.',
          code: 'AI_BUSY',
          retryAfterSeconds: 15,
        }, {
          status: 429,
          headers: { 'Retry-After': '15' },
        })
      }
      throw error
    }
  } catch (error) {
    if (isUnauthorized(error)) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }
    console.error('Chat API Error:', error)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}
