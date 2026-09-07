import {
  ExternalReviewSchema,
  MemberReviewDetailsSchema,
  TastingSchema,
} from "@peated/server/schemas";
import { z } from "zod";
import { contract } from "../base";

const CursorSchema = z.object({
  nextCursor: z.string().nullable(),
});

export default contract
  .route({
    method: "GET",
    path: "/reviews-and-tastings",
    summary: "List reviews and tastings",
    description:
      "List tastings, member reviews, and published critic reviews for one bottle, brand, bottler, or distillery in newest-first order.",
    operationId: "listReviewsAndTastings",
  })
  .input(
    z
      .object({
        bottle: z.coerce.number().int().positive().optional(),
        entity: z.coerce.number().int().positive().optional(),
        cursor: z.string().max(512).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .strict()
      .refine(
        (input) =>
          Number(Boolean(input.bottle)) + Number(Boolean(input.entity)) === 1,
        {
          message: "Choose one bottle, brand, bottler, or distillery.",
        },
      ),
  )
  .output(
    z.object({
      results: z.array(
        z.discriminatedUnion("type", [
          z.object({ type: z.literal("tasting"), tasting: TastingSchema }),
          z.object({
            type: z.literal("member_review"),
            review: MemberReviewDetailsSchema,
          }),
          z.object({
            type: z.literal("critic_review"),
            review: ExternalReviewSchema,
          }),
        ]),
      ),
      rel: CursorSchema,
    }),
  );
