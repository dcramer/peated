import { AgeStatsSchema, CategoryEnum } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export const LibraryStatsSchema = z.object({
  total: z.number(),
  status: z.object({
    open: z.number(),
    sealed: z.number(),
    unspecified: z.number(),
  }),
  brands: z.array(
    z.object({ id: z.number(), name: z.string(), count: z.number() }),
  ),
  distillers: z.array(
    z.object({ id: z.number(), name: z.string(), count: z.number() }),
  ),
  age: AgeStatsSchema,
  categories: z.array(z.object({ category: CategoryEnum, count: z.number() })),
});

export default contract
  .route({
    method: "GET",
    path: "/users/{user}/library/stats",
    summary: "Get user Library statistics",
    description: "Get producer, status, age, and category totals for a Library",
    operationId: "getUserLibraryStats",
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
    }),
  )
  .output(LibraryStatsSchema);
