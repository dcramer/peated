import { BottleInputSchema } from "@peated/server/schemas";
import { getGeneratedBottleDetails } from "@peated/server/worker/jobs/generateBottleDetails";
import { type z } from "zod";
import { modProcedure } from "../trpc";
import { type Context } from "../trpc/context";

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
