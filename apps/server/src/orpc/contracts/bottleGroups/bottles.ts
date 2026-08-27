import { BOTTLE_GROUP_BOTTLE_SORT_OPTIONS } from "@peated/server/lib/bottleGroupSort";
import { BottleSchema, listResponse } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/bottle-groups/{group}/bottles",
    summary: "List related Bottles",
    description: "List the Bottles in a Bottle Group",
    operationId: "listBottleGroupBottles",
  })
  .input(
    z
      .object({
        group: z.coerce.number().int().positive(),
        query: z.coerce.string().default(""),
        cursor: z.coerce.number().int().gte(1).default(1),
        limit: z.coerce.number().int().gte(1).lte(100).default(25),
        sort: z.enum(BOTTLE_GROUP_BOTTLE_SORT_OPTIONS).default("-tastings"),
      })
      .strict(),
  )
  .output(listResponse(BottleSchema));
