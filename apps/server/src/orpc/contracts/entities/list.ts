import { ENTITY_TYPE_LIST } from "@peated/server/constants";
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

const InputSchema = z
  .object({
    query: z
      .string()
      .default("")
      .describe("Plain-text search; operator syntax is not supported."),
    name: z.string().nullish(),
    country: z.coerce.string().nullish().describe("Country slug or id"),
    region: z.coerce.string().nullish().describe("Region slug or id"),
    type: z.enum(ENTITY_TYPE_LIST).nullish(),
    bottler: z.number().nullish(),
    searchContext: z
      .object({
        type: z.enum(ENTITY_TYPE_LIST).nullish(),
        brand: z.number().nullish(),
        bottleName: z.string().nullish(),
      })
      .nullish(),
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

export default contract
  .route({
    method: "GET",
    path: "/entities",
    summary: "List entities",
    description:
      "Search and filter entities (brands, distilleries, bottlers) with advanced filtering by location, type, and search context",
    operationId: "listEntities",
  })
  .input(InputSchema)
  .output(listResponse(EntitySchema));
