import { EntitySchema, listResponse } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

const DEFAULT_SORT = "rank";

const SORT_OPTIONS = [
  "rank",
  "name",
  "created",
  "tastings",
  "bottles",
  "-name",
  "-created",
  "-tastings",
  "-bottles",
] as const;

export const EntityKindListOutputSchema = listResponse(EntitySchema).extend({
  total: z.number().int().nonnegative(),
});

export const EntityKindListInputSchema = z
  .object({
    query: z
      .string()
      .default("")
      .describe("Search text only. Search operators are not supported."),
    name: z
      .string()
      .nullish()
      .describe("Match an Entity name or alias case-insensitively"),
    owner: z.coerce
      .number()
      .int()
      .positive()
      .nullish()
      .describe("Filter by the current owner Entity ID"),
    country: z.coerce
      .string()
      .nullish()
      .describe("Filter by country slug or numeric ID"),
    region: z.coerce
      .string()
      .nullish()
      .describe(
        "Filter by region slug or numeric ID. A slug requires `country`.",
      ),
    filter: z.enum(["all", "following"]).default("all"),
    sort: z
      .enum(SORT_OPTIONS)
      .default(DEFAULT_SORT)
      .describe(
        "`rank` orders by search relevance, or tasting count when `query` is empty. Prefix another value with `-` for descending order.",
      ),
    cursor: z.coerce
      .number()
      .gte(1)
      .default(1)
      .describe("Page number to return"),
    limit: z.coerce
      .number()
      .lte(500)
      .default(100)
      .describe("Maximum number of Entities to return per page"),
  })
  .default({
    query: "",
    filter: "all",
    sort: DEFAULT_SORT,
    cursor: 1,
    limit: 100,
  });

export function createEntityKindListContract({
  description,
  operationId,
  path,
  summary,
}: {
  description: string;
  operationId: string;
  path: `/${string}`;
  summary: string;
}) {
  return contract
    .route({
      method: "GET",
      path,
      summary,
      description,
      operationId,
    })
    .input(EntityKindListInputSchema)
    .output(EntityKindListOutputSchema);
}
