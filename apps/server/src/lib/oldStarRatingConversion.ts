import type { RatingBandId, TastingBandCounts } from "@peated/server/constants";
import {
  EMPTY_TASTING_BAND_COUNTS,
  RATING_BAND_IDS,
} from "@peated/server/constants";
import { db, type AnyConnection, type AnyDatabase } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { and, asc, inArray, isNotNull, isNull } from "drizzle-orm";

type OldTastingRating = {
  bottleId: number;
  id: number;
  legacyStarRating: number;
  ratingBand: RatingBandId | null;
};

export type OldStarRatingConversionReport = {
  bottleIds: number[];
  alreadyRated: number;
  converted: number;
  ratings: TastingBandCounts;
  willConvert: number;
  oldStarRatings: number;
  notConverted: number;
  notConvertedValues: Record<string, number>;
};

export class OldStarRatingPreviewChangedError extends Error {
  constructor(
    readonly expectedConversions: number,
    readonly currentConversions: number,
  ) {
    super(
      `The number of tastings to convert changed from ${expectedConversions} to ${currentConversions}. Preview again.`,
    );
    this.name = "OldStarRatingPreviewChangedError";
  }
}

export class OldStarRatingConversionConflictError extends Error {
  constructor(
    readonly plannedConversions: number,
    readonly converted: number,
  ) {
    super(
      `The number of tastings ready to convert changed during the request (${plannedConversions} to ${converted}). No changes were saved. Preview again.`,
    );
    this.name = "OldStarRatingConversionConflictError";
  }
}

/** Maps supported old quarter-star values without inventing a rating for zero. */
export function getRatingForOldStars(starRating: number): RatingBandId | null {
  if (
    !Number.isFinite(starRating) ||
    starRating <= 0 ||
    starRating > 5 ||
    !Number.isInteger(starRating * 4)
  ) {
    return null;
  }
  if (starRating <= 2) return "mediocre";
  if (starRating <= 3) return "good";
  if (starRating <= 4) return "very_good";
  if (starRating <= 4.5) return "outstanding";
  return "unicorn";
}

async function loadOldStarRatings(
  database: AnyDatabase,
): Promise<OldTastingRating[]> {
  const rows = await database
    .select({
      bottleId: tastings.bottleId,
      id: tastings.id,
      legacyStarRating: tastings.legacyStarRating,
      ratingBand: tastings.ratingBand,
    })
    .from(tastings)
    .where(isNotNull(tastings.legacyStarRating))
    .orderBy(asc(tastings.id));

  return rows.map((row) => {
    if (row.legacyStarRating === null) {
      throw new Error(`Tasting ${row.id} has no old star rating.`);
    }
    return { ...row, legacyStarRating: row.legacyStarRating };
  });
}

function buildOldStarRatingConversionReport(
  rows: OldTastingRating[],
): OldStarRatingConversionReport {
  const bottleIds = new Set<number>();
  const ratings: TastingBandCounts = { ...EMPTY_TASTING_BAND_COUNTS };
  const notConvertedValues = new Map<string, number>();
  let alreadyRated = 0;
  let willConvert = 0;
  let notConverted = 0;

  for (const row of rows) {
    const ratingBand = getRatingForOldStars(row.legacyStarRating);
    if (ratingBand === null) {
      notConverted += 1;
      const value = String(row.legacyStarRating);
      notConvertedValues.set(value, (notConvertedValues.get(value) ?? 0) + 1);
      continue;
    }

    bottleIds.add(row.bottleId);
    if (row.ratingBand !== null) {
      alreadyRated += 1;
      continue;
    }

    willConvert += 1;
    ratings[ratingBand] += 1;
  }

  return {
    bottleIds: [...bottleIds].sort((left, right) => left - right),
    alreadyRated,
    converted: 0,
    ratings,
    willConvert,
    oldStarRatings: rows.length,
    notConverted,
    notConvertedValues: Object.fromEntries(
      [...notConvertedValues].sort(
        ([left], [right]) => Number(left) - Number(right),
      ),
    ),
  };
}

export async function previewOldStarRatingConversion(
  database: AnyDatabase = db,
): Promise<OldStarRatingConversionReport> {
  return buildOldStarRatingConversionReport(await loadOldStarRatings(database));
}

/** Converts the previewed tastings only while every current rating remains null. */
export async function convertOldStarRatings(
  expectedConversions: number,
  database: AnyConnection = db,
): Promise<OldStarRatingConversionReport> {
  return await database.transaction(async (tx) => {
    const rows = await loadOldStarRatings(tx);
    const report = buildOldStarRatingConversionReport(rows);
    if (report.willConvert !== expectedConversions) {
      throw new OldStarRatingPreviewChangedError(
        expectedConversions,
        report.willConvert,
      );
    }

    let converted = 0;
    for (const ratingBand of RATING_BAND_IDS) {
      const tastingIds = rows.flatMap((row) =>
        row.ratingBand === null &&
        getRatingForOldStars(row.legacyStarRating) === ratingBand
          ? [row.id]
          : [],
      );
      if (!tastingIds.length) continue;

      const updated = await tx
        .update(tastings)
        .set({ ratingBand })
        .where(
          and(
            inArray(tastings.id, tastingIds),
            isNull(tastings.ratingBand),
            isNotNull(tastings.legacyStarRating),
          ),
        )
        .returning({ id: tastings.id });
      converted += updated.length;
    }

    if (converted !== report.willConvert) {
      throw new OldStarRatingConversionConflictError(
        report.willConvert,
        converted,
      );
    }
    return { ...report, converted };
  });
}
