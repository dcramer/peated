import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/users/{user}/flavors",
    summary: "List user flavor profiles",
    description: "Count and score the flavor profiles a user has tasted",
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
          score: z.number(),
        }),
      ),
      totalScore: z.number(),
      totalCount: z.number(),
    }),
  );
