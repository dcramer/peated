import { RegionSchema, listResponse } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

const DEFAULT_SORT = "name";
const SORT_OPTIONS = ["name", "bottles", "-name", "-bottles"] as const;

export default contract
  .route({
    method: "GET",
    path: "/countries/{country}/regions",
    summary: "List regions",
    description: "Find regions in a country by name or bottle availability",
    operationId: "listRegions",
  })
  .input(
    z.object({
      country: z.string(),
      query: z.string().default(""),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(100),
      sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
      hasBottles: z.coerce.boolean().default(false),
    }),
  )
  .output(listResponse(RegionSchema));
