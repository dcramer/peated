import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/users/{user}/flavors",
    summary: "List user flavor profiles",
    description: "Count flavor profiles and top-band tastings for a user",
    operationId: "listUserFlavors",
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          flavorProfile: z.string(),
          count: z.number(),
          topBandCount: z.number(),
        }),
      ),
      totalTopBandCount: z.number(),
      totalCount: z.number(),
    }),
  );
