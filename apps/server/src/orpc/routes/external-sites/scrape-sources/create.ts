import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ScrapeSourceCreateSchema,
  ScrapeSourceSchema,
} from "@peated/server/schemas";
import {
  ScrapeSourceConflictError,
  ScrapeSourceValidationError,
  createSiteWithScrapeSource,
} from "@peated/server/scraper/configured/service";
import { serializeScrapeSource } from "./serialize";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/scrape-sources",
    summary: "Create a database-managed source",
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
      return serializeScrapeSource(source, site, []);
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
