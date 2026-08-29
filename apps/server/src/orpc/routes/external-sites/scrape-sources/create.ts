import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ScrapeSourceCreateSchema,
  ScrapeSourceSchema,
} from "@peated/server/schemas";
import { queueScrapeSourceSuggestion } from "@peated/server/scraper";
import {
  ScrapeSourceConflictError,
  ScrapeSourceValidationError,
  createSiteWithScrapeSource,
} from "@peated/server/scraper/configured/service";
import { serialize } from "@peated/server/serializers";
import { ScrapeSourceSerializer } from "@peated/server/serializers/scrapeSource";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/scrape-sources",
    summary: "Create a scrape source",
    operationId: "createScrapeSource",
  })
  .input(ScrapeSourceCreateSchema)
  .output(ScrapeSourceSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      const { source, site } = await createSiteWithScrapeSource({
        ...input,
        createdById: context.user.id,
      });
      await queueScrapeSourceSuggestion({
        scrapeSourceId: source.id,
        requestedById: context.user.id,
      });
      return await serialize(
        ScrapeSourceSerializer,
        { source, site, revisions: [] },
        context.user,
      );
    } catch (error) {
      if (error instanceof ScrapeSourceConflictError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      if (error instanceof ScrapeSourceValidationError) {
        throw errors.BAD_REQUEST({ message: error.message, cause: error });
      }
      throw error;
    }
  });
