import { db } from "@peated/server/db";
import { countries, regions } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { EntityInputObjectSchema } from "@peated/server/schemas";
import { getGeneratedEntityDetails } from "@peated/server/worker/jobs/generateEntityDetails";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = EntityInputObjectSchema.partial();

const OutputSchema = z.object({
  pronunciation: z.string().nullish(),
  pronunciationIpa: z.string().nullish(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/ai/entity-lookup",
    summary: "AI entity lookup",
    description:
      "Use AI to suggest how an Entity's name is pronounced, in plain English respelling and IPA. Descriptions and founding years come from the sourced About page instead. Requires moderator privileges",
    operationId: "aiEntityLookup",
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
      pronunciation: result?.pronunciation,
      pronunciationIpa: result?.pronunciationIpa,
    };
  });
