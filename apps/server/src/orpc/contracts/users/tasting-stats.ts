import { AgeStatsSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/users/{user}/tasting-stats",
    summary: "Get user tasting statistics",
    description: "Get rating, bottle, and age totals for a user's tastings",
    operationId: "getUserTastingStats",
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
    }),
  )
  .output(
    z.object({
      total: z.number(),
      uniqueBottles: z.number(),
      ratings: z.object({
        total: z.number(),
        pass: z.number(),
        sip: z.number(),
        savor: z.number(),
      }),
      mostTastedBottle: z
        .object({
          id: z.number(),
          name: z.string(),
          count: z.number(),
        })
        .nullable(),
      age: AgeStatsSchema,
    }),
  );
