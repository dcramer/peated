import { CountryInputSchema } from "@peated/server/schemas";
import { getGeneratedCountryDetails } from "@peated/server/worker/jobs/generateCountryDetails";
import { type z } from "zod";
import { modProcedure } from "../trpc";
import { type Context } from "../trpc/context";

const InputSchema = CountryInputSchema.partial();

export async function countryGenerateDetails({
  input,
  ctx,
}: {
  input: z.infer<typeof InputSchema>;
  ctx: Context;
}) {
  const result = await getGeneratedCountryDetails(input);
  return result;
}

export default modProcedure.input(InputSchema).mutation(countryGenerateDetails);
