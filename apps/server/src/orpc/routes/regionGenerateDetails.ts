import { ORPCError } from "@orpc/server";
import { db } from "@peated/server/db";
import { RegionInputSchema } from "@peated/server/schemas";
import { getGeneratedRegionDetails } from "@peated/server/worker/jobs/generateRegionDetails";
import { z } from "zod";
import { procedure } from "..";
import type { Context } from "../context";
import { requireMod } from "../middleware";

const InputSchema = RegionInputSchema.partial().extend({
  country: z.number(),
});

export async function regionGenerateDetails({
  input,
  context,
}: {
  input: z.infer<typeof InputSchema>;
  context: Context;
}) {
  const country = input.country
    ? await db.query.countries.findFirst({
        where: (table, { eq }) => eq(table.id, input.country),
      })
    : null;

  if (!country) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Cannot find country",
    });
  }

  const result = await getGeneratedRegionDetails({
    ...input,
    country,
  });
  return result;
}

const OutputSchema = z.object({
  description: z.string().nullish(),
});

export default procedure
  .use(requireMod)
  .route({ method: "POST", path: "/regions/generate-details" })
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async function ({ input, context }) {
    const result = await regionGenerateDetails({ input, context });

    return {
      description: result?.description,
    };
  });
