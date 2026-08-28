import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ExternalSiteKeySchema,
  ScrapeSourceSchema,
} from "@peated/server/schemas";
import {
  listScrapeSourceRevisions,
  listScrapeSources,
} from "@peated/server/scraper/configured/service";
import { z } from "zod";
import { serializeScrapeSource } from "./serialize";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/scrape-sources",
    summary: "List database-managed sources",
    operationId: "listScrapeSources",
  })
  .input(z.object({ site: ExternalSiteKeySchema.optional() }).strict())
  .output(z.array(ScrapeSourceSchema))
  .handler(async ({ input }) => {
    const rows = await listScrapeSources(input.site);
    return await Promise.all(
      rows.map(async ({ source, site }) =>
        serializeScrapeSource(
          source,
          site,
          await listScrapeSourceRevisions(source.id),
        ),
      ),
    );
  });
