import { FlightSchema, listResponse } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

const DEFAULT_SORT = "name";
const SORT_OPTIONS = ["name", "-name"] as const;

export default contract
  .route({
    method: "GET",
    path: "/flights",
    summary: "List flights",
    description: "Find tasting flights by name and visibility",
    operationId: "listFlights",
  })
  .input(
    z
      .object({
        query: z.string().default(""),
        filter: z.enum(["public", "private", "none"]).optional(),
        sort: z.enum(SORT_OPTIONS).default(DEFAULT_SORT),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(100),
      })
      .default({
        query: "",
        sort: DEFAULT_SORT,
        cursor: 1,
        limit: 100,
      }),
  )
  .output(listResponse(FlightSchema));
