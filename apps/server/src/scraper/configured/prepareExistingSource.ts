import type { AnyTransaction } from "@peated/server/db";
import {
  externalSiteRuns,
  externalSites,
  externalSiteScrapeTargets,
  scrapeOrigins,
  scrapeSources,
  scrapeTargets,
} from "@peated/server/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  ScrapeSourceConflictError,
  ScrapeSourceNotFoundError,
  ScrapeSourceValidationError,
} from "./service";

export type ExistingSourceDefinition = {
  siteKey: string;
  siteName: string;
  targetKey: string;
  origin: string;
};

/** Locks and checks one code-owned source before its records are inspected. */
export async function inspectExistingSource(
  tx: AnyTransaction,
  definition: ExistingSourceDefinition,
) {
  // The scraper lifecycle also locks this site before choosing its scraper.
  const [site] = await tx
    .select()
    .from(externalSites)
    .where(eq(externalSites.type, definition.siteKey))
    .for("update");
  if (!site) {
    throw new ScrapeSourceNotFoundError(
      `${definition.siteName} was not found.`,
    );
  }
  if (site.runEvery !== null) {
    throw new ScrapeSourceConflictError(
      `Stop the ${definition.siteName} schedule before continuing.`,
    );
  }
  const [activeRun] = await tx
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
    throw new ScrapeSourceConflictError(
      `Wait for the active ${definition.siteName} run to finish.`,
    );
  }
  const [source] = await tx
    .select({ id: scrapeSources.id })
    .from(scrapeSources)
    .where(eq(scrapeSources.externalSiteId, site.id));
  if (source) {
    throw new ScrapeSourceConflictError(
      `${definition.siteName} is already prepared for saved scraping rules.`,
    );
  }

  const siteTargets = await tx
    .select()
    .from(externalSiteScrapeTargets)
    .where(eq(externalSiteScrapeTargets.externalSiteId, site.id))
    .for("update");
  const targetSites = await tx
    .select()
    .from(externalSiteScrapeTargets)
    .where(eq(externalSiteScrapeTargets.targetKey, definition.targetKey))
    .for("update");
  const origins = await tx
    .select()
    .from(scrapeOrigins)
    .where(eq(scrapeOrigins.targetKey, definition.targetKey))
    .for("update");
  const [target] = await tx
    .select()
    .from(scrapeTargets)
    .where(eq(scrapeTargets.key, definition.targetKey))
    .for("update");
  // A preparation operation can take ownership only of this site's request settings.
  if (
    siteTargets.length !== 1 ||
    siteTargets[0].targetKey !== definition.targetKey ||
    !siteTargets[0].active ||
    siteTargets[0].managedBy !== "code" ||
    targetSites.length !== 1 ||
    targetSites[0].externalSiteId !== site.id ||
    origins.length !== 1 ||
    origins[0].origin !== definition.origin ||
    !origins[0].active ||
    origins[0].managedBy !== "code" ||
    origins[0].robotsMode !== "enforce" ||
    !target?.enabled ||
    target.managedBy !== "code"
  ) {
    throw new ScrapeSourceValidationError(
      `${definition.siteName} has unexpected request settings. Check them before continuing.`,
    );
  }
  return site;
}

/** Transfers checked request settings and creates an inactive saved-rule source. */
export async function createPreparedSource(
  tx: AnyTransaction,
  input: {
    externalSiteId: number;
    createdById: number;
    kind: "review" | "price";
    listUrl: string;
  },
  definition: ExistingSourceDefinition,
) {
  await tx
    .update(externalSiteScrapeTargets)
    .set({ managedBy: "admin", updatedAt: new Date() })
    .where(
      and(
        eq(externalSiteScrapeTargets.externalSiteId, input.externalSiteId),
        eq(externalSiteScrapeTargets.targetKey, definition.targetKey),
      ),
    );
  await tx
    .update(scrapeOrigins)
    .set({ managedBy: "admin", updatedAt: new Date() })
    .where(eq(scrapeOrigins.origin, definition.origin));
  await tx
    .update(scrapeTargets)
    .set({ managedBy: "admin", updatedAt: new Date() })
    .where(eq(scrapeTargets.key, definition.targetKey));
  const [created] = await tx
    .insert(scrapeSources)
    .values({
      externalSiteId: input.externalSiteId,
      kind: input.kind,
      listUrl: input.listUrl,
      createdById: input.createdById,
    })
    .returning({ id: scrapeSources.id });
  if (!created) throw new Error("Failed to prepare the scrape source.");
  return created.id;
}
