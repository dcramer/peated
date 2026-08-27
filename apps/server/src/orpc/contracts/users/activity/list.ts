import { parseActivityCursor } from "@peated/server/lib/activityCursor";
import { ActivityListResponseSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../../base";

export default contract
  .route({
    method: "GET",
    path: "/users/{user}/activity",
    summary: "List profile activity",
    description:
      "List tastings and collection additions shown on a user's profile",
    operationId: "listUserActivity",
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.string(), z.coerce.number()]),
      cursor: z
        .string()
        .max(64)
        .refine((value) => parseActivityCursor(value) !== null, {
          message: "Invalid activity cursor.",
        })
        .optional(),
      limit: z.coerce.number().gte(1).lte(100).default(10),
    }),
  )
  .output(ActivityListResponseSchema);
