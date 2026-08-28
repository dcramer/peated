import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ConfiguredScraperCreateSchema,
  ConfiguredScraperSchema,
} from "@peated/server/schemas";
import {
  ConfiguredScraperConflictError,
  ConfiguredScraperValidationError,
  createConfiguredScraperSite,
} from "@peated/server/scraper/configured/service";
import { serializeConfiguredScraper } from "./serialize";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/configured-scrapers",
    summary: "Create a database-managed source",
    operationId: "createConfiguredScraper",
  })
  .input(ConfiguredScraperCreateSchema)
  .output(ConfiguredScraperSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      const { scraper, site } = await createConfiguredScraperSite({
        ...input,
        createdById: context.user.id,
      });
      return serializeConfiguredScraper(scraper, site, []);
    } catch (error) {
      if (error instanceof ConfiguredScraperConflictError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      if (error instanceof ConfiguredScraperValidationError) {
        throw errors.BAD_REQUEST({ message: error.message, cause: error });
      }
      throw error;
    }
  });
