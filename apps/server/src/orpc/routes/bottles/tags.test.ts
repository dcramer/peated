import { db } from "@peated/server/db";
import { bottleTombstones, catalogTargets } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
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

  test("counts tagged Tastings by their direct Bottle reference", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Selected Bottle" });
    const otherBottle = await fixtures.Bottle({ name: "Other Bottle" });
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    const otherTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, otherBottle.id),
    });
    if (!target || !otherTarget) throw new Error("Missing target fixture");

    await fixtures.Tasting({
      bottleId: otherBottle.id,
      targetId: target.id,
      tags: ["wrong-bottle"],
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: otherTarget.id,
      tags: ["target-drift"],
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: null,
      tags: ["targetless"],
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: target.id,
      tags: [],
    });

    const result = await routerClient.bottles.tags({ bottle: bottle.id });

    expect(result.totalCount).toBe(2);
  });

  test("rejects a retired selected Bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ name: "Selected Bottle" });
    const replacement = await fixtures.Bottle({ name: "Replacement Bottle" });
    await fixtures.Tasting({
      bottleId: bottle.id,
      tags: ["retired"],
    });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });

    const error = await waitError(
      routerClient.bottles.tags({ bottle: bottle.id }),
    );

    expect(error).toMatchObject({ status: 409 });
  });

  test("rejects a Bottle that is not assigned to a group", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.LegacyBottle();

    const error = await waitError(
      routerClient.bottles.tags({ bottle: bottle.id }),
    );

    expect(error).toMatchObject({ status: 409 });
  });

  test("preserves missing Bottle behavior", async () => {
    await expect(
      routerClient.bottles.tags({ bottle: 999_999_999 }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
