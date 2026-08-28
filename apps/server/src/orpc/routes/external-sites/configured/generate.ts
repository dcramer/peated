import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { ExternalSiteRunSchema } from "@peated/server/schemas";
import { queueConfiguredScraperGeneration } from "@peated/server/scraper";
import { serializeExternalSiteRun } from "@peated/server/serializers/externalSite";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/configured-scrapers/{id}/generate",
    summary: "Ask AI to suggest parsing rules",
    operationId: "generateConfiguredScraperDraft",
  })
  .input(z.object({ id: z.number().int().positive() }).strict())
  .output(ExternalSiteRunSchema)
  .handler(async ({ input, context }) =>
    serializeExternalSiteRun(
      await queueConfiguredScraperGeneration({
        configuredScraperId: input.id,
        requestedById: context.user.id,
      }),
    ),
  );
