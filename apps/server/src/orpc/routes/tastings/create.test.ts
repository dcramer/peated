import { db } from "@peated/server/db";
import {
  bottleTags,
  bottleTombstones,
  tastings,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const STATS_JOB_OPTIONS = {
  delay: 5000,
  removeOnComplete: true,
  removeOnFail: false,
};

describe("POST /tastings", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
  });

  test("requires auth", async () => {
    const error = await waitError(() =>
      routerClient.tastings.create({ bottle: 1 }),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("creates a direct-Bottle Tasting and awards badges", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ statedAge: 5 });
    await fixtures.Badge({
      tracker: "bottle",
      checks: [{ type: "age", config: { minAge: 5, maxAge: 10 } }],
    });

    const result = await routerClient.tastings.create(
      { bottle: bottle.id, ratingBand: "good" },
      { context: { user: defaults.user } },
    );

    expect(result.tasting.bottle.id).toBe(bottle.id);
    expect(result.awards).toHaveLength(1);
    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, result.tasting.id),
        columns: {
          bottleId: true,
          ratingBand: true,
        },
      }),
    ).toEqual({
      bottleId: bottle.id,
      ratingBand: "good",
    });
    expect(result.tasting.bottle.fullName).toBe(bottle.fullName);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { bottleId: bottle.id },
      STATS_JOB_OPTIONS,
    );
  });

  test("rejects an unknown band", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    await expect(
      routerClient.tastings.create(
        // SAFETY: This test must send a value outside the public TypeScript type.
        { bottle: bottle.id, ratingBand: "unknown" as "good" },
        { context: { user: defaults.user } },
      ),
    ).rejects.toThrow();
  });

  test("rejects missing, unassigned, and retired Bottles", async ({
    defaults,
    fixtures,
  }) => {
    const unassigned = await fixtures.LegacyBottle();
    const retired = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });

    for (const bottle of [999_999, unassigned.id, retired.id]) {
      const error = await waitError(() =>
        routerClient.tastings.create(
          { bottle },
          { context: { user: defaults.user } },
        ),
      );
      expect(error).toMatchObject({
        code: "BAD_REQUEST",
        message: "Cannot identify bottle.",
      });
    }
  });

  test("returns the selected exact Bottle", async ({ defaults, fixtures }) => {
    const firstBottle = await fixtures.Bottle({ name: "Tasting Family" });
    if (firstBottle.groupId === null) {
      throw new Error("Expected grouped Bottle fixture.");
    }
    const selectedBottle = await fixtures.BottleGroupMember({
      groupId: firstBottle.groupId,
      edition: "Batch 2",
    });
    const result = await routerClient.tastings.create(
      { bottle: selectedBottle.id },
      { context: { user: defaults.user } },
    );

    expect(result.tasting.bottle).toMatchObject({
      id: selectedBottle.id,
      fullName: selectedBottle.fullName,
    });
    expect(result.tasting.bottle.id).not.toBe(firstBottle.id);
    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, result.tasting.id),
        columns: { bottleId: true },
      }),
    ).toEqual({ bottleId: selectedBottle.id });
  });

  test("queues tag summary work for the selected Bottle", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.Tag({ name: "caramel" });

    await routerClient.tastings.create(
      { bottle: bottle.id, tags: ["caramel"] },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.bottleTags.findFirst({
        where: (tags, { and, eq }) =>
          and(eq(tags.bottleId, bottle.id), eq(tags.tag, "caramel")),
      }),
    ).toBeUndefined();
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { bottleId: bottle.id },
      STATS_JOB_OPTIONS,
    );
  });

  test("validates Flight membership by Bottle", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const flight = await fixtures.Flight({ bottles: [bottle.id] });

    const result = await routerClient.tastings.create(
      { bottle: bottle.id, flight: flight.publicId },
      { context: { user: defaults.user } },
    );
    expect(result.tasting.bottle.id).toBe(bottle.id);

    const error = await waitError(() =>
      routerClient.tastings.create(
        { bottle: otherBottle.id, flight: flight.publicId },
        { context: { user: defaults.user } },
      ),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Cannot identify flight.]`);
  });

  test("uses the post time as the tasted time by default", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    const { tasting } = await routerClient.tastings.create(
      { bottle: bottle.id },
      { context: { user: defaults.user } },
    );

    expect(tasting.tastedAt).toBe(tasting.createdAt);
  });

  test("keeps an old tasted time but posts it now", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const tastedAt = new Date("2024-03-09T21:30:00.000Z").toISOString();
    const before = Date.now();

    const { tasting } = await routerClient.tastings.create(
      { bottle: bottle.id, tastedAt },
      { context: { user: defaults.user } },
    );

    expect(tasting.tastedAt).toBe(tastedAt);
    expect(new Date(tasting.createdAt).getTime()).toBeGreaterThanOrEqual(
      before,
    );
  });

  test("rejects a tasted time in the future", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const tastedAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const error = await waitError(() =>
      routerClient.tastings.create(
        { bottle: bottle.id, tastedAt },
        { context: { user: defaults.user } },
      ),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("returns the first tasting when a post is repeated", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ statedAge: 5 });
    await fixtures.Badge({
      tracker: "bottle",
      checks: [{ type: "age", config: { minAge: 5, maxAge: 10 } }],
    });
    const input = {
      bottle: bottle.id,
      notes: "Peat smoke and pear.",
      idempotencyKey: "post-1",
    };

    const first = await routerClient.tastings.create(input, {
      context: { user: defaults.user },
    });
    const second = await routerClient.tastings.create(input, {
      context: { user: defaults.user },
    });

    expect(second.tasting.id).toBe(first.tasting.id);
    expect(first.awards).toHaveLength(1);
    expect(second.awards).toEqual([]);
    expect(
      await db.query.tastings.findMany({
        where: eq(tastings.bottleId, bottle.id),
        columns: { id: true },
      }),
    ).toEqual([{ id: first.tasting.id }]);
  });

  test("scopes the repeat key to the member", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherUser = await fixtures.User();

    const mine = await routerClient.tastings.create(
      { bottle: bottle.id, idempotencyKey: "shared-key" },
      { context: { user: defaults.user } },
    );
    const theirs = await routerClient.tastings.create(
      { bottle: bottle.id, idempotencyKey: "shared-key" },
      { context: { user: otherUser } },
    );

    expect(theirs.tasting.id).not.toBe(mine.tasting.id);
    expect(theirs.tasting.createdBy.id).toBe(otherUser.id);
  });

  test("does not mutate the cached tag summary inline", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.Tag({ name: "caramel" });
    await db.insert(bottleTags).values({
      bottleId: bottle.id,
      tag: "caramel",
      count: 2_147_483_647,
    });

    await routerClient.tastings.create(
      { bottle: bottle.id, tags: ["caramel"] },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.tastings.findFirst({
        where: (tastings, { and, eq }) =>
          and(
            eq(tastings.bottleId, bottle.id),
            eq(tastings.createdById, defaults.user.id),
          ),
      }),
    ).toBeDefined();
    expect(
      await db.query.bottleTags.findFirst({
        where: (bottleTags, { and, eq }) =>
          and(
            eq(bottleTags.bottleId, bottle.id),
            eq(bottleTags.tag, "caramel"),
          ),
        columns: { count: true },
      }),
    ).toEqual({ count: 2_147_483_647 });
  });
});
