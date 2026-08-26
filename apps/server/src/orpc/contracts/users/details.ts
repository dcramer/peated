import { detailsResponse, UserSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/users/{user}",
    summary: "Get user details",
    description:
      "Get a user profile and counts for tastings, bottles, and contributions",
    operationId: "getUser",
  })
  .input(
    z.object({
      user: z.union([z.coerce.number(), z.literal("me"), z.string()]),
    }),
  )
  // TODO(response-envelope): Return { data: ... } when all detail routes use the
  // same wrapper.
  .output(
    detailsResponse(
      UserSchema.extend({
        stats: z.object({
          tastings: z.number(),
          bottles: z.number(),
          collected: z.number(),
          library: z.object({
            total: z.number(),
            open: z.number(),
            sealed: z.number(),
          }),
          contributions: z.number(),
        }),
      }),
    ),
  );
