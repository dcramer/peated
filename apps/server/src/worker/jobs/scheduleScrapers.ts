import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import {
  ExternalSiteRunActiveError,
  queueScheduledExternalSiteRun,
  redispatchStaleExternalSiteRuns,
  ScraperTargetDisabledError,
} from "@peated/server/scraper";
import { and, isNotNull, isNull, lte, or, sql } from "drizzle-orm";

export interface ScraperScheduleLifecycle {
  queueScheduledExternalSiteRun: typeof queueScheduledExternalSiteRun;
  redispatchStaleExternalSiteRuns: typeof redispatchStaleExternalSiteRuns;
}

const scraperScheduleLifecycle: ScraperScheduleLifecycle = {
  queueScheduledExternalSiteRun,
  redispatchStaleExternalSiteRuns,
};

export async function scheduleScrapers(
  lifecycle: ScraperScheduleLifecycle = scraperScheduleLifecycle,
) {
  await lifecycle.redispatchStaleExternalSiteRuns();

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
      await lifecycle.queueScheduledExternalSiteRun(site.id);
    } catch (error) {
      if (
        !(error instanceof ExternalSiteRunActiveError) &&
        !(error instanceof ScraperTargetDisabledError)
      ) {
        throw error;
      }
    }
  }
}

export default async function scheduleScrapersJob() {
  await scheduleScrapers();
}
