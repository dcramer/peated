import { db } from "@peated/server/db";
import { RegionInputSchema } from "@peated/server/schemas";
import { getGeneratedRegionDetails } from "@peated/server/worker/jobs/generateRegionDetails";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { modProcedure } from "..";
import { type Context } from "../context";

const InputSchema = RegionInputSchema.partial().extend({
  country: z.number(),
});

export async function regionGenerateDetails({
  input,
  ctx,
}: {
  input: z.infer<typeof InputSchema>;
  ctx: Context;
}) {
  const country = input.country
    ? await db.query.countries.findFirst({
        where: (table, { eq }) => eq(table.id, input.country),
      })
    : null;

  if (!country) {
    throw new TRPCError({
      message: "Cannot find country",
      code: "BAD_REQUEST",
    });
  }

  const result = await getGeneratedRegionDetails({
    ...input,
    country,
  });
  return result;
}

export default modProcedure.input(InputSchema).mutation(regionGenerateDetails);
