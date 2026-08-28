import { db } from "@peated/server/db";
import { configuredScrapers, externalSites } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { ExternalSiteRunSchema } from "@peated/server/schemas";
import { queueConfiguredScraperPreview } from "@peated/server/scraper";
import { serializeExternalSiteRun } from "@peated/server/serializers/externalSite";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/configured-scrapers/{id}/versions/{versionId}/preview",
    summary: "Test one parsing-rule version",
    operationId: "previewConfiguredScraperDraft",
  })
  .input(
    z
      .object({
        id: z.number().int().positive(),
        versionId: z.number().int().positive(),
      })
      .strict(),
  )
  .output(ExternalSiteRunSchema)
  .handler(async ({ input, context, errors }) => {
    const [row] = await db
      .select({ site: externalSites })
      .from(configuredScrapers)
      .innerJoin(
        externalSites,
        eq(externalSites.id, configuredScrapers.externalSiteId),
      )
      .where(eq(configuredScrapers.id, input.id));
    if (!row) throw errors.NOT_FOUND({ message: "Source not found." });
    const run = await queueConfiguredScraperPreview({
      site: row.site,
      configVersionId: input.versionId,
      requestedById: context.user.id,
    });
    return serializeExternalSiteRun(run);
  });
