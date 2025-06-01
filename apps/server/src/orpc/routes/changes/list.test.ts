import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /changes", () => {
  test("lists changes", async ({ defaults, fixtures }) => {
    await fixtures.Entity({ name: "Entity 1" });
    await fixtures.Entity({ name: "Entity 2" });

    const { results } = await routerClient.changes.list(
      {},
      {
        context: { user: defaults.user },
      }
    );

    expect(results.length).toBe(2);
  });
});
