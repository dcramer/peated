import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /bottles/unmatched", () => {
  test("requires authentication", async () => {
    const err = await waitError(() => routerClient.bottles.unmatched());
    expect(err).toMatchInlineSnapshot("[Error: Unauthorized.]");
  });

  test("requires mod privileges", async ({ fixtures }) => {
    const user = await fixtures.User();

    const err = await waitError(() =>
      routerClient.bottles.unmatched({}, { context: { user } })
    );
    expect(err).toMatchInlineSnapshot("[Error: Unauthorized.]");
  });

  test("returns empty list when no aliases exist", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const result = await routerClient.bottles.unmatched(
      {},
      { context: { user } }
    );

    expect(result.results).toEqual([]);
    expect(result.rel).toEqual({
      nextCursor: null,
      prevCursor: null,
    });
  });

  test("returns unmatched bottle aliases", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    // Create some unmatched bottle aliases
    const alias1 = await fixtures.BottleAlias({
      name: "Test Unmatched 1",
      bottleId: null,
    });
    const alias2 = await fixtures.BottleAlias({
      name: "Test Unmatched 2",
      bottleId: null,
    });

    // Create a matched bottle alias (should not be returned)
    const bottle = await fixtures.Bottle();
    const matchedAlias = await fixtures.BottleAlias({
      name: "Test Matched",
      bottleId: bottle.id,
    });

    // Create an ignored bottle alias (should not be returned)
    const ignoredAlias = await fixtures.BottleAlias({
      name: "Test Ignored",
      bottleId: null,
      ignored: true,
    });

    const result = await routerClient.bottles.unmatched(
      {},
      { context: { user } }
    );

    expect(result.results).toHaveLength(2);
    expect(result.results.map((r) => r.name)).toEqual(
      expect.arrayContaining(["Test Unmatched 1", "Test Unmatched 2"])
    );

    // Verify matched and ignored aliases are not included
    expect(
      result.results.find((r) => r.name === "Test Matched")
    ).toBeUndefined();
    expect(
      result.results.find((r) => r.name === "Test Ignored")
    ).toBeUndefined();
  });

  test("filters by query parameter", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    // Create aliases with different names
    await fixtures.BottleAlias({ name: "Apple Whiskey", bottleId: null });
    await fixtures.BottleAlias({ name: "Banana Whiskey", bottleId: null });
    await fixtures.BottleAlias({ name: "Cherry Whiskey", bottleId: null });

    const result = await routerClient.bottles.unmatched(
      { query: "Apple" },
      { context: { user } }
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toEqual("Apple Whiskey");
  });

  test("paginates results correctly", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    // Create more aliases than the default limit
    for (let i = 1; i <= 3; i++) {
      await fixtures.BottleAlias({
        name: `Paginated Alias ${i}`,
        bottleId: null,
      });
    }

    // Get first page with limit 2
    const firstPage = await routerClient.bottles.unmatched(
      { limit: 2 },
      { context: { user } }
    );

    expect(firstPage.results).toHaveLength(2);
    expect(firstPage.rel.nextCursor).toEqual(2);
    expect(firstPage.rel.prevCursor).toBeNull();

    // Get second page
    const secondPage = await routerClient.bottles.unmatched(
      { limit: 2, cursor: 2 },
      { context: { user } }
    );

    expect(secondPage.results).toHaveLength(1);
    expect(secondPage.rel.nextCursor).toBeNull();
    expect(secondPage.rel.prevCursor).toEqual(1);
  });
});
