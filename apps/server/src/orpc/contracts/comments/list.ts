import { CommentSchema, listResponse } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/comments",
    summary: "List comments",
    description: "Find comments by user or tasting",
    spec: (spec) => ({ ...spec, operationId: "listComments" }),
  })
  .input(
    z.object({
      user: z.union([z.literal("me"), z.coerce.number()]).optional(),
      tasting: z.coerce.number().optional(),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(100),
    }),
  )
  // TODO(response-envelope): Return { data, meta } when all list routes use the
  // same wrapper.
  .output(listResponse(CommentSchema));
