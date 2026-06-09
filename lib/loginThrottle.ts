// In-memory brute-force throttle per username. There is no password reset
// flow, so slowing guessing down matters more than perfect distributed state.

const MAX_FAILED_ATTEMPTS = 8
const WINDOW_MS = 10 * 60 * 1000

const globalForThrottle = globalThis as unknown as {
  loginFailures: Map<string, number[]> | undefined
}

const failures: Map<string, number[]> = globalForThrottle.loginFailures ?? new Map()

if (process.env.NODE_ENV !== 'production') {
  globalForThrottle.loginFailures = failures
}

function recentFailures(username: string): number[] {
  const cutoff = Date.now() - WINDOW_MS
  const recent = (failures.get(username) ?? []).filter(at => at >= cutoff)
  if (recent.length === 0) {
    failures.delete(username)
  } else {
    failures.set(username, recent)
  }
  return recent
}

export function loginRetryAfterSeconds(username: string): number {
  const recent = recentFailures(username)
  if (recent.length < MAX_FAILED_ATTEMPTS) return 0
  return Math.max(1, Math.ceil((recent[0] + WINDOW_MS - Date.now()) / 1000))
}

export function recordFailedLogin(username: string) {
  const recent = recentFailures(username)
  recent.push(Date.now())
  failures.set(username, recent)
}

export function clearFailedLogins(username: string) {
  failures.delete(username)
}
