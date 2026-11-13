// End-to-end tests for the MCP server's Clerk OAuth protection.
//
// Nothing here talks to the real Clerk or Convex. A stand-in Clerk authorization
// server (discovery, authorize, token, JWKS, token introspection) and a stand-in
// Convex /agent endpoint are served by intercepting fetch, and the real Express
// app runs on a local port. Run with `pnpm test`.
import assert from 'node:assert/strict'
import { createHash, createSign, generateKeyPairSync, randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { after, before, test } from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { UnauthorizedError, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'

const ISSUER = 'https://clerk.foldspace.test'
const CLERK_API = 'https://api.clerk.test'
const CONVEX = 'https://convex.test'
const AGENT_SECRET = 'test-agent-secret'
const REDIRECT_URI = 'http://localhost:9/callback'
const KID = 'ins_test_key'

const signingKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
const strangerKey = generateKeyPairSync('rsa', { modulusLength: 2048 })

let resourceUrl = ''
let origin = ''
let httpServer: Server

type Claims = Record<string, unknown>
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
const now = () => Math.floor(Date.now() / 1000)

function signJwt(claims: Claims, { typ = 'at+jwt', key = signingKey.privateKey } = {}) {
  const body = `${b64({ alg: 'RS256', typ, kid: KID })}.${b64(claims)}`
  return `${body}.${createSign('RSA-SHA256').update(body).sign(key).toString('base64url')}`
}

/** An access token exactly as the stand-in Clerk issues it, with optional overrides. */
function accessToken(userId: string, overrides: Claims = {}, options?: Parameters<typeof signJwt>[1]) {
  const claims: Claims = {
    iss: ISSUER,
    sub: userId,
    aud: resourceUrl,
    client_id: 'client_test',
    scope: 'profile email',
    jti: `oat_${randomUUID()}`,
    iat: now() - 5,
    nbf: now() - 5,
    exp: now() + 600,
    ...overrides,
  }
  for (const [name, value] of Object.entries(claims)) if (value === undefined) delete claims[name]
  return signJwt(claims, options)
}

// ---- Stand-in Clerk + Convex, reached through fetch ----

const authorizationCodes = new Map<string, { userId: string; challenge: string; resource: string; scope: string }>()
const opaqueTokens = new Map<string, { subject: string; aud: string[] }>()
const convexCalls: { userId: string; action: string }[] = []
const json = (body: unknown, status = 200) => Response.json(body, { status })

async function clerkIssuer(url: URL, request: Request) {
  if (url.pathname === '/.well-known/oauth-authorization-server') {
    return json({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/oauth/authorize`,
      token_endpoint: `${ISSUER}/oauth/token`,
      jwks_uri: `${ISSUER}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['openid', 'profile', 'email'],
      client_id_metadata_document_supported: true,
    })
  }
  if (url.pathname === '/oauth/authorize') {
    // The "sign-in": the test says which user is at the keyboard and consents.
    const userId = request.headers.get('x-test-signed-in-user')
    if (!userId) return json({ error: 'login_required' }, 401)
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
    const code = randomUUID()
    authorizationCodes.set(code, {
      userId,
      challenge: url.searchParams.get('code_challenge') ?? '',
      resource: url.searchParams.get('resource') ?? '',
      scope: url.searchParams.get('scope') ?? '',
    })
    const back = new URL(url.searchParams.get('redirect_uri') ?? '')
    back.searchParams.set('code', code)
    return new Response(null, { status: 302, headers: { location: back.href } })
  }
  if (url.pathname === '/oauth/token') {
    const form = new URLSearchParams(await request.text())
    const grant = authorizationCodes.get(form.get('code') ?? '')
    const challenge = createHash('sha256').update(form.get('code_verifier') ?? '').digest('base64url')
    if (!grant || grant.challenge !== challenge) return json({ error: 'invalid_grant' }, 400)
    authorizationCodes.delete(form.get('code') ?? '')
    return json({
      access_token: accessToken(grant.userId, { aud: grant.resource, scope: grant.scope }),
      token_type: 'Bearer',
      expires_in: 600,
      scope: grant.scope,
    })
  }
  return json({ error: 'not_found' }, 404)
}

async function clerkBackendApi(url: URL, request: Request) {
  if (request.headers.get('authorization') !== 'Bearer sk_test_standin') return json({ errors: [] }, 401)
  const path = url.pathname.replace(/^\/v1/, '')
  if (path === '/jwks') {
    return json({ keys: [{ ...signingKey.publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }] })
  }
  if (path === '/oauth_applications/access_tokens/verify') {
    const { access_token } = (await request.json()) as { access_token: string }
    const token = opaqueTokens.get(access_token)
    if (!token) return json({ errors: [{ code: 'token_invalid', message: 'not found' }] }, 404)
    return json({
      object: 'clerk_idp_oauth_access_token',
      id: 'oat_id',
      client_id: 'client_test',
      type: 'oauth_token',
      subject: token.subject,
      scopes: ['profile', 'email'],
      revoked: false,
      revocation_reason: null,
      expired: false,
      expiration: Date.now() + 600_000,
      created_at: Date.now(),
      updated_at: Date.now(),
      aud: token.aud,
    })
  }
  const user = path.match(/^\/users\/(user_\w+)$/)
  if (user) {
    return json({
      object: 'user',
      id: user[1],
      first_name: 'Test',
      last_name: user[1],
      primary_email_address_id: 'idn_1',
      email_addresses: [{ id: 'idn_1', object: 'email_address', email_address: `${user[1]}@example.com`, linked_to: [] }],
    })
  }
  return json({ errors: [] }, 404)
}

async function convexAgent(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${AGENT_SECRET}`) return json({ error: 'forbidden' }, 403)
  const { userId, action } = (await request.json()) as { userId: string; action: string }
  convexCalls.push({ userId, action })
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 20)) // let concurrent calls interleave
  return json({ result: [{ id: `space-of-${userId}`, name: 'Home', parentId: null }] })
}

const realFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const request = new Request(input, init)
  const url = new URL(request.url)
  if (url.origin === ISSUER) return clerkIssuer(url, request)
  if (url.origin === CLERK_API) return clerkBackendApi(url, request)
  if (url.origin === CONVEX) return convexAgent(request)
  return realFetch(input, init)
}

// ---- Helpers ----

/** A raw tools/call, so status codes and challenges can be asserted directly. */
async function callTool(token: string | undefined, name = 'list_spaces', headers: Record<string, string> = {}) {
  const response = await realFetch(resourceUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: randomUUID(), method: 'tools/call', params: { name, arguments: {} } }),
  })
  const raw = await response.text()
  const payload = raw.match(/^data: (.*)$/m)?.[1] ?? raw
  return { response, body: payload ? JSON.parse(payload) : undefined, challenge: response.headers.get('www-authenticate') }
}

function toolText(body: { result?: { content?: { text?: string }[] } }) {
  return body.result?.content?.[0]?.text ?? ''
}

async function assertRejected(token: string | undefined, label: string) {
  const before = convexCalls.length
  const { response, challenge } = await callTool(token)
  assert.equal(response.status, 401, label)
  assert.ok(challenge?.startsWith(`Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`), label)
  assert.equal(convexCalls.length, before, `${label}: must not reach Convex`)
  return challenge
}

class TestOAuthProvider implements OAuthClientProvider {
  authorizationUrl?: URL
  #tokens?: OAuthTokens
  #verifier = ''
  redirectUrl = REDIRECT_URI
  clientMetadata = { client_name: 'Foldspace test client', redirect_uris: [REDIRECT_URI] }
  clientInformation = () => ({ client_id: 'client_test' })
  tokens = () => this.#tokens
  saveTokens = (tokens: OAuthTokens) => void (this.#tokens = tokens)
  redirectToAuthorization = (url: URL) => void (this.authorizationUrl = url)
  saveCodeVerifier = (verifier: string) => void (this.#verifier = verifier)
  codeVerifier = () => this.#verifier
}

/** Connects a real MCP client the way Claude does: discovery, sign-in, code exchange, retry. */
async function connectSignedIn(userId: string) {
  const provider = new TestOAuthProvider()
  const firstTry = new StreamableHTTPClientTransport(new URL(resourceUrl), { authProvider: provider })
  await assert.rejects(new Client({ name: 'test', version: '1.0.0' }).connect(firstTry), UnauthorizedError)
  assert.ok(provider.authorizationUrl, 'the client was sent to the authorization server')

  const signIn = await fetch(provider.authorizationUrl, {
    redirect: 'manual',
    headers: { 'x-test-signed-in-user': userId },
  })
  const code = new URL(signIn.headers.get('location') ?? '').searchParams.get('code')
  assert.ok(code)
  await firstTry.finishAuth(code)

  const client = new Client({ name: 'test', version: '1.0.0' })
  await client.connect(new StreamableHTTPClientTransport(new URL(resourceUrl), { authProvider: provider }))
  return { client, provider }
}

before(async () => {
  const port = await new Promise<number>((resolve) => {
    const probe = createNetServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number }
      probe.close(() => resolve(port))
    })
  })
  origin = `http://127.0.0.1:${port}`
  resourceUrl = `${origin}/mcp`
  Object.assign(process.env, {
    VERCEL: '1', // export the app without listening on the default port
    MCP_RESOURCE_URL: resourceUrl,
    CLERK_SECRET_KEY: 'sk_test_standin',
    CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from(`${new URL(ISSUER).host}$`).toString('base64')}`,
    CLERK_API_URL: CLERK_API,
    CONVEX_SITE_URL: CONVEX,
    AGENT_SECRET,
  })
  const { default: app } = await import('../index.ts')
  await new Promise<void>((resolve) => {
    httpServer = app.listen(port, '127.0.0.1', () => resolve())
  })
})

after(() => {
  httpServer?.close()
  globalThis.fetch = realFetch
})

// ---- Tests ----

test('publishes protected-resource metadata for the exact resource, pointing at Clerk', async () => {
  const response = await realFetch(`${origin}/.well-known/oauth-protected-resource/mcp`, {
    headers: { origin: 'https://claude.ai' },
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), '*')
  const metadata = await response.json()
  assert.equal(metadata.resource, resourceUrl)
  assert.deepEqual(metadata.authorization_servers, [ISSUER])
  assert.deepEqual(metadata.scopes_supported, ['profile', 'email'])
  assert.equal(metadata.jwks_uri, `${ISSUER}/.well-known/jwks.json`)
})

test('serves authorization-server discovery taken from the Clerk issuer', async () => {
  const response = await realFetch(`${origin}/.well-known/oauth-authorization-server`)
  assert.equal(response.status, 200)
  const metadata = await response.json()
  assert.equal(metadata.issuer, ISSUER)
  assert.equal(metadata.authorization_endpoint, `${ISSUER}/oauth/authorize`)
  assert.equal(metadata.token_endpoint, `${ISSUER}/oauth/token`)
  assert.deepEqual(metadata.code_challenge_methods_supported, ['S256'])
})

test('challenges a request with no token and points at the metadata', async () => {
  const challenge = await assertRejected(undefined, 'missing token')
  assert.ok(!challenge?.includes('error='), 'a missing token is not reported as an invalid one')
  const basic = await callTool(undefined, 'list_spaces', { authorization: 'Basic dXNlcjpwYXNz' })
  assert.equal(basic.response.status, 401)
})

test('a client signs in with Clerk and then calls tools as that user', async () => {
  const { client, provider } = await connectSignedIn('user_alice')

  // The client asked for a token bound to this exact resource.
  assert.equal(provider.authorizationUrl?.origin, ISSUER)
  assert.equal(provider.authorizationUrl?.searchParams.get('resource'), resourceUrl)

  const { tools } = await client.listTools()
  assert.equal(tools.length, 12)

  const whoami = await client.callTool({ name: 'whoami', arguments: {} })
  assert.equal(JSON.parse(toolText({ result: whoami as never })).id, 'user_alice')

  const before = convexCalls.length
  const spaces = await client.callTool({ name: 'list_spaces', arguments: {} })
  assert.match(toolText({ result: spaces as never }), /space-of-user_alice/)
  assert.deepEqual(convexCalls.slice(before), [{ userId: 'user_alice', action: 'list_spaces' }])
  await client.close()
})

test('rejects expired tokens', async () => {
  const challenge = await assertRejected(
    accessToken('user_alice', { iat: now() - 7200, nbf: now() - 7200, exp: now() - 3600 }),
    'expired token',
  )
  assert.match(challenge ?? '', /error="invalid_token"/)
})

test('rejects tokens for another audience, or with none', async () => {
  await assertRejected(accessToken('user_alice', { aud: 'https://other.example.com/mcp' }), 'other resource')
  await assertRejected(accessToken('user_alice', { aud: origin }), 'origin without the /mcp path')
  await assertRejected(accessToken('user_alice', { aud: `${resourceUrl}/` }), 'trailing slash')
  await assertRejected(accessToken('user_alice', { aud: [`${resourceUrl}/x`, 'https://other.example.com'] }), 'list without it')
  await assertRejected(accessToken('user_alice', { aud: undefined }), 'no audience')
})

test('rejects tokens from another issuer or signed with another key', async () => {
  await assertRejected(accessToken('user_alice', { iss: 'https://evil.example.com' }), 'wrong issuer')
  await assertRejected(accessToken('user_alice', { iss: undefined }), 'no issuer')
  await assertRejected(accessToken('user_alice', {}, { key: strangerKey.privateKey }), 'wrong signing key')
  const [header, , signature] = accessToken('user_alice').split('.')
  const forged = `${header}.${b64({ iss: ISSUER, sub: 'user_bob', aud: resourceUrl, exp: now() + 600 })}.${signature}`
  await assertRejected(forged, 'payload swapped after signing')
  await assertRejected(`${b64({ alg: 'none', typ: 'at+jwt' })}.${b64({ iss: ISSUER, sub: 'user_bob', aud: resourceUrl, exp: now() + 600 })}.`, 'unsigned token')
  await assertRejected('not-a-token', 'garbage')
})

test('rejects Clerk session tokens used in place of OAuth access tokens', async () => {
  const sessionToken = accessToken('user_alice', { sid: 'sess_1', azp: origin }, { typ: 'JWT' })
  await assertRejected(sessionToken, 'session token')
})

test('opaque tokens are introspected and bound to this resource', async () => {
  opaqueTokens.set('oat_good', { subject: 'user_carol', aud: [resourceUrl] })
  opaqueTokens.set('oat_elsewhere', { subject: 'user_carol', aud: ['https://other.example.com/mcp'] })
  const ok = await callTool('oat_good')
  assert.equal(ok.response.status, 200)
  assert.match(toolText(ok.body), /space-of-user_carol/)
  await assertRejected('oat_elsewhere', 'opaque token for another resource')
  await assertRejected('oat_unknown', 'opaque token Clerk does not know')
})

test('a valid token without the required scopes gets an insufficient_scope challenge', async () => {
  const { response, challenge } = await callTool(accessToken('user_alice', { scope: 'profile' }))
  assert.equal(response.status, 403)
  assert.match(challenge ?? '', /error="insufficient_scope", scope="profile email"/)
})

test('repeated calls on one connection keep working', async () => {
  const { client } = await connectSignedIn('user_dave')
  for (let i = 0; i < 10; i++) {
    const result = await client.callTool({ name: 'list_spaces', arguments: {} })
    assert.match(toolText({ result: result as never }), /space-of-user_dave/)
  }
  await client.close()
})

test('concurrent calls from different users never see each other', async () => {
  const users = Array.from({ length: 40 }, (_, i) => `user_${i % 4}`)
  const results = await Promise.all(users.map((userId) => callTool(accessToken(userId))))
  results.forEach(({ response, body }, i) => {
    assert.equal(response.status, 200)
    assert.match(toolText(body), new RegExp(`space-of-${users[i]}"`))
  })
  // An invalid request in the middle of the burst does not disturb the others.
  const mixed = await Promise.all([callTool(accessToken('user_1')), callTool(undefined), callTool(accessToken('user_2'))])
  assert.deepEqual(mixed.map(({ response }) => response.status), [200, 401, 200])
})
