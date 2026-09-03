import { listResponse, MemberReviewSchema } from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/bottles/{bottle}/member-reviews",
    summary: "List member reviews",
    description:
      "List reviews for one bottle, most recently updated first. Private members' reviews are visible only to the author and members who follow them.",
    operationId: "listMemberReviews",
  })
  .input(
    z.object({
      bottle: z.coerce.number().int().positive(),
      cursor: z.coerce
        .number()
        .int()
        .positive()
        .default(1)
        .describe("Page number to return"),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  )
  .output(listResponse(MemberReviewSchema));
