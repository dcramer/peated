import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
});

describe("GET /admin/tastings/star-rating-conversion", () => {
  test("previews the repair without changing anything", async ({
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

    await expect(
      routerClient.admin.getOldStarRatingConversion(undefined, {
        context: { user: admin },
      }),
    ).resolves.toEqual({
      oldStarRatings: 3,
      willConvert: 2,
      alreadyRated: 0,
      notConverted: 1,
      converted: 0,
      bottles: 1,
      bottleTotalsStarted: 0,
      bottleTotalsFailed: 0,
      ratings: {
        mediocre: 0,
        good: 1,
        very_good: 0,
        outstanding: 0,
        unicorn: 1,
      },
      notConvertedValues: { "0": 1 },
    });
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("requires an administrator", async ({ defaults }) => {
    await expect(
      waitError(
        routerClient.admin.getOldStarRatingConversion(undefined, {
          context: { user: defaults.user },
        }),
      ),
    ).resolves.toMatchObject({ message: "Unauthorized." });
  });
});
