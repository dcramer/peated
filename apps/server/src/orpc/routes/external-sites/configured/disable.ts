import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { disableConfiguredScraper } from "@peated/server/scraper/configured/service";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/configured-scrapers/{id}/disable",
    summary: "Pause a database-managed source",
    operationId: "disableConfiguredScraper",
  })
  .input(z.object({ id: z.number().int().positive() }).strict())
  .output(z.object({ enabled: z.literal(false) }))
  .handler(async ({ input }) => {
    await disableConfiguredScraper(input.id);
    return { enabled: false as const };
  });
