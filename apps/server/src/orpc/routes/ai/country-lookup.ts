import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { CountryInputSchema } from "@peated/server/schemas";
import { getGeneratedCountryDetails } from "@peated/server/worker/jobs/generateCountryDetails";
import { z } from "zod";

const InputSchema = CountryInputSchema.partial();

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/ai/country-lookup",
    summary: "AI country lookup",
    spec: {
      operationId: "lookupCountryWithAI",
    },
    description:
      "Use AI to generate country details and information. Requires moderator privileges",
  })
  .input(InputSchema)
  .output(z.any())
  .handler(async function ({ input, context }) {
    const result = await getGeneratedCountryDetails(input);
    return result;
  });
