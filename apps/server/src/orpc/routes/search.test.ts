import { db } from "@peated/server/db";
import { bottleAliases, bottleTombstones } from "@peated/server/db/schema";
import { formatPeatedId } from "@peated/server/lib/peatedId";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /search", () => {
  test("searches across bottles and entities without authentication", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Search Fixture Brand" });
    const bottle = await fixtures.Bottle({
      name: "Unique Whiskey",
      brandId: brand.id,
    });
    const entity = await fixtures.Entity({ name: "Unique Distillery" });
    await fixtures.User({ username: "uniqueuser" });

    const { results } = await routerClient.search({
      query: "unique",
      include: ["bottles", "entities"],
      limit: 10,
    });

    expect(results.length).toBe(2);
    expect(
      results.some((r) => r.type === "bottle" && r.ref.id === bottle.id),
    ).toBeTruthy();
    expect(
      results.some(
        (r) =>
          r.type === "bottle" &&
          r.ref.id === bottle.id &&
          r.ref.group?.id === bottle.groupId,
      ),
    ).toBeTruthy();
    expect(
      results.some((r) => r.type === "entity" && r.ref.id === entity.id),
    ).toBeTruthy();
  });

  test("searches across bottles, entities, and users with authentication", async ({
    fixtures,
    defaults,
  }) => {
    const brand = await fixtures.Entity({ name: "Search Fixture Brand" });
    const bottle = await fixtures.Bottle({
      name: "Unique Whiskey",
      brandId: brand.id,
    });
    const entity = await fixtures.Entity({ name: "Unique Distillery" });
    const user = await fixtures.User({ username: "uniqueuser" });

    const { results } = await routerClient.search(
      {
        query: "unique",
        limit: 10,
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(results.length).toBe(3);
    expect(
      results.some((r) => r.type === "bottle" && r.ref.id === bottle.id),
    ).toBeTruthy();
    expect(
      results.some((r) => r.type === "entity" && r.ref.id === entity.id),
    ).toBeTruthy();
    expect(
      results.some((r) => r.type === "user" && r.ref.id === user.id),
    ).toBeTruthy();
  });

  test("limits search to specified types", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "Search Fixture Brand" });
    await fixtures.Bottle({ name: "Unique Whiskey", brandId: brand.id });
    const entity = await fixtures.Entity({ name: "Unique Distillery" });

    const { results } = await routerClient.search({
      query: "unique",
      include: ["entities"],
      limit: 10,
    });

    expect(results.length).toBe(1);
    expect(results[0].type).toBe("entity");
    expect(results[0].ref.id).toBe(entity.id);
  });

  test("respects the limit parameter", async ({ fixtures }) => {
    await fixtures.Bottle({ name: "Unique Whiskey 1" });
    await fixtures.Bottle({ name: "Unique Whiskey 2" });
    await fixtures.Bottle({ name: "Unique Whiskey 3" });

    const { results } = await routerClient.search({
      query: "unique",
      limit: 2,
    });

    expect(results.length).toBe(2);
  });

  test("blends result types within the limit", async ({
    fixtures,
    defaults,
  }) => {
    const brand = await fixtures.Entity({ name: "Blend Fixture Brand" });
    await Promise.all(
      ["One", "Two", "Three"].map((suffix) =>
        fixtures.Bottle({
          name: `Blend Release ${suffix}`,
          brandId: brand.id,
        }),
      ),
    );
    await fixtures.Entity({ name: "Blend Fixture Entity" });
    await fixtures.User({ username: "blend-fixture-user" });

    const { results } = await routerClient.search(
      { query: "blend", limit: 3 },
      { context: { user: defaults.user } },
    );

    expect(results.map(({ type }) => type)).toEqual([
      "bottle",
      "user",
      "entity",
    ]);
  });

  test("defaults the limit when omitted", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ name: "Unique Whiskey" });

    const { results } = await routerClient.search({
      query: "unique",
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(
      results.some((r) => r.type === "bottle" && r.ref.id === bottle.id),
    ).toBeTruthy();
  });

  test("sorts exact matches first", async ({ fixtures }) => {
    await fixtures.Bottle({ name: "Lagavulin 16" });
    const exactMatch = await fixtures.Bottle({ name: "Lagavulin" });

    const { results } = await routerClient.search({
      query: "Lagavulin",
      limit: 10,
    });

    expect(results[0].type).toBe("bottle");
    expect(results[0].ref.id).toBe(exactMatch.id);
  });

  test("finds a bottle by Peated ID", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();

    const { results } = await routerClient.search({
      query: formatPeatedId("bottle", bottle.id),
      limit: 10,
    });

    expect(results).toEqual([
      expect.objectContaining({
        type: "bottle",
        ref: expect.objectContaining({
          id: bottle.id,
          peatedId: formatPeatedId("bottle", bottle.id),
        }),
      }),
    ]);
  });

  test("finds an entity by lowercase Peated ID", async ({ fixtures }) => {
    const entity = await fixtures.Entity();

    const { results } = await routerClient.search({
      query: `e${entity.id}`,
      limit: 10,
    });

    expect(results).toEqual([
      expect.objectContaining({
        type: "entity",
        ref: expect.objectContaining({
          id: entity.id,
          peatedId: formatPeatedId("entity", entity.id),
        }),
      }),
    ]);
  });

  test("respects included types for Peated ID lookup", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();

    const { results } = await routerClient.search({
      query: `B${bottle.id}`,
      include: ["entities"],
      limit: 10,
    });

    expect(results).toEqual([]);
  });

  test("resolves a merged Peated ID to the surviving bottle", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: 999,
      newBottleId: bottle.id,
    });

    const { results } = await routerClient.search({
      query: "B999",
      limit: 10,
    });

    expect(results).toEqual([
      expect.objectContaining({
        type: "bottle",
        ref: expect.objectContaining({
          id: bottle.id,
          peatedId: formatPeatedId("bottle", bottle.id),
        }),
      }),
    ]);
  });

  test("returns empty results with no query", async () => {
    const { results } = await routerClient.search({
      query: "",
      limit: 10,
    });

    expect(results).toHaveLength(0);
  });

  test("returns empty results with no matches", async () => {
    const { results } = await routerClient.search({
      query: "nonexistentitem",
      limit: 10,
    });

    expect(results).toHaveLength(0);
  });

  test("searches only active Bottles and directly assigned aliases", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Canonical Search Bottle" });
    const retainedBottle = await fixtures.Bottle({ name: "Retained Pair" });
    await fixtures.LegacyBottle({ name: "Legacy Search Orphan" });
    await db.insert(bottleAliases).values({
      bottleId: retainedBottle.id,
      name: "Authoritative Search Alias",
      assignedByActorId: bottle.createdByActorId,
    });

    const [aliasSearch, legacySearch] = await Promise.all([
      routerClient.search({
        query: "Authoritative Search Alias",
        include: ["bottles"],
      }),
      routerClient.search({
        query: "Legacy Search Orphan",
        include: ["bottles"],
      }),
    ]);

    expect(aliasSearch.results).toMatchObject([
      { type: "bottle", ref: { id: retainedBottle.id } },
    ]);
    expect(legacySearch.results).toHaveLength(0);
  });

  test("throws error for invalid include parameter", async () => {
    const err = await waitError(() =>
      routerClient.search({
        query: "test",
        // SAFETY: This test sends an invalid result type to the runtime validator.
        include: ["invalidtype" as any],
        limit: 10,
      }),
    );
    expect(err).toBeDefined();
    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });
});
