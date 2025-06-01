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
      results.some((r) => r.type === "bottle" && r.ref.id === bottle.id)
    ).toBeTruthy();
    expect(
      results.some((r) => r.type === "entity" && r.ref.id === entity.id)
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
      }
    );

    expect(results.length).toBe(3);
    expect(
      results.some((r) => r.type === "bottle" && r.ref.id === bottle.id)
    ).toBeTruthy();
    expect(
      results.some((r) => r.type === "entity" && r.ref.id === entity.id)
    ).toBeTruthy();
    expect(
      results.some((r) => r.type === "user" && r.ref.id === user.id)
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
      })
    );
    expect(err).toBeDefined();
    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });
});
