import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export const SPACE_COLORS = [
  "#6C5CE7",
  "#00B894",
  "#E17055",
  "#0984E3",
  "#E84393",
  "#FDCB6E",
];
export const NOTE_COLORS = ["#FFF3B0", "#FFD6E0", "#D7F9E9", "#DCEBFF", "#EADCFF"];

const DEFAULT_SIZE = {
  note: { width: 220, height: 180 },
  todo: { width: 250, height: 230 },
  space: { width: 210, height: 150 },
} as const;

// The longest side of a freshly added image card, in canvas units.
const MAX_IMAGE_SIDE = 260;
const MAX_ITEMS_PER_SPACE = 500;
const MAX_SPACES = 500;

export type EditableContent =
  | { kind: "note"; text: string; color: string }
  | {
      kind: "todo";
      title: string;
      tasks: { id: string; text: string; done: boolean }[];
    };

export type DrawingContent = {
  kind: "drawing";
  color: string;
  strokeWidth: number;
  points: number[];
};

/** Content a client may create. Drawings are write-once, so they are not editable. */
export type CreatableContent = EditableContent | DrawingContent;

// A stroke is stored in one document, so keep it well inside Convex's
// 8192-value array limit.
const MAX_DRAWING_VALUES = 8000;
const MAX_STROKE_WIDTH = 64;

/**
 * Checks a stroke and returns the size of the item that holds it. Points are
 * relative to the item's top-left corner, so the box runs from the origin to
 * the furthest point plus room for the stroke's own thickness.
 */
function drawingSize(content: DrawingContent): { width: number; height: number } {
  const { points, strokeWidth } = content;
  if (points.length < 4 || points.length % 2 !== 0 || points.length > MAX_DRAWING_VALUES) {
    throw new ConvexError("A drawing needs between 2 and 4000 points");
  }
  if (!(strokeWidth > 0 && strokeWidth <= MAX_STROKE_WIDTH)) {
    throw new ConvexError("Stroke width is out of range");
  }
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) {
      throw new ConvexError("Drawing points must be relative to the item's top-left corner");
    }
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { width: Math.ceil(maxX + strokeWidth), height: Math.ceil(maxY + strokeWidth) };
}

/** The signed-in user's stable identity key. Throws when signed out. */
export async function requireOwner(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw new ConvexError("Not signed in");
  return identity.tokenIdentifier;
}

export async function loadSpace(
  ctx: QueryCtx | MutationCtx,
  ownerId: string,
  spaceId: Id<"spaces">,
): Promise<Doc<"spaces">> {
  const space = await ctx.db.get("spaces", spaceId);
  if (space === null || space.ownerId !== ownerId) {
    throw new ConvexError("Space not found");
  }
  return space;
}

async function loadItem(
  ctx: QueryCtx | MutationCtx,
  ownerId: string,
  itemId: Id<"items">,
): Promise<Doc<"items">> {
  const item = await ctx.db.get("items", itemId);
  if (item === null || item.ownerId !== ownerId) {
    throw new ConvexError("Item not found");
  }
  return item;
}

export async function listSpaces(ctx: QueryCtx, ownerId: string) {
  return await ctx.db
    .query("spaces")
    .withIndex("by_ownerId_and_parentId", (q) => q.eq("ownerId", ownerId))
    .take(MAX_SPACES);
}

export async function listRootSpaces(ctx: QueryCtx, ownerId: string) {
  return await ctx.db
    .query("spaces")
    .withIndex("by_ownerId_and_parentId", (q) =>
      q.eq("ownerId", ownerId).eq("parentId", undefined),
    )
    .take(MAX_SPACES);
}

/** A space plus the chain of ancestors from the root down to it. */
export async function getSpaceWithPath(
  ctx: QueryCtx,
  ownerId: string,
  spaceId: Id<"spaces">,
) {
  const space = await ctx.db.get("spaces", spaceId);
  if (space === null || space.ownerId !== ownerId) return null;
  const path: { _id: Id<"spaces">; name: string }[] = [];
  let current: Doc<"spaces"> | null = space;
  for (let depth = 0; current !== null && depth < 50; depth++) {
    path.unshift({ _id: current._id, name: current.name });
    current = current.parentId ? await ctx.db.get("spaces", current.parentId) : null;
  }
  return { space, path };
}

export async function listItems(ctx: QueryCtx, ownerId: string, spaceId: Id<"spaces">) {
  await loadSpace(ctx, ownerId, spaceId);
  const items = await ctx.db
    .query("items")
    .withIndex("by_spaceId", (q) => q.eq("spaceId", spaceId))
    .take(MAX_ITEMS_PER_SPACE);
  return await Promise.all(
    items.map(async (item) => {
      if (item.content.kind === "image") {
        // Signed URL for the stored file; null if the file has gone missing.
        const imageUrl = await ctx.storage.getUrl(item.content.storageId);
        return { ...item, child: null, imageUrl };
      }
      if (item.content.kind !== "space") {
        return { ...item, child: null, imageUrl: null };
      }
      const child = await ctx.db.get("spaces", item.content.childSpaceId);
      return {
        ...item,
        child: child ? { name: child.name, color: child.color } : null,
        imageUrl: null,
      };
    }),
  );
}

/** Where to drop a new item when the caller did not pick a spot. */
async function nextPosition(ctx: MutationCtx, spaceId: Id<"spaces">) {
  const existing = await ctx.db
    .query("items")
    .withIndex("by_spaceId", (q) => q.eq("spaceId", spaceId))
    .take(MAX_ITEMS_PER_SPACE);
  if (existing.length >= MAX_ITEMS_PER_SPACE) {
    throw new ConvexError("This space is full");
  }
  const n = existing.length;
  return { x: 40 + (n % 3) * 280, y: 40 + Math.floor(n / 3) * 260 };
}

export async function createSpace(
  ctx: MutationCtx,
  ownerId: string,
  args: {
    name: string;
    color?: string;
    parentId?: Id<"spaces">;
    x?: number;
    y?: number;
  },
): Promise<Id<"spaces">> {
  const name = args.name.trim() || "Untitled space";
  const color =
    args.color ?? SPACE_COLORS[Math.floor(Math.random() * SPACE_COLORS.length)];
  if (args.parentId === undefined) {
    return await ctx.db.insert("spaces", { ownerId, name, color });
  }
  await loadSpace(ctx, ownerId, args.parentId);
  const auto = await nextPosition(ctx, args.parentId);
  const spaceId = await ctx.db.insert("spaces", {
    ownerId,
    name,
    color,
    parentId: args.parentId,
  });
  await ctx.db.insert("items", {
    ownerId,
    spaceId: args.parentId,
    x: args.x ?? auto.x,
    y: args.y ?? auto.y,
    ...DEFAULT_SIZE.space,
    z: Date.now(),
    content: { kind: "space", childSpaceId: spaceId },
  });
  return spaceId;
}

export async function renameSpace(
  ctx: MutationCtx,
  ownerId: string,
  args: { spaceId: Id<"spaces">; name?: string; color?: string },
) {
  await loadSpace(ctx, ownerId, args.spaceId);
  const patch: { name?: string; color?: string } = {};
  if (args.name !== undefined) patch.name = args.name.trim() || "Untitled space";
  if (args.color !== undefined) patch.color = args.color;
  await ctx.db.patch("spaces", args.spaceId, patch);
}

export async function createItem(
  ctx: MutationCtx,
  ownerId: string,
  args: {
    spaceId: Id<"spaces">;
    x?: number;
    y?: number;
    content: CreatableContent;
  },
): Promise<Id<"items">> {
  await loadSpace(ctx, ownerId, args.spaceId);
  const auto = await nextPosition(ctx, args.spaceId);
  const size =
    args.content.kind === "drawing" ? drawingSize(args.content) : DEFAULT_SIZE[args.content.kind];
  return await ctx.db.insert("items", {
    ownerId,
    spaceId: args.spaceId,
    x: args.x ?? auto.x,
    y: args.y ?? auto.y,
    ...size,
    z: Date.now(),
    content: args.content,
  });
}

/**
 * Places an uploaded file on the canvas as an image card. The card keeps the
 * picture's aspect ratio, scaled so its longest side is MAX_IMAGE_SIDE.
 */
export async function createImageItem(
  ctx: MutationCtx,
  ownerId: string,
  args: {
    spaceId: Id<"spaces">;
    x?: number;
    y?: number;
    storageId: Id<"_storage">;
    imageWidth: number;
    imageHeight: number;
  },
): Promise<Id<"items">> {
  await loadSpace(ctx, ownerId, args.spaceId);
  const upload = await ctx.db
    .query("imageUploads")
    .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
    .unique();
  if (upload === null || upload.ownerId !== ownerId) {
    throw new ConvexError("Image upload not found or already used");
  }
  const file = await ctx.db.system.get("_storage", args.storageId);
  if (file === null) throw new ConvexError("Upload not found");
  if (file.contentType === undefined || !file.contentType.startsWith("image/")) {
    throw new ConvexError("That file is not an image");
  }
  // This and the insert commit together. Concurrent/replayed creates cannot
  // attach the same file to another card, including another user's card.
  await ctx.db.delete("imageUploads", upload._id);
  const auto = await nextPosition(ctx, args.spaceId);
  const known = args.imageWidth > 0 && args.imageHeight > 0;
  const scale = known
    ? MAX_IMAGE_SIDE / Math.max(args.imageWidth, args.imageHeight)
    : 1;
  return await ctx.db.insert("items", {
    ownerId,
    spaceId: args.spaceId,
    x: args.x ?? auto.x,
    y: args.y ?? auto.y,
    width: known ? Math.max(60, Math.round(args.imageWidth * scale)) : MAX_IMAGE_SIDE,
    height: known ? Math.max(60, Math.round(args.imageHeight * scale)) : 195,
    z: Date.now(),
    content: { kind: "image", storageId: args.storageId },
  });
}

export async function updateItem(
  ctx: MutationCtx,
  ownerId: string,
  args: {
    itemId: Id<"items">;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    content?: EditableContent;
  },
) {
  const item = await loadItem(ctx, ownerId, args.itemId);
  if (args.content !== undefined && args.content.kind !== item.content.kind) {
    throw new ConvexError("An item cannot change kind");
  }
  const { itemId, ...fields } = args;
  const patch: Partial<Doc<"items">> = { z: Date.now() };
  if (fields.x !== undefined) patch.x = fields.x;
  if (fields.y !== undefined) patch.y = fields.y;
  if (fields.width !== undefined) patch.width = fields.width;
  if (fields.height !== undefined) patch.height = fields.height;
  if (fields.content !== undefined) patch.content = fields.content;
  await ctx.db.patch("items", itemId, patch);
}

export async function removeItem(ctx: MutationCtx, ownerId: string, itemId: Id<"items">) {
  const item = await loadItem(ctx, ownerId, itemId);
  await ctx.db.delete("items", itemId);
  if (item.content.kind === "image") {
    await ctx.storage.delete(item.content.storageId);
  }
  if (item.content.kind === "space") {
    await ctx.scheduler.runAfter(0, internal.agent.purgeSpace, {
      spaceId: item.content.childSpaceId,
    });
  }
}

/** Delete a space, the card that links to it from its parent, and everything inside. */
export async function removeSpace(ctx: MutationCtx, ownerId: string, spaceId: Id<"spaces">) {
  const space = await loadSpace(ctx, ownerId, spaceId);
  if (space.parentId !== undefined) {
    const siblings = await ctx.db
      .query("items")
      .withIndex("by_spaceId", (q) => q.eq("spaceId", space.parentId!))
      .take(MAX_ITEMS_PER_SPACE);
    for (const item of siblings) {
      if (item.content.kind === "space" && item.content.childSpaceId === spaceId) {
        await ctx.db.delete("items", item._id);
      }
    }
  }
  await ctx.scheduler.runAfter(0, internal.agent.purgeSpace, { spaceId });
}
