import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ExternalSiteKeySchema,
  ScrapeSourceSchema,
} from "@peated/server/schemas";
import {
  getLatestScrapeSourceSetup,
  listScrapeSourceRevisions,
  listScrapeSources,
} from "@peated/server/scraper/configured/service";
import { serialize } from "@peated/server/serializers";
import { ScrapeSourceSerializer } from "@peated/server/serializers/scrapeSource";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/scrape-sources",
    summary: "List scrape sources",
    description:
      "List configured price and review sources with their parsing-rule revisions and latest setup status. Requires administrator privileges.",
    operationId: "listScrapeSources",
  })
  .input(z.object({ site: ExternalSiteKeySchema.optional() }).strict())
  .output(z.array(ScrapeSourceSchema))
  .handler(async ({ input, context }) => {
    const rows = await listScrapeSources(input.site);
    return await serialize(
      ScrapeSourceSerializer,
      await Promise.all(
        rows.map(async ({ source, site }) => ({
          source,
          site,
          revisions: await listScrapeSourceRevisions(source.id),
          setup: await getLatestScrapeSourceSetup(source.id),
        })),
      ),
      context.user,
    );
  });
