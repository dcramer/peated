import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ScrapeRulesSchema,
  ScrapeSourceRevisionSchema,
  ScrapeSourceUrlSchema,
} from "@peated/server/schemas";
import {
  ScrapeSourceNotFoundError,
  ScrapeSourceValidationError,
  createScrapeSourceRevision,
} from "@peated/server/scraper/configured/service";
import { serialize } from "@peated/server/serializers";
import { ScrapeSourceRevisionSerializer } from "@peated/server/serializers/scrapeSource";
import { z } from "zod";

// The OpenAPI boundary owns number coercion, but its experimental coercion
// cannot safely inspect unions of strict object shapes. Keep scraper rules
// intact here; the inner schema still performs their full validation.
const ScrapeRulesInputSchema = z.preprocess(
  (value) => value,
  ScrapeRulesSchema,
);

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/scrape-sources/{id}/revisions",
    summary: "Save a parsing-rule revision",
    description:
      "Save a new version of the rules used to extract prices or reviews from a source. The revision must be previewed before activation. Requires administrator privileges.",
    operationId: "createScrapeSourceRevision",
  })
  .input(
    z
      .object({
        id: z.number().int().positive(),
        listUrl: ScrapeSourceUrlSchema,
        rules: ScrapeRulesInputSchema,
      })
      .strict(),
  )
  .output(ScrapeSourceRevisionSchema)
  .handler(async ({ input, context, errors }) => {
    try {
      return await serialize(
        ScrapeSourceRevisionSerializer,
        await createScrapeSourceRevision({
          scrapeSourceId: input.id,
          listUrl: input.listUrl,
          rules: input.rules,
          author: "person",
          createdById: context.user.id,
        }),
        context.user,
      );
    } catch (error) {
      if (error instanceof ScrapeSourceNotFoundError) {
        throw errors.NOT_FOUND({ message: "Source not found.", cause: error });
      }
      if (error instanceof ScrapeSourceValidationError) {
        throw errors.BAD_REQUEST({ message: error.message, cause: error });
      }
      throw error;
    }
  });
