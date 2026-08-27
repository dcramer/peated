import { BottleRecommendationsSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/bottles/{bottle}/recommendations",
    summary: "Get bottle recommendations",
    description:
      "Recommend bottles based on preferences from the Peated community",
    spec: (spec) => ({
      ...spec,
      operationId: "listBottleRecommendations",
    }),
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
      limit: z.coerce.number().gte(1).lte(12).default(6),
    }),
  )
  .output(BottleRecommendationsSchema);
