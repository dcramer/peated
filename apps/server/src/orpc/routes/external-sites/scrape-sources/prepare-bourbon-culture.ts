import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { prepareBourbonCultureSource } from "@peated/server/scraper/configured/prepareBourbonCulture";
import {
  ScrapeSourceConflictError,
  ScrapeSourceNotFoundError,
  ScrapeSourceValidationError,
} from "@peated/server/scraper/configured/service";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/scrape-sources/prepare-bourbon-culture",
    summary: "Prepare Bourbon Culture for saved scraping rules",
    description:
      "Check existing reviews without saving. Set apply to true to save the changes and leave collection paused. Requires an administrator and a stopped schedule with no active runs.",
    spec: (spec) => ({
      ...spec,
      operationId: "prepareBourbonCultureScrapeSource",
    }),
  })
  .input(
    z
      .object({
        apply: z
          .boolean()
          .default(false)
          .describe("Save the checked changes and create a paused source."),
      })
      .strict(),
  )
  .output(
    z
      .object({
        siteId: z.number().int().positive(),
        scrapeSourceId: z
          .number()
          .int()
          .positive()
          .nullable()
          .describe(
            "The prepared source ID, or null when checking without saving.",
          ),
        reviewCount: z.number().int().nonnegative(),
        applied: z.boolean(),
      })
      .strict(),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      return await prepareBourbonCultureSource({
        ...input,
        createdById: context.user.id,
      });
    } catch (error) {
      if (error instanceof ScrapeSourceNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      if (error instanceof ScrapeSourceConflictError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      if (error instanceof ScrapeSourceValidationError) {
        throw errors.BAD_REQUEST({ message: error.message, cause: error });
      }
      throw error;
    }
  });
