import { getGeneratedEntityDetails } from "@peated/server/jobs/generateEntityDetails";
import { EntityInputSchema } from "@peated/server/schemas";
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
  const result = await getGeneratedEntityDetails(input);
  return result;
}

export default modProcedure.input(InputSchema).mutation(entityGenerateDetails);
