import { db } from "@peated/server/db";
import { externalSites, scrapeSources } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { ExternalSiteRunSchema } from "@peated/server/schemas";
import {
  ExternalSiteRunActiveError,
  queueScrapeSourcePreview,
} from "@peated/server/scraper";
import { ScrapeSourceValidationError } from "@peated/server/scraper/configured/service";
import { serializeExternalSiteRun } from "@peated/server/serializers/externalSite";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/scrape-sources/{id}/revisions/{revisionId}/preview",
    summary: "Test one parsing-rule revision",
    description:
      "Queue a preview of a saved parsing-rule revision and return the run to track. Requires administrator privileges.",
    operationId: "previewScrapeSourceRevision",
  })
  .input(
    z
      .object({
        id: z.number().int().positive(),
        revisionId: z.number().int().positive(),
      })
      .strict(),
  )
  .output(ExternalSiteRunSchema)
  .handler(async ({ input, context, errors }) => {
    const [row] = await db
      .select({ site: externalSites })
      .from(scrapeSources)
      .innerJoin(
        externalSites,
        eq(externalSites.id, scrapeSources.externalSiteId),
      )
      .where(eq(scrapeSources.id, input.id));
    if (!row) throw errors.NOT_FOUND({ message: "Source not found." });
    try {
      const run = await queueScrapeSourcePreview({
        site: row.site,
        scrapeSourceId: input.id,
        revisionId: input.revisionId,
        requestedById: context.user.id,
      });
      return serializeExternalSiteRun(run);
    } catch (error) {
      if (error instanceof ScrapeSourceValidationError) {
        throw errors.BAD_REQUEST({ message: error.message, cause: error });
      }
      if (error instanceof ExternalSiteRunActiveError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }
  });
