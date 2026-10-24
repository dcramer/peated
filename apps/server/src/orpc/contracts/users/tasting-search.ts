import { BottleSchema, EntitySchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export const TastingSearchSchema = z.object({
  entities: z
    .array(
      z.object({
        entity: EntitySchema,
        count: z
          .number()
          .describe(
            "Tasted Bottles that list this Entity as the brand, a distiller, or the bottler",
          ),
      }),
    )
    .describe(
      "Entities of tasted Bottles, best name match first, then by `count`",
    ),
  bottles: z
    .array(BottleSchema)
    .describe("Bottles the user has tasted, best name match first"),
});

export default contract
  .route({
    method: "GET",
    path: "/users/{user}/tastings/search",
    summary: "Search a user's tastings",
    description:
      "Find Entities and Bottles from a user's tastings while the user types. Matches whole words and the start of words.",
    operationId: "searchUserTastings",
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
      query: z.coerce
        .string()
        .trim()
        .default("")
        .describe(
          "Search text only. Search operators are not supported. Empty text returns no results.",
        ),
      limit: z.coerce
        .number()
        .gte(1)
        .lte(10)
        .default(5)
        .describe("Maximum results to return in each list"),
    }),
  )
  .output(TastingSearchSchema);
