import { EntityInputSchema } from "@peated/server/schemas";
import { getGeneratedEntityDetails } from "@peated/server/worker/jobs/generateEntityDetails";
import { type z } from "zod";
import { modProcedure } from "..";
import { type Context } from "../context";

const InputSchema = EntityInputSchema.partial();

export async function entityGenerateDetails({
  input,
  ctx,
}: {
  input: z.infer<typeof InputSchema>;
  ctx: Context;
}) {
  const result = await getGeneratedEntityDetails({
    ...input,
    country: input.country
      ? {
          name: input.country,
        }
      : null,
  });
  return result;
}

export default modProcedure.input(InputSchema).mutation(entityGenerateDetails);
