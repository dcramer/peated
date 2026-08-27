import { CountrySchema, listResponse } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

const DEFAULT_SORT = "name";
const SORT_OPTIONS = ["name", "bottles", "-name", "-bottles"] as const;

export default contract
  .route({
    method: "GET",
    path: "/countries",
    summary: "List countries",
    description: "Find countries by name or bottle availability",
    operationId: "listCountries",
  })
  .input(
    z
      .object({
        query: z.string().default(""),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(100),
        sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
        onlyMajor: z.coerce.boolean().default(false),
        hasBottles: z.coerce.boolean().default(false),
      })
      .default({
        query: "",
        cursor: 1,
        limit: 100,
        sort: DEFAULT_SORT,
        onlyMajor: false,
        hasBottles: false,
      }),
  )
  // TODO(response-envelope): Return { data, meta } when all list routes use the
  // same wrapper.
  .output(listResponse(CountrySchema));
