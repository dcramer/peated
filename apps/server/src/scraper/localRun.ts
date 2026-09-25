import { db } from "@peated/server/db";
import { externalSiteRuns, externalSites } from "@peated/server/db/schema";
import { syncExternalSites } from "@peated/server/lib/externalSites";
import { ExternalSiteKeySchema } from "@peated/server/schemas/externalSites";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { scraperSystemClock, type ScraperHttpClock } from "./http";
import { scraperRegistry } from "./registry";
import { executeScraperRun } from "./runs";
import { syncScraperDefinitions } from "./syncDefinitions";
import type { ScraperRegistry } from "./types";

const InputSchema = z.object({ site: ExternalSiteKeySchema }).strict();

export type LocalScraperSourceRunInput = z.input<typeof InputSchema>;

/**
 * Runs one built-in source through the local runtime and saves its results
 * to the local database. Robots rules, request pacing, and the source's sink
 * all apply, so this is the local check the scraper README asks for.
 */
export async function runLocalScraperSource(
  input: LocalScraperSourceRunInput,
  options: {
    registry?: ScraperRegistry;
    fetchImpl?: typeof fetch;
    clock?: ScraperHttpClock;
    executionToken?: string;
    onWaiting?: (nextAttemptAt: Date) => void;
  } = {},
) {
  const { site: siteKey } = InputSchema.parse(input);
  const registry = options.registry ?? scraperRegistry;
  const clock = options.clock ?? scraperSystemClock;

  const isBuiltIn = [...registry.sources.values()].some(
    (source) => source.externalSiteKey === siteKey,
  );
  if (!isBuiltIn) {
    throw new Error(
      `${siteKey} is not a built-in scraper source. Use "scrapers preview" for saved rules.`,
    );
  }

  await syncExternalSites();
  await syncScraperDefinitions(registry);

  const [site] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.type, siteKey));
  if (!site) throw new Error(`External site ${siteKey} was not found.`);

  const [activeRun] = await db
    .select({ id: externalSiteRuns.id })
    .from(externalSiteRuns)
    .where(
      and(
        eq(externalSiteRuns.externalSiteId, site.id),
        inArray(externalSiteRuns.status, ["queued", "running"]),
      ),
    )
    .limit(1);
  if (activeRun) {
    throw new Error(`External site ${siteKey} already has an active run.`);
  }

  const [run] = await db
    .insert(externalSiteRuns)
    .values({
      externalSiteId: site.id,
      trigger: "manual",
      requestErrorCount: 0,
    })
    .returning();
  if (!run) throw new Error("Failed to create the local scraper run.");

  while (true) {
    const result = await executeScraperRun(
      { runId: run.id },
      {
        registry,
        fetchImpl: options.fetchImpl,
        clock,
        executionToken: options.executionToken,
      },
    );
    if (result.status === "completed") break;
    if (result.status === "waiting") {
      options.onWaiting?.(result.nextAttemptAt);
      await clock.sleep(
        Math.max(0, result.nextAttemptAt.getTime() - clock.now().getTime()),
      );
      continue;
    }
    throw new Error("The local scraper run is already running.");
  }

  const [storedRun] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  if (!storedRun) throw new Error("Local scraper run was not found.");
  return storedRun;
}
