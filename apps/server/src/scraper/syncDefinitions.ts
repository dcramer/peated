import { db, type AnyTransaction } from "@peated/server/db";
import {
  externalSiteScrapeTargets,
  externalSites,
  scrapeOrigins,
  scrapeTargets,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import type { ScraperRegistry } from "./types";

async function applyScraperDefinitions(
  tx: AnyTransaction,
  registry: ScraperRegistry,
) {
  const now = new Date();

  // Definitions are code-owned. Rows are retained but made inactive when a
  // definition disappears so coordination history is never silently deleted.
  await tx
    .update(externalSiteScrapeTargets)
    .set({ active: false, updatedAt: now })
    .where(eq(externalSiteScrapeTargets.owner, "code"));
  await tx
    .update(scrapeOrigins)
    .set({ active: false, updatedAt: now })
    .where(eq(scrapeOrigins.owner, "code"));
  await tx
    .update(scrapeTargets)
    .set({ enabled: false, updatedAt: now })
    .where(eq(scrapeTargets.owner, "code"));

  for (const target of registry.targets.values()) {
    await tx
      .insert(scrapeTargets)
      .values({
        key: target.key,
        owner: "code",
        enabled: target.enabled,
        minimumSpacingMs: target.minimumSpacingMs,
        requestsPerWindow: target.requestsPerWindow,
        windowMs: target.windowMs,
        timeoutMs: target.timeoutMs,
        maxResponseBytes: target.maxResponseBytes,
        maxRetries: target.maxRetries,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: scrapeTargets.key,
        set: {
          enabled: target.enabled,
          minimumSpacingMs: target.minimumSpacingMs,
          requestsPerWindow: target.requestsPerWindow,
          windowMs: target.windowMs,
          timeoutMs: target.timeoutMs,
          maxResponseBytes: target.maxResponseBytes,
          maxRetries: target.maxRetries,
          updatedAt: now,
        },
        setWhere: eq(scrapeTargets.owner, "code"),
      });

    for (const origin of target.origins) {
      await tx
        .insert(scrapeOrigins)
        .values({
          origin: origin.origin,
          owner: "code",
          targetKey: target.key,
          active: true,
          robotsMode: origin.robots.mode,
          robotsRationale:
            origin.robots.mode === "not_applicable"
              ? origin.robots.rationale
              : null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: scrapeOrigins.origin,
          set: {
            targetKey: target.key,
            active: true,
            robotsMode: origin.robots.mode,
            robotsRationale:
              origin.robots.mode === "not_applicable"
                ? origin.robots.rationale
                : null,
            updatedAt: now,
          },
          setWhere: eq(scrapeOrigins.owner, "code"),
        });
    }
  }

  for (const source of registry.sources.values()) {
    const [site] = await tx
      .select({ id: externalSites.id })
      .from(externalSites)
      .where(eq(externalSites.type, source.externalSiteKey));
    if (!site) {
      throw new Error(
        `External site ${source.externalSiteKey} must be synchronized before scraper definitions.`,
      );
    }

    for (const targetKey of source.targetKeys) {
      await tx
        .insert(externalSiteScrapeTargets)
        .values({
          externalSiteId: site.id,
          targetKey,
          owner: "code",
          active: true,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            externalSiteScrapeTargets.externalSiteId,
            externalSiteScrapeTargets.targetKey,
          ],
          set: { active: true, updatedAt: now },
          setWhere: eq(externalSiteScrapeTargets.owner, "code"),
        });
    }
  }
}

export async function syncScraperDefinitions(registry: ScraperRegistry) {
  await db.transaction(async (tx) => {
    await applyScraperDefinitions(tx, registry);
  });
}
