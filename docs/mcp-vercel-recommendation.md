# Foldspace MCP: Vercel deployment and eve

Research checked 13 November 2026. Recommendation: deploy the existing Express server now; introduce eve if Foldspace gains its own durable AI agent.

## Why keep Express for this endpoint

The current server exposes 12 deterministic tools. Each verifies a Clerk OAuth token and forwards a user-scoped operation to Convex. It does not run a model, maintain conversation memory, spawn agents, or need durable execution. The installed Clerk transport creates a stateless MCP transport per request and closes it with the HTTP response. This already suits a function deployment.

Vercel supports `index.ts` Express entry points, including the current `app.listen` form; default-exporting the app is also supported. Express becomes a Vercel Function, and response streaming is supported. A framework migration is not a prerequisite. [Express on Vercel](https://vercel.com/docs/frameworks/backend/express)

## What eve would add

eve is a durable-agent framework: authored tools, instructions, skills, channels, schedules, memory, subagents, and resumable work. On Vercel it integrates with Workflow, Sandbox, model access, and Agent Runs. Those are useful for a future “organise my workspace” agent that plans and carries out work, rather than exposing CRUD tools to someone else's agent. [eve deployment architecture](https://eve.dev/docs/guides/deployment)

eve can serve our use case: `mcpChannel({ agent: false, tools: true, route: '/mcp', auth: ... })` publishes authored tools without invoking a model. It supports stateless Streamable HTTP and OAuth resource metadata. Migration would require translating all tools and their caller context, then revalidating clients. It would add capability, but does not remove a current blocker. [eve MCP channel](https://eve.dev/docs/channels/mcp)

## Authentication parity matters

Keep signature, expiration, exact resource-audience checks, required `profile`/`email` scopes, and a user ID derived exclusively from the verified token. Register the stable HTTPS `/mcp` URL with Clerk, and use that same value in `MCP_RESOURCE_URL`, discovery, and clients. Preview URLs should not silently become the token audience. [Clerk MCP server guide](https://clerk.com/docs/expressjs/guides/ai/mcp/build-mcp-server)

Clerk documents eve integration through a custom channel authenticator. Its generic example maps OAuth callers to a machine principal and carries the resource owner in `attributes.userId`. A Foldspace migration must preserve that owner when calling Convex; substituting the OAuth client/principal ID would break isolation. `oauthResource()` can supply MCP discovery around the verifier. [Clerk channel authentication](https://clerk.com/docs/guides/ai/eve/custom-channel-auth)

## Concrete deployment path

1. Use `mcp-server` as a separate Vercel project root so the Expo app is not built as a website.
2. Use the newest supported LTS major (Node 26.x), and keep the existing lockfile and MCP SDK v1 for this deployment.
3. Configure server-only `CLERK_SECRET_KEY`, Clerk publishable key, `CONVEX_SITE_URL`, `AGENT_SECRET`, and the stable `MCP_RESOURCE_URL`. Keep the local `.env.local` out of uploads; production uses Vercel environment variables.
4. Deploy, register the hosted resource in the intended Clerk instance, and verify discovery plus unauthenticated 401 and insufficient-scope 403 responses.
5. Complete real client OAuth and exercise all 12 tools, including cross-user denial and create/update/delete round trips.

Do not migrate to Vercel's `mcp-handler` merely to deploy Express. Current Vercel examples use `mcp-handler` v2 plus MCP server SDK v2, which is a separate API migration from our installed `@modelcontextprotocol/sdk` v1.32.2. Requests remain subject to Function duration limits; use durable work only if a tool actually needs longer execution. [Vercel MCP hosting](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel)

## Status

Deployed on 13 November 2026 to **https://foldspace-mcp.vercel.app/mcp** using
Node.js 26.x, Express, and Clerk/Convex development resources. Vercel deployment
`dpl_DoMHEdWfaWJNJv4XbFTBRkXXEBmD` is READY. The mobile frontend was not deployed.

Verified `/health` and both OAuth discovery endpoints return 200, missing and
invalid tokens return 401 with the resource-metadata challenge, and GET `/mcp`
returns 405. Completed real Clerk OAuth in Claude Code against the hosted
audience, then successfully called `whoami` and `list_spaces` read-only. No
personal content was changed. The insufficient-scope response and mutating
tool round trips were not exercised in this deployment check.

The deployment required TypeScript 6.0.3 and
`rewriteRelativeImportExtensions: true`: the initial TypeScript 7 build could
not resolve Node types, and emitted `.ts` import paths initially failed at
runtime. Both issues were corrected before the successful checks.

### Node security verification (13 November 2026)

Both `package.json` and the Vercel project select Node 26.x, the newest supported
LTS major. The deployed function's private startup log reports **v26.13.0**.
The latest upstream security release is **v26.13.1**, published 11 November;
therefore the latest security patch is **not yet verified on this deployment**.
[Node release](https://nodejs.org/en/blog/release/v26.13.1)

Vercel exposes major-version selection only and rolls out minor/patch updates
itself. A separate Node 24 deployment, created without changing the stable
alias, reported v24.22.2; it also trails its latest security release v24.22.3.
Switching back to Node 24 would not resolve the observed patch gap. No exact
patch pin or custom runtime workaround was applied.
[Vercel runtime policy](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
[Node 24 security release](https://nodejs.org/en/blog/release/v24.22.3)

Health, discovery, the unauthenticated 401 challenge, and authenticated
`whoami` / `list_spaces` were rechecked successfully after the Node 26 deploy.
These functional checks do not establish that the security patch is present.
Recheck the private startup version after Vercel's patch rollout; do not label
this runtime fully up to date until it reports at least v26.13.1.

No eve migration was made. An eve prototype can be evaluated separately.
