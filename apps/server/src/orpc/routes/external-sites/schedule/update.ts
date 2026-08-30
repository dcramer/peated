import { db } from "@peated/server/db";
import {
  externalSites,
  scrapeSourceRevisions,
  scrapeSources,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ExternalSiteKeySchema,
  ExternalSiteSchema,
} from "@peated/server/schemas";
import { getScraperRegistration } from "@peated/server/scraper";
import { serializeExternalSite } from "@peated/server/serializers/externalSite";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z
  .object({
    site: ExternalSiteKeySchema,
    schedule: z
      .object({
        runEvery: z.number().int().positive().nullable(),
      })
      .strict(),
  })
  .strict();

async function hasReadyConfiguredSource(externalSiteId: number) {
  const [source] = await db
    .select({ id: scrapeSources.id })
    .from(scrapeSources)
    .innerJoin(
      scrapeSourceRevisions,
      and(
        eq(scrapeSourceRevisions.scrapeSourceId, scrapeSources.id),
        eq(scrapeSourceRevisions.active, true),
        eq(scrapeSourceRevisions.previewStatus, "passed"),
      ),
    )
    .where(
      and(
        eq(scrapeSources.externalSiteId, externalSiteId),
        eq(scrapeSources.enabled, true),
      ),
    )
    .limit(1);
  return source !== undefined;
}

export default procedure
  .use(requireAdmin)
  .route({
    method: "PUT",
    path: "/admin/external-sites/{site}/schedule",
    summary: "Update external site schedule",
    operationId: "updateExternalSiteSchedule",
  })
  .input(InputSchema)
  .output(ExternalSiteSchema)
  .handler(async ({ input, errors }) => {
    const [site] = await db
      .select()
      .from(externalSites)
      .where(eq(externalSites.type, input.site))
      .limit(1);
    if (!site) throw errors.NOT_FOUND({ message: "Site not found." });

    // Code-managed scrapers use the registry until they move to saved rules.
    // Keep this path for custom scrapers, such as SMWS, that need code.
    if (
      input.schedule.runEvery !== null &&
      getScraperRegistration(site.type) === null &&
      !(await hasReadyConfiguredSource(site.id))
    ) {
      throw errors.BAD_REQUEST({
        message: "Set up this scraper before you schedule automatic runs.",
      });
    }

    const [updated] = await db
      .update(externalSites)
      .set({
        runEvery: input.schedule.runEvery,
        nextRunAt: input.schedule.runEvery === null ? null : new Date(),
      })
      .where(eq(externalSites.id, site.id))
      .returning();
    if (!updated) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to update scraper schedule.",
      });
    }
    return serializeExternalSite(updated);
  });
