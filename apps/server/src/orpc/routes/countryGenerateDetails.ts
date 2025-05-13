import { CountryInputSchema } from "@peated/server/schemas";
import { getGeneratedCountryDetails } from "@peated/server/worker/jobs/generateCountryDetails";
import { z } from "zod";
import { procedure } from "..";
import { requireMod } from "../middleware";

const InputSchema = CountryInputSchema.partial();

export default procedure
  .use(requireMod)
  .route({ method: "POST", path: "/countries/generate-details" })
  .input(InputSchema)
  .output(z.any())
  .handler(async function ({ input, context }) {
    const result = await getGeneratedCountryDetails(input);
    return result;
  });
