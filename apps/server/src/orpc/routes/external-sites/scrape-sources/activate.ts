import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { activateScrapeSourceRevision } from "@peated/server/scraper/configured/service";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/scrape-sources/{id}/revisions/{revisionId}/activate",
    summary: "Activate a parsing-rule revision",
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
  .handler(async ({ input }) => {
    const result = await activateScrapeSourceRevision({
      scrapeSourceId: input.id,
      revisionId: input.revisionId,
    });
    return { activeRevisionId: result.revision.id };
  });
