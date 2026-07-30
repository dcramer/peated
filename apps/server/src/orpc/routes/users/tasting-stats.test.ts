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
    expect(data.age).toMatchObject({
      knownCount: 0,
      median: null,
      oldest: null,
    });
    expect(data.age.buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });

  test("does not expose a private profile", async ({ fixtures }) => {
    const user = await fixtures.User({ private: true });

    const error = await waitError(() =>
      routerClient.users.tastingStats({ user: user.id }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: User's profile is private.]`);
  });
});
