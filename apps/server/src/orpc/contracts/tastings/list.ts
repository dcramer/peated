import { listResponse, TastingSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/tastings",
    summary: "List tastings",
    description: "Find tastings by bottle, entity, user, or feed",
    operationId: "listTastings",
  })
  .input(
    z
      .object({
        bottle: z.coerce.number().int().positive().optional(),
        entity: z.coerce.number().optional(),
        user: z
          .union([z.coerce.number(), z.literal("me"), z.string()])
          .optional(),
        filter: z.enum(["global", "friends", "local"]).default("global"),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(25),
      })
      .strict()
      .default({
        filter: "global",
        cursor: 1,
        limit: 25,
      }),
  )
  // TODO(response-envelope): Return { data, meta } when all list routes use the
  // same wrapper.
  .output(listResponse(TastingSchema));
