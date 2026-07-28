import { db } from "@peated/server/db";
import { bottleGroups } from "@peated/server/db/schema";
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

  test("paginates hydrated direct Bottles", async ({ fixtures }) => {
    const bottles = await Promise.all([
      fixtures.Bottle({ name: "Pagination One" }),
      fixtures.Bottle({ name: "Pagination Two" }),
      fixtures.Bottle({ name: "Pagination Three" }),
    ]);
    await Promise.all(
      bottles.map((bottle, index) =>
        fixtures.Tasting({
          bottleId: bottle.id,
          createdAt: new Date(`2026-01-0${index + 1}T00:00:00.000Z`),
        }),
      ),
    );

    const firstPage = await routerClient.tastings.list({
      cursor: 1,
      limit: 2,
    });
    const secondPage = await routerClient.tastings.list({
      cursor: 2,
      limit: 2,
    });

    expect(firstPage.results.map(({ bottle }) => bottle.id)).toEqual([
      bottles[2]!.id,
      bottles[1]!.id,
    ]);
    expect(firstPage.rel).toEqual({ nextCursor: 2, prevCursor: null });
    expect(secondPage.results.map(({ bottle }) => bottle.id)).toEqual([
      bottles[0]!.id,
    ]);
    expect(secondPage.rel).toEqual({ nextCursor: null, prevCursor: 1 });
  });

  test("requires authentication for the friends filter", async () => {
    const error = await waitError(
      routerClient.tastings.list({ filter: "friends" }),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
