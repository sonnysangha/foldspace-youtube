// Talks to the Foldspace Convex backend on behalf of one Clerk user.
const SITE_URL = process.env.CONVEX_SITE_URL ?? process.env.EXPO_PUBLIC_CONVEX_SITE_URL
const AGENT_SECRET = process.env.AGENT_SECRET

export function assertConfigured() {
  const missing = [
    ['CLERK_SECRET_KEY', process.env.CLERK_SECRET_KEY],
    ['EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY', process.env.CLERK_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY],
    ['EXPO_PUBLIC_CONVEX_SITE_URL', SITE_URL],
    ['AGENT_SECRET', AGENT_SECRET],
  ].filter(([, value]) => !value)
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.map(([name]) => name).join(', ')}`)
  }
}

/** Runs one action as the given user. The user id always comes from the verified token. */
export async function callFoldspace(userId: string, action: string, args: Record<string, unknown> = {}) {
  const response = await fetch(`${SITE_URL}/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AGENT_SECRET}` },
    body: JSON.stringify({ userId, action, args }),
  })
  const body = (await response.json().catch(() => ({}))) as { result?: unknown; error?: string }
  if (!response.ok) throw new Error(body.error ?? `Foldspace request failed (${response.status})`)
  return body.result ?? null
}
