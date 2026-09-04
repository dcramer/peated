import { parseActivityCursor } from "@peated/server/lib/activityCursor";
import { ActivityListResponseSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/activity",
    summary: "List activity",
    description:
      "Get recent tastings, reviews, and grouped collection additions",
    operationId: "listActivity",
  })
  .input(
    z
      .object({
        filter: z.enum(["global", "friends", "local"]).default("global"),
        includeCriticReviews: z.coerce
          .boolean()
          .default(false)
          .describe(
            "Include published critic reviews in global and local activity",
          ),
        cursor: z
          .string()
          .max(64)
          .refine((value) => parseActivityCursor(value) !== null, {
            message: "Invalid activity cursor.",
          })
          .optional(),
        limit: z.coerce.number().gte(1).lte(100).default(10),
      })
      .default({
        filter: "global",
        includeCriticReviews: false,
        limit: 10,
      }),
  )
  .output(ActivityListResponseSchema);
