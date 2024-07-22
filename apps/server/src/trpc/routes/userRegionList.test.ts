import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("lists regions", async ({ defaults, fixtures }) => {
  const country1 = await fixtures.Country({ name: "Scotland" });
  const region1 = await fixtures.Region({
    countryId: country1.id,
    name: "Highland",
  });
  const entity1 = await fixtures.Entity({
    countryId: country1.id,
    regionId: null,
  });
  const entity2 = await fixtures.Entity({
    countryId: country1.id,
    regionId: region1.id,
  });
  const bottle = await fixtures.Bottle({
    brandId: entity1.id,
    distillerIds: [],
    bottlerId: null,
  });
  const bottle2 = await fixtures.Bottle({
    brandId: entity2.id,
    distillerIds: [],
    bottlerId: null,
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

  const caller = createCaller({ user: defaults.user });
  const { results, totalCount } = await caller.userRegionList({
    user: "me",
  });

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

  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.userRegionList({
      user: otherUser.id,
    }),
  );
  expect(err).toMatchInlineSnapshot(
    `[TRPCError: User's profile is not public.]`,
  );
});

test("can list private with friend", async ({ defaults, fixtures }) => {
  const otherUser = await fixtures.User({ private: true });
  await fixtures.Follow({
    fromUserId: defaults.user.id,
    toUserId: otherUser.id,
    status: "following",
  });

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.userRegionList({
    user: otherUser.id,
  });

  expect(results.length).toEqual(0);
});

test("can list public without friend", async ({ defaults, fixtures }) => {
  const otherUser = await fixtures.User({ private: false });

  const caller = createCaller({ user: defaults.user });
  const { results } = await caller.userRegionList({
    user: otherUser.id,
  });

  expect(results.length).toEqual(0);
});
