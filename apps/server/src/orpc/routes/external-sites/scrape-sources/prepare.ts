import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { ExternalSiteKeySchema } from "@peated/server/schemas";
import { prepareBourbonCultureSource } from "@peated/server/scraper/configured/prepareBourbonCulture";
import { prepareWhiskyStudySource } from "@peated/server/scraper/configured/prepareWhiskyStudy";
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
    path: "/admin/scrape-sources/prepare",
    summary: "Prepare an existing scraper for saved rules",
    description:
      "Check existing reviews without saving. Set apply to true to save the changes and leave collection paused. Requires an administrator and a stopped schedule with no active runs.",
    spec: (spec) => ({
      ...spec,
      operationId: "prepareScrapeSource",
    }),
  })
  .input(
    z
      .object({
        site: ExternalSiteKeySchema.describe(
          "The existing site's key. Currently supports bourbonculture and whiskystudy.",
        ),
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
    if (!["bourbonculture", "whiskystudy"].includes(input.site)) {
      throw errors.BAD_REQUEST({
        message: "This scraper cannot move to saved rules yet.",
      });
    }
    try {
      const prepareSource =
        input.site === "bourbonculture"
          ? prepareBourbonCultureSource
          : prepareWhiskyStudySource;
      return await prepareSource({
        apply: input.apply,
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
