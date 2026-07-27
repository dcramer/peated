import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroupTombstones,
  bottleTags,
  bottleTombstones,
  catalogTargets,
  tastings,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@peated/server/worker/client", async (importOriginal) => ({
  ...(await importOriginal<typeof workerClient>()),
  pushJob: vi.fn().mockResolvedValue(undefined),
}));

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
      { bottle: bottle.id, rating: 1 },
      { context: { user: defaults.user } },
    );

    expect(result.tasting.bottle.id).toBe(bottle.id);
    expect(result.awards).toHaveLength(1);
    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, result.tasting.id),
        columns: {
          bottleId: true,
          rating: true,
        },
      }),
    ).toEqual({
      bottleId: bottle.id,
      rating: 1,
    });
    expect(result.tasting.bottle.fullName).toBe(bottle.fullName);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { bottleId: bottle.id },
      STATS_JOB_OPTIONS,
    );
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

  test("ignores stale target evidence and returns the selected Bottle", async ({
    defaults,
    fixtures,
  }) => {
    const firstBottle = await fixtures.Bottle({ name: "Tasting Family" });
    if (firstBottle.groupId === null) {
      throw new Error("Expected grouped Bottle fixture.");
    }
    const selectedBottle = await fixtures.BottleGroupMember({
      groupId: firstBottle.groupId,
      edition: "Batch 2",
    });
    const unrelatedBottle = await fixtures.Bottle({
      name: "Unrelated Target Evidence",
    });
    const unrelatedTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, unrelatedBottle.id),
    });
    if (!unrelatedTarget) throw new Error("Missing exact target fixture.");
    await db
      .update(bottleAliases)
      .set({ targetId: unrelatedTarget.id })
      .where(eq(bottleAliases.bottleId, selectedBottle.id));
    await db
      .delete(catalogTargets)
      .where(eq(catalogTargets.bottleId, selectedBottle.id));

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

  test("rejects a Bottle in a retired BottleGroup", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    if (bottle.groupId === null || replacement.groupId === null) {
      throw new Error("BottleGroup fixtures not found.");
    }
    await db.insert(bottleGroupTombstones).values({
      groupId: bottle.groupId,
      newGroupId: replacement.groupId,
      createdByActorId: bottle.createdByActorId,
    });

    const error = await waitError(() =>
      routerClient.tastings.create(
        { bottle: bottle.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({
      code: "BAD_REQUEST",
      message: "Cannot identify bottle.",
    });
  });

  test("accounts tags against the selected Bottle", async ({
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
    ).toMatchObject({ count: 1 });
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

  test("returns a conflict for a duplicate Bottle Tasting", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const createdAt = new Date().toISOString();

    await routerClient.tastings.create(
      { bottle: bottle.id, createdAt },
      { context: { user: defaults.user } },
    );
    const error = await waitError(() =>
      routerClient.tastings.create(
        { bottle: bottle.id, createdAt },
        { context: { user: defaults.user } },
      ),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Tasting already exists.]`);
  });

  test("rolls back the Tasting when a tag aggregate write fails", async ({
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

    await expect(
      routerClient.tastings.create(
        { bottle: bottle.id, tags: ["caramel"] },
        { context: { user: defaults.user } },
      ),
    ).rejects.toThrow("integer out of range");

    expect(
      await db.query.tastings.findFirst({
        where: (tastings, { and, eq }) =>
          and(
            eq(tastings.bottleId, bottle.id),
            eq(tastings.createdById, defaults.user.id),
          ),
      }),
    ).toBeUndefined();
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
