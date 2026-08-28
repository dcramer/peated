import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ConfiguredScraperSchema,
  ExternalSiteKeySchema,
} from "@peated/server/schemas";
import {
  listConfiguredScrapers,
  listConfiguredScraperVersions,
} from "@peated/server/scraper/configured/service";
import { z } from "zod";
import { serializeConfiguredScraper } from "./serialize";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/configured-scrapers",
    summary: "List database-managed sources",
    operationId: "listConfiguredScrapers",
  })
  .input(z.object({ site: ExternalSiteKeySchema.optional() }).strict())
  .output(z.array(ConfiguredScraperSchema))
  .handler(async ({ input }) => {
    const rows = await listConfiguredScrapers(input.site);
    return await Promise.all(
      rows.map(async ({ scraper, site }) =>
        serializeConfiguredScraper(
          scraper,
          site,
          await listConfiguredScraperVersions(scraper.id),
        ),
      ),
    );
  });
