import { listResponse, PriceChangeSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/price-changes",
    summary: "List price changes",
    description: "List Bottle price changes from the past week",
    operationId: "listPriceChanges",
  })
  .input(
    z
      .object({
        query: z.string().default(""),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(100),
      })
      .default({ query: "", cursor: 1, limit: 100 }),
  )
  .output(listResponse(PriceChangeSchema));
