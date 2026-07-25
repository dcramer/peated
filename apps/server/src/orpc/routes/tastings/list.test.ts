import { db } from "@peated/server/db";
import { bottleGroups, tastings } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /tastings", () => {
  test("lists hydrated direct Bottles", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({ bottleId: bottle.id });

    const { results } = await routerClient.tastings.list();

    expect(results.find(({ id }) => id === tasting.id)?.bottle.id).toBe(
      bottle.id,
    );
    expect(results[0]).not.toHaveProperty("target");
    expect(results[0]).not.toHaveProperty("release");
  });

  test("filters by Bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({ bottleId: bottle.id });
    await fixtures.Tasting({ bottleId: otherBottle.id });

    const { results } = await routerClient.tastings.list({
      bottle: bottle.id,
    });

    expect(results.map(({ id }) => id)).toEqual([tasting.id]);
    expect(results[0]?.bottle.id).toBe(bottle.id);
  });

  test("filters entities from Bottle-owned identity", async ({ fixtures }) => {
    const bottleBrand = await fixtures.Entity();
    const groupBrand = await fixtures.Entity();
    const bottle = await fixtures.Bottle({ brandId: bottleBrand.id });
    const tasting = await fixtures.Tasting({ bottleId: bottle.id });
    await db
      .update(bottleGroups)
      .set({ brandId: groupBrand.id })
      .where(eq(bottleGroups.id, bottle.groupId!));

    expect(
      (
        await routerClient.tastings.list({
          entity: bottleBrand.id,
        })
      ).results.map(({ id }) => id),
    ).toEqual([tasting.id]);
    expect(
      (
        await routerClient.tastings.list({
          entity: groupBrand.id,
        })
      ).results,
    ).toEqual([]);
  });

  test("fails closed when a persisted Tasting has no Bottle", async ({
    fixtures,
  }) => {
    const tasting = await fixtures.Tasting();
    await db
      .update(tastings)
      .set({ bottleId: null })
      .where(eq(tastings.id, tasting.id));

    await expect(routerClient.tastings.list()).rejects.toThrow(
      `Tasting ${tasting.id} has no Bottle.`,
    );
  });

  test("requires authentication for the friends filter", async () => {
    const error = await waitError(
      routerClient.tastings.list({ filter: "friends" }),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
