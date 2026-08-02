import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /users/:user/tasting-stats", () => {
  test("summarizes the ages of tasted bottles", async ({
    defaults,
    fixtures,
  }) => {
    const ages = [8, 12, 18, 25, null];

    for (const statedAge of ages) {
      const bottle = await fixtures.Bottle({ statedAge });
      await fixtures.Tasting({
        bottleId: bottle.id,
        createdById: defaults.user.id,
        rating: null,
      });
    }

    const otherBottle = await fixtures.Bottle({ statedAge: 50 });
    await fixtures.Tasting({ bottleId: otherBottle.id });

    const data = await routerClient.users.tastingStats(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data).toEqual({
      total: 5,
      uniqueBottles: 5,
      ratings: { total: 0, pass: 0, sip: 0, savor: 0 },
      mostTastedBottle: null,
      age: {
        knownCount: 4,
        median: 15,
        oldest: 25,
        buckets: [
          { id: "under10", label: "Under 10", count: 1 },
          { id: "from10To12", label: "10–12", count: 1 },
          { id: "from13To17", label: "13–17", count: 0 },
          { id: "from18To24", label: "18–24", count: 1 },
          { id: "atLeast25", label: "25+", count: 1 },
          { id: "unstated", label: "Unstated", count: 1 },
        ],
      },
    });
  });

  test("returns empty insights when the user has no tastings", async ({
    defaults,
  }) => {
    const data = await routerClient.users.tastingStats(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data.total).toBe(0);
    expect(data.uniqueBottles).toBe(0);
    expect(data.ratings).toEqual({ total: 0, pass: 0, sip: 0, savor: 0 });
    expect(data.mostTastedBottle).toBeNull();
    expect(data.age).toMatchObject({
      knownCount: 0,
      median: null,
      oldest: null,
    });
    expect(data.age.buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });

  test("summarizes ratings and repeated bottles", async ({
    defaults,
    fixtures,
  }) => {
    const favorite = await fixtures.Bottle({ fullName: "Favorite Bottle" });
    const occasional = await fixtures.Bottle({ fullName: "Occasional Bottle" });
    const tastingInputs = [
      { bottleId: favorite.id, rating: 2, day: 1 },
      { bottleId: favorite.id, rating: 2, day: 2 },
      { bottleId: favorite.id, rating: 1, day: 3 },
      { bottleId: occasional.id, rating: -1, day: 4 },
      { bottleId: occasional.id, rating: null, day: 5 },
    ];

    for (const { bottleId, rating, day } of tastingInputs) {
      await fixtures.Tasting({
        bottleId,
        rating,
        createdById: defaults.user.id,
        createdAt: new Date(`2026-01-0${day}T00:00:00.000Z`),
      });
    }

    const data = await routerClient.users.tastingStats(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data).toMatchObject({
      total: 5,
      uniqueBottles: 2,
      ratings: { total: 4, pass: 1, sip: 1, savor: 2 },
      mostTastedBottle: {
        id: favorite.id,
        name: favorite.fullName,
        count: 3,
      },
    });
  });

  test("does not expose a private profile", async ({ fixtures }) => {
    const user = await fixtures.User({ private: true });

    const error = await waitError(() =>
      routerClient.users.tastingStats({ user: user.id }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: User's profile is private.]`);
  });
});
