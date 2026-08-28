import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ScrapeRulesSchema,
  ScrapeSourceRevisionSchema,
  ScrapeSourceUrlSchema,
} from "@peated/server/schemas";
import { createScrapeSourceRevision } from "@peated/server/scraper/configured/service";
import { serialize } from "@peated/server/serializers";
import { ScrapeSourceRevisionSerializer } from "@peated/server/serializers/scrapeSource";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/scrape-sources/{id}/revisions",
    summary: "Save a parsing-rule revision",
    operationId: "createScrapeSourceRevision",
  })
  .input(
    z
      .object({
        id: z.number().int().positive(),
        listUrl: ScrapeSourceUrlSchema,
        rules: ScrapeRulesSchema,
      })
      .strict(),
  )
  .output(ScrapeSourceRevisionSchema)
  .handler(async ({ input, context }) =>
    serialize(
      ScrapeSourceRevisionSerializer,
      await createScrapeSourceRevision({
        scrapeSourceId: input.id,
        listUrl: input.listUrl,
        rules: input.rules,
        author: "person",
        createdById: context.user.id,
      }),
      context.user,
    ),
  );
