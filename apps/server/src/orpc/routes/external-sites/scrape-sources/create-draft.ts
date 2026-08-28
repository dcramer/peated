import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ScrapeRulesSchema,
  ScrapeSourceRevisionSchema,
} from "@peated/server/schemas";
import { createScrapeSourceDraft } from "@peated/server/scraper/configured/service";
import { z } from "zod";
import { serializeScrapeSourceRevision } from "./serialize";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/scrape-sources/{id}/revisions",
    summary: "Save a parsing-rule revision",
    operationId: "createScrapeSourceDraft",
  })
  .input(
    z
      .object({
        id: z.number().int().positive(),
        listUrl: z.url(),
        rules: ScrapeRulesSchema,
      })
      .strict(),
  )
  .output(ScrapeSourceRevisionSchema)
  .handler(async ({ input, context }) =>
    serializeScrapeSourceRevision(
      await createScrapeSourceDraft({
        scrapeSourceId: input.id,
        listUrl: input.listUrl,
        rules: input.rules,
        createdWith: "person",
        createdById: context.user.id,
      }),
    ),
  );
