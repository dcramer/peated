import { db } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
  externalSiteScrapeTargets,
} from "@peated/server/db/schema";
import { syncExternalSites } from "@peated/server/lib/externalSites";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { ScrapeSourcePreviewResult } from "./configured/preview";
import {
  parseScrapeRules,
  SCRAPE_SOURCE_MAX_LIST_PAGES,
  scrapeRulesLimit,
  withScrapeRulesLimit,
} from "./configured/rules";
import { createLocalScrapeSourcePreview } from "./configured/runtime";
import { scraperSystemClock, type ScraperHttpClock } from "./http";
import { scraperRegistry } from "./registry";
import { executeScraperRun } from "./runs";
import { syncScraperDefinitions } from "./syncDefinitions";

const InputSchema = z
  .object({
    site: z.string().trim().min(1),
    listUrl: z.url(),
    rulesVersion: z.number().int().positive().default(1),
    rules: z.json(),
    limit: z.number().int().positive().max(99).optional(),
  })
  .strict();

export type LocalScrapeSourcePreviewInput = z.input<typeof InputSchema>;

export async function runLocalScrapeSourcePreview(
  input: LocalScrapeSourcePreviewInput,
  options: {
    fetchImpl?: typeof fetch;
    clock?: ScraperHttpClock;
    executionToken?: string;
    onDeferred?: (nextAttemptAt: Date) => void;
  } = {},
) {
  const parsed = InputSchema.parse(input);
  const clock = options.clock ?? scraperSystemClock;
  const parsedRules = parseScrapeRules(parsed.rulesVersion, parsed.rules);
  const rules = parsed.limit
    ? withScrapeRulesLimit(parsedRules, parsed.limit)
    : parsedRules;

  await syncExternalSites();
  await syncScraperDefinitions(scraperRegistry);

  const [site] = await db
    .select()
    .from(externalSites)
    .where(eq(externalSites.type, parsed.site));
  if (!site) throw new Error(`External site ${parsed.site} was not found.`);

  const target = scraperRegistry.targets.get(parsed.site);
  if (!target) {
    throw new Error(`External site ${parsed.site} has no scrape target.`);
  }
  // Local previews still need coordinator authorization after the legacy
  // source registration is removed. Production migrations own their mapping.
  await db
    .insert(externalSiteScrapeTargets)
    .values({
      externalSiteId: site.id,
      targetKey: target.key,
      managedBy: "code",
    })
    .onConflictDoUpdate({
      target: [
        externalSiteScrapeTargets.externalSiteId,
        externalSiteScrapeTargets.targetKey,
      ],
      set: { active: true, updatedAt: new Date() },
      setWhere: eq(externalSiteScrapeTargets.managedBy, "code"),
    });
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
    throw new Error(`External site ${parsed.site} already has an active run.`);
  }

  let preview: ScrapeSourcePreviewResult | null = null;
  const previewSource = createLocalScrapeSourcePreview({
    siteKey: parsed.site,
    targetKey: target.key,
    listUrl: parsed.listUrl,
    rules,
    recordPreview: async ({ result }) => {
      preview = result;
    },
  });
  const sources = new Map(scraperRegistry.sources);
  for (const [key, source] of sources) {
    if (source.externalSiteKey === parsed.site) sources.delete(key);
  }
  sources.set(previewSource.key, previewSource);
  const registry = { sources, targets: scraperRegistry.targets };

  const [run] = await db
    .insert(externalSiteRuns)
    .values({
      externalSiteId: site.id,
      trigger: "manual",
      requestLimit: scrapeRulesLimit(rules) + SCRAPE_SOURCE_MAX_LIST_PAGES,
    })
    .returning();
  if (!run) throw new Error("Failed to create the local scraper preview run.");

  try {
    for (let attempt = 0; attempt < 10; attempt += 1) {
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
      if ("nextAttemptAt" in result) {
        options.onDeferred?.(result.nextAttemptAt);
        await clock.sleep(
          Math.max(0, result.nextAttemptAt.getTime() - clock.now().getTime()),
        );
        continue;
      }
      throw new Error("The local scraper preview is already running.");
    }
  } catch (error) {
    if (!preview) throw error;
  }

  const [storedRun] = await db
    .select()
    .from(externalSiteRuns)
    .where(eq(externalSiteRuns.id, run.id));
  if (!storedRun) throw new Error("Local scraper preview run was not found.");
  return { run: storedRun, preview };
}
