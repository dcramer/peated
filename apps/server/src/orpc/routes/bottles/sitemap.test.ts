import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /bottles/sitemap", () => {
  test("lists only current public Bottles in ID order", async ({
    fixtures,
  }) => {
    const first = await fixtures.Bottle({ name: "First Sitemap Bottle" });
    const retired = await fixtures.Bottle({ name: "Retired Sitemap Bottle" });
    const replacement = await fixtures.Bottle({
      name: "Replacement Sitemap Bottle",
    });
    await fixtures.LegacyBottle({ name: "Legacy Sitemap Bottle" });
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });

    const { results } = await routerClient.bottles.sitemap({ page: 1 });

    expect(results).toEqual([
      {
        id: first.id,
        fullName: first.fullName,
        updatedAt: first.updatedAt.toISOString(),
      },
      {
        id: replacement.id,
        fullName: replacement.fullName,
        updatedAt: replacement.updatedAt.toISOString(),
      },
    ]);
  });
});
