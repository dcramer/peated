import { SIMPLE_RATING_VALUES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

const communityVerdict = {
  pass: 1,
  sip: 2,
  savor: 3,
  total: 6,
  avg: 1,
  percentage: { pass: 16.67, sip: 33.33, savor: 50 },
};

describe("GET /bottles/:bottle/recommendations", () => {
  test("orders Savor overlap and excludes the source and retired duplicates", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "Recommendation Source" });
    const first = await fixtures.Bottle({
      name: "First Recommendation",
      ratingStats: communityVerdict,
    });
    const second = await fixtures.Bottle({ name: "Second Recommendation" });
    const tied = await fixtures.Bottle({ name: "Tied Recommendation" });
    const retiredDuplicate = await fixtures.Bottle({
      name: "Retired Duplicate",
    });
    await db.insert(bottleTombstones).values({
      bottleId: retiredDuplicate.id,
      newBottleId: first.id,
    });

    const members = await Promise.all([
      fixtures.User(),
      fixtures.User(),
      fixtures.User(),
    ]);
    for (const member of members) {
      await fixtures.Tasting({
        bottleId: source.id,
        createdById: member.id,
        rating: SIMPLE_RATING_VALUES.SAVOR,
      });
      await fixtures.Tasting({
        bottleId: first.id,
        createdById: member.id,
        rating: SIMPLE_RATING_VALUES.SAVOR,
      });
      await fixtures.Tasting({
        bottleId: retiredDuplicate.id,
        createdById: member.id,
        rating: SIMPLE_RATING_VALUES.SAVOR,
      });
    }
    for (const member of members.slice(0, 2)) {
      await fixtures.Tasting({
        bottleId: second.id,
        createdById: member.id,
        rating: SIMPLE_RATING_VALUES.SAVOR,
      });
      await fixtures.Tasting({
        bottleId: tied.id,
        createdById: member.id,
        rating: SIMPLE_RATING_VALUES.SAVOR,
      });
    }

    const result = await routerClient.bottles.recommendations({
      bottle: source.id,
    });

    expect(result.reason).toBe(
      "People who liked this bottle also liked these bottles.",
    );
    expect(result.results.map(({ id }) => id)).toEqual([
      first.id,
      second.id,
      tied.id,
    ]);
    expect(result.results[0]).toMatchObject({
      id: first.id,
      fullName: first.fullName,
      ratingStats: communityVerdict,
    });
    expect(result.results.map(({ id }) => id)).not.toContain(source.id);
    expect(result.results.map(({ id }) => id)).not.toContain(
      retiredDuplicate.id,
    );
  });

  test("counts each member once when ranking", async ({ fixtures }) => {
    const source = await fixtures.Bottle({ name: "Distinct Member Source" });
    const broad = await fixtures.Bottle({ name: "Broad Support" });
    const repeated = await fixtures.Bottle({ name: "Repeated Support" });
    const members = await Promise.all([
      fixtures.User(),
      fixtures.User(),
      fixtures.User(),
    ]);

    for (const member of members) {
      await fixtures.Tasting({
        bottleId: source.id,
        createdById: member.id,
        rating: SIMPLE_RATING_VALUES.SAVOR,
      });
      await fixtures.Tasting({
        bottleId: broad.id,
        createdById: member.id,
        rating: SIMPLE_RATING_VALUES.SAVOR,
      });
    }
    for (let day = 1; day <= 3; day += 1) {
      await fixtures.Tasting({
        bottleId: repeated.id,
        createdById: members[0].id,
        createdAt: new Date(2026, 0, day),
        rating: SIMPLE_RATING_VALUES.SAVOR,
      });
    }
    await fixtures.Tasting({
      bottleId: repeated.id,
      createdById: members[1].id,
      rating: SIMPLE_RATING_VALUES.SAVOR,
    });

    const result = await routerClient.bottles.recommendations({
      bottle: source.id,
    });

    expect(result.results.map(({ id }) => id)).toEqual([broad.id, repeated.id]);
  });

  test("returns an empty set when fewer than three members Savor the source", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "Sparse Source" });
    const candidate = await fixtures.Bottle({ name: "Sparse Candidate" });
    const members = await Promise.all([fixtures.User(), fixtures.User()]);
    for (const member of members) {
      await fixtures.Tasting({
        bottleId: source.id,
        createdById: member.id,
        rating: SIMPLE_RATING_VALUES.SAVOR,
      });
      await fixtures.Tasting({
        bottleId: candidate.id,
        createdById: member.id,
        rating: SIMPLE_RATING_VALUES.SAVOR,
      });
    }

    const result = await routerClient.bottles.recommendations({
      bottle: source.id,
    });

    expect(result).toEqual({
      reason: "People who liked this bottle also liked these bottles.",
      results: [],
    });
  });

  test("returns not found for a retired source Bottle", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "Retired Source" });
    await db.insert(bottleTombstones).values({ bottleId: source.id });

    const error = await waitError(
      routerClient.bottles.recommendations({ bottle: source.id }),
    );

    expect(error).toMatchObject({
      status: 404,
      message: "Bottle not found.",
    });
  });
});
