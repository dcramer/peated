import { procedure } from "@peated/server/orpc";
import type { Context } from "@peated/server/orpc/context";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleInputSchema } from "@peated/server/schemas";
import { getGeneratedBottleDetails } from "@peated/server/worker/jobs/generateBottleDetails";
import { z } from "zod";

const InputSchema = BottleInputSchema.partial();

const OutputSchema = z.object({
  description: z.string().nullish(),
  category: z.string().nullish(),
  flavorProfile: z.string().nullish(),
  tastingNotes: z
    .object({
      nose: z.string().nullish(),
      palate: z.string().nullish(),
      finish: z.string().nullish(),
    })
    .nullish(),
  suggestedTags: z.array(z.string()).nullish(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/ai/bottle-lookup",
    summary: "AI bottle lookup",
    description:
      "Use AI to generate bottle details including description, category, flavor profile, tasting notes, and suggested tags. Requires moderator privileges",
    operationId: "aiBottleLookup",
  })
  .input(InputSchema)
  .output(OutputSchema)
  .handler(async function ({ input }) {
    const result = await getGeneratedBottleDetails(input, []);
    return {
      description: result?.description,
      category: result?.category,
      flavorProfile: result?.flavorProfile,
      tastingNotes: result?.tastingNotes,
      suggestedTags: result?.suggestedTags,
    };
  });
