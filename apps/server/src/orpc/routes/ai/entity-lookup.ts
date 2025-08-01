import { db } from "@peated/server/db";
import { countries, regions } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { EntityInputSchema } from "@peated/server/schemas";
import { getGeneratedEntityDetails } from "@peated/server/worker/jobs/generateEntityDetails";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = EntityInputSchema.partial();

const OutputSchema = z.object({
  description: z.string().nullish(),
  yearEstablished: z.number().nullish(),
  type: z.array(z.string().nullish()).nullish(),
  website: z.string().nullish(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/ai/entity-lookup",
    summary: "AI entity lookup",
    spec: {
      operationId: "lookupEntityWithAI",
    },
    description:
      "Use AI to generate entity details including description, establishment year, type, and website. Requires moderator privileges",
  })
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async function ({ input }) {
    const country = input.country
      ? await db.query.countries.findFirst({
          where: eq(countries.id, input.country),
        })
      : null;
    const region = input.region
      ? await db.query.regions.findFirst({
          where: eq(regions.id, input.region),
        })
      : null;

    const result = await getGeneratedEntityDetails({
      ...input,
      country: country || null,
      region: region || null,
    });

    return {
      description: result?.description,
      yearEstablished: result?.yearEstablished,
      type: result?.type || null,
      website: result?.website,
    };
  });
