// Follows https://clerk.com/docs/expressjs/guides/ai/mcp/build-mcp-server
import { createClerkClient } from '@clerk/backend'
import { verifyClerkToken } from '@clerk/mcp-tools/server'

// The app's .env.local stores the key under Expo's name; Clerk's server helpers
// read CLERK_PUBLISHABLE_KEY.
process.env.CLERK_PUBLISHABLE_KEY ??= process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY

export const PORT = Number(process.env.PORT ?? 3000)
// The exact URL MCP clients connect to. Replace with the HTTPS URL when deployed.
export const MCP_RESOURCE_URL = process.env.MCP_RESOURCE_URL ?? `http://localhost:${PORT}/mcp`
export const REQUIRED_SCOPES = ['profile', 'email']
// RFC 9728: the metadata lives at the well-known prefix followed by the resource's own path.
export const RESOURCE_METADATA_PATH = `/.well-known/oauth-protected-resource${new URL(MCP_RESOURCE_URL).pathname}`
export const RESOURCE_METADATA_URL = new URL(RESOURCE_METADATA_PATH, MCP_RESOURCE_URL).href
// The Clerk authorization server (its Frontend API URL), which the publishable key encodes.
export const CLERK_ISSUER = issuerFromPublishableKey(process.env.CLERK_PUBLISHABLE_KEY)

function issuerFromPublishableKey(publishableKey: string | undefined) {
  const encoded = publishableKey?.replace(/^pk_(test|live)_/, '')
  if (!encoded) return ''
  return `https://${Buffer.from(encoded, 'base64url').toString('utf8').replace(/\$$/, '')}`
}

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  apiUrl: process.env.CLERK_API_URL,
})

/**
 * Re-checks the claims of a JWT access token that Clerk has ALREADY verified.
 * Clerk checks the signature, expiry and audience but not `iss`, so the issuer
 * is enforced here, and expiry and the exact audience are asserted again.
 * Never call this on a token whose signature has not been verified.
 */
function hasExpectedClaims(verifiedJwt: string) {
  const claims = JSON.parse(Buffer.from(verifiedJwt.split('.')[1], 'base64url').toString('utf8')) as {
    iss?: unknown
    aud?: unknown
    exp?: unknown
  }
  const audiences = [claims.aud].flat()
  return (
    claims.iss === CLERK_ISSUER &&
    audiences.includes(MCP_RESOURCE_URL) &&
    typeof claims.exp === 'number' &&
    claims.exp * 1000 > Date.now()
  )
}

/**
 * Accepts only OAuth access tokens issued by our Clerk instance for this MCP
 * server. Session tokens, API keys and machine tokens are rejected.
 *
 * JWT access tokens: Clerk verifies the signature against the instance's keys,
 * the `at+jwt` type, expiry and audience; the issuer is then checked here.
 * Opaque tokens: Clerk's Backend API introspects them for this instance and the
 * audience it reports must include this server's URL.
 */
export async function verifyMcpToken(request: Request) {
  try {
    const requestState = await clerkClient.authenticateRequest(request, {
      acceptsToken: 'oauth_token',
      audience: MCP_RESOURCE_URL,
    })
    if (!requestState.isAuthenticated || requestState.tokenType !== 'oauth_token') return undefined
    const isJwt = requestState.token.split('.').length === 3
    if (isJwt && !hasExpectedClaims(requestState.token)) {
      console.error('MCP access token rejected: unexpected issuer, audience or expiry')
      return undefined
    }

    const authInfo = verifyClerkToken(requestState.toAuth(), requestState.token)
    // MCP SDK 2 sends this as resource_metadata in its WWW-Authenticate scope challenges
    return authInfo && { ...authInfo, resourceMetadataUrl: RESOURCE_METADATA_URL }
  } catch (error) {
    console.error('MCP access token verification failed', error)
    return undefined
  }
}

export async function getUserProfile(userId: string) {
  const user = await clerkClient.users.getUser(userId)
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email:
      user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)
        ?.emailAddress ?? null,
  }
}
