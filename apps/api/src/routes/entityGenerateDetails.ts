import { db } from "@peated/server/db";
import { countries, regions } from "@peated/server/db/schema";
import { EntityInputSchema } from "@peated/server/schemas";
import { getGeneratedEntityDetails } from "@peated/server/worker/jobs/generateEntityDetails";
import { eq } from "drizzle-orm";
import { type z } from "zod";
import { modProcedure } from "../trpc";
import { type Context } from "../trpc/context";

const InputSchema = EntityInputSchema.partial();

export async function entityGenerateDetails({
  input,
  ctx,
}: {
  input: z.infer<typeof InputSchema>;
  ctx: Context;
}) {
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
  return result;
}

export default modProcedure.input(InputSchema).mutation(entityGenerateDetails);
