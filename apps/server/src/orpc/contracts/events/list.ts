import { EventSchema, listResponse } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

const DEFAULT_SORT = "date";

export default contract
  .route({
    method: "GET",
    path: "/events",
    summary: "List events",
    description: "List whisky events",
    operationId: "listEvents",
  })
  .input(
    z
      .object({
        query: z.string().default(""),
        sort: z.enum(["name", "date", "-date", "-name"]).default(DEFAULT_SORT),
        cursor: z.coerce.number().gte(1).default(1),
        onlyUpcoming: z.coerce.boolean().default(true),
        limit: z.coerce.number().gte(1).lte(100).default(100),
      })
      .default({
        query: "",
        sort: DEFAULT_SORT,
        onlyUpcoming: true,
        cursor: 1,
        limit: 100,
      }),
  )
  .output(listResponse(EventSchema));
