import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
});

describe("POST /admin/tastings/star-rating-conversion", () => {
  test("requires an administrator", async ({ defaults, fixtures }) => {
    const moderator = await fixtures.User({ mod: true });

    for (const user of [defaults.user, moderator]) {
      await expect(
        waitError(
          routerClient.admin.convertOldStarRatings(
            { expectedConversions: 0 },
            { context: { user } },
          ),
        ),
      ).resolves.toMatchObject({ message: "Unauthorized." });
    }
  });

  test("rejects an invalid preview count", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });

    await expect(
      routerClient.admin.convertOldStarRatings(
        { expectedConversions: -1 },
        { context: { user: admin } },
      ),
    ).rejects.toThrow("Input validation failed");
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("stops when the preview changes, converts, and starts Bottle total updates", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();
    await fixtures.Tasting({
      bottleId: bottle.id,
      legacyStarRating: 2.25,
      ratingBand: null,
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      legacyStarRating: 4.75,
      ratingBand: null,
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      legacyStarRating: 0,
      ratingBand: null,
    });

    const options = { context: { user: admin } };
    const staleError = await waitError(
      routerClient.admin.convertOldStarRatings(
        { expectedConversions: 1 },
        options,
      ),
    );
    expect(staleError).toMatchInlineSnapshot(
      `[Error: The number of tastings to convert changed from 1 to 2. Preview again.]`,
    );
    expect(workerClient.pushJob).not.toHaveBeenCalled();

    const result = await routerClient.admin.convertOldStarRatings(
      { expectedConversions: 2 },
      options,
    );
    expect(result).toMatchObject({
      willConvert: 2,
      converted: 2,
      bottles: 1,
      bottleTotalsStarted: 1,
      bottleTotalsFailed: 0,
    });
    expect(
      await db
        .select({ ratingBand: tastings.ratingBand })
        .from(tastings)
        .orderBy(asc(tastings.id)),
    ).toEqual([
      { ratingBand: "good" },
      { ratingBand: "unicorn" },
      { ratingBand: null },
    ]);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { bottleId: bottle.id },
      { delay: 5000, removeOnComplete: true, removeOnFail: false },
    );

    vi.mocked(workerClient.pushJob).mockClear();
    await expect(
      routerClient.admin.convertOldStarRatings(
        { expectedConversions: 0 },
        options,
      ),
    ).resolves.toMatchObject({
      willConvert: 0,
      converted: 0,
      bottles: 1,
      bottleTotalsStarted: 1,
      bottleTotalsFailed: 0,
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { bottleId: bottle.id },
      { delay: 5000, removeOnComplete: true, removeOnFail: false },
    );
  });

  test("keeps saved ratings when a Bottle total update cannot start", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      legacyStarRating: 3,
      ratingBand: null,
    });
    vi.mocked(workerClient.pushJob).mockRejectedValueOnce(
      new Error("Queue unavailable"),
    );

    await expect(
      routerClient.admin.convertOldStarRatings(
        { expectedConversions: 1 },
        { context: { user: admin } },
      ),
    ).resolves.toMatchObject({
      converted: 1,
      bottleTotalsStarted: 0,
      bottleTotalsFailed: 1,
    });
    await expect(
      db
        .select({ ratingBand: tastings.ratingBand })
        .from(tastings)
        .where(eq(tastings.id, tasting.id)),
    ).resolves.toEqual([{ ratingBand: "good" }]);
  });
});
