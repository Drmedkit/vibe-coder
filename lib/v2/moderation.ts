const BLOCKED_PATTERNS = [
  /(?:kill|hurt|cut|hang|poison)\s+(?:myself|yourself|someone|a person)/i,
  /(?:suicide|self[- ]?harm|how to die)\b/i,
  /(?:nude|naked|sexual|porn(?:ography)?)\s+(?:child|kid|minor|teen)/i,
  /(?:child|kid|minor)\s+(?:nude|naked|sexual|porn(?:ography)?)/i,
  /(?:credit\s*card|social\s*security|passport\s*number|home\s*address)/i,
  /(?:doxx|swat|steal\s+(?:a\s+)?password)\b/i,
  /(?:build|make|hide)\s+(?:a\s+)?(?:bomb|explosive|ghost\s*gun)/i,
]

export interface ModerationResult {
  allowed: boolean
  reason?: string
}

export function moderateText(value: string): ModerationResult {
  const text = value.trim().slice(0, 20_000)
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return { allowed: false, reason: 'The request needs an adult review before it can be published.' }
    }
  }
  return { allowed: true }
}

export function sanitizePublicText(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}
