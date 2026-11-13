import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import * as model from "./model";
import { drawingContent, noteContent, todoContent } from "./schema";

const editableContent = v.union(noteContent, todoContent);
// Drawings can be created but not edited afterwards, only moved or removed.
const creatableContent = v.union(noteContent, todoContent, drawingContent);

export const list = query({
  args: { spaceId: v.id("spaces") },
  handler: async (ctx, args) =>
    model.listItems(ctx, await model.requireOwner(ctx), args.spaceId),
});

export const get = query({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const ownerId = await model.requireOwner(ctx);
    const item = await ctx.db.get("items", args.itemId);
    return item !== null && item.ownerId === ownerId ? item : null;
  },
});

export const create = mutation({
  args: {
    spaceId: v.id("spaces"),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    content: creatableContent,
  },
  handler: async (ctx, args) =>
    model.createItem(ctx, await model.requireOwner(ctx), args),
});

/** Called only after the HTTP endpoint has authenticated and stored the bytes. */
export const registerImageUpload = internalMutation({
  args: { ownerId: v.string(), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const uploadId = await ctx.db.insert("imageUploads", args);
    await ctx.scheduler.runAfter(60 * 60 * 1000, internal.items.expireImageUpload, { uploadId });
    return null;
  },
});

export const expireImageUpload = internalMutation({
  args: { uploadId: v.id("imageUploads") },
  returns: v.null(),
  handler: async (ctx, { uploadId }) => {
    const upload = await ctx.db.get("imageUploads", uploadId);
    if (upload) {
      await ctx.storage.delete(upload.storageId);
      await ctx.db.delete("imageUploads", uploadId);
    }
    return null;
  },
});

/** Consumes an authenticated upload belonging to the caller. */
export const createImage = mutation({
  args: {
    spaceId: v.id("spaces"),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    storageId: v.id("_storage"),
    imageWidth: v.number(),
    imageHeight: v.number(),
  },
  returns: v.id("items"),
  handler: async (ctx, args) =>
    model.createImageItem(ctx, await model.requireOwner(ctx), args),
});

export const update = mutation({
  args: {
    itemId: v.id("items"),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    content: v.optional(editableContent),
  },
  handler: async (ctx, args) => {
    await model.updateItem(ctx, await model.requireOwner(ctx), args);
    return null;
  },
});

export const remove = mutation({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    await model.removeItem(ctx, await model.requireOwner(ctx), args.itemId);
    return null;
  },
});
