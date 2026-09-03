import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ScrapeSourceNotFoundError,
  ScrapeSourceValidationError,
  activateScrapeSourceRevision,
} from "@peated/server/scraper/configured/service";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/scrape-sources/{id}/revisions/{revisionId}/activate",
    summary: "Activate a parsing-rule revision",
    description:
      "Make a revision the source's active parsing rules. The revision must have passed preview checks. Requires administrator privileges.",
    operationId: "activateScrapeSourceRevision",
  })
  .input(
    z
      .object({
        id: z.number().int().positive(),
        revisionId: z.number().int().positive(),
      })
      .strict(),
  )
  .output(z.object({ activeRevisionId: z.number().int().positive() }))
  .handler(async ({ input, errors }) => {
    try {
      const result = await activateScrapeSourceRevision({
        scrapeSourceId: input.id,
        revisionId: input.revisionId,
      });
      return { activeRevisionId: result.revision.id };
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
