import { db } from "@peated/server/db";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottleTombstones,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /countries/categories", () => {
  test("lists categories for a country by id", async ({ fixtures }) => {
    const country = await fixtures.Country();
    const distiller = await fixtures.Entity({
      countryId: country.id,
      type: ["distiller"],
    });
    const bottle1 = await fixtures.Bottle({
      category: "bourbon",
      distillerIds: [distiller.id],
    });
    const bottle2 = await fixtures.Bottle({
      category: "single_malt",
      distillerIds: [distiller.id],
    });

    const { results, totalCount } = await routerClient.countries.categories({
      country: country.id,
    });

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "category": "bourbon",
          "count": 1,
        },
        {
          "category": "single_malt",
          "count": 1,
        },
      ]
    `);
    expect(totalCount).toBe(2);
  });

  test("lists categories for a country by slug", async ({ fixtures }) => {
    const country = await fixtures.Country({ slug: "scotland" });
    const distiller = await fixtures.Entity({
      countryId: country.id,
      type: ["distiller"],
    });
    const bottle = await fixtures.Bottle({
      category: "single_malt",
      distillerIds: [distiller.id],
    });

    const { results, totalCount } = await routerClient.countries.categories({
      country: "scotland",
    });

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "category": "single_malt",
          "count": 1,
        },
      ]
    `);
    expect(totalCount).toBe(1);
  });

  test("returns empty results for a country with no bottles", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country();

    const { results, totalCount } = await routerClient.countries.categories({
      country: country.id,
    });

    expect(results).toMatchInlineSnapshot(`[]`);
    expect(totalCount).toBe(0);
  });

  test("aggregates counts correctly for multiple bottles in the same category", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country();
    const distiller = await fixtures.Entity({
      countryId: country.id,
      type: ["distiller"],
    });
    await fixtures.Bottle({
      category: "bourbon",
      distillerIds: [distiller.id],
    });
    await fixtures.Bottle({
      category: "bourbon",
      distillerIds: [distiller.id],
    });
    await fixtures.Bottle({
      category: "single_malt",
      distillerIds: [distiller.id],
    });

    const { results, totalCount } = await routerClient.countries.categories({
      country: country.id,
    });

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "category": "bourbon",
          "count": 2,
        },
        {
          "category": "single_malt",
          "count": 1,
        },
      ]
    `);
    expect(totalCount).toBe(3);
  });

  test("counts active Bottles directly and ignores legacy ungrouped identity", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country();
    const otherCountry = await fixtures.Country();
    const countryDistiller = await fixtures.Entity({
      countryId: country.id,
      type: ["distiller"],
    });
    const otherDistiller = await fixtures.Entity({
      countryId: otherCountry.id,
      type: ["distiller"],
    });
    const activeBottle = await fixtures.Bottle({
      category: "bourbon",
      distillerIds: [countryDistiller.id],
    });
    if (activeBottle.groupId === null) {
      throw new Error("Expected grouped Bottle fixture");
    }
    const sameGroupBottle = await fixtures.BottleGroupMember({
      groupId: activeBottle.groupId,
      edition: "Related Release",
    });
    await fixtures.Bottle({
      category: "single_malt",
      distillerIds: [countryDistiller.id],
    });
    await fixtures.Bottle({
      category: "blend",
      distillerIds: [countryDistiller.id],
    });
    const legacyBottle = await fixtures.LegacyBottle({
      category: "blend",
      distillerIds: [countryDistiller.id],
    });
    const retiredBottle = await fixtures.Bottle({
      category: "rye",
      distillerIds: [countryDistiller.id],
    });
    const destinationBottle = await fixtures.Bottle({
      category: "spirit",
      distillerIds: [otherDistiller.id],
    });

    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: destinationBottle.id,
    });
    await db
      .update(bottleGroups)
      .set({ category: "rye" })
      .where(eq(bottleGroups.id, activeBottle.groupId));
    await db
      .delete(bottleGroupDistillers)
      .where(eq(bottleGroupDistillers.groupId, activeBottle.groupId));
    await db.insert(bottleGroupDistillers).values({
      groupId: activeBottle.groupId,
      distillerId: otherDistiller.id,
    });

    const data = await routerClient.countries.categories({
      country: country.id,
    });

    expect(data).toEqual({
      results: [
        { category: "blend", count: 1 },
        { category: "bourbon", count: 2 },
        { category: "single_malt", count: 1 },
      ],
      totalCount: 4,
    });
    expect(sameGroupBottle.groupId).toBe(activeBottle.groupId);
    expect(legacyBottle.groupId).toBeNull();
  });

  test("counts each Bottle once and orders nullable category buckets", async ({
    fixtures,
  }) => {
    const country = await fixtures.Country();
    const otherCountry = await fixtures.Country();
    const firstDistiller = await fixtures.Entity({
      countryId: country.id,
      type: ["distiller"],
    });
    const secondDistiller = await fixtures.Entity({
      countryId: country.id,
      type: ["distiller"],
    });
    const otherDistiller = await fixtures.Entity({
      countryId: otherCountry.id,
      type: ["distiller"],
    });
    await fixtures.Bottle({
      category: null,
      distillerIds: [firstDistiller.id, secondDistiller.id],
    });
    await fixtures.Bottle({
      category: "single_malt",
      distillerIds: [firstDistiller.id],
    });
    await fixtures.Bottle({
      category: "bourbon",
      distillerIds: [secondDistiller.id],
    });
    await fixtures.Bottle({
      category: "blend",
      distillerIds: [otherDistiller.id],
    });

    const data = await routerClient.countries.categories({
      country: country.id,
    });

    expect(data).toEqual({
      results: [
        { category: "bourbon", count: 1 },
        { category: "single_malt", count: 1 },
        { category: null, count: 1 },
      ],
      totalCount: 3,
    });
  });

  test("throws error for invalid country slug", async () => {
    const err = await waitError(() =>
      routerClient.countries.categories({ country: "nonexistent" }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Invalid country.]`);
  });
});
