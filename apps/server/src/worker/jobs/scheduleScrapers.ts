import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import {
  ExternalReviewSourcePolicyError,
  ExternalSiteRunActiveError,
  queueScheduledExternalSiteRun,
  redispatchStaleExternalSiteRuns,
  ScraperTargetDisabledError,
} from "@peated/server/scraper";
import { and, isNotNull, isNull, lte, or, sql } from "drizzle-orm";

export default async function scheduleScrapers() {
  await redispatchStaleExternalSiteRuns();

  const pending = await db
    .select({ id: externalSites.id })
    .from(externalSites)
    .where(
      and(
        or(
          isNull(externalSites.nextRunAt),
          lte(externalSites.nextRunAt, sql`NOW()`),
        ),
        isNotNull(externalSites.runEvery),
      ),
    );
  for (const site of pending) {
    try {
      await queueScheduledExternalSiteRun(site.id);
    } catch (error) {
      if (
        !(error instanceof ExternalSiteRunActiveError) &&
        !(error instanceof ExternalReviewSourcePolicyError) &&
        !(error instanceof ScraperTargetDisabledError)
      ) {
        throw error;
      }
    }
  }
}
