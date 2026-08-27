import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /bottles/:bottle/recommendations", () => {
  test("orders top-band overlap and excludes the source and retired duplicates", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "Recommendation Source" });
    const first = await fixtures.Bottle({ name: "First Recommendation" });
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
        ratingBand: "outstanding",
      });
      await fixtures.Tasting({
        bottleId: first.id,
        createdById: member.id,
        ratingBand: "outstanding",
      });
      await fixtures.Tasting({
        bottleId: retiredDuplicate.id,
        createdById: member.id,
        ratingBand: "unicorn",
      });
    }
    for (const member of members.slice(0, 2)) {
      await fixtures.Tasting({
        bottleId: second.id,
        createdById: member.id,
        ratingBand: "outstanding",
      });
      await fixtures.Tasting({
        bottleId: tied.id,
        createdById: member.id,
        ratingBand: "unicorn",
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
        ratingBand: "outstanding",
      });
      await fixtures.Tasting({
        bottleId: broad.id,
        createdById: member.id,
        ratingBand: "outstanding",
      });
    }
    for (let day = 1; day <= 3; day += 1) {
      await fixtures.Tasting({
        bottleId: repeated.id,
        createdById: members[0].id,
        createdAt: new Date(2026, 0, day),
        ratingBand: "unicorn",
      });
    }
    await fixtures.Tasting({
      bottleId: repeated.id,
      createdById: members[1].id,
      ratingBand: "outstanding",
    });

    const result = await routerClient.bottles.recommendations({
      bottle: source.id,
    });

    expect(result.results.map(({ id }) => id)).toEqual([broad.id, repeated.id]);
  });

  test("returns an empty set when fewer than three members use a top band", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "Sparse Source" });
    const candidate = await fixtures.Bottle({ name: "Sparse Candidate" });
    const members = await Promise.all([fixtures.User(), fixtures.User()]);
    for (const member of members) {
      await fixtures.Tasting({
        bottleId: source.id,
        createdById: member.id,
        ratingBand: "outstanding",
      });
      await fixtures.Tasting({
        bottleId: candidate.id,
        createdById: member.id,
        ratingBand: "unicorn",
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
