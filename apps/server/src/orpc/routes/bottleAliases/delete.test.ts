import { db } from "@peated/server/db";
import { bottleAliases, reviews, storePrices } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, expect, vi } from "vitest";

describe("DELETE /bottle-aliases/:name", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("atomically unassigns one direct Bottle and its matching consumers", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Alias Owner" });
    const otherBottle = await fixtures.Bottle({ name: "Other Alias Owner" });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Direct Bottle Alias",
    });
    const matchingReview = await fixtures.Review({
      bottleId: bottle.id,
      name: alias.name,
      issue: "direct-owner",
    });
    const matchingPrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: alias.name,
      volume: 750,
    });
    const otherReview = await fixtures.Review({
      bottleId: otherBottle.id,
      name: alias.name,
      issue: "other-owner",
    });
    const otherPrice = await fixtures.StorePrice({
      bottleId: otherBottle.id,
      name: alias.name,
      volume: 700,
    });

    await expect(
      routerClient.bottleAliases.delete(
        { alias: alias.name.toUpperCase() },
        { context: { user } },
      ),
    ).resolves.toEqual({});

    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).resolves.toMatchObject({
      bottleId: null,
      releaseId: alias.releaseId,
      targetId: alias.targetId,
    });
    await expect(
      db.query.reviews.findFirst({
        where: eq(reviews.id, matchingReview.id),
      }),
    ).resolves.toMatchObject({
      bottleId: null,
      releaseId: matchingReview.releaseId,
      targetId: matchingReview.targetId,
    });
    await expect(
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, matchingPrice.id),
      }),
    ).resolves.toMatchObject({
      bottleId: null,
      releaseId: matchingPrice.releaseId,
      targetId: matchingPrice.targetId,
    });
    await expect(
      db.query.reviews.findFirst({ where: eq(reviews.id, otherReview.id) }),
    ).resolves.toMatchObject({ bottleId: otherBottle.id });
    await expect(
      db.query.storePrices.findFirst({
        where: eq(storePrices.id, otherPrice.id),
      }),
    ).resolves.toMatchObject({ bottleId: otherBottle.id });
    expect(workerClient.pushJob).toHaveBeenCalledTimes(2);
    expect(workerClient.pushJob).toHaveBeenCalledWith("IndexBottleAlias", {
      name: alias.name,
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
  });

  test("uses the direct Bottle id even when retained legacy identities disagree", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Direct Alias Bottle" });
    const staleBottle = await fixtures.Bottle({ name: "Stale Target Bottle" });
    const staleRelease = await fixtures.BottleRelease({
      bottleId: staleBottle.id,
    });
    const staleTarget = await db.query.catalogTargets.findFirst({
      where: (targets, { eq }) => eq(targets.bottleId, staleBottle.id),
    });
    if (!staleTarget) throw new Error("Missing stale target fixture");
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Legacy Drift Alias",
    });
    await db
      .update(bottleAliases)
      .set({ releaseId: staleRelease.id, targetId: staleTarget.id })
      .where(eq(bottleAliases.name, alias.name));
    const review = await fixtures.Review({
      bottleId: bottle.id,
      releaseId: staleRelease.id,
      targetId: staleTarget.id,
      name: alias.name,
    });
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      targetId: staleTarget.id,
      name: alias.name,
    });
    await db
      .update(storePrices)
      .set({ releaseId: staleRelease.id })
      .where(eq(storePrices.id, price.id));

    await routerClient.bottleAliases.delete(
      { alias: alias.name },
      { context: { user } },
    );

    await expect(
      db.query.reviews.findFirst({ where: eq(reviews.id, review.id) }),
    ).resolves.toMatchObject({
      bottleId: null,
      releaseId: staleRelease.id,
      targetId: staleTarget.id,
    });
    await expect(
      db.query.storePrices.findFirst({ where: eq(storePrices.id, price.id) }),
    ).resolves.toMatchObject({
      bottleId: null,
      releaseId: staleRelease.id,
      targetId: staleTarget.id,
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
    expect(workerClient.pushJob).toHaveBeenCalledWith("IndexBottleAlias", {
      name: alias.name,
    });
    expect(workerClient.pushJob).toHaveBeenCalledTimes(2);
  });

  test("protects the direct Bottle canonical name", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Canonical Alias Bottle" });

    const error = await waitError(
      routerClient.bottleAliases.delete(
        { alias: bottle.fullName },
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Cannot delete canonical name]`,
    );
    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, bottle.fullName),
      }),
    ).resolves.toMatchObject({ bottleId: bottle.id });
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("fails closed for a retained target-only alias", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Target Only Alias Bottle" });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Target Only Alias",
    });
    await db
      .update(bottleAliases)
      .set({ bottleId: null })
      .where(eq(bottleAliases.name, alias.name));

    const error = await waitError(
      routerClient.bottleAliases.delete(
        { alias: alias.name },
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Bottle Alias is not assigned to a Bottle.]`,
    );
    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).resolves.toMatchObject({
      bottleId: null,
      targetId: expect.any(Number),
    });
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("commits the unassignment when search indexing enqueue fails", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Queue Failure Alias",
    });
    vi.mocked(workerClient.pushJob).mockRejectedValueOnce(
      new Error("Queue unavailable"),
    );

    await expect(
      routerClient.bottleAliases.delete(
        { alias: alias.name },
        { context: { user } },
      ),
    ).resolves.toEqual({});
    await expect(
      db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).resolves.toMatchObject({
      bottleId: null,
      releaseId: alias.releaseId,
      targetId: alias.targetId,
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith("IndexBottleAlias", {
      name: alias.name,
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
  });

  test("returns not found for an unknown alias", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const error = await waitError(
      routerClient.bottleAliases.delete(
        { alias: "Missing Bottle Alias" },
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Bottle Alias not found.]`);
  });

  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({ bottleId: bottle.id });

    const error = await waitError(
      routerClient.bottleAliases.delete(
        { alias: alias.name },
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
