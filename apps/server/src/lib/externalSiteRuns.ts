import { db, type AnyDatabase } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
  type ExternalSite,
  type ExternalSiteRun,
} from "@peated/server/db/schema";
import { requireExternalReviewFetchBeforeQueue } from "@peated/server/lib/externalReviewSourcePolicy";
import { findScraperSourceBySiteType } from "@peated/server/scraper/definitions";
import { scraperRegistry } from "@peated/server/scraper/registry";
import type { JobName } from "@peated/server/worker/types";
import { and, asc, eq, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";

const STALE_EXTERNAL_SITE_RUN_MS = 10 * 60_000;
const EXTERNAL_SITE_RUN_RECONCILE_LIMIT = 100;

type RunTrigger = ExternalSiteRun["trigger"];
type Enqueue = (
  jobName: JobName,
  args: { runId: number },
  options: { jobId: string; removeOnComplete: boolean; removeOnFail: boolean },
) => Promise<unknown>;

export class ExternalSiteRunActiveError extends Error {
  constructor(readonly status: "queued" | "running" | null) {
    super(
      status
        ? `A scraper run is already ${status}.`
        : "A scraper run is already active.",
    );
  }
}

function isActiveRunConflict(error: unknown) {
  const candidate = error as { code?: string; constraint?: string };
  return (
    candidate.code === "23505" &&
    candidate.constraint === "external_site_run_active_unq"
  );
}

async function findActiveRun(siteId: number) {
  const [run] = await db
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

async function insertRun(
  connection: AnyDatabase,
  site: Pick<ExternalSite, "id" | "type">,
  trigger: RunTrigger,
  requestedById?: number,
) {
  const source = findScraperSourceBySiteType(scraperRegistry, site.type);
  if (!source) {
    throw new Error(
      `External site ${site.type} is not registered with the scraper runtime.`,
    );
  }
  const [run] = await connection
    .insert(externalSiteRuns)
    .values({
      externalSiteId: site.id,
      trigger,
      requestedById,
      requestLimit: source.requestLimit,
    })
    .returning();
  if (!run) throw new Error("Failed to create external site run.");
  return run;
}

async function translateActiveRunConflict(error: unknown, siteId: number) {
  if (!isActiveRunConflict(error)) throw error;
  const activeRun = await findActiveRun(siteId);
  throw new ExternalSiteRunActiveError(
    activeRun?.status === "queued" || activeRun?.status === "running"
      ? activeRun.status
      : null,
  );
}

async function defaultEnqueue(
  jobName: JobName,
  args: { runId: number },
  options: { jobId: string; removeOnComplete: boolean; removeOnFail: boolean },
) {
  const { pushJob } = await import("@peated/server/worker/client");
  return pushJob(jobName, args, options);
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
  enqueue: Enqueue = defaultEnqueue,
  { completeOnFailure = true }: { completeOnFailure?: boolean } = {},
) {
  try {
    const source = findScraperSourceBySiteType(scraperRegistry, site.type);
    if (!source) {
      throw new Error(
        `External site ${site.type} is not registered with the scraper runtime.`,
      );
    }
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
export async function redispatchStaleExternalSiteRuns({
  staleBefore = new Date(Date.now() - STALE_EXTERNAL_SITE_RUN_MS),
  eligibleAt = new Date(),
  enqueue = defaultEnqueue,
}: { staleBefore?: Date; eligibleAt?: Date; enqueue?: Enqueue } = {}) {
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

export async function queueManualExternalSiteRun({
  site,
  requestedById,
  enqueue,
}: {
  site: ExternalSite;
  requestedById: number;
  enqueue?: Enqueue;
}) {
  await requireExternalReviewFetchBeforeQueue(db, site);

  let run: ExternalSiteRun;
  try {
    run = await insertRun(db, site, "manual", requestedById);
  } catch (error) {
    await translateActiveRunConflict(error, site.id);
    throw error;
  }
  await dispatchExternalSiteRun(run, site, enqueue);
  return run;
}

export async function queueScheduledExternalSiteRun(
  siteId: number,
  enqueue?: Enqueue,
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

      await requireExternalReviewFetchBeforeQueue(tx, site);

      const run = await insertRun(tx, site, "scheduled");
      await tx
        .update(externalSites)
        .set({ nextRunAt: new Date(Date.now() + site.runEvery * 60_000) })
        .where(eq(externalSites.id, site.id));
      return { run, site };
    });
  } catch (error) {
    await translateActiveRunConflict(error, siteId);
    throw error;
  }

  if (!result) return null;
  await dispatchExternalSiteRun(result.run, result.site, enqueue);
  return result.run;
}
