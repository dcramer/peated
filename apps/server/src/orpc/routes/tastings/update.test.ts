import { db } from "@peated/server/db";
import { bottleTags, tastings } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("PATCH /tastings/{tasting}", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
  });

  test("requires auth", async () => {
    const error = await waitError(routerClient.tastings.update({ tasting: 1 }));
    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("cannot update another user's Tasting", async ({
    defaults,
    fixtures,
  }) => {
    const tasting = await fixtures.Tasting();
    const error = await waitError(
      routerClient.tastings.update(
        { tasting: tasting.id, notes: "changed" },
        { context: { user: defaults.user } },
      ),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Tasting not found.]`);
  });

  test("updates rating and queues direct Bottle statistics", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: defaults.user.id,
      rating: 1,
    });

    const result = await routerClient.tastings.update(
      { tasting: tasting.id, rating: 2 },
      { context: { user: defaults.user } },
    );

    expect(result.bottle.id).toBe(bottle.id);
    expect(result.rating).toBe(2);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { bottleId: bottle.id },
      {
        delay: 5000,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  });

  test("replaces a simple rating with an advanced score", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: defaults.user.id,
      rating: 2,
    });

    const result = await routerClient.tastings.update(
      { tasting: tasting.id, score: 88 },
      { context: { user: defaults.user } },
    );

    expect(result).toMatchObject({ rating: null, score: 88 });
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { bottleId: bottle.id },
      {
        delay: 5000,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  });

  test("clears an advanced score without creating a simple rating", async ({
    defaults,
    fixtures,
  }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
      rating: null,
      score: 88,
    });

    const result = await routerClient.tastings.update(
      { tasting: tasting.id, score: null },
      { context: { user: defaults.user } },
    );

    expect(result).toMatchObject({ rating: null, score: null });
  });

  test("updates tag accounting on the direct Bottle", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.Tag({ name: "new" });
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: defaults.user.id,
      tags: ["old"],
    });

    await routerClient.tastings.update(
      { tasting: tasting.id, tags: ["new"] },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.bottleTags.findMany({
        where: eq(bottleTags.bottleId, bottle.id),
        orderBy: (tags, { asc }) => asc(tags.tag),
      }),
    ).toMatchObject([
      { tag: "new", count: 1 },
      { tag: "old", count: 0 },
    ]);
  });
});
