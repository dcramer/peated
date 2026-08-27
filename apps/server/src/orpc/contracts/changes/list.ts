import { ChangeSchema, listResponse } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/changes",
    summary: "List changes",
    description: "List recent changes to Bottles and entities",
    operationId: "listChanges",
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.coerce.number()]).optional(),
      type: z.enum(["bottle", "entity"]).optional(),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(100),
    }),
  )
  .output(listResponse(ChangeSchema));
