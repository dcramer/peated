import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottleGroupTombstones,
  bottles,
  bottleTombstones,
  tastings,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /users/:user/regions", () => {
  test("lists regions", async ({ defaults, fixtures }) => {
    const country1 = await fixtures.Country({ name: "Scotland" });
    const region1 = await fixtures.Region({
      countryId: country1.id,
      name: "Highland",
    });
    const entity1 = await fixtures.Entity({
      countryId: country1.id,
      regionId: null,
      name: "Entity 1",
    });
    const entity2 = await fixtures.Entity({
      countryId: country1.id,
      regionId: region1.id,
      name: "Entity 2",
    });
    const bottle = await fixtures.Bottle({
      brandId: entity1.id,
      distillerIds: [],
      bottlerId: null,
      name: "Bottle 1",
    });
    const bottle2 = await fixtures.Bottle({
      brandId: entity2.id,
      distillerIds: [],
      bottlerId: null,
      name: "Bottle 2",
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: defaults.user.id,
    });
    await fixtures.Tasting({
      bottleId: bottle2.id,
      createdById: defaults.user.id,
    });
    await fixtures.Tasting({
      bottleId: bottle2.id,
    });

    const { results, totalCount } = await routerClient.users.regionList(
      {
        user: "me",
      },
      { context: { user: defaults.user } },
    );

    expect(totalCount).toEqual(2);
    expect(results).toMatchInlineSnapshot(`
      [
        {
          "count": 1,
          "country": {
            "name": "Scotland",
            "slug": "scotland",
          },
          "region": {
            "name": "Highland",
            "slug": "highland",
          },
        },
        {
          "count": 1,
          "country": {
            "name": "Scotland",
            "slug": "scotland",
          },
          "region": null,
        },
      ]
    `);
  });

  test("cannot list private without friend", async ({ fixtures }) => {
    const otherUser = await fixtures.User({ private: true });

    const err = await waitError(() =>
      routerClient.users.regionList({
        user: otherUser.id,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: User's profile is not public.]`);
  });

  test("can list private with friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: true });
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: otherUser.id,
      status: "following",
    });

    const { results } = await routerClient.users.regionList(
      {
        user: otherUser.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(0);
  });

  test("can list public without friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: false });

    const { results } = await routerClient.users.regionList(
      {
        user: otherUser.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(0);
  });

  test("skips tastings tied to entities without a country", async ({
    defaults,
    fixtures,
  }) => {
    const country = await fixtures.Country({ name: "Scotland" });
    const region = await fixtures.Region({
      countryId: country.id,
      name: "Highland",
    });
    const entityWithCountry = await fixtures.Entity({
      countryId: country.id,
      regionId: region.id,
      name: "Entity With Country",
    });
    const entityWithoutCountry = await fixtures.Entity({
      countryId: null,
      regionId: null,
      name: "Entity Without Country",
    });
    const bottleWithCountry = await fixtures.Bottle({
      brandId: entityWithCountry.id,
      distillerIds: [],
      bottlerId: null,
      name: "Bottle With Country",
    });
    const bottleWithoutCountry = await fixtures.Bottle({
      brandId: entityWithoutCountry.id,
      distillerIds: [],
      bottlerId: null,
      name: "Bottle Without Country",
    });

    await fixtures.Tasting({
      bottleId: bottleWithCountry.id,
      createdById: defaults.user.id,
    });
    await fixtures.Tasting({
      bottleId: bottleWithoutCountry.id,
      createdById: defaults.user.id,
    });

    const { results, totalCount } = await routerClient.users.regionList(
      {
        user: "me",
      },
      { context: { user: defaults.user } },
    );

    expect(totalCount).toEqual(2);
    expect(results).toMatchInlineSnapshot(`
      [
        {
          "count": 1,
          "country": {
            "name": "Scotland",
            "slug": "scotland",
          },
          "region": {
            "name": "Highland",
            "slug": "highland",
          },
        },
      ]
    `);
  });

  test("uses Bottle-owned brands and keeps unresolved identity out of buckets", async ({
    defaults,
    fixtures,
  }) => {
    const scotland = await fixtures.Country({ name: "Scotland" });
    const highland = await fixtures.Region({
      countryId: scotland.id,
      name: "Highland",
    });
    const ireland = await fixtures.Country({ name: "Ireland" });
    const exactBrand = await fixtures.Entity({
      countryId: scotland.id,
      regionId: highland.id,
      name: "Exact Brand",
    });
    const sameLocationBrand = await fixtures.Entity({
      countryId: scotland.id,
      regionId: highland.id,
      name: "Same Location Brand",
    });
    const countryOnlyBrand = await fixtures.Entity({
      countryId: scotland.id,
      regionId: null,
      name: "Country Only Brand",
    });
    const unrelatedRole = await fixtures.Entity({
      countryId: ireland.id,
      regionId: null,
      name: "Unrelated Bottler and Distiller",
    });
    const groupOnlyBrand = await fixtures.Entity({
      countryId: ireland.id,
      regionId: null,
      name: "Divergent Exact Group Brand",
    });
    const countrylessBrand = await fixtures.Entity({
      countryId: null,
      regionId: null,
      name: "Countryless Brand",
    });
    const exactBottle = await fixtures.Bottle({
      brandId: exactBrand.id,
      bottlerId: unrelatedRole.id,
      distillerIds: [unrelatedRole.id],
      name: "Exact Bottle",
    });
    await db
      .update(bottleGroups)
      .set({ brandId: groupOnlyBrand.id })
      .where(eq(bottleGroups.id, exactBottle.groupId!));
    const sameLocationBottle = await fixtures.Bottle({
      brandId: sameLocationBrand.id,
      name: "Same Location Bottle",
    });
    const retainedBottle = await fixtures.Bottle({
      brandId: exactBrand.id,
      name: "Retained Drift Bottle",
    });
    const countryOnlyBottle = await fixtures.Bottle({
      brandId: countryOnlyBrand.id,
      name: "Country Only Bottle",
    });
    const countrylessBottle = await fixtures.Bottle({
      brandId: countrylessBrand.id,
      name: "Countryless Bottle",
    });
    const baseTime = Date.parse("2026-01-01T00:00:00.000Z");
    await fixtures.Tasting({
      bottleId: exactBottle.id,
      createdById: defaults.user.id,
      createdAt: new Date(baseTime),
    });
    await fixtures.Tasting({
      bottleId: sameLocationBottle.id,
      createdById: defaults.user.id,
      createdAt: new Date(baseTime + 1),
    });
    await fixtures.Tasting({
      bottleId: retainedBottle.id,
      createdById: defaults.user.id,
      createdAt: new Date(baseTime + 2),
    });
    await fixtures.Tasting({
      bottleId: countryOnlyBottle.id,
      createdById: defaults.user.id,
      createdAt: new Date(baseTime + 3),
    });
    await fixtures.Tasting({
      bottleId: countrylessBottle.id,
      createdById: defaults.user.id,
      createdAt: new Date(baseTime + 4),
    });
    const unresolvedTasting = await fixtures.Tasting({
      bottleId: exactBottle.id,
      createdById: defaults.user.id,
      createdAt: new Date(baseTime + 5),
    });
    await db
      .update(tastings)
      .set({ bottleId: null })
      .where(eq(tastings.id, unresolvedTasting.id));

    const data = await routerClient.users.regionList(
      { user: "me" },
      { context: { user: defaults.user } },
    );

    expect(data).toEqual({
      totalCount: 6,
      results: [
        {
          country: { name: "Scotland", slug: "scotland" },
          region: { name: "Highland", slug: "highland" },
          count: 3,
        },
        {
          country: { name: "Scotland", slug: "scotland" },
          region: null,
          count: 1,
        },
      ],
    });
    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, unresolvedTasting.id),
        columns: { bottleId: true },
      }),
    ).toEqual({ bottleId: null });
  });

  test("uses the stored Bottle brand when legacy release evidence remains", async ({
    defaults,
    fixtures,
  }) => {
    const parentCountry = await fixtures.Country({ name: "Parent Country" });
    const promotedCountry = await fixtures.Country({
      name: "Promoted Country",
    });
    const parentBrand = await fixtures.Entity({
      countryId: parentCountry.id,
      name: "Parent Brand",
    });
    const promotedBrand = await fixtures.Entity({
      countryId: promotedCountry.id,
      name: "Promoted Brand",
    });
    const parent = await fixtures.Bottle({ brandId: parentBrand.id });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await fixtures.BottleGroupMember({
      groupId: parent.groupId as number,
      edition: "Promoted Edition",
    });
    await db
      .update(bottles)
      .set({ brandId: promotedBrand.id })
      .where(eq(bottles.id, promoted.id));
    await fixtures.Tasting({
      bottleId: promoted.id,
      releaseId: release.id,
      createdById: defaults.user.id,
    });

    const data = await routerClient.users.regionList(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data).toEqual({
      totalCount: 1,
      results: [
        {
          country: {
            name: promotedCountry.name,
            slug: promotedCountry.slug,
          },
          region: null,
          count: 1,
        },
      ],
    });
  });

  test("scans more than one batch and returns a deterministic top 25", async ({
    defaults,
    fixtures,
  }) => {
    const locations: Array<{
      bottleId: number;
      countryName: string;
    }> = [];
    for (let index = 0; index < 26; index += 1) {
      const countryName = `Location ${String(index + 1).padStart(2, "0")}`;
      const country = await fixtures.Country({ name: countryName });
      const brand = await fixtures.Entity({
        countryId: country.id,
        name: `${countryName} Brand`,
      });
      const bottle = await fixtures.Bottle({ brandId: brand.id });
      locations.push({ bottleId: bottle.id, countryName });
    }
    const createdAt = Date.parse("2026-02-01T00:00:00.000Z");
    await db.insert(tastings).values([
      ...Array.from({ length: 176 }, (_, index) => ({
        bottleId: locations[0]!.bottleId,
        createdById: defaults.user.id,
        createdAt: new Date(createdAt + index),
      })),
      ...locations.slice(1).map((location, index) => ({
        bottleId: location.bottleId,
        createdById: defaults.user.id,
        createdAt: new Date(createdAt + 176 + index),
      })),
    ]);

    const data = await routerClient.users.regionList(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data.totalCount).toBe(201);
    expect(data.results).toHaveLength(25);
    expect(data.results[0]).toEqual({
      country: { name: "Location 01", slug: "location-01" },
      region: null,
      count: 176,
    });
    expect(data.results.map((result) => result.country.name)).toEqual(
      locations.slice(0, 25).map((location) => location.countryName),
    );
  });

  test("fails closed when a Bottle is retired", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: defaults.user.id,
    });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });

    const error = await waitError(
      routerClient.users.regionList(
        { user: defaults.user.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({ status: 409 });
  });

  test("fails closed when a BottleGroup is retired", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: defaults.user.id,
    });
    await db.insert(bottleGroupTombstones).values({
      groupId: bottle.groupId!,
      newGroupId: replacement.groupId!,
      createdByActorId: bottle.createdByActorId,
    });

    const error = await waitError(
      routerClient.users.regionList(
        { user: defaults.user.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({ status: 409 });
  });
});
