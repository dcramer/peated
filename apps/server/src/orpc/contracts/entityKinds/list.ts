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

export const EntityKindListInputSchema = z
  .object({
    query: z
      .string()
      .default("")
      .describe("Search text only. Search operators are not supported."),
    name: z.string().nullish(),
    owner: z.coerce.number().int().positive().nullish(),
    country: z.coerce.string().nullish().describe("Country slug or id"),
    region: z.coerce.string().nullish().describe("Region slug or id"),
    sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
    cursor: z.coerce.number().gte(1).default(1),
    limit: z.coerce.number().lte(500).default(100),
  })
  .default({
    query: "",
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
    .output(listResponse(EntitySchema));
}
