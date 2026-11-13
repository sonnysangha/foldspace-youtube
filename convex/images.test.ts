/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const aliceIdentity = { subject: "user_alice", issuer: "https://test.clerk.accounts.dev", tokenIdentifier: "https://test.clerk.accounts.dev|user_alice" };
const bobIdentity = { subject: "user_bob", issuer: "https://test.clerk.accounts.dev", tokenIdentifier: "https://test.clerk.accounts.dev|user_bob" };

async function setup() {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity(aliceIdentity);
  const bob = t.withIdentity(bobIdentity);
  const aliceSpace = await alice.mutation(api.spaces.create, { name: "Alice" });
  const bobSpace = await bob.mutation(api.spaces.create, { name: "Bob" });
  const response = await alice.fetch("/images/upload", {
    method: "POST", headers: { "Content-Type": "image/png" }, body: new Uint8Array([137, 80, 78, 71]),
  });
  expect(response.status).toBe(200);
  const { storageId } = await response.json() as { storageId: Id<"_storage"> };
  const args = { spaceId: aliceSpace, storageId, imageWidth: 400, imageHeight: 200 };
  return { t, alice, bob, aliceSpace, bobSpace, storageId, args };
}

afterEach(() => vi.useRealTimers());

describe("image ownership", () => {
  it("requires authentication and rejects invalid uploads", async () => {
    const t = convexTest(schema, modules);
    const request = { method: "POST", headers: { "Content-Type": "image/png" }, body: "image" };
    expect((await t.fetch("/images/upload", request)).status).toBe(401);
    const alice = t.withIdentity(aliceIdentity);
    expect((await alice.fetch("/images/upload", { ...request, headers: { "Content-Type": "text/plain" } })).status).toBe(415);
    expect((await alice.fetch("/images/upload", { ...request, body: "" })).status).toBe(413);
    expect((await alice.fetch("/images/upload", { ...request, headers: { ...request.headers, "Content-Length": String(21 * 1024 * 1024) } })).status).toBe(413);
    expect((await t.run((ctx) => ctx.db.query("imageUploads").collect()))).toHaveLength(0);
  });

  it("allows only the uploader to attach a file, even when another user knows its ID", async () => {
    const { t, alice, bob, bobSpace, args, storageId } = await setup();
    await expect(bob.mutation(api.items.createImage, { ...args, spaceId: bobSpace })).rejects.toThrow("Image upload not found");
    await expect(t.mutation(api.items.createImage, args)).rejects.toThrow("Not signed in");
    const id = await alice.mutation(api.items.createImage, args);
    expect((await alice.query(api.items.get, { itemId: id }))?.content).toEqual({ kind: "image", storageId });
    expect((await alice.query(api.items.list, { spaceId: args.spaceId }))[0].imageUrl).toBeTruthy();
  });

  it("rejects raw storage IDs that never passed through the authenticated endpoint", async () => {
    const { t, alice, args } = await setup();
    const rawId = await t.run((ctx) => ctx.storage.store(new Blob(["raw"], { type: "image/png" })));
    await expect(alice.mutation(api.items.createImage, { ...args, storageId: rawId })).rejects.toThrow("Image upload not found");
    expect(await t.run((ctx) => ctx.db.system.get("_storage", rawId))).not.toBeNull();
  });

  it("rejects reuse within or across accounts and keeps the original file intact", async () => {
    const { t, alice, bob, bobSpace, args, storageId } = await setup();
    await alice.mutation(api.items.createImage, args);
    await expect(alice.mutation(api.items.createImage, args)).rejects.toThrow("already used");
    await expect(bob.mutation(api.items.createImage, { ...args, spaceId: bobSpace })).rejects.toThrow("already used");
    expect(await t.run((ctx) => ctx.db.system.get("_storage", storageId))).not.toBeNull();
  });

  it("preserves an upload when attachment to another user's space fails", async () => {
    const { alice, bobSpace, args } = await setup();
    await expect(alice.mutation(api.items.createImage, { ...args, spaceId: bobSpace })).rejects.toThrow("Space not found");
    await expect(alice.mutation(api.items.createImage, args)).resolves.toBeTruthy();
  });

  it("deletes a card's file without affecting another user's image", async () => {
    const { t, alice, bob, bobSpace, args, storageId } = await setup();
    const uploaded = await bob.fetch("/images/upload", { method: "POST", headers: { "Content-Type": "image/png" }, body: "bob" });
    const other = await uploaded.json() as { storageId: Id<"_storage"> };
    await bob.mutation(api.items.createImage, { ...args, spaceId: bobSpace, storageId: other.storageId });
    const id = await alice.mutation(api.items.createImage, args);
    await expect(bob.mutation(api.items.remove, { itemId: id })).rejects.toThrow("Item not found");
    await alice.mutation(api.items.remove, { itemId: id });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", storageId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get("_storage", other.storageId))).not.toBeNull();
  });

  it("expires abandoned uploads but never deletes an attached image", async () => {
    vi.useFakeTimers();
    const { t, alice, args, storageId } = await setup();
    const abandoned = await alice.fetch("/images/upload", { method: "POST", headers: { "Content-Type": "image/png" }, body: "abandoned" });
    const other = await abandoned.json() as { storageId: Id<"_storage"> };
    await alice.mutation(api.items.createImage, args);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await t.run((ctx) => ctx.db.system.get("_storage", other.storageId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get("_storage", storageId))).not.toBeNull();
  });

  it("removes the stored image when its space is purged", async () => {
    const { t, alice, aliceSpace, args, storageId } = await setup();
    await alice.mutation(api.items.createImage, args);
    await t.mutation(internal.agent.purgeSpace, { spaceId: aliceSpace });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", storageId))).toBeNull();
  });
});
