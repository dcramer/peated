import {
  BottleSeriesListItemSchema,
  CursorSchema,
} from "@peated/server/schemas";
import { z } from "zod";

import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/bottle-series",
    summary: "List bottle series",
    description: "Find bottle series by name, brand, or distillery.",
    operationId: "listBottleSeries",
  })
  .input(
    z.object({
      query: z.coerce.string().default(""),
      brand: z.coerce.number().int().positive().optional(),
      distillery: z.coerce.number().int().positive().optional(),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
      sort: z.enum(["name", "-bottles"]).default("name"),
    }),
  )
  .output(
    z.object({
      results: z.array(BottleSeriesListItemSchema),
      total: z.number(),
      rel: CursorSchema,
    }),
  );
