import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
  type ExternalSiteRun,
} from "@peated/server/db/schema";
import type { ExternalSiteKey } from "@peated/server/types";
import * as Sentry from "@sentry/node";
import { and, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveScrapeSourceRunRegistry } from "./configured/runtime";
import { SCRAPE_SOURCE_PAUSED_ERROR } from "./configured/service";
import { ScrapeSourceSetupError } from "./configured/setupError";
import { ScraperCoordinationError } from "./coordinator";
import {
  findScraperSourceBySiteKey,
  requireEnabledScraperTargets,
  ScraperTargetDisabledError,
} from "./definitions";
import {
  ScraperHttpStatusError,
  ScraperRequestError,
  ScraperRequestWaitError,
  scraperSystemClock,
  type ScraperHttpClock,
} from "./http";
import { ScraperRobotsDeniedError } from "./robots";
import { SCRAPER_RUN_REFRESH_MS, SCRAPER_RUN_TIMEOUT_MS } from "./runTimeout";
import { createScraperSession, ScraperRunTakenOverError } from "./session";
import type {
  ScraperRegistry,
  ScraperRunPayload,
  ScraperSourceDefinition,
} from "./types";

const MAX_RUN_EXECUTION_ATTEMPTS = 10;
const MAX_RUN_AGE_MS = 3 * 24 * 60 * 60_000;
const DEFAULT_WAIT_MS = 15 * 60_000;
const REQUEST_LIMIT_WAIT_MS = 60_000;
const RUN_LIMIT_ERROR = "Scraper run exceeded its execution limits.";

const ScraperRunJobInputSchema = z
  .object({ runId: z.number().int().positive() })
  .strict();

type ClaimedRun = {
  run: ExternalSiteRun;
  siteKey: ExternalSiteKey;
  source: ScraperSourceDefinition;
  executionToken: string;
};

export type ScraperRunExecutionResult =
  | { status: "completed" | "duplicate" }
  | { status: "waiting"; nextAttemptAt: Date };

function safeRunError(error: Error) {
  if (error instanceof ScraperTargetDisabledError) {
    return "The source is disabled.";
  }
  if (error instanceof ScrapeSourceSetupError) return error.adminMessage();
  if (error instanceof z.ZodError) {
    return "The source returned data we could not use.";
  }
  if (error instanceof ScraperRobotsDeniedError) {
    return "The source does not allow scraping this page.";
  }
  if (error instanceof ScraperHttpStatusError) {
    return `The source returned error ${error.status}.`;
  }
  if (error instanceof ScraperRequestError) {
    switch (error.category) {
      case "invalid_request":
        return "The scraper request was not allowed.";
      case "redirect_limit":
        return "The source redirected too many times.";
      case "response_too_large":
        return "The source response was too large.";
      case "timeout":
        return "The source took too long to respond.";
      case "transport":
        return "The source could not be reached.";
    }
  }
  return "The scraper failed unexpectedly. See Sentry for details.";
}

async function claimScraperRun({
  runId,
  registry,
  now,
  executionToken,
}: {
  runId: number;
  registry: ScraperRegistry;
  now: Date;
  executionToken: string;
}): Promise<ClaimedRun | ScraperRunExecutionResult> {
  return await db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({ run: externalSiteRuns, site: externalSites })
      .from(externalSiteRuns)
      .innerJoin(
        externalSites,
        eq(externalSites.id, externalSiteRuns.externalSiteId),
      )
      .where(eq(externalSiteRuns.id, runId))
      // Lifecycle and Pause own site locks. A worker owns only its run.
      .for("update", { of: externalSiteRuns });
    if (!candidate) throw new Error(`Scraper run ${runId} not found.`);
    if (
      candidate.run.status === "succeeded" ||
      candidate.run.status === "failed"
    ) {
      return { status: "completed" };
    }
    if (
      candidate.run.status === "running" &&
      candidate.run.executionToken &&
      candidate.run.executionExpiresAt &&
      candidate.run.executionExpiresAt > now
    ) {
      return { status: "duplicate" };
    }
    if (
      candidate.run.attemptCount >= MAX_RUN_EXECUTION_ATTEMPTS ||
      now.getTime() - candidate.run.createdAt.getTime() >= MAX_RUN_AGE_MS
    ) {
      await tx
        .update(externalSiteRuns)
        .set({
          status: "failed",
          error: RUN_LIMIT_ERROR,
          completedAt: now,
          nextAttemptAt: null,
          executionToken: null,
          executionExpiresAt: null,
        })
        .where(eq(externalSiteRuns.id, runId));
      await tx
        .update(externalSites)
        .set({ lastRunAt: now, lastRunId: runId })
        .where(eq(externalSites.id, candidate.run.externalSiteId));
      return { status: "completed" };
    }
    if (
      candidate.run.status === "queued" &&
      candidate.run.nextAttemptAt &&
      candidate.run.nextAttemptAt > now
    ) {
      return {
        status: "waiting",
        nextAttemptAt: candidate.run.nextAttemptAt,
      };
    }

    const source = findScraperSourceBySiteKey(registry, candidate.site.type);
    if (!source) {
      throw new Error(
        `External site ${candidate.site.type} is not registered with the scraper runtime.`,
      );
    }
    const [claimed] = await tx
      .update(externalSiteRuns)
      .set({
        status: "running",
        startedAt: candidate.run.startedAt ?? now,
        attemptCount: sql`${externalSiteRuns.attemptCount} + 1`,
        sliceRequestCount:
          candidate.run.status === "queued"
            ? 0
            : candidate.run.sliceRequestCount,
        nextAttemptAt: null,
        executionToken,
        executionExpiresAt: new Date(now.getTime() + SCRAPER_RUN_TIMEOUT_MS),
      })
      .where(eq(externalSiteRuns.id, runId))
      .returning();
    if (!claimed) throw new Error(`Unable to claim scraper run ${runId}.`);
    return {
      run: claimed,
      siteKey: candidate.site.type,
      source,
      executionToken,
    };
  });
}

async function isScraperRunPaused(runId: number) {
  const [run] = await db
    .select({ error: externalSiteRuns.error, status: externalSiteRuns.status })
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, runId));
  return run?.status === "failed" && run.error === SCRAPE_SOURCE_PAUSED_ERROR;
}

async function completeRun(claim: ClaimedRun, completedAt: Date) {
  await db.transaction(async (tx) => {
    const [completed] = await tx
      .update(externalSiteRuns)
      .set({
        status: "succeeded",
        itemCount: claim.run.emittedItemCount,
        error: null,
        completedAt,
        executionToken: null,
        executionExpiresAt: null,
      })
      .where(
        and(
          eq(externalSiteRuns.id, claim.run.id),
          eq(externalSiteRuns.status, "running"),
          eq(externalSiteRuns.executionToken, claim.executionToken),
        ),
      )
      .returning({
        id: externalSiteRuns.id,
        externalSiteId: externalSiteRuns.externalSiteId,
      });
    if (!completed) throw new ScraperRunTakenOverError();
    await tx
      .update(externalSites)
      .set({ lastRunAt: completedAt, lastRunId: completed.id })
      .where(eq(externalSites.id, completed.externalSiteId));
  });
}

async function failRun(claim: ClaimedRun, error: Error, completedAt: Date) {
  await db.transaction(async (tx) => {
    const [failed] = await tx
      .update(externalSiteRuns)
      .set({
        status: "failed",
        error: safeRunError(error),
        completedAt,
        executionToken: null,
        executionExpiresAt: null,
      })
      .where(
        and(
          eq(externalSiteRuns.id, claim.run.id),
          eq(externalSiteRuns.status, "running"),
          eq(externalSiteRuns.executionToken, claim.executionToken),
        ),
      )
      .returning({
        id: externalSiteRuns.id,
        externalSiteId: externalSiteRuns.externalSiteId,
      });
    if (!failed) return;
    await tx
      .update(externalSites)
      .set({ lastRunAt: completedAt, lastRunId: failed.id })
      .where(eq(externalSites.id, failed.externalSiteId));
  });
}

async function queueRunForLater(
  claim: ClaimedRun,
  error: ScraperRequestWaitError | ScraperCoordinationError,
  now: Date,
) {
  let nextAttemptAt = new Date(now.getTime() + DEFAULT_WAIT_MS);
  if (error instanceof ScraperRequestWaitError) {
    nextAttemptAt =
      error.nextEligibleAt ??
      new Date(
        now.getTime() +
          (error.reason === "run_budget"
            ? REQUEST_LIMIT_WAIT_MS
            : DEFAULT_WAIT_MS),
      );
  }
  await db
    .update(externalSiteRuns)
    .set({
      status: "queued",
      attemptCount:
        error instanceof ScraperRequestWaitError &&
        (error.reason === "target_spacing" || error.reason === "run_budget")
          ? Math.max(0, claim.run.attemptCount - 1)
          : claim.run.attemptCount,
      nextAttemptAt,
      executionToken: null,
      executionExpiresAt: null,
      error: null,
    })
    .where(
      and(
        eq(externalSiteRuns.id, claim.run.id),
        eq(externalSiteRuns.executionToken, claim.executionToken),
        inArray(externalSiteRuns.status, ["queued", "running"]),
      ),
    );
  return nextAttemptAt;
}

export async function executeScraperRun(
  input: ScraperRunPayload,
  {
    registry,
    fetchImpl,
    clock = scraperSystemClock,
    executionToken = randomUUID(),
  }: {
    registry: ScraperRegistry;
    fetchImpl?: typeof fetch;
    clock?: ScraperHttpClock;
    executionToken?: string;
  },
): Promise<ScraperRunExecutionResult> {
  const { runId } = ScraperRunJobInputSchema.parse(input);
  const runRegistry = await resolveScrapeSourceRunRegistry(
    runId,
    registry,
    executionToken,
  );
  const claimed = await claimScraperRun({
    runId,
    registry: runRegistry,
    now: clock.now(),
    executionToken,
  });
  if (!("run" in claimed)) return claimed;

  const stopExtendingRun = startExtendingRunTimeout({
    runId: claimed.run.id,
    executionToken: claimed.executionToken,
    clock,
  });

  Sentry.getIsolationScope().setContext("externalSiteRun", {
    id: claimed.run.id,
    site: claimed.siteKey,
  });

  try {
    requireEnabledScraperTargets(runRegistry, claimed.source);
    const cursor =
      claimed.run.cursor === null
        ? null
        : claimed.source.cursorSchema.parse(claimed.run.cursor);
    const session = createScraperSession({
      run: claimed.run,
      source: claimed.source,
      registry: runRegistry,
      executionToken: claimed.executionToken,
      fetchImpl,
      clock,
    });
    await claimed.source.adapter({ cursor, session });
    await stopExtendingRun();

    const [latest] = await db
      .select({ emittedItemCount: externalSiteRuns.emittedItemCount })
      .from(externalSiteRuns)
      .where(eq(externalSiteRuns.id, claimed.run.id));
    claimed.run.emittedItemCount = latest?.emittedItemCount ?? 0;
    await completeRun(claimed, clock.now());
    return { status: "completed" };
  } catch (error) {
    await stopExtendingRun().catch(() => {});
    if (
      (error instanceof ScraperRunTakenOverError ||
        (error instanceof ScraperRequestError &&
          error.category === "invalid_request")) &&
      (await isScraperRunPaused(claimed.run.id))
    ) {
      return { status: "completed" };
    }
    if (
      error instanceof ScraperRequestWaitError ||
      error instanceof ScraperCoordinationError
    ) {
      const nextAttemptAt = await queueRunForLater(claimed, error, clock.now());
      return { status: "waiting", nextAttemptAt };
    }
    if (error instanceof ScrapeSourceSetupError) {
      await failRun(claimed, error, clock.now());
      return { status: "completed" };
    }
    await failRun(
      claimed,
      error instanceof Error ? error : new Error("Unexpected scraper failure."),
      clock.now(),
    );
    throw error;
  }
}

function startExtendingRunTimeout({
  runId,
  executionToken,
  clock,
}: {
  runId: number;
  executionToken: string;
  clock: ScraperHttpClock;
}) {
  let stopped = false;
  let refreshError: unknown;
  let refresh = Promise.resolve();
  const timer = setInterval(() => {
    refresh = refresh
      .then(async () => {
        await extendRunTimeout({
          runId,
          executionToken,
          now: clock.now(),
        });
      })
      .catch((error) => {
        refreshError = error;
        clearInterval(timer);
      });
  }, SCRAPER_RUN_REFRESH_MS);
  timer.unref();

  return async () => {
    if (!stopped) {
      stopped = true;
      clearInterval(timer);
      await refresh;
    }
    if (refreshError) throw refreshError;
  };
}

export async function extendRunTimeout({
  runId,
  executionToken,
  now,
}: {
  runId: number;
  executionToken: string;
  now: Date;
}) {
  const [updated] = await db
    .update(externalSiteRuns)
    .set({
      executionExpiresAt: new Date(now.getTime() + SCRAPER_RUN_TIMEOUT_MS),
    })
    .where(
      and(
        eq(externalSiteRuns.id, runId),
        eq(externalSiteRuns.status, "running"),
        eq(externalSiteRuns.executionToken, executionToken),
      ),
    )
    .returning({ id: externalSiteRuns.id });
  if (!updated) throw new ScraperRunTakenOverError();
}
