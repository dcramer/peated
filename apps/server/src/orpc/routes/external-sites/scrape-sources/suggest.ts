import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { ExternalSiteRunSchema } from "@peated/server/schemas";
import { queueScrapeSourceSuggestion } from "@peated/server/scraper";
import {
  ScrapeSourceNotFoundError,
  ScrapeSourceValidationError,
} from "@peated/server/scraper/configured/service";
import { serializeExternalSiteRun } from "@peated/server/serializers/externalSite";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/scrape-sources/{id}/suggest",
    summary: "Ask AI to suggest parsing rules",
    operationId: "suggestScrapeSourceRevision",
  })
  .input(z.object({ id: z.number().int().positive() }).strict())
  .output(ExternalSiteRunSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      return serializeExternalSiteRun(
        await queueScrapeSourceSuggestion({
          scrapeSourceId: input.id,
          requestedById: context.user.id,
        }),
      );
    } catch (error) {
      if (error instanceof ScrapeSourceNotFoundError) {
        throw errors.NOT_FOUND({ message: "Source not found.", cause: error });
      }
      if (error instanceof ScrapeSourceValidationError) {
        throw errors.BAD_REQUEST({ message: error.message, cause: error });
      }
      throw error;
    }
  });
