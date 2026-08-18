import { db, type AnyDatabase } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
  type ExternalSite,
  type ExternalSiteRun,
} from "@peated/server/db/schema";
import {
  requireExternalReviewFetchBeforeQueue,
  requireExternalReviewSourceCapability,
} from "@peated/server/lib/externalReviewSourcePolicy";
import type { ExternalSiteType } from "@peated/server/types";
import type { JobName } from "@peated/server/worker/types";
import { getJobForSite } from "@peated/server/worker/utils";
import * as Sentry from "@sentry/node";
import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

const STALE_EXTERNAL_SITE_RUN_MS = 10 * 60_000;
const EXTERNAL_SITE_RUN_RECONCILE_LIMIT = 100;

const ExternalSiteRunJobInputSchema = z
  .object({ runId: z.number().int().positive() })
  .strict();

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
  siteId: number,
  trigger: RunTrigger,
  requestedById?: number,
) {
  const [run] = await connection
    .insert(externalSiteRuns)
    .values({ externalSiteId: siteId, trigger, requestedById })
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
    await enqueue(
      getJobForSite(site.type),
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
  enqueue = defaultEnqueue,
}: { staleBefore?: Date; enqueue?: Enqueue } = {}) {
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
          ),
          and(
            eq(externalSiteRuns.status, "running"),
            lte(externalSiteRuns.startedAt, staleBefore),
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
    run = await insertRun(db, site.id, "manual", requestedById);
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

      const run = await insertRun(tx, site.id, "scheduled");
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

function summarizeExternalSiteRunError(error: unknown): string {
  if (error instanceof z.ZodError) return "Scraped data failed validation.";
  if (error instanceof Error) {
    if (error.name === "PageNotFound") return "Retailer page was not found.";
    if (error.message === "Failed to scrape any products.") {
      return error.message;
    }
  }
  return "Unexpected scraper failure. See Sentry for this run.";
}

function buildExternalSiteRunJob(
  siteType: ExternalSiteType,
  scrape: () => Promise<number>,
  authorizeFetch?: (site: {
    id: number;
    type: ExternalSiteType;
  }) => Promise<void>,
) {
  return async (input: unknown) => {
    const { runId } = ExternalSiteRunJobInputSchema.parse(input);
    const run = await db.transaction(async (tx) => {
      const [candidate] = await tx
        .select({
          run: externalSiteRuns,
          site: externalSites,
        })
        .from(externalSiteRuns)
        .innerJoin(
          externalSites,
          eq(externalSites.id, externalSiteRuns.externalSiteId),
        )
        .where(eq(externalSiteRuns.id, runId))
        .for("update");

      if (!candidate) throw new Error(`External site run ${runId} not found.`);
      if (candidate.site.type !== siteType) {
        throw new Error(`External site run ${runId} does not match its job.`);
      }
      if (["succeeded", "failed"].includes(candidate.run.status)) return null;

      const [claimed] = await tx
        .update(externalSiteRuns)
        .set({
          status: "running",
          startedAt: candidate.run.startedAt ?? new Date(),
          attemptCount: sql`${externalSiteRuns.attemptCount} + 1`,
        })
        .where(eq(externalSiteRuns.id, runId))
        .returning();
      return claimed ?? null;
    });

    if (!run) return;

    // The worker registry owns error capture after this handler rejects, so
    // correlation must live on its job isolation scope rather than a child
    // scope that would close before the exception reaches that boundary.
    Sentry.getIsolationScope().setContext("externalSiteRun", {
      id: run.id,
      site: siteType,
    });
    try {
      await authorizeFetch?.({ id: run.externalSiteId, type: siteType });
      const itemCount = await scrape();
      await completeExternalSiteRun({ run, status: "succeeded", itemCount });
    } catch (error) {
      await completeExternalSiteRun({
        run,
        status: "failed",
        error: summarizeExternalSiteRunError(error),
      });
      throw error;
    }
  };
}

export function createExternalSiteRunJob(
  siteType: ExternalSiteType,
  scrape: () => Promise<number>,
) {
  return buildExternalSiteRunJob(siteType, scrape);
}

/** Rechecks publisher authorization immediately before review network access. */
export function createExternalReviewSiteRunJob(
  siteType: ExternalSiteType,
  scrape: () => Promise<number>,
) {
  return buildExternalSiteRunJob(siteType, scrape, async (site) => {
    await requireExternalReviewSourceCapability(db, site, "allowFetching");
  });
}
