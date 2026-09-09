import { db } from "@peated/server/db";
import { externalSiteRuns } from "@peated/server/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  requestScraperUrl,
  type ScraperHttpClock,
  scraperSystemClock,
} from "./http";
import { ensureRobotsAllowed } from "./robots";
import { SCRAPER_RUN_TIMEOUT_MS } from "./runTimeout";
import type {
  ScraperObservation,
  ScraperRegistry,
  ScraperRequest,
  ScraperSession,
  ScraperSourceDefinition,
} from "./types";

const SourceObservationKeySchema = z.string().trim().min(1).max(512);
const ObservationItemCountSchema = z.number().int().positive().max(1_000);
const ScraperSinkResultSchema = z
  .object({
    newItemCount: z.number().int().nonnegative(),
    existingItemCount: z.number().int().nonnegative(),
  })
  .strict();

export class ScraperRunTakenOverError extends Error {
  override name = "ScraperRunTakenOverError";

  constructor() {
    super("Another worker has taken over this scraper run.");
  }
}

export function createScraperSession<TCursor, TObservation>({
  run,
  source,
  registry,
  executionToken,
  fetchImpl,
  clock = scraperSystemClock,
}: {
  run: {
    id: number;
    externalSiteId: number;
    requestLimit: number;
    sliceRequestCount: number;
  };
  source: ScraperSourceDefinition<TCursor, TObservation>;
  registry: ScraperRegistry;
  executionToken: string;
  fetchImpl?: typeof fetch;
  clock?: ScraperHttpClock;
}): ScraperSession<TCursor, TObservation> {
  let remaining = Math.max(0, run.requestLimit - run.sliceRequestCount);

  async function updateOwnedRun(values: { cursor?: unknown }) {
    const now = clock.now();
    const [updated] = await db
      .update(externalSiteRuns)
      .set({
        ...values,
        executionExpiresAt: new Date(now.getTime() + SCRAPER_RUN_TIMEOUT_MS),
      })
      .where(
        and(
          eq(externalSiteRuns.id, run.id),
          eq(externalSiteRuns.status, "running"),
          eq(externalSiteRuns.executionToken, executionToken),
        ),
      )
      .returning({
        requestLimit: externalSiteRuns.requestLimit,
        sliceRequestCount: externalSiteRuns.sliceRequestCount,
      });
    if (!updated) throw new ScraperRunTakenOverError();
    remaining = Math.max(0, updated.requestLimit - updated.sliceRequestCount);
  }

  return {
    async request(request: ScraperRequest) {
      try {
        const checkRobots = async (url: URL) => {
          await ensureRobotsAllowed({
            runId: run.id,
            executionToken,
            sourceKey: source.key,
            targetKey: request.target,
            url,
            canResumeLater: request.canResumeLater,
            registry,
            fetchImpl,
            clock,
          });
        };
        await checkRobots(request.url);
        return await requestScraperUrl({
          runId: run.id,
          executionToken,
          sourceKey: source.key,
          request,
          registry,
          checkRedirect: checkRobots,
          fetchImpl,
          clock,
        });
      } finally {
        await updateOwnedRun({});
      }
    },

    async emit(observation: ScraperObservation<TObservation>) {
      const validated = {
        sourceKey: SourceObservationKeySchema.parse(observation.sourceKey),
        itemCount: ObservationItemCountSchema.parse(observation.itemCount ?? 1),
        value: source.observationSchema.parse(observation.value),
      };
      await updateOwnedRun({});
      const sinkResult = await source.sink({
        externalSiteId: run.externalSiteId,
        observation: validated,
      });
      const counts = sinkResult
        ? ScraperSinkResultSchema.parse(sinkResult)
        : { newItemCount: 0, existingItemCount: 0 };
      if (
        counts.newItemCount + counts.existingItemCount >
        validated.itemCount
      ) {
        throw new Error("Scraper sink counted more records than it received.");
      }
      const now = clock.now();
      const [updated] = await db
        .update(externalSiteRuns)
        .set({
          emittedItemCount: sql`${externalSiteRuns.emittedItemCount} + ${validated.itemCount}`,
          newItemCount: sql`${externalSiteRuns.newItemCount} + ${counts.newItemCount}`,
          existingItemCount: sql`${externalSiteRuns.existingItemCount} + ${counts.existingItemCount}`,
          executionExpiresAt: new Date(now.getTime() + SCRAPER_RUN_TIMEOUT_MS),
        })
        .where(
          and(
            eq(externalSiteRuns.id, run.id),
            eq(externalSiteRuns.status, "running"),
            eq(externalSiteRuns.executionToken, executionToken),
          ),
        )
        .returning({
          requestLimit: externalSiteRuns.requestLimit,
          sliceRequestCount: externalSiteRuns.sliceRequestCount,
        });
      if (!updated) throw new ScraperRunTakenOverError();
      remaining = Math.max(0, updated.requestLimit - updated.sliceRequestCount);
    },

    async checkpoint(cursor: TCursor) {
      await updateOwnedRun({ cursor: source.cursorSchema.parse(cursor) });
    },

    remainingRequests() {
      return remaining;
    },
  };
}
