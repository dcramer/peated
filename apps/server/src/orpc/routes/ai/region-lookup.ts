import { db } from "@peated/server/db";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { RegionInputSchema } from "@peated/server/schemas";
import { getGeneratedRegionDetails } from "@peated/server/worker/jobs/generateRegionDetails";
import { z } from "zod";

const InputSchema = RegionInputSchema.partial().extend({
  country: z.number(),
});

const OutputSchema = z.object({
  description: z.string().nullish(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/ai/region-lookup",
    summary: "AI region lookup",
    spec: {},
    description:
      "Use AI to generate region details and descriptions for a specific country. Requires moderator privileges",
  })
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async function ({ input, context, errors }) {
    const country = input.country
      ? await db.query.countries.findFirst({
          where: (table, { eq }) => eq(table.id, input.country),
        })
      : null;

    if (!country) {
      throw errors.BAD_REQUEST({
        message: "Cannot find country",
      });
    }

    const result = await getGeneratedRegionDetails({
      ...input,
      country,
    });

    return {
      description: result?.description,
    };
  });
