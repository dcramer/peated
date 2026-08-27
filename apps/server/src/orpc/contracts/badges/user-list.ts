import { listResponse, UserSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/badges/{badge}/users",
    summary: "List badge users",
    description:
      "List public users who earned a badge, from most to least points",
    operationId: "listBadgeUsers",
  })
  .input(
    z.object({
      badge: z.coerce.number(),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
    }),
  )
  .output(
    listResponse(
      z.object({
        id: z.number(),
        xp: z.number(),
        level: z.number(),
        user: UserSchema,
        createdAt: z.string(),
      }),
    ),
  );
