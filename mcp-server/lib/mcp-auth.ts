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
export const RESOURCE_METADATA_URL = new URL(
  '/.well-known/oauth-protected-resource/mcp',
  MCP_RESOURCE_URL,
).href

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  apiUrl: process.env.CLERK_API_URL,
})

/**
 * Accepts only OAuth access tokens issued by our Clerk instance for this MCP
 * server (signature, expiry and audience are all checked).
 */
export async function verifyMcpToken(request: Request) {
  try {
    const requestState = await clerkClient.authenticateRequest(request, {
      acceptsToken: 'oauth_token',
      audience: MCP_RESOURCE_URL,
    })
    if (!requestState.isAuthenticated) return undefined

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
