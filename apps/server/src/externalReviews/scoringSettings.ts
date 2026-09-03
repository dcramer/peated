import { db, type AnyDatabase } from "@peated/server/db";
import { externalSiteConfig } from "@peated/server/db/schema";
import {
  ExternalReviewScoringSettingsSchema,
  REVIEW_SCORING_CONFIG_KEY,
  type ExternalReviewScoringSettings,
} from "@peated/server/schemas/externalReviewScoring";
import { and, eq, inArray } from "drizzle-orm";

export async function loadReviewScoringSettings(
  siteIds: number[],
  conn: AnyDatabase = db,
) {
  if (!siteIds.length) return new Map<number, ExternalReviewScoringSettings>();
  const rows = await conn
    .select()
    .from(externalSiteConfig)
    .where(
      and(
        eq(externalSiteConfig.key, REVIEW_SCORING_CONFIG_KEY),
        inArray(externalSiteConfig.externalSiteId, siteIds),
      ),
    );
  return new Map(
    rows.map((row) => [
      row.externalSiteId,
      ExternalReviewScoringSettingsSchema.parse(row.value),
    ]),
  );
}
