import { TSVector } from "@peated/server/db/columns";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /search", () => {
  test("searches across bottles and entities without authentication", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Unique Whiskey" });
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
      results.some((r) => r.type === "entity" && r.ref.id === entity.id),
    ).toBeTruthy();
  });

  test("searches across bottles, entities, and users with authentication", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Unique Whiskey" });
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
    await fixtures.Bottle({ name: "Unique Whiskey" });
    const entity = await fixtures.Entity({ name: "Unique Distillery" });

    const { results } = await routerClient.search({
      query: "unique",
      include: ["entities"],
      limit: 10,
    });

    expect(results.length).toBe(1);
    expect(results[0]).toMatchObject({
      type: "entity",
      ref: { id: entity.id },
    });
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

    expect(results[0]).toMatchObject({
      type: "bottle",
      ref: { id: exactMatch.id },
    });
  });

  test("returns exact bottlings as first-class search results", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Cairdeas" });
    const bottling = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "Cairdeas Warehouse 1",
      edition: "Warehouse 1",
      releaseYear: 2022,
      abv: 52.2,
      searchVector: [new TSVector("Warehouse 1 2022")],
    });

    const { results } = await routerClient.search({
      query: "Warehouse 1 2022",
      include: ["bottlings"],
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      type: "bottling",
      ref: { id: bottling.id, bottleId: bottle.id },
      bottle: { id: bottle.id },
    });
  });

  test("preserves the bottling target for exact release aliases", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Annual Malt" });
    const bottling = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "Annual Malt 2022 Edition",
      edition: "2022 Edition",
      releaseYear: 2022,
    });
    const aliasName = "Unique Annual Malt Twenty Two";
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: bottling.id,
      name: aliasName,
      ignored: null,
    });

    const { results } = await routerClient.search({
      query: aliasName,
      include: ["bottles", "bottlings"],
      limit: 10,
    });

    expect(results[0]).toMatchObject({
      type: "bottling",
      ref: { id: bottling.id, bottleId: bottle.id },
      bottle: { id: bottle.id },
    });
  });

  test("keeps exact release aliases ahead of text matches before limiting", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Limit Test Malt" });
    const exactBottling = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "Limit Test Malt Exact Edition",
      edition: "Exact Edition",
    });
    const aliasName = "Limit Test Release Alias";
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: exactBottling.id,
      name: aliasName,
    });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "Limit Test Malt Popular Edition",
      edition: "Popular Edition",
      totalTastings: 100,
      searchVector: [new TSVector(aliasName)],
    });

    const { results } = await routerClient.search({
      query: aliasName,
      include: ["bottlings"],
      limit: 1,
    });

    expect(results).toMatchObject([
      {
        type: "bottling",
        ref: { id: exactBottling.id },
      },
    ]);
  });

  test("does not return bottlings unless requested", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ name: "Search Scope Malt" });
    const bottling = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "Search Scope Malt Batch 7",
      edition: "Batch 7",
    });

    const { results } = await routerClient.search({
      query: bottling.fullName,
      include: ["bottles"],
      limit: 10,
    });

    expect(results.every((result) => result.type !== "bottling")).toBe(true);
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

  test("throws error for invalid include parameter", async () => {
    const err = await waitError(() =>
      routerClient.search({
        query: "test",
        include: ["invalidtype" as any],
        limit: 10,
      }),
    );
    expect(err).toBeDefined();
    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });
});
