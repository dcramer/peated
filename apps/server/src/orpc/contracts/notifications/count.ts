import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/notifications/count",
    summary: "Count notifications",
    description: "Count all or unread notifications for the current user",
    operationId: "countNotifications",
  })
  .input(
    z
      .object({
        filter: z.enum(["unread", "all"]).nullish(),
      })
      .default({}),
  )
  .output(z.object({ count: z.number() }));
