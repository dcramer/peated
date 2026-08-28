import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ConfiguredScraperConfigSchema,
  ConfiguredScraperVersionSchema,
} from "@peated/server/schemas";
import { createConfiguredScraperDraft } from "@peated/server/scraper/configured/service";
import { z } from "zod";
import { serializeConfiguredVersion } from "./serialize";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/configured-scrapers/{id}/versions",
    summary: "Save a parsing-rule version",
    operationId: "createConfiguredScraperDraft",
  })
  .input(
    z
      .object({
        id: z.number().int().positive(),
        config: ConfiguredScraperConfigSchema,
      })
      .strict(),
  )
  .output(ConfiguredScraperVersionSchema)
  .handler(async ({ input, context }) =>
    serializeConfiguredVersion(
      await createConfiguredScraperDraft({
        configuredScraperId: input.id,
        config: input.config,
        createdWith: "person",
        createdById: context.user.id,
      }),
    ),
  );
