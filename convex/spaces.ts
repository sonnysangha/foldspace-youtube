import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import * as model from "./model";

export const listRoot = query({
  args: {},
  handler: async (ctx) => model.listRootSpaces(ctx, await model.requireOwner(ctx)),
});

/** Every space the user owns, for building the sidebar tree on wide screens. */
export const listAll = query({
  args: {},
  handler: async (ctx) => model.listSpaces(ctx, await model.requireOwner(ctx)),
});

export const get = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) =>
    model.getSpaceWithPath(ctx, await model.requireOwner(ctx), args.spaceId),
});

export const create = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
    parentId: v.optional(v.id("spaces")),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
  },
  handler: async (ctx, args) =>
    model.createSpace(ctx, await model.requireOwner(ctx), args),
});

export const update = mutation({
  args: {
    spaceId: v.id("spaces"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await model.renameSpace(ctx, await model.requireOwner(ctx), args);
    return null;
  },
});

export const remove = mutation({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) => {
    await model.removeSpace(ctx, await model.requireOwner(ctx), args.spaceId);
    return null;
  },
});
