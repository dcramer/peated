import {
  BOTTLE_AGE_BAND_LIST,
  BOTTLE_LIST_SORT_OPTIONS,
  CATEGORY_LIST,
  DISTILLERY_BOTTLE_VIEW_LIST,
  FLAVOR_PROFILES,
} from "@peated/server/constants";
import { BottleSchema, listResponse } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

const DEFAULT_SORT = "-tastings";

const OutputSchema = listResponse(BottleSchema).extend({
  total: z.number().int().nonnegative(),
  followedEntityCount: z.number().int().nonnegative().nullable(),
});

export default contract
  .route({
    method: "GET",
    path: "/bottles",
    summary: "List bottles",
    description:
      "Find bottles, including releases from distillers, brands, and bottlers the signed-in user follows",
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
        .describe("Search text only. Search operators are not supported."),
      brand: z.coerce.number().nullish(),
      distiller: z.coerce.number().nullish(),
      bottler: z.coerce.number().nullish(),
      entity: z.coerce.number().nullish(),
      distilleryView: z
        .enum(DISTILLERY_BOTTLE_VIEW_LIST)
        .nullish()
        .describe(
          "Filter a distillery to its own releases or releases from other brands and bottlers.",
        ),
      series: z.coerce.number().nullish(),
      library: z
        .enum(["in", "out"])
        .nullish()
        .describe("Filter by the signed-in user's Library."),
      tag: z.string().nullish(),
      flavorProfile: z.enum(FLAVOR_PROFILES).nullish(),
      flight: z.string().nullish(),
      category: z.enum(CATEGORY_LIST).nullish(),
      age: z.coerce.number().nullish(),
      ageBand: z.enum(BOTTLE_AGE_BAND_LIST).nullish(),
      minScore: z.coerce.number().int().min(0).max(100).nullish(),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
      filter: z.enum(["all", "following"]).default("all"),
      sort: z.enum(BOTTLE_LIST_SORT_OPTIONS).default(DEFAULT_SORT),
    }),
  )
  // TODO(response-envelope): Return { data, meta } when all list routes use the
  // same wrapper.
  .output(OutputSchema);
