import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { activateConfiguredScraperVersion } from "@peated/server/scraper/configured/service";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/configured-scrapers/{id}/versions/{versionId}/activate",
    summary: "Activate a parsing-rule version",
    operationId: "activateConfiguredScraperVersion",
  })
  .input(
    z
      .object({
        id: z.number().int().positive(),
        versionId: z.number().int().positive(),
      })
      .strict(),
  )
  .output(z.object({ activeConfigVersionId: z.number().int().positive() }))
  .handler(async ({ input }) => {
    const result = await activateConfiguredScraperVersion({
      configuredScraperId: input.id,
      configVersionId: input.versionId,
    });
    return { activeConfigVersionId: result.version.id };
  });
