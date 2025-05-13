import waitError from "@peated/server/lib/test/waitError";
import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

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

    const { results, totalCount } = await routerClient.userRegionList(
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
      routerClient.userRegionList({
        user: otherUser.id,
      }),
    );
    expect(err).toMatchInlineSnapshot();
  });

  test("can list private with friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: true });
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: otherUser.id,
      status: "following",
    });

    const { results } = await routerClient.userRegionList(
      {
        user: otherUser.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(0);
  });

  test("can list public without friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: false });

    const { results } = await routerClient.userRegionList(
      {
        user: otherUser.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(0);
  });
});
