import { db } from "@peated/server/db";
import {
  bottleAliases,
  catalogTargets,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, expect, vi } from "vitest";

describe("DELETE /bottle-aliases/:name", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("deletes alias", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({ bottleId: bottle.id });

    const site = await fixtures.ExternalSiteOrExisting();
    const review = await fixtures.Review({
      bottleId: bottle.id,
      name: alias.name,
      externalSiteId: site.id,
    });
    const storePrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      externalSiteId: site.id,
      name: alias.name,
    });

    const data = await routerClient.bottleAliases.delete(
      { alias: alias.name },
      {
        context: { user },
      },
    );
    expect(data).toEqual({});

    const [newAlias] = await db
      .select()
      .from(bottleAliases)
      .where(eq(bottleAliases.name, alias.name));
    expect(newAlias).toBeDefined();
    expect(newAlias.bottleId).toBeNull();
    expect(newAlias.targetId).toBeNull();

    const [newReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, review.id));
    expect(newReview.bottleId).toBeNull();

    const [newStorePrice] = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.id, storePrice.id));
    expect(newStorePrice.bottleId).toBeNull();
  });

  test("succeeds after commit when search indexing enqueue fails", async ({
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

    const result = await routerClient.bottleAliases.delete(
      { alias: alias.name },
      { context: { user } },
    );

    expect(result).toEqual({});
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).toMatchObject({ bottleId: null, releaseId: null, targetId: null });
  });

  test("cannot delete without mod", async ({ fixtures }) => {
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({ bottleId: bottle.id });

    const err = await waitError(
      routerClient.bottleAliases.delete(
        { alias: alias.name },
        {
          context: { user },
        },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("protects the exact target Bottle canonical name without legacy identity", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const authoritativeBottle = await fixtures.Bottle({
      name: "Authoritative Canonical Bottle",
    });
    const review = await fixtures.Review({
      bottleId: authoritativeBottle.id,
      name: authoritativeBottle.fullName,
    });
    const storePrice = await fixtures.StorePrice({
      bottleId: authoritativeBottle.id,
      name: authoritativeBottle.fullName,
    });
    await db
      .update(bottleAliases)
      .set({ bottleId: null })
      .where(eq(bottleAliases.name, authoritativeBottle.fullName));

    const err = await waitError(
      routerClient.bottleAliases.delete(
        { alias: authoritativeBottle.fullName },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Cannot delete canonical name]`);
    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, authoritativeBottle.fullName),
    });
    expect(alias).toMatchObject({
      bottleId: null,
      targetId: expect.any(Number),
    });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({ bottleId: authoritativeBottle.id });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, storePrice.id),
      }),
    ).toMatchObject({ bottleId: authoritativeBottle.id });
  });

  test("reindexes the exact target Bottle and clears stale legacy identity", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const authoritativeBottle = await fixtures.Bottle({
      name: "Authoritative Alias Bottle",
    });
    const staleBottle = await fixtures.Bottle({ name: "Stale Match Bottle" });
    const alias = await fixtures.BottleAlias({
      bottleId: authoritativeBottle.id,
      name: "Authoritative Noncanonical Alias",
    });
    await db
      .update(bottleAliases)
      .set({ bottleId: staleBottle.id })
      .where(eq(bottleAliases.name, alias.name));

    await routerClient.bottleAliases.delete(
      { alias: alias.name },
      { context: { user } },
    );

    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).toMatchObject({
      bottleId: null,
      releaseId: null,
      targetId: null,
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: authoritativeBottle.id },
    );
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: staleBottle.id },
    );
    expect(workerClient.pushJob).toHaveBeenCalledTimes(2);
  });

  test("clears a generic alias without selecting a representative Bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({ name: "Generic Alias Bottle" });
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: (targets, { and, eq, isNull }) =>
        and(eq(targets.groupId, bottle.groupId!), isNull(targets.bottleId)),
    });
    if (!genericTarget)
      throw new Error("Missing generic CatalogTarget fixture");
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      targetId: genericTarget.id,
      name: "Generic Group Alias",
    });

    await routerClient.bottleAliases.delete(
      { alias: alias.name },
      { context: { user } },
    );

    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, alias.name),
      }),
    ).toMatchObject({ bottleId: null, releaseId: null, targetId: null });
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
    expect(workerClient.pushJob).toHaveBeenCalledTimes(1);
  });

  test("clears release matches for release aliases", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 4",
    });
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: release.id,
      name: release.fullName,
    });

    const review = await fixtures.Review({
      bottleId: bottle.id,
      releaseId: release.id,
      name: alias.name,
    });
    const storePrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      releaseId: release.id,
      name: alias.name,
    });

    const data = await routerClient.bottleAliases.delete(
      { alias: alias.name },
      {
        context: { user },
      },
    );
    expect(data).toEqual({});

    const [newAlias] = await db
      .select()
      .from(bottleAliases)
      .where(eq(bottleAliases.name, alias.name));
    expect(newAlias).toBeDefined();
    expect(newAlias.bottleId).toBeNull();
    expect(newAlias.releaseId).toBeNull();
    expect(newAlias.targetId).toBeNull();

    const [newReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, review.id));
    expect(newReview.bottleId).toBeNull();
    expect(newReview.releaseId).toBeNull();

    const [newStorePrice] = await db
      .select()
      .from(storePrices)
      .where(eq(storePrices.id, storePrice.id));
    expect(newStorePrice.bottleId).toBeNull();
    expect(newStorePrice.releaseId).toBeNull();
  });
});
