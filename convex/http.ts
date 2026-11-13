import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

const uploadCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

http.route({
  path: "/images/upload",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: uploadCors })),
});

// Receive the bytes ourselves: a client-supplied storage ID is not proof that
// the caller uploaded the file. The owner comes from the verified Clerk JWT.
http.route({
  path: "/images/upload",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
      status,
      headers: { ...uploadCors, "Content-Type": "application/json" },
    });
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return respond({ error: "Not signed in" }, 401);
    const contentType = req.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
    if (!contentType?.startsWith("image/")) {
      return respond({ error: "That file is not an image" }, 415);
    }
    const maxBytes = 20 * 1024 * 1024;
    if (Number(req.headers.get("Content-Length")) > maxBytes) {
      return respond({ error: "Image must be 20 MB or smaller" }, 413);
    }
    const blob = await req.blob();
    if (blob.size === 0 || blob.size > maxBytes) {
      return respond({ error: "Image must be between 1 byte and 20 MB" }, 413);
    }
    const storageId = await ctx.storage.store(blob);
    try {
      await ctx.runMutation(internal.items.registerImageUpload, {
        ownerId: identity.tokenIdentifier,
        storageId,
      });
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
    return respond({ storageId });
  }),
});

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
