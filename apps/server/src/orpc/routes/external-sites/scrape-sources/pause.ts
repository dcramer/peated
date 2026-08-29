import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ScrapeSourceNotFoundError,
  pauseScrapeSource,
} from "@peated/server/scraper/configured/service";
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
  .handler(async ({ input, errors }) => {
    try {
      await pauseScrapeSource(input.id);
      return { enabled: false as const };
    } catch (error) {
      if (error instanceof ScrapeSourceNotFoundError) {
        throw errors.NOT_FOUND({ message: "Source not found.", cause: error });
      }
      throw error;
    }
  });
