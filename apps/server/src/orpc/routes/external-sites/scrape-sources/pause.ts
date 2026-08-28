import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { pauseScrapeSource } from "@peated/server/scraper/configured/service";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/scrape-sources/{id}/pause",
    summary: "Pause a scrape source",
    operationId: "pauseScrapeSource",
  })
  .input(z.object({ id: z.number().int().positive() }).strict())
  .output(z.object({ enabled: z.literal(false) }))
  .handler(async ({ input }) => {
    await pauseScrapeSource(input.id);
    return { enabled: false as const };
  });
