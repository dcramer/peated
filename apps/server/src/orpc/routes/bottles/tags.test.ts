import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /bottles/:bottle/tags", () => {
  test("lists tags", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      name: "A",
    });
    const bottle2 = await fixtures.Bottle({
      name: "B",
      brandId: bottle.brandId,
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      tags: ["solvent", "caramel"],
      rating: 5,
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      tags: ["caramel"],
      rating: 5,
    });
    await fixtures.Tasting({
      bottleId: bottle2.id,
      tags: ["cedar", "caramel"],
      rating: 5,
    });

    const { results, totalCount } = await routerClient.bottles.tags({
      bottle: bottle.id,
    });

    expect(totalCount).toEqual(2);
    expect(results).toEqual([
      { tag: "caramel", count: 2 },
      { tag: "solvent", count: 1 },
    ]);
  });
});
