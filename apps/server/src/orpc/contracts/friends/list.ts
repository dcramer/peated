import { FriendSchema, listResponse } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/friends",
    summary: "List friends",
    description: "List the signed-in user's friends",
    operationId: "listFriends",
  })
  .input(
    z
      .object({
        query: z.string().default(""),
        filter: z.enum(["pending", "active"]).optional(),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(100),
      })
      .default({ query: "", cursor: 1, limit: 100 }),
  )
  .output(listResponse(FriendSchema));
