import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("GET /changes", () => {
  test("lists changes", async ({ defaults, fixtures }) => {
    await fixtures.Entity({ name: "Entity 1" });
    await fixtures.Entity({ name: "Entity 2" });

    const { results } = await routerClient.changeList(
      {},
      {
        context: { user: defaults.user },
      },
    );

    expect(results.length).toBe(2);
  });
});
