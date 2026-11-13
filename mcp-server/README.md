# Foldspace MCP server

Lets a signed-in Foldspace user's AI agent (Claude Code, Cursor, VS Code) work in
their spaces: create spaces and nested spaces, add notes and to-do lists, edit,
move and delete them.

It follows Clerk's guide,
[Build and authenticate an MCP server with Clerk](https://clerk.com/docs/expressjs/guides/ai/mcp/build-mcp-server).

## How it works

1. The MCP client discovers Clerk as the authorization server from
   `/.well-known/oauth-protected-resource/mcp` and signs the user in with OAuth.
2. `POST /mcp` verifies the Clerk OAuth access token (signature, expiry and that
   its audience is this server's URL) and requires the `profile` and `email` scopes.
3. Each tool calls the Convex `/agent` HTTP action with a shared secret and the
   Clerk user id taken from the verified token. Convex scopes every read and
   write to that user. The user id never comes from tool input.

## Tools

`whoami`, `list_spaces`, `get_space`, `create_space`, `rename_space`,
`delete_space`, `add_note`, `update_note`, `add_todo_list`, `update_todo_list`,
`move_item`, `delete_item`.

## Run it locally

Needs Node.js 22.18 or later. The server reads the app's `../.env.local`:
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

## Connect Claude Code

The repo's `.mcp.json` already lists the server. Or add it yourself:

```bash
claude mcp add --transport http foldspace http://localhost:3000/mcp
claude mcp login foldspace
```

Sign in, select Allow on the Clerk consent screen, then ask Claude to
"list my Foldspace spaces".
