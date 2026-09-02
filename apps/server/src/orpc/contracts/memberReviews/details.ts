import {
  detailsResponse,
  MemberReviewDetailsSchema,
} from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

export default contract
  .route({
    method: "GET",
    path: "/member-reviews/{review}",
    summary: "Get member review details",
    description: "Get one member review with its bottle",
    operationId: "getMemberReview",
  })
  .input(z.object({ review: z.coerce.number().int().positive() }))
  .output(detailsResponse(MemberReviewDetailsSchema));
