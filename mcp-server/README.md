# Foldspace MCP server

Lets a signed-in Foldspace user's AI agent (Claude Code, Cursor, VS Code) work in
their spaces: create spaces and nested spaces, add notes and to-do lists, edit,
move and delete them.

It follows Clerk's guide,
[Build and authenticate an MCP server with Clerk](https://clerk.com/docs/expressjs/guides/ai/mcp/build-mcp-server).

## How it works

1. The MCP client discovers Clerk as the authorization server from
   `/.well-known/oauth-protected-resource/mcp` and signs the user in with OAuth.
2. `POST /mcp` verifies the Clerk OAuth access token (signature, issuer, expiry
   and that its audience is exactly this server's URL) and requires the `profile`
   and `email` scopes. Session tokens, API keys and tokens for another resource
   are rejected with a `WWW-Authenticate` challenge that points at the metadata.
3. Each tool calls the Convex `/agent` HTTP action with a shared secret and the
   Clerk user id taken from the verified token. Convex scopes every read and
   write to that user. The user id never comes from tool input.

## Tools

`whoami`, `list_spaces`, `get_space`, `create_space`, `rename_space`,
`delete_space`, `add_note`, `update_note`, `add_todo_list`, `update_todo_list`,
`move_item`, `delete_item`.

## Hosted server

The shared endpoint is **https://foldspace-mcp.vercel.app/mcp**. It is deployed
as a standalone Express app on Vercel and currently uses the Foldspace
**development** Clerk instance and Convex deployment (`fantastic-bullfrog-823`).
The Vercel production alias is a stable host; it does not point at a production
Foldspace database.

Verified on 13 November 2026: health/OAuth discovery, authentication challenges,
and read-only `whoami` / `list_spaces` calls pass. The project selects Node 26.x,
but its private runtime log currently reports v26.13.0, behind the latest
upstream security patch v26.13.1. Vercel controls patch rollout; an isolated
Node 24 probe also lagged its latest patch. See
[deployment and runtime evidence](../docs/mcp-vercel-recommendation.md#node-security-verification-13-november-2026).

The repository's `.mcp.json` connects to this hosted endpoint. In Claude Code:

```bash
claude mcp login foldspace
```

Complete Clerk sign-in and consent. Public liveness is available at
https://foldspace-mcp.vercel.app/health; the MCP endpoint itself requires OAuth.

## Tests

```bash
pnpm test
```

The tests start the real Express app and drive it with the MCP SDK client
against a stand-in Clerk (discovery, sign-in, PKCE code exchange, signing keys,
token introspection) and a stand-in Convex, so they need no secrets or network.
They cover metadata discovery, sign-in followed by tool calls, rejection of
missing, expired, wrong-audience, wrong-issuer, forged and session tokens, and
repeated and concurrent calls.

## Run it locally

Use Node.js 26 LTS with the latest security patch. The server reads the app's `../.env.local`:
`CLERK_SECRET_KEY`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`EXPO_PUBLIC_CONVEX_SITE_URL` and `AGENT_SECRET`. The Convex deployment needs the
same `AGENT_SECRET` plus `CLERK_FRONTEND_API_URL` (`npx convex env set`).

```bash
cd mcp-server
pnpm install
pnpm start   # http://localhost:3000/mcp
```

Set `PORT` or `MCP_RESOURCE_URL` to serve it somewhere else. The URL must match
the one registered with Clerk exactly.

## Register the URL with Clerk

Clerk only issues tokens for MCP URLs registered on the instance. For a local
URL, add it in the Clerk Dashboard under Agents, MCP servers, or with the Clerk CLI:

```bash
APP=app_xxx
BASE=/v1/platform/applications/$APP/instances/development
clerk api --platform $BASE/oauth_resources -d '{"uri":"http://localhost:3000/mcp","name":"Foldspace MCP (local)"}'
clerk api --platform $BASE/oauth_resources/<oares_id> -X PATCH -d '{"mcp_server":true}'
clerk api --platform $BASE/oauth_application_settings -X PATCH \
  -d '{"aud_claim_enabled":true,"client_id_metadata_documents_advertised":true}'
```

For a hosted HTTPS URL, use `configure_mcp_server` on Clerk's own MCP server instead.

## Connect Claude Code locally

Keep the hosted connection and add a separate local one:

```bash
claude mcp add --transport http foldspace-local http://localhost:3000/mcp
claude mcp login foldspace-local
```

Sign in, select Allow on the Clerk consent screen, then ask Claude to
"list my Foldspace spaces".

## Deploy to Vercel

Deploy from this `mcp-server/` directory, not the mobile app root. The project
is `sonnysanghas-projects/foldspace-mcp`. `vercel.json` selects Express, and
TypeScript rewrites local `.ts` import extensions for the deployed JavaScript.

Set these Vercel server environment variables before deploying:

- `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` for the intended Clerk instance.
- `CONVEX_SITE_URL` and `AGENT_SECRET` matching the intended Convex deployment.
- `MCP_RESOURCE_URL=https://foldspace-mcp.vercel.app/mcp`.

Keep secrets in Vercel's environment settings. `.vercelignore` excludes local
environment files and dependencies from uploads.

```bash
pnpm typecheck
vercel project inspect --non-interactive --scope sonnysanghas-projects
vercel deploy --prod --scope sonnysanghas-projects
```

The hosted URL is separately registered as an MCP OAuth resource in Clerk;
the localhost resource remains available for development. If the hosted URL
changes, update its Clerk resource, `MCP_RESOURCE_URL`, and client configuration
together. A new audience requires signing in again.
