// Internal functions used by the MCP server (through convex/http.ts) and by
// background cleanup. They take an explicit ownerId because the caller has
// already authenticated the user with Clerk.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import * as model from "./model";
import { noteContent, todoContent } from "./schema";

export const listSpaces = internalQuery({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const spaces = await model.listSpaces(ctx, args.ownerId);
    return spaces.map((s) => ({
      id: s._id,
      name: s.name,
      color: s.color,
      parentId: s.parentId ?? null,
    }));
  },
});

export const getSpace = internalQuery({
  args: { ownerId: v.string(), spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const found = await model.getSpaceWithPath(ctx, args.ownerId, args.spaceId);
    if (found === null) return null;
    const items = await model.listItems(ctx, args.ownerId, args.spaceId);
    return {
      id: found.space._id,
      name: found.space.name,
      path: found.path.map((p) => p.name),
      items: items.map((item) => ({
        id: item._id,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        ...(item.content.kind === "space"
          ? {
              kind: "space" as const,
              spaceId: item.content.childSpaceId,
              name: item.child?.name ?? "",
            }
          : item.content),
      })),
    };
  },
});

export const createSpace = internalMutation({
  args: {
    ownerId: v.string(),
    name: v.string(),
    color: v.optional(v.string()),
    parentId: v.optional(v.id("spaces")),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
  },
  handler: async (ctx, { ownerId, ...args }) => model.createSpace(ctx, ownerId, args),
});

export const updateSpace = internalMutation({
  args: {
    ownerId: v.string(),
    spaceId: v.id("spaces"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, { ownerId, ...args }) => {
    await model.renameSpace(ctx, ownerId, args);
    return null;
  },
});

export const deleteSpace = internalMutation({
  args: { ownerId: v.string(), spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    await model.removeSpace(ctx, args.ownerId, args.spaceId);
    return null;
  },
});

export const createItem = internalMutation({
  args: {
    ownerId: v.string(),
    spaceId: v.id("spaces"),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    content: v.union(noteContent, todoContent),
  },
  handler: async (ctx, { ownerId, ...args }) => model.createItem(ctx, ownerId, args),
});

export const updateItem = internalMutation({
  args: {
    ownerId: v.string(),
    itemId: v.id("items"),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    content: v.optional(v.union(noteContent, todoContent)),
  },
  handler: async (ctx, { ownerId, ...args }) => {
    await model.updateItem(ctx, ownerId, args);
    return null;
  },
});

export const deleteItem = internalMutation({
  args: { ownerId: v.string(), itemId: v.id("items") },
  handler: async (ctx, args) => {
    await model.removeItem(ctx, args.ownerId, args.itemId);
    return null;
  },
});

/** Deletes a space and everything nested inside it, a batch at a time. */
export const purgeSpace = internalMutation({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    const batch = await ctx.db
      .query("items")
      .withIndex("by_spaceId", (q) => q.eq("spaceId", args.spaceId))
      .take(100);
    for (const item of batch) {
      if (item.content.kind === "space") {
        await ctx.scheduler.runAfter(0, internal.agent.purgeSpace, {
          spaceId: item.content.childSpaceId,
        });
      }
      if (item.content.kind === "image") {
        await ctx.storage.delete(item.content.storageId);
      }
      await ctx.db.delete("items", item._id);
    }
    if (batch.length === 100) {
      await ctx.scheduler.runAfter(0, internal.agent.purgeSpace, args);
      return null;
    }
    const space = await ctx.db.get("spaces", args.spaceId);
    if (space !== null) await ctx.db.delete("spaces", args.spaceId);
    return null;
  },
});
