import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const taskValidator = v.object({
  id: v.string(),
  text: v.string(),
  done: v.boolean(),
});

export const noteContent = v.object({
  kind: v.literal("note"),
  text: v.string(),
  color: v.string(),
});

export const todoContent = v.object({
  kind: v.literal("todo"),
  title: v.string(),
  tasks: v.array(taskValidator),
});

export const spaceContent = v.object({
  kind: v.literal("space"),
  childSpaceId: v.id("spaces"),
});

// A freehand stroke. Points are [x0, y0, x1, y1, ...] relative to the item's
// top-left corner, so moving the item moves the whole stroke.
export const drawingContent = v.object({
  kind: v.literal("drawing"),
  color: v.string(),
  strokeWidth: v.number(),
  points: v.array(v.number()),
});

export const imageContent = v.object({
  kind: v.literal("image"),
  storageId: v.id("_storage"),
});

export default defineSchema({
  // A space is a canvas. Root spaces have no parent; nested spaces point at
  // the space whose canvas they sit on.
  spaces: defineTable({
    ownerId: v.string(),
    parentId: v.optional(v.id("spaces")),
    name: v.string(),
    color: v.string(),
  }).index("by_ownerId_and_parentId", ["ownerId", "parentId"]),

  // Everything placed on a canvas. Positions are in canvas (world) units.
  items: defineTable({
    ownerId: v.string(),
    spaceId: v.id("spaces"),
    x: v.number(),
    y: v.number(),
    width: v.number(),
    height: v.number(),
    z: v.number(),
    content: v.union(noteContent, todoContent, spaceContent, drawingContent, imageContent),
  }).index("by_spaceId", ["spaceId"]),
});
