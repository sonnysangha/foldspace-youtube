import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// The MCP server calls this after it has verified the user's Clerk OAuth
// token. It proves it is our MCP server with a shared secret and tells us
// which Clerk user it is acting for.
http.route({
  path: "/agent",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.AGENT_SECRET;
    const issuer = process.env.CLERK_FRONTEND_API_URL;
    if (!secret || !issuer) return json({ error: "Agent access is not configured" }, 503);
    if (req.headers.get("Authorization") !== `Bearer ${secret}`) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body: unknown = await req.json().catch(() => null);
    if (typeof body !== "object" || body === null) return json({ error: "Invalid body" }, 400);
    const { userId, action, args } = body as Record<string, unknown>;
    if (typeof userId !== "string" || !userId.startsWith("user_")) {
      return json({ error: "Invalid userId" }, 400);
    }
    if (typeof action !== "string") return json({ error: "Invalid action" }, 400);
    const input = (typeof args === "object" && args !== null ? args : {}) as Record<string, any>;

    // Matches identity.tokenIdentifier for the same user signed in to the app.
    const ownerId = `${issuer}|${userId}`;

    try {
      switch (action) {
        case "list_spaces":
          return json({ result: await ctx.runQuery(internal.agent.listSpaces, { ownerId }) });
        case "get_space":
          return json({
            result: await ctx.runQuery(internal.agent.getSpace, { ownerId, spaceId: input.spaceId }),
          });
        case "create_space":
          return json({
            result: await ctx.runMutation(internal.agent.createSpace, { ...input, ownerId } as any),
          });
        case "update_space":
          return json({
            result: await ctx.runMutation(internal.agent.updateSpace, { ...input, ownerId } as any),
          });
        case "delete_space":
          return json({
            result: await ctx.runMutation(internal.agent.deleteSpace, { ownerId, spaceId: input.spaceId }),
          });
        case "create_item":
          return json({
            result: await ctx.runMutation(internal.agent.createItem, { ...input, ownerId } as any),
          });
        case "update_item":
          return json({
            result: await ctx.runMutation(internal.agent.updateItem, { ...input, ownerId } as any),
          });
        case "delete_item":
          return json({
            result: await ctx.runMutation(internal.agent.deleteItem, { ownerId, itemId: input.itemId }),
          });
        default:
          return json({ error: `Unknown action: ${action}` }, 400);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      return json({ error: message }, 400);
    }
  }),
});

export default http;
