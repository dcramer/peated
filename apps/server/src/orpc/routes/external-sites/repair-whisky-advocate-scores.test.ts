import { db } from "@peated/server/db";
import { externalReviews } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { pushJob } from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { asc, inArray } from "drizzle-orm";

const STATS_JOB_OPTIONS = {
  delay: 5000,
  removeOnComplete: true,
  removeOnFail: false,
};

describe("POST /admin/external-sites/whiskyadvocate/repair-review-scores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("requires an administrator", async ({ fixtures }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const review = await fixtures.ExternalReview({
      externalSiteId: site.id,
      legacyNormalizedScore: 92,
    });
    const moderator = await fixtures.User({ mod: true, admin: false });

    const error = await waitError(() =>
      routerClient.externalSites.repairWhiskyAdvocateScores(
        {},
        { context: { user: moderator } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
    expect(
      await db.query.externalReviews.findFirst({
        where: (reviews, { eq }) => eq(reviews.id, review.id),
      }),
    ).toMatchObject({
      legacyNormalizedScore: 92,
      nativeScoreValue: null,
      nativeScoreScale: null,
      nativeScoreDisplay: null,
    });
    expect(pushJob).not.toHaveBeenCalled();
  });

  test("repairs only eligible Whisky Advocate scores and can safely repeat", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting({
      type: "whiskyadvocate",
    });
    const otherSite = await fixtures.ExternalSiteOrExisting({
      type: "whiskyfun",
    });
    const bottle = await fixtures.Bottle();
    const matched = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: bottle.id,
      legacyNormalizedScore: 92,
    });
    const sameBottle = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: bottle.id,
      legacyNormalizedScore: 93,
    });
    const unmatched = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: null,
      legacyNormalizedScore: 88,
    });
    const currentNative = await fixtures.ExternalReview({
      externalSiteId: site.id,
      legacyNormalizedScore: 90,
      nativeScoreValue: 9,
      nativeScoreScale: 10,
      nativeScoreDisplay: "9/10",
    });
    const missingLegacy = await fixtures.ExternalReview({
      externalSiteId: site.id,
      legacyNormalizedScore: null,
    });
    const zeroLegacy = await fixtures.ExternalReview({
      externalSiteId: site.id,
      legacyNormalizedScore: 0,
    });
    const otherSource = await fixtures.ExternalReview({
      externalSiteId: otherSite.id,
      legacyNormalizedScore: 87,
    });
    const admin = await fixtures.User({ admin: true });
    vi.clearAllMocks();

    await expect(
      routerClient.externalSites.repairWhiskyAdvocateScores(
        {},
        { context: { user: admin } },
      ),
    ).resolves.toEqual({
      totalReviews: 6,
      updatedReviews: 3,
      unchangedReviews: 3,
      preservedNativeScores: 1,
      skippedLegacyScores: 2,
      affectedBottles: 1,
      queuedBottleUpdates: 1,
    });
    expect(pushJob).toHaveBeenCalledTimes(1);
    expect(pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { bottleId: bottle.id },
      STATS_JOB_OPTIONS,
    );

    const stored = await db
      .select({
        id: externalReviews.id,
        nativeScoreValue: externalReviews.nativeScoreValue,
        nativeScoreScale: externalReviews.nativeScoreScale,
        nativeScoreDisplay: externalReviews.nativeScoreDisplay,
      })
      .from(externalReviews)
      .where(
        inArray(externalReviews.id, [
          matched.id,
          sameBottle.id,
          unmatched.id,
          currentNative.id,
          missingLegacy.id,
          zeroLegacy.id,
          otherSource.id,
        ]),
      )
      .orderBy(asc(externalReviews.id));
    expect(
      Object.fromEntries(stored.map((review) => [review.id, review])),
    ).toMatchObject({
      [matched.id]: {
        nativeScoreValue: 92,
        nativeScoreScale: 100,
        nativeScoreDisplay: "92/100",
      },
      [sameBottle.id]: {
        nativeScoreValue: 93,
        nativeScoreScale: 100,
        nativeScoreDisplay: "93/100",
      },
      [unmatched.id]: {
        nativeScoreValue: 88,
        nativeScoreScale: 100,
        nativeScoreDisplay: "88/100",
      },
      [currentNative.id]: {
        nativeScoreValue: 9,
        nativeScoreScale: 10,
        nativeScoreDisplay: "9/10",
      },
      [missingLegacy.id]: {
        nativeScoreValue: null,
        nativeScoreScale: null,
        nativeScoreDisplay: null,
      },
      [zeroLegacy.id]: {
        nativeScoreValue: null,
        nativeScoreScale: null,
        nativeScoreDisplay: null,
      },
      [otherSource.id]: {
        nativeScoreValue: null,
        nativeScoreScale: null,
        nativeScoreDisplay: null,
      },
    });

    vi.clearAllMocks();
    await expect(
      routerClient.externalSites.repairWhiskyAdvocateScores(
        {},
        { context: { user: admin } },
      ),
    ).resolves.toEqual({
      totalReviews: 6,
      updatedReviews: 0,
      unchangedReviews: 6,
      preservedNativeScores: 4,
      skippedLegacyScores: 2,
      affectedBottles: 1,
      queuedBottleUpdates: 1,
    });
    expect(pushJob).toHaveBeenCalledTimes(1);
    expect(pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { bottleId: bottle.id },
      STATS_JOB_OPTIONS,
    );
  });
});
