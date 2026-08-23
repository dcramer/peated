import { db, type AnyConnection } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSiteScrapeTargets,
  scrapeTargets,
} from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

const LEASE_TIMEOUT_PADDING_MS = 5_000;
const INITIAL_RATE_LIMIT_COOLDOWN_MS = 60_000;
const MAX_RATE_LIMIT_COOLDOWN_MS = 6 * 60 * 60_000;

export type CoordinatorDatabase = Pick<AnyConnection, "transaction">;

export type PermitDenialReason =
  | "target_not_found"
  | "run_not_found"
  | "run_inactive"
  | "target_not_allowed"
  | "target_disabled"
  | "target_busy"
  | "target_spacing"
  | "target_quota"
  | "target_cooldown"
  | "run_budget";

export type PermitResult =
  | {
      granted: true;
      token: string;
      targetKey: string;
      timeoutMs: number;
      maxResponseBytes: number;
      maxRetries: number;
      remainingRequests: number;
    }
  | {
      granted: false;
      reason: PermitDenialReason;
      nextEligibleAt: Date | null;
    };

export class ScraperCoordinationError extends Error {
  override name = "ScraperCoordinationError";

  constructor(cause: unknown) {
    super("Scraper traffic coordination failed before network access.", {
      cause,
    });
  }
}

function laterDate(...values: Array<Date | null>): Date | null {
  return values.reduce<Date | null>((latest, value) => {
    if (!value) return latest;
    return !latest || value > latest ? value : latest;
  }, null);
}

function addMs(value: Date, milliseconds: number) {
  return new Date(value.getTime() + milliseconds);
}

export async function acquireScrapePermit({
  runId,
  executionToken,
  targetKey,
  isRetry = false,
  now = new Date(),
  token = randomUUID(),
  database = db,
}: {
  runId: number;
  executionToken: string;
  targetKey: string;
  isRetry?: boolean;
  now?: Date;
  token?: string;
  database?: CoordinatorDatabase;
}): Promise<PermitResult> {
  try {
    return await database.transaction(async (tx) => {
      // Target then run is the invariant lock order for every permit writer.
      const [target] = await tx
        .select()
        .from(scrapeTargets)
        .where(eq(scrapeTargets.key, targetKey))
        .for("update");
      if (!target) {
        return {
          granted: false,
          reason: "target_not_found",
          nextEligibleAt: null,
        };
      }

      const [run] = await tx
        .select()
        .from(externalSiteRuns)
        .where(eq(externalSiteRuns.id, runId))
        .for("update");
      if (!run) {
        return {
          granted: false,
          reason: "run_not_found",
          nextEligibleAt: null,
        };
      }
      if (run.status !== "running" || run.executionToken !== executionToken) {
        return {
          granted: false,
          reason: "run_inactive",
          nextEligibleAt: run.nextAttemptAt,
        };
      }

      const [mapping] = await tx
        .select({ active: externalSiteScrapeTargets.active })
        .from(externalSiteScrapeTargets)
        .where(
          and(
            eq(externalSiteScrapeTargets.externalSiteId, run.externalSiteId),
            eq(externalSiteScrapeTargets.targetKey, targetKey),
            eq(externalSiteScrapeTargets.active, true),
          ),
        );
      if (!mapping) {
        return {
          granted: false,
          reason: "target_not_allowed",
          nextEligibleAt: null,
        };
      }
      if (run.sliceRequestCount >= run.requestLimit) {
        return {
          granted: false,
          reason: "run_budget",
          nextEligibleAt: null,
        };
      }
      if (!target.enabled) {
        return {
          granted: false,
          reason: "target_disabled",
          nextEligibleAt: null,
        };
      }
      if (target.leaseExpiresAt && target.leaseExpiresAt > now) {
        return {
          granted: false,
          reason: "target_busy",
          nextEligibleAt: target.leaseExpiresAt,
        };
      }
      if (target.blockedUntil && target.blockedUntil > now) {
        return {
          granted: false,
          reason: "target_cooldown",
          nextEligibleAt: target.blockedUntil,
        };
      }
      if (target.nextRequestAt && target.nextRequestAt > now) {
        return {
          granted: false,
          reason: "target_spacing",
          nextEligibleAt: target.nextRequestAt,
        };
      }

      let windowStartedAt = target.windowStartedAt;
      let windowRequestCount = target.windowRequestCount;
      if (!windowStartedAt || addMs(windowStartedAt, target.windowMs) <= now) {
        windowStartedAt = now;
        windowRequestCount = 0;
      }
      if (windowRequestCount >= target.requestsPerWindow) {
        return {
          granted: false,
          reason: "target_quota",
          nextEligibleAt: addMs(windowStartedAt, target.windowMs),
        };
      }

      await tx
        .update(scrapeTargets)
        .set({
          windowStartedAt,
          windowRequestCount: windowRequestCount + 1,
          nextRequestAt: addMs(now, target.minimumSpacingMs),
          leaseToken: token,
          leaseExpiresAt: addMs(
            now,
            target.timeoutMs + LEASE_TIMEOUT_PADDING_MS,
          ),
          updatedAt: now,
        })
        .where(eq(scrapeTargets.key, targetKey));
      await tx
        .update(externalSiteRuns)
        .set({
          sliceRequestCount: run.sliceRequestCount + 1,
          requestCount: run.requestCount + 1,
          retryCount: run.retryCount + (isRetry ? 1 : 0),
        })
        .where(eq(externalSiteRuns.id, runId));

      return {
        granted: true,
        token,
        targetKey,
        timeoutMs: target.timeoutMs,
        maxResponseBytes: target.maxResponseBytes,
        maxRetries: target.maxRetries,
        remainingRequests: run.requestLimit - run.sliceRequestCount - 1,
      };
    });
  } catch (error) {
    if (error instanceof ScraperCoordinationError) throw error;
    throw new ScraperCoordinationError(error);
  }
}

export async function releaseScrapePermit({
  targetKey,
  token,
  resetRateLimitStreak = false,
  now = new Date(),
  database = db,
}: {
  targetKey: string;
  token: string;
  resetRateLimitStreak?: boolean;
  now?: Date;
  database?: CoordinatorDatabase;
}): Promise<boolean> {
  try {
    return await database.transaction(async (tx) => {
      const update: Partial<typeof scrapeTargets.$inferInsert> = {
        leaseToken: null,
        leaseExpiresAt: null,
        updatedAt: now,
      };
      if (resetRateLimitStreak) update.rateLimitStreak = 0;
      const [released] = await tx
        .update(scrapeTargets)
        .set(update)
        .where(
          and(
            eq(scrapeTargets.key, targetKey),
            eq(scrapeTargets.leaseToken, token),
          ),
        )
        .returning({ key: scrapeTargets.key });
      return Boolean(released);
    });
  } catch (error) {
    throw new ScraperCoordinationError(error);
  }
}

export async function recordScrapeRateLimit({
  runId,
  targetKey,
  token,
  retryAt,
  now = new Date(),
  database = db,
}: {
  runId: number;
  targetKey: string;
  token: string;
  retryAt?: Date | null;
  now?: Date;
  database?: CoordinatorDatabase;
}): Promise<Date> {
  try {
    return await database.transaction(async (tx) => {
      // Keep the same target-then-run lock order as permit acquisition.
      const [target] = await tx
        .select()
        .from(scrapeTargets)
        .where(eq(scrapeTargets.key, targetKey))
        .for("update");
      if (!target) throw new Error(`Unknown scraper target: ${targetKey}`);
      const [run] = await tx
        .select()
        .from(externalSiteRuns)
        .where(eq(externalSiteRuns.id, runId))
        .for("update");
      if (!run) throw new Error(`Unknown scraper run: ${runId}`);

      const rateLimitStreak = target.rateLimitStreak + 1;
      const fallbackMs = Math.min(
        INITIAL_RATE_LIMIT_COOLDOWN_MS * 2 ** (rateLimitStreak - 1),
        MAX_RATE_LIMIT_COOLDOWN_MS,
      );
      const candidate =
        retryAt && retryAt > now ? retryAt : addMs(now, fallbackMs);
      const blockedUntil =
        laterDate(target.blockedUntil, candidate) ?? candidate;

      const update: Partial<typeof scrapeTargets.$inferInsert> = {
        blockedUntil,
        rateLimitStreak,
        updatedAt: now,
      };
      if (target.leaseToken === token) {
        update.leaseToken = null;
        update.leaseExpiresAt = null;
      }
      await tx
        .update(scrapeTargets)
        .set(update)
        .where(eq(scrapeTargets.key, targetKey));
      await tx
        .update(externalSiteRuns)
        .set({ rateLimitCount: run.rateLimitCount + 1 })
        .where(eq(externalSiteRuns.id, runId));

      return blockedUntil;
    });
  } catch (error) {
    if (error instanceof ScraperCoordinationError) throw error;
    throw new ScraperCoordinationError(error);
  }
}
