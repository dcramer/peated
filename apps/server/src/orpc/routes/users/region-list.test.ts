import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
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
});
