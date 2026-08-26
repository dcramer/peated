import { CATEGORY_LIST, FLAVOR_PROFILES } from "@peated/server/constants";
import { BottleSchema, listResponse } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

const DEFAULT_SORT = "-tastings";

const SORT_OPTIONS = [
  "rank",
  "brand",
  "created",
  "name",
  "age",
  "rating",
  "score",
  "tastings",
  "-created",
  "-name",
  "-age",
  "-rating",
  "-release",
  "-score",
  "-tastings",
] as const;

const OutputSchema = listResponse(BottleSchema).extend({
  followedDistillerCount: z.number().int().nonnegative().nullable(),
});

export default contract
  .route({
    method: "GET",
    path: "/bottles",
    summary: "List bottles",
    description:
      "Search and filter bottles, including releases from distillers the current user follows",
    spec: (spec) => ({
      ...spec,
      operationId: "listBottles",
    }),
  })
  .input(
    z.object({
      query: z.coerce
        .string()
        .default("")
        .describe("Plain-text search; operator syntax is not supported."),
      brand: z.coerce.number().nullish(),
      distiller: z.coerce.number().nullish(),
      bottler: z.coerce.number().nullish(),
      entity: z.coerce.number().nullish(),
      series: z.coerce.number().nullish(),
      tag: z.string().nullish(),
      flavorProfile: z.enum(FLAVOR_PROFILES).nullish(),
      flight: z.string().nullish(),
      category: z.enum(CATEGORY_LIST).nullish(),
      age: z.coerce.number().nullish(),
      minRating: z.coerce.number().min(-1).max(2).nullish(),
      minScore: z.coerce.number().int().min(0).max(100).nullish(),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
      filter: z.enum(["all", "following"]).default("all"),
      sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
    }),
  )
  // TODO(response-envelope): switch to { data, meta } by changing
  // listResponse() implementation once we migrate envelopes globally.
  .output(OutputSchema);
