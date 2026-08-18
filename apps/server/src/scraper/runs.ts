import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
  type ExternalSiteRun,
} from "@peated/server/db/schema";
import type { ExternalSiteType } from "@peated/server/types";
import * as Sentry from "@sentry/node";
import { and, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { findScraperSourceBySiteType } from "./definitions";
import {
  ScraperHttpStatusError,
  ScraperRequestDeferredError,
  ScraperRequestError,
  scraperSystemClock,
  type ScraperHttpClock,
} from "./http";
import { scraperRegistry } from "./registry";
import { ScraperRobotsDeniedError } from "./robots";
import { createScraperSession, ScraperRunOwnershipError } from "./session";
import type { ScraperRegistry, ScraperSourceDefinition } from "./types";

const RUN_EXECUTION_LEASE_MS = 60 * 60_000;
const MAX_RUN_EXECUTION_ATTEMPTS = 10;
const MAX_RUN_AGE_MS = 24 * 60 * 60_000;
const DEFAULT_DEFERRAL_MS = 15 * 60_000;
const BUDGET_DEFERRAL_MS = 60_000;
const RUN_LIMIT_ERROR = "Scraper run exceeded its execution limits.";

const ScraperRunJobInputSchema = z
  .object({ runId: z.number().int().positive() })
  .strict();

type ClaimedRun = {
  run: ExternalSiteRun;
  siteType: ExternalSiteType;
  source: ScraperSourceDefinition;
  executionToken: string;
};

export type ScraperRunExecutionResult =
  | { status: "completed" | "duplicate" }
  | { status: "not_ready"; nextAttemptAt: Date }
  | { status: "deferred"; nextAttemptAt: Date };

function safeRunError(error: unknown) {
  if (error instanceof z.ZodError) return "Scraper data failed validation.";
  if (error instanceof ScraperRobotsDeniedError) {
    return "Robots policy disallows this scraper path.";
  }
  if (error instanceof ScraperHttpStatusError) {
    return `Remote source returned HTTP ${error.status}.`;
  }
  if (error instanceof ScraperRequestError) {
    return `Scraper request failed: ${error.category}.`;
  }
  return "Unexpected scraper failure. See Sentry for this run.";
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
      .for("update");
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
        status: "not_ready",
        nextAttemptAt: candidate.run.nextAttemptAt,
      };
    }

    const source = findScraperSourceBySiteType(registry, candidate.site.type);
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
        executionExpiresAt: new Date(now.getTime() + RUN_EXECUTION_LEASE_MS),
      })
      .where(eq(externalSiteRuns.id, runId))
      .returning();
    if (!claimed) throw new Error(`Unable to claim scraper run ${runId}.`);
    return {
      run: claimed,
      siteType: candidate.site.type,
      source,
      executionToken,
    };
  });
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
    if (!completed) throw new ScraperRunOwnershipError();
    await tx
      .update(externalSites)
      .set({ lastRunAt: completedAt, lastRunId: completed.id })
      .where(eq(externalSites.id, completed.externalSiteId));
  });
}

async function failRun(claim: ClaimedRun, error: unknown, completedAt: Date) {
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

async function deferRun(
  claim: ClaimedRun,
  error: ScraperRequestDeferredError,
  now: Date,
) {
  const nextAttemptAt =
    error.nextEligibleAt ??
    new Date(
      now.getTime() +
        (error.reason === "run_budget"
          ? BUDGET_DEFERRAL_MS
          : DEFAULT_DEFERRAL_MS),
    );
  await db
    .update(externalSiteRuns)
    .set({
      status: "queued",
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
  input: unknown,
  {
    registry = scraperRegistry,
    fetchImpl = fetch,
    clock = scraperSystemClock,
    executionToken = randomUUID(),
  }: {
    registry?: ScraperRegistry;
    fetchImpl?: typeof fetch;
    clock?: ScraperHttpClock;
    executionToken?: string;
  } = {},
): Promise<ScraperRunExecutionResult> {
  const { runId } = ScraperRunJobInputSchema.parse(input);
  const claimed = await claimScraperRun({
    runId,
    registry,
    now: clock.now(),
    executionToken,
  });
  if (!("run" in claimed)) return claimed;

  Sentry.getIsolationScope().setContext("externalSiteRun", {
    id: claimed.run.id,
    site: claimed.siteType,
  });

  try {
    const cursor =
      claimed.run.cursor === null
        ? null
        : claimed.source.cursorSchema.parse(claimed.run.cursor);
    await claimed.source.authorize?.({
      externalSiteId: claimed.run.externalSiteId,
      externalSiteType: claimed.source.externalSiteType,
    });
    const session = createScraperSession({
      run: claimed.run,
      source: claimed.source,
      registry,
      executionToken: claimed.executionToken,
      fetchImpl,
      clock,
    });
    await claimed.source.adapter({ cursor, session });

    const [latest] = await db
      .select({ emittedItemCount: externalSiteRuns.emittedItemCount })
      .from(externalSiteRuns)
      .where(eq(externalSiteRuns.id, claimed.run.id));
    claimed.run.emittedItemCount = latest?.emittedItemCount ?? 0;
    await completeRun(claimed, clock.now());
    return { status: "completed" };
  } catch (error) {
    if (error instanceof ScraperRequestDeferredError) {
      const nextAttemptAt = await deferRun(claimed, error, clock.now());
      return { status: "deferred", nextAttemptAt };
    }
    await failRun(claimed, error, clock.now());
    throw error;
  }
}
