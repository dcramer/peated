import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import {
  convertOldStarRatings,
  getRatingForOldStars,
  OldStarRatingPreviewChangedError,
  previewOldStarRatingConversion,
} from "@peated/server/lib/oldStarRatingConversion";
import { asc } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("old star rating conversion", () => {
  test.each([
    [0, null],
    [0.25, "mediocre"],
    [2, "mediocre"],
    [2.25, "good"],
    [3, "good"],
    [3.25, "very_good"],
    [4, "very_good"],
    [4.25, "outstanding"],
    [4.5, "outstanding"],
    [4.75, "unicorn"],
    [5, "unicorn"],
    [-0.25, null],
    [3.1, null],
    [5.25, null],
    [Number.NaN, null],
  ] as const)("maps %s stars to %s", (starRating, expected) => {
    expect(getRatingForOldStars(starRating)).toBe(expected);
  });

  test("converts supported ratings and keeps the old values", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const inputs = [
      { legacyStarRating: 0.25, legacySimpleRating: -1, ratingBand: null },
      { legacyStarRating: 2, legacySimpleRating: -1, ratingBand: null },
      { legacyStarRating: 2.25, legacySimpleRating: 1, ratingBand: null },
      { legacyStarRating: 3.75, legacySimpleRating: 1, ratingBand: null },
      { legacyStarRating: 4.25, legacySimpleRating: 2, ratingBand: null },
      { legacyStarRating: 4.75, legacySimpleRating: 2, ratingBand: null },
      { legacyStarRating: 0, legacySimpleRating: -1, ratingBand: null },
      { legacyStarRating: 3.1, legacySimpleRating: 1, ratingBand: null },
      { legacyStarRating: 5, legacySimpleRating: 2, ratingBand: "good" },
    ] as const;
    for (const input of inputs) {
      await fixtures.Tasting({ bottleId: bottle.id, ...input });
    }

    const before = await db
      .select({
        legacySimpleRating: tastings.legacySimpleRating,
        legacyStarRating: tastings.legacyStarRating,
        ratingBand: tastings.ratingBand,
      })
      .from(tastings)
      .orderBy(asc(tastings.id));
    const preview = await previewOldStarRatingConversion();

    expect(preview).toEqual({
      bottleIds: [bottle.id],
      alreadyRated: 1,
      converted: 0,
      ratings: {
        mediocre: 2,
        good: 1,
        very_good: 1,
        outstanding: 1,
        unicorn: 1,
      },
      willConvert: 6,
      oldStarRatings: 9,
      notConverted: 2,
      notConvertedValues: { "0": 1, "3.1": 1 },
    });
    expect(
      await db
        .select({ ratingBand: tastings.ratingBand })
        .from(tastings)
        .orderBy(asc(tastings.id)),
    ).toEqual(before.map(({ ratingBand }) => ({ ratingBand })));

    await expect(convertOldStarRatings(5)).rejects.toBeInstanceOf(
      OldStarRatingPreviewChangedError,
    );
    expect(
      await db
        .select({ ratingBand: tastings.ratingBand })
        .from(tastings)
        .orderBy(asc(tastings.id)),
    ).toEqual(before.map(({ ratingBand }) => ({ ratingBand })));

    const result = await convertOldStarRatings(6);
    expect(result.converted).toBe(6);
    const after = await db
      .select({
        legacySimpleRating: tastings.legacySimpleRating,
        legacyStarRating: tastings.legacyStarRating,
        ratingBand: tastings.ratingBand,
      })
      .from(tastings)
      .orderBy(asc(tastings.id));
    expect(after.map(({ ratingBand }) => ratingBand)).toEqual([
      "mediocre",
      "mediocre",
      "good",
      "very_good",
      "outstanding",
      "unicorn",
      null,
      null,
      "good",
    ]);
    expect(
      after.map(({ legacySimpleRating, legacyStarRating }) => ({
        legacySimpleRating,
        legacyStarRating,
      })),
    ).toEqual(
      before.map(({ legacySimpleRating, legacyStarRating }) => ({
        legacySimpleRating,
        legacyStarRating,
      })),
    );

    const repeated = await convertOldStarRatings(0);
    expect(repeated).toMatchObject({
      bottleIds: [bottle.id],
      alreadyRated: 7,
      converted: 0,
      willConvert: 0,
      oldStarRatings: 9,
      notConverted: 2,
    });
  });
});
