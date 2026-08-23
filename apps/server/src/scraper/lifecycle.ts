import { db, type AnyDatabase } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
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
} from "drizzle-orm";
import { z } from "zod";
import {
  findScraperSourceBySiteType,
  requireEnabledScraperTargets,
} from "./definitions";
import type { ScraperRegistry } from "./types";

const STALE_EXTERNAL_SITE_RUN_MS = 10 * 60_000;
const EXTERNAL_SITE_RUN_RECONCILE_LIMIT = 100;

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
  registry: ScraperRegistry,
  requestedById?: number,
) {
  const source = findScraperSourceBySiteType(registry, site.type);
  if (!source) {
    throw new Error(
      `External site ${site.type} is not registered with the scraper runtime.`,
    );
  }
  requireEnabledScraperTargets(registry, source);
  let cursor = null;
  if (source.resumeFromLastRun) {
    const [priorRun] = await connection
      .select({ cursor: externalSiteRuns.cursor })
      .from(externalSiteRuns)
      .where(
        and(
          eq(externalSiteRuns.externalSiteId, site.id),
          eq(externalSiteRuns.status, "succeeded"),
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
      requestedById,
      requestLimit: source.requestLimit,
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
  registry: ScraperRegistry,
  enqueue: ScraperEnqueue,
  { completeOnFailure = true }: { completeOnFailure?: boolean } = {},
) {
  try {
    const source = findScraperSourceBySiteType(registry, site.type);
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
    await dispatchExternalSiteRun(run, site, registry, enqueue, {
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
    run = await insertRun(db, site, "manual", registry, requestedById);
  } catch (error) {
    if (!ActiveRunConflictSchema.safeParse(error).success) throw error;
    return await throwActiveRunConflict(site.id);
  }
  await dispatchExternalSiteRun(run, site, registry, enqueue);
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
    if (!ActiveRunConflictSchema.safeParse(error).success) throw error;
    return await throwActiveRunConflict(siteId);
  }

  if (!result) return null;
  await dispatchExternalSiteRun(result.run, result.site, registry, enqueue);
  return result.run;
}

/** Binds infrastructure once so lifecycle callers cannot bypass source ownership. */
export function createScraperLifecycle({
  registry,
  enqueue,
}: {
  registry: ScraperRegistry;
  enqueue: ScraperEnqueue;
}) {
  return {
    queueManualExternalSiteRun: (input: {
      site: ExternalSite;
      requestedById: number;
    }) => queueManualExternalSiteRun({ ...input, registry, enqueue }),
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
