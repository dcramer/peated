import { listResponse, NotificationSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/notifications",
    summary: "List notifications",
    description: "List the signed-in user's notifications",
    operationId: "listNotifications",
  })
  .input(
    z
      .object({
        filter: z.enum(["unread", "all"]).optional(),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(100),
      })
      .default({ cursor: 1, limit: 100 }),
  )
  .output(listResponse(NotificationSchema));
