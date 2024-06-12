import { getGeneratedBottleDetails } from "@peated/server/jobs/generateBottleDetails";
import { BottleInputSchema } from "@peated/server/schemas";
import { type z } from "zod";
import { modProcedure } from "..";
import { type Context } from "../context";

const InputSchema = BottleInputSchema.partial();

export async function bottleGenerateDetails({
  input,
  ctx,
}: {
  input: z.infer<typeof InputSchema>;
  ctx: Context;
}) {
  const result = await getGeneratedBottleDetails(input, []);
  return result;
}

export default modProcedure.input(InputSchema).mutation(bottleGenerateDetails);
