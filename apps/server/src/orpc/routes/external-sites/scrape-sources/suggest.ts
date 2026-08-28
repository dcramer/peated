import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { ExternalSiteRunSchema } from "@peated/server/schemas";
import { queueScrapeSourceSuggestion } from "@peated/server/scraper";
import { serializeExternalSiteRun } from "@peated/server/serializers/externalSite";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/scrape-sources/{id}/suggest",
    summary: "Ask AI to suggest parsing rules",
    operationId: "suggestScrapeSourceDraft",
  })
  .input(z.object({ id: z.number().int().positive() }).strict())
  .output(ExternalSiteRunSchema)
  .handler(async ({ input, context }) =>
    serializeExternalSiteRun(
      await queueScrapeSourceSuggestion({
        scrapeSourceId: input.id,
        requestedById: context.user.id,
      }),
    ),
  );
