import { db, type AnyDatabase } from "@peated/server/db";
import {
  auctionLots,
  auctions,
  externalReviewArticles,
  externalReviewBodies,
  externalReviews,
  externalSiteRuns,
  externalSites,
  scrapeSources,
  type ExternalSite,
  type ExternalSiteRun,
} from "@peated/server/db/schema";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { ScotchWhiskyAuctionDetailsCursorSchema } from "./adapters/scotchWhiskyAuctions";
import { createPinnedScrapeSourceRun } from "./configured/runs";
import { ScrapeSourceValidationError } from "./configured/service";
import {
  findScraperSourceBySiteKey,
  requireEnabledScraperTargets,
  ScraperTargetDisabledError,
} from "./definitions";
import type { ScraperRegistry } from "./types";

const STALE_EXTERNAL_SITE_RUN_MS = 10 * 60_000;
const EXTERNAL_SITE_RUN_RECONCILE_LIMIT = 100;
const REQUESTS_BEFORE_PAUSE = 100;

type RunTrigger = ExternalSiteRun["trigger"];
export type ScraperEnqueue = (
  jobName: "RunScraper",
  args: { runId: number },
  options: { jobId: string; removeOnComplete: boolean; removeOnFail: boolean },
) => Promise<void>;

export class ExternalSiteRunActiveError extends Error {
  constructor(readonly status: "queued" | "running" | null) {
    super(
      status
        ? `A scraper run is already ${status}.`
        : "A scraper run is already active.",
    );
  }
}

const ActiveRunConflictSchema = z.object({
  code: z.literal("23505"),
  constraint: z.literal("external_site_run_active_unq"),
});

async function findActiveRun(siteId: number, connection: AnyDatabase = db) {
  const [run] = await connection
    .select({ status: externalSiteRuns.status })
    .from(externalSiteRuns)
    .where(
      and(
        eq(externalSiteRuns.externalSiteId, siteId),
        inArray(externalSiteRuns.status, ["queued", "running"]),
      ),
    )
    .limit(1);
  return run;
}

async function hasReviewsWithoutSavedText(
  connection: AnyDatabase,
  externalSiteId: number,
) {
  const [review] = await connection
    .select({ id: externalReviews.id })
    .from(externalReviews)
    .innerJoin(
      externalReviewArticles,
      eq(externalReviews.articleId, externalReviewArticles.id),
    )
    .leftJoin(
      externalReviewBodies,
      eq(externalReviewBodies.externalReviewId, externalReviews.id),
    )
    .where(
      and(
        eq(externalReviewArticles.externalSiteId, externalSiteId),
        isNull(externalReviewBodies.externalReviewId),
      ),
    )
    .limit(1);
  return Boolean(review);
}

async function insertRun(
  connection: AnyDatabase,
  site: Pick<ExternalSite, "id" | "type">,
  trigger: RunTrigger,
  registry: ScraperRegistry,
  requestedById?: number,
  initialCursor?: z.infer<typeof ScotchWhiskyAuctionDetailsCursorSchema>,
) {
  // Lifecycle holds the site lock. Reject active work before an insert can wait
  // on a completing run that needs that same site lock to finish.
  const activeRun = await findActiveRun(site.id, connection);
  if (activeRun?.status === "queued" || activeRun?.status === "running") {
    throw new ExternalSiteRunActiveError(activeRun.status);
  }
  const source = findScraperSourceBySiteKey(registry, site.type);
  const [configuredSource] = await connection
    .select({ id: scrapeSources.id })
    .from(scrapeSources)
    .where(eq(scrapeSources.externalSiteId, site.id));
  // Scraper lifecycle chooses the scraper. A migrated site's paused or
  // unfinished rules must never restart its old scraper.
  if (configuredSource || !source) {
    if (initialCursor !== undefined)
      throw new ScrapeSourceValidationError(
        "Auction detail collection requires its built-in source.",
      );
    const configured = await createPinnedScrapeSourceRun(connection, {
      externalSiteId: site.id,
      requestedById,
      trigger,
      purpose: "collect",
    });
    return configured.run;
  }
  requireEnabledScraperTargets(registry, source);
  let cursor =
    initialCursor === undefined
      ? null
      : source.cursorSchema.parse(initialCursor);
  if (
    initialCursor === undefined &&
    site.type === "scotchwhiskyauctions" &&
    trigger === "scheduled"
  )
    cursor = source.cursorSchema.parse({
      scope: "current",
      auctions: [],
      auctionIndex: 0,
      page: 1,
    });
  const restartForMissingReviewText =
    trigger === "manual" &&
    source.recordType === "review" &&
    (await hasReviewsWithoutSavedText(connection, site.id));
  if (
    initialCursor === undefined &&
    source.resumeFromLastRun &&
    !restartForMissingReviewText
  ) {
    // Every checkpoint is a safe place to continue, so a failed run's progress
    // counts too.
    const [priorRun] = await connection
      .select({ cursor: externalSiteRuns.cursor })
      .from(externalSiteRuns)
      .where(
        and(
          eq(externalSiteRuns.externalSiteId, site.id),
          inArray(externalSiteRuns.status, ["succeeded", "failed"]),
          isNotNull(externalSiteRuns.cursor),
        ),
      )
      .orderBy(desc(externalSiteRuns.completedAt), desc(externalSiteRuns.id))
      .limit(1);
    cursor = priorRun ? source.cursorSchema.parse(priorRun.cursor) : null;
  }
  const [run] = await connection
    .insert(externalSiteRuns)
    .values({
      externalSiteId: site.id,
      trigger,
      purpose: initialCursor ? "details" : "collect",
      requestedById,
      requestLimit: REQUESTS_BEFORE_PAUSE,
      requestErrorCount: 0,
      recordType: source.recordType,
      cursor,
    })
    .returning();
  if (!run) throw new Error("Failed to create external site run.");
  return run;
}

async function throwActiveRunConflict(siteId: number): Promise<never> {
  const activeRun = await findActiveRun(siteId);
  throw new ExternalSiteRunActiveError(
    activeRun?.status === "queued" || activeRun?.status === "running"
      ? activeRun.status
      : null,
  );
}

async function completeExternalSiteRun({
  run,
  status,
  itemCount,
  error,
}: {
  run: Pick<ExternalSiteRun, "id" | "externalSiteId">;
  status: "succeeded" | "failed";
  itemCount?: number;
  error?: string;
}) {
  const completedAt = new Date();
  await db.transaction(async (tx) => {
    const [completedRun] = await tx
      .update(externalSiteRuns)
      .set({
        status,
        itemCount: itemCount ?? null,
        error: error ?? null,
        completedAt,
      })
      .where(
        and(
          eq(externalSiteRuns.id, run.id),
          inArray(externalSiteRuns.status, ["queued", "running"]),
        ),
      )
      .returning({ id: externalSiteRuns.id });

    if (!completedRun) return;

    // The pointer distinguishes this cache from ambiguous legacy timestamps.
    await tx
      .update(externalSites)
      .set({ lastRunAt: completedAt, lastRunId: run.id })
      .where(eq(externalSites.id, run.externalSiteId));
  });
}

async function dispatchExternalSiteRun(
  run: ExternalSiteRun,
  site: ExternalSite,
  enqueue: ScraperEnqueue,
  { completeOnFailure = true }: { completeOnFailure?: boolean } = {},
) {
  try {
    await enqueue(
      "RunScraper",
      { runId: run.id },
      {
        jobId: `external-site-run-${run.id}`,
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  } catch (error) {
    if (!completeOnFailure) throw error;
    await completeExternalSiteRun({
      run,
      status: "failed",
      error: "Unable to dispatch scraper job.",
    });
    if (run.trigger === "scheduled") {
      await db
        .update(externalSites)
        .set({ nextRunAt: new Date() })
        .where(eq(externalSites.id, site.id));
    }
    throw error;
  }
  return run;
}

// The scheduler owns stale-run recovery and reuses both durable and queue identity.
async function redispatchStaleExternalSiteRuns({
  staleBefore = new Date(Date.now() - STALE_EXTERNAL_SITE_RUN_MS),
  eligibleAt = new Date(),
  registry,
  enqueue,
}: {
  staleBefore?: Date;
  eligibleAt?: Date;
  registry: ScraperRegistry;
  enqueue: ScraperEnqueue;
}) {
  const staleRuns = await db
    .select({ run: externalSiteRuns, site: externalSites })
    .from(externalSiteRuns)
    .innerJoin(
      externalSites,
      eq(externalSites.id, externalSiteRuns.externalSiteId),
    )
    .where(
      and(
        inArray(externalSiteRuns.status, ["queued", "running"]),
        or(
          and(
            eq(externalSiteRuns.status, "queued"),
            lte(externalSiteRuns.createdAt, staleBefore),
            or(
              isNull(externalSiteRuns.nextAttemptAt),
              lte(externalSiteRuns.nextAttemptAt, eligibleAt),
            ),
          ),
          and(
            eq(externalSiteRuns.status, "running"),
            or(
              and(
                isNotNull(externalSiteRuns.executionExpiresAt),
                lte(externalSiteRuns.executionExpiresAt, eligibleAt),
              ),
              and(
                isNull(externalSiteRuns.executionExpiresAt),
                lte(externalSiteRuns.startedAt, staleBefore),
              ),
            ),
          ),
        ),
      ),
    )
    .orderBy(asc(externalSiteRuns.createdAt))
    .limit(EXTERNAL_SITE_RUN_RECONCILE_LIMIT);

  for (const { run, site } of staleRuns) {
    await dispatchExternalSiteRun(run, site, enqueue, {
      completeOnFailure: false,
    });
  }
  return staleRuns.length;
}

async function queueManualExternalSiteRun({
  site,
  requestedById,
  registry,
  enqueue,
}: {
  site: ExternalSite;
  requestedById: number;
  registry: ScraperRegistry;
  enqueue: ScraperEnqueue;
}) {
  let run: ExternalSiteRun;
  try {
    run = await db.transaction(async (tx) => {
      // Site migrations also lock this row before changing which scraper runs.
      const [currentSite] = await tx
        .select()
        .from(externalSites)
        .where(eq(externalSites.id, site.id))
        .for("no key update");
      if (!currentSite) throw new Error("External site not found.");
      return insertRun(tx, currentSite, "manual", registry, requestedById);
    });
  } catch (error) {
    if (!ActiveRunConflictSchema.safeParse(error).success) throw error;
    return await throwActiveRunConflict(site.id);
  }
  await dispatchExternalSiteRun(run, site, enqueue);
  return run;
}

async function queueAuctionDetailsRun(
  siteId: number,
  registry: ScraperRegistry,
  enqueue: ScraperEnqueue,
) {
  const result = await db.transaction(async (tx) => {
    // Auction detail dispatch uses the same site-first lock order and active run limit as collection.
    const [site] = await tx
      .select()
      .from(externalSites)
      .where(eq(externalSites.id, siteId))
      .for("no key update");
    if (!site || site.type !== "scotchwhiskyauctions") return null;
    const pending = await tx
      .select({ lot: auctionLots })
      .from(auctionLots)
      .innerJoin(auctions, eq(auctions.id, auctionLots.auctionId))
      .where(
        and(
          eq(auctions.externalSiteId, site.id),
          inArray(auctionLots.matchStatus, ["pending", "review"]),
          isNotNull(auctionLots.sourceDetailsRequestedAt),
          isNull(auctionLots.sourceDetailsCheckedAt),
          isNull(auctionLots.sourceDetailsRunId),
          isNull(auctionLots.bottleId),
        ),
      )
      .orderBy(
        sql`CASE ${auctionLots.state} WHEN 'live' THEN 0 WHEN 'upcoming' THEN 1 WHEN 'aftersale' THEN 2 ELSE 3 END`,
        asc(auctionLots.sourceDetailsRequestedAt),
        asc(auctionLots.id),
      )
      .limit(25)
      .for("update", { of: auctionLots });
    if (!pending.length) return null;
    const cursor = ScotchWhiskyAuctionDetailsCursorSchema.parse({
      kind: "details",
      lotIndex: 0,
      lots: pending.map(({ lot }) => ({
        lotId: lot.id,
        fingerprint: lot.sourceFingerprint,
        expectedCheckId: lot.matchCheckId,
        requestedAt: lot.sourceDetailsRequestedAt!.toISOString(),
        url: lot.url,
      })),
    });
    const run = await insertRun(
      tx,
      site,
      "manual",
      registry,
      undefined,
      cursor,
    );
    await tx
      .update(auctionLots)
      .set({ sourceDetailsRunId: run.id })
      .where(
        inArray(
          auctionLots.id,
          pending.map(({ lot }) => lot.id),
        ),
      );
    return { site, run };
  });
  if (!result) return null;
  // A failed run retains its lot pointers. Scheduler recovery must not create an endless series of new attempts.
  await dispatchExternalSiteRun(result.run, result.site, enqueue, {
    completeOnFailure: false,
  });
  return result.run;
}

async function dispatchRequestedAuctionDetails(
  queue: (siteId: number) => Promise<ExternalSiteRun | null>,
) {
  const sites = await db
    .selectDistinct({ siteId: auctions.externalSiteId })
    .from(auctionLots)
    .innerJoin(auctions, eq(auctions.id, auctionLots.auctionId))
    .where(
      and(
        inArray(auctionLots.matchStatus, ["pending", "review"]),
        isNotNull(auctionLots.sourceDetailsRequestedAt),
        isNull(auctionLots.sourceDetailsCheckedAt),
        isNull(auctionLots.sourceDetailsRunId),
      ),
    )
    .orderBy(asc(auctions.externalSiteId))
    .limit(10);
  for (const { siteId } of sites) {
    try {
      await queue(siteId);
    } catch (error) {
      if (
        !(error instanceof ExternalSiteRunActiveError) &&
        !(error instanceof ScraperTargetDisabledError) &&
        !(error instanceof ScrapeSourceValidationError)
      )
        throw error;
      // Scraper scheduler leaves requested work saved while a site is busy, paused, or using different rules.
    }
  }
}

async function queueScrapeSourcePreview({
  site,
  scrapeSourceId,
  revisionId,
  requestedById,
  enqueue,
}: {
  site: ExternalSite;
  scrapeSourceId: number;
  revisionId: number;
  requestedById: number;
  enqueue: ScraperEnqueue;
}) {
  let run: ExternalSiteRun;
  try {
    const configured = await db.transaction(async (tx) => {
      return createPinnedScrapeSourceRun(tx, {
        externalSiteId: site.id,
        scrapeSourceId,
        revisionId,
        requestedById,
        trigger: "manual",
        purpose: "preview",
      });
    });
    run = configured.run;
  } catch (error) {
    if (!ActiveRunConflictSchema.safeParse(error).success) throw error;
    return await throwActiveRunConflict(site.id);
  }
  await dispatchExternalSiteRun(run, site, enqueue);
  return run;
}

async function queueScheduledExternalSiteRun(
  siteId: number,
  registry: ScraperRegistry,
  enqueue: ScraperEnqueue,
) {
  let result: { run: ExternalSiteRun; site: ExternalSite } | null;
  try {
    result = await db.transaction(async (tx) => {
      const [site] = await tx
        .select()
        .from(externalSites)
        .where(eq(externalSites.id, siteId))
        .for("update");

      if (
        !site ||
        site.runEvery === null ||
        (site.nextRunAt !== null && site.nextRunAt > new Date())
      ) {
        return null;
      }

      const run = await insertRun(tx, site, "scheduled", registry);
      await tx
        .update(externalSites)
        .set({ nextRunAt: new Date(Date.now() + site.runEvery * 60_000) })
        .where(eq(externalSites.id, site.id));
      return { run, site };
    });
  } catch (error) {
    // Paused or unfinished configured sources are not due for collection.
    if (error instanceof ScrapeSourceValidationError) return null;
    if (!ActiveRunConflictSchema.safeParse(error).success) throw error;
    return await throwActiveRunConflict(siteId);
  }

  if (!result) return null;
  await dispatchExternalSiteRun(result.run, result.site, enqueue);
  return result.run;
}

/** Creates the scraper actions used by API routes and scheduled jobs. */
export function createScraperLifecycle({
  registry,
  enqueue,
}: {
  registry: ScraperRegistry;
  enqueue: ScraperEnqueue;
}) {
  return {
    queueAuctionDetailsRun: (siteId: number) =>
      queueAuctionDetailsRun(siteId, registry, enqueue),
    queueRequestedAuctionLotDetails: () =>
      dispatchRequestedAuctionDetails((siteId) =>
        queueAuctionDetailsRun(siteId, registry, enqueue),
      ),
    queueManualExternalSiteRun: (input: {
      site: ExternalSite;
      requestedById: number;
    }) => queueManualExternalSiteRun({ ...input, registry, enqueue }),
    queueScrapeSourcePreview: (input: {
      site: ExternalSite;
      scrapeSourceId: number;
      revisionId: number;
      requestedById: number;
    }) => queueScrapeSourcePreview({ ...input, enqueue }),
    queueScheduledExternalSiteRun: (siteId: number) =>
      queueScheduledExternalSiteRun(siteId, registry, enqueue),
    redispatchStaleExternalSiteRuns: (options?: {
      staleBefore?: Date;
      eligibleAt?: Date;
    }) =>
      redispatchStaleExternalSiteRuns({
        ...options,
        registry,
        enqueue,
      }),
  };
}
