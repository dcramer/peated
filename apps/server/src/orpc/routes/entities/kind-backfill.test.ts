import { db } from "@peated/server/db";
import { bottleTombstones, entities } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { inferKindFromLegacyTypes } from "./kind-backfill";

describe("inferKindFromLegacyTypes", () => {
  test.each([
    { legacyTypes: ["brand"] as const, kind: "brand" },
    { legacyTypes: ["bottler"] as const, kind: "bottler" },
    { legacyTypes: ["distiller"] as const, kind: "distillery" },
    { legacyTypes: ["brand", "bottler"] as const, kind: "bottler" },
    {
      legacyTypes: ["brand", "bottler", "distiller"] as const,
      kind: "distillery",
    },
    { legacyTypes: [] as const, kind: null },
  ])("maps $legacyTypes to $kind", ({ legacyTypes, kind }) => {
    expect(inferKindFromLegacyTypes([...legacyTypes])).toBe(kind);
  });
});

describe("GET /entities/kind-backfill", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const error = await waitError(
      routerClient.entities.kindBackfill({}, { context: { user } }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists only missing kinds with active Bottle-use counts", async ({
    fixtures,
  }) => {
    const owner = await fixtures.Entity({
      name: "Backfill Owner",
      kind: "company",
    });
    const entity = await fixtures.Entity({
      name: "Backfill Subject",
      kind: null,
      ownerId: owner.id,
      description: "Needs reviewed classification.",
      type: ["brand", "bottler"],
      totalBottles: 1,
      totalTastings: 3,
      website: "https://example.com",
    });
    await fixtures.Entity({ name: "Already Classified", kind: "brand" });
    const user = await fixtures.User({ mod: true });

    await fixtures.Bottle({
      brandId: entity.id,
      bottlerId: entity.id,
      distillerIds: [entity.id],
      name: "Active Bottle",
    });
    const retiredBottle = await fixtures.Bottle({
      brandId: entity.id,
      bottlerId: entity.id,
      distillerIds: [entity.id],
      name: "Retired Bottle",
    });
    await db.insert(bottleTombstones).values({ bottleId: retiredBottle.id });

    const result = await routerClient.entities.kindBackfill(
      {},
      { context: { user } },
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      id: entity.id,
      name: "Backfill Subject",
      kind: null,
      type: ["brand", "bottler"],
      suggestedKind: "bottler",
      ownerId: owner.id,
      owner: {
        id: owner.id,
        name: "Backfill Owner",
      },
      description: "Needs reviewed classification.",
      totalBottles: 1,
      totalTastings: 3,
      website: "https://example.com",
      relationships: { brand: 1, bottler: 1, distiller: 1 },
    });
    expect(result.rel).toEqual({ nextCursor: null, prevCursor: null });
  });

  test("uses an Entity ID cursor while completed rows leave the result set", async ({
    fixtures,
  }) => {
    const first = await fixtures.Entity({ name: "First", kind: null });
    const second = await fixtures.Entity({ name: "Second", kind: null });
    const third = await fixtures.Entity({ name: "Third", kind: null });
    const user = await fixtures.User({ mod: true });

    const firstPage = await routerClient.entities.kindBackfill(
      { limit: 2 },
      { context: { user } },
    );

    expect(firstPage.results.map(({ id }) => id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(firstPage.rel.nextCursor).toBe(second.id);

    await db
      .update(entities)
      .set({ kind: "brand" })
      .where(eq(entities.id, second.id));

    const secondPage = await routerClient.entities.kindBackfill(
      { cursor: firstPage.rel.nextCursor!, limit: 2 },
      { context: { user } },
    );

    expect(secondPage.results.map(({ id }) => id)).toEqual([third.id]);
    expect(secondPage.rel.nextCursor).toBeNull();
  });
});
