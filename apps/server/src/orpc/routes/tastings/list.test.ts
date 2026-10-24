import type { RatingBandId } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { bottleGroups } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

const byNumber = (left: number, right: number) => left - right;

describe("GET /tastings", () => {
  test("lists hydrated direct Bottles", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({ bottleId: bottle.id });

    const { results } = await routerClient.tastings.list();

    expect(results.find(({ id }) => id === tasting.id)?.bottle.id).toBe(
      bottle.id,
    );
    expect(results.find(({ id }) => id === tasting.id)?.bottle.group?.id).toBe(
      bottle.groupId,
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

  test("paginates public tastings consistently when dates match", async ({
    fixtures,
  }) => {
    const createdAt = new Date("2026-09-01T00:00:00Z");
    const first = await fixtures.Tasting({ createdAt });
    const second = await fixtures.Tasting({ createdAt });
    const privateUser = await fixtures.User({ private: true });
    await fixtures.Tasting({ createdAt, createdById: privateUser.id });

    const firstPage = await routerClient.tastings.list({ cursor: 1, limit: 1 });
    const secondPage = await routerClient.tastings.list({
      cursor: 2,
      limit: 1,
    });

    expect(firstPage.results.map(({ id }) => id)).toEqual([second.id]);
    expect(secondPage.results.map(({ id }) => id)).toEqual([first.id]);
    expect(secondPage.rel.nextCursor).toBeNull();
  });
  test("searches the tasted Bottle's name", async ({ defaults, fixtures }) => {
    const match = await fixtures.Bottle({ name: "Quenchwick Harbour" });
    const other = await fixtures.Bottle({ name: "Plumbridge Reserve" });
    const tasting = await fixtures.Tasting({
      bottleId: match.id,
      createdById: defaults.user.id,
    });
    await fixtures.Tasting({
      bottleId: other.id,
      createdById: defaults.user.id,
    });

    const { results } = await routerClient.tastings.list({
      user: defaults.user.id,
      query: "quenchw",
    });

    expect(results.map(({ id }) => id)).toEqual([tasting.id]);
  });

  test("keeps private members hidden while searching", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ name: "Hiddenvale Sherry" });
    const privateUser = await fixtures.User({ private: true });
    await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: privateUser.id,
    });

    const { results } = await routerClient.tastings.list({
      query: "hiddenvale",
    });

    expect(results).toEqual([]);
  });

  test("filters by rating", async ({ defaults, fixtures }) => {
    const good = await fixtures.Tasting({
      createdById: defaults.user.id,
      ratingBand: "good",
    });
    await fixtures.Tasting({
      createdById: defaults.user.id,
      ratingBand: "unicorn",
    });
    await fixtures.Tasting({
      createdById: defaults.user.id,
      ratingBand: null,
    });

    const { results } = await routerClient.tastings.list({
      user: defaults.user.id,
      ratingBand: "good",
    });

    expect(results.map(({ id }) => id)).toEqual([good.id]);
  });

  test("sorts by rating, best first, then newest, unrated last", async ({
    defaults,
    fixtures,
  }) => {
    const tasting = (ratingBand: RatingBandId | null, day: number) =>
      fixtures.Tasting({
        createdById: defaults.user.id,
        createdAt: new Date(`2026-03-0${day}T00:00:00.000Z`),
        ratingBand,
      });
    const unrated = await tasting(null, 5);
    const olderGood = await tasting("good", 1);
    const unicorn = await tasting("unicorn", 2);
    const newerGood = await tasting("good", 3);
    const mediocre = await tasting("mediocre", 4);

    const { results } = await routerClient.tastings.list({
      user: defaults.user.id,
      sort: "-rating",
    });

    expect(results.map(({ id }) => id)).toEqual([
      unicorn.id,
      newerGood.id,
      olderGood.id,
      mediocre.id,
      unrated.id,
    ]);
  });

  test("sorts by Bottle name, then newest", async ({ defaults, fixtures }) => {
    // Full names start with the brand, so share one to compare Bottle names.
    const brand = await fixtures.Entity({ name: "Sort Brand" });
    const ardbeg = await fixtures.Bottle({
      brandId: brand.id,
      name: "Aaa Sort Ardbeg",
    });
    const zuidam = await fixtures.Bottle({
      brandId: brand.id,
      name: "Zzz Sort Zuidam",
    });
    const tasting = (bottleId: number, day: number) =>
      fixtures.Tasting({
        bottleId,
        createdById: defaults.user.id,
        createdAt: new Date(`2026-04-0${day}T00:00:00.000Z`),
      });
    const zuidamTasting = await tasting(zuidam.id, 3);
    const olderArdbeg = await tasting(ardbeg.id, 1);
    const newerArdbeg = await tasting(ardbeg.id, 2);

    const { results } = await routerClient.tastings.list({
      user: defaults.user.id,
      sort: "name",
    });

    expect(results.map(({ id }) => id)).toEqual([
      newerArdbeg.id,
      olderArdbeg.id,
      zuidamTasting.id,
    ]);
  });

  test("filters by stated age range with the same counts as tasting stats", async ({
    defaults,
    fixtures,
  }) => {
    for (const statedAge of [9, 10, 12, 13, 17, 18, 24, 25, null]) {
      const bottle = await fixtures.Bottle({ statedAge });
      await fixtures.Tasting({
        bottleId: bottle.id,
        createdById: defaults.user.id,
      });
    }

    const stats = await routerClient.users.tastingStats(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    for (const bucket of stats.age.buckets) {
      const { results } = await routerClient.tastings.list({
        user: defaults.user.id,
        age: bucket.id,
      });
      expect([bucket.id, results.length]).toEqual([bucket.id, bucket.count]);
    }
    expect(stats.age.buckets.map(({ count }) => count)).toEqual([
      1, 2, 2, 2, 1, 1,
    ]);
  });

  test("filters by the brand's country and region with the same counts as the region list", async ({
    defaults,
    fixtures,
  }) => {
    const scotland = await fixtures.Country({ name: "Scotland" });
    const islay = await fixtures.Region({
      countryId: scotland.id,
      name: "Islay",
    });
    const japan = await fixtures.Country({ name: "Japan" });
    const tasteFrom = async (countryId: number, regionId: number | null) => {
      const brand = await fixtures.Entity({ countryId, regionId });
      const bottle = await fixtures.Bottle({
        brandId: brand.id,
        distillerIds: [],
        bottlerId: null,
      });
      return fixtures.Tasting({
        bottleId: bottle.id,
        createdById: defaults.user.id,
      });
    };
    const islayTastings = [
      await tasteFrom(scotland.id, islay.id),
      await tasteFrom(scotland.id, islay.id),
    ];
    const scotlandTasting = await tasteFrom(scotland.id, null);
    await tasteFrom(japan.id, null);

    const regionList = await routerClient.users.regionList(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );
    for (const row of regionList.results) {
      const { results } = await routerClient.tastings.list({
        user: defaults.user.id,
        country: row.country.slug,
        region: row.region?.slug,
      });
      if (row.region) {
        expect(results).toHaveLength(row.count);
      } else {
        // A country filter matches the whole country: its own row plus its regions.
        expect(results).toHaveLength(
          regionList.results
            .filter(({ country }) => country.slug === row.country.slug)
            .reduce((total, { count }) => total + count, 0),
        );
      }
    }

    const islayResults = await routerClient.tastings.list({
      user: defaults.user.id,
      country: scotland.slug,
      region: islay.slug,
    });
    expect(islayResults.results.map(({ id }) => id).toSorted(byNumber)).toEqual(
      islayTastings.map(({ id }) => id).toSorted(byNumber),
    );
    const scotlandResults = await routerClient.tastings.list({
      user: defaults.user.id,
      country: String(scotland.id),
    });
    expect(
      scotlandResults.results.map(({ id }) => id).toSorted(byNumber),
    ).toEqual(
      [...islayTastings, scotlandTasting]
        .map(({ id }) => id)
        .toSorted(byNumber),
    );
  });

  test("requires country with region", async () => {
    const error = await waitError(
      routerClient.tastings.list({ region: "islay" }),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Region requires country.]`);
  });

  test("rejects an unknown country", async () => {
    const error = await waitError(
      routerClient.tastings.list({ country: "atlantis" }),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Invalid country.]`);
  });
});
