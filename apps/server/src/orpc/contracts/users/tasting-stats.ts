import { AgeStatsSchema, EntitySchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

const ProducerStatSchema = EntitySchema.pick({
  id: true,
  name: true,
  kind: true,
}).extend({
  count: z.number(),
});

export default contract
  .route({
    method: "GET",
    path: "/users/{user}/tasting-stats",
    summary: "Get user tasting statistics",
    description:
      "Get rating, bottle, producer, and age totals for a user's tastings",
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
      bands: z.object({
        total: z.number(),
        mediocre: z.number(),
        good: z.number(),
        very_good: z.number(),
        outstanding: z.number(),
        unicorn: z.number(),
      }),
      producers: z.object({
        brands: z.array(ProducerStatSchema),
        bottlers: z.array(ProducerStatSchema),
        distillers: z.array(ProducerStatSchema),
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
