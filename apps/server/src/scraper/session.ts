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
import type {
  ScraperObservation,
  ScraperRegistry,
  ScraperRequest,
  ScraperSession,
  ScraperSourceDefinition,
} from "./types";

const SourceObservationKeySchema = z.string().trim().min(1).max(512);
const ObservationItemCountSchema = z.number().int().positive().max(1_000);
const RUN_EXECUTION_LEASE_MS = 60 * 60_000;

export class ScraperRunOwnershipError extends Error {
  override name = "ScraperRunOwnershipError";

  constructor() {
    super("Scraper run is no longer owned by this execution.");
  }
}

export function createScraperSession<TCursor, TObservation>({
  run,
  source,
  registry,
  executionToken,
  fetchImpl = fetch,
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
        executionExpiresAt: new Date(now.getTime() + RUN_EXECUTION_LEASE_MS),
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
    if (!updated) throw new ScraperRunOwnershipError();
    remaining = Math.max(0, updated.requestLimit - updated.sliceRequestCount);
  }

  async function authorize() {
    await source.authorize?.({
      externalSiteId: run.externalSiteId,
      externalSiteType: source.externalSiteType,
    });
  }

  return {
    async request(request: ScraperRequest) {
      await authorize();
      try {
        await ensureRobotsAllowed({
          runId: run.id,
          executionToken,
          sourceKey: source.key,
          targetKey: request.target,
          url: request.url,
          registry,
          fetchImpl,
          clock,
        });
        return await requestScraperUrl({
          runId: run.id,
          executionToken,
          sourceKey: source.key,
          request,
          registry,
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
      await source.sink({
        externalSiteId: run.externalSiteId,
        observation: validated,
      });
      const now = clock.now();
      const [updated] = await db
        .update(externalSiteRuns)
        .set({
          emittedItemCount: sql`${externalSiteRuns.emittedItemCount} + ${validated.itemCount}`,
          executionExpiresAt: new Date(now.getTime() + RUN_EXECUTION_LEASE_MS),
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
      if (!updated) throw new ScraperRunOwnershipError();
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
