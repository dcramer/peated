import { z } from "zod";
import { ServingStyleEnum } from "./common";
import { UserSchema } from "./users";

export const MemberReviewScoreSchema = z
  .number()
  .int()
  .min(0)
  .max(100)
  .describe("Whole-number Bottle score from 0 through 100");

export const MemberReviewNotesSchema = z
  .string()
  .trim()
  .nullable()
  .default(null)
  .describe("Optional review notes");

const MemberReviewTagsSchema = z
  .array(z.string())
  .default([])
  .describe("Tasting notes associated with this review");
const MemberReviewColorSchema = z
  .number()
  .gte(0)
  .lte(20)
  .nullable()
  .default(null)
  .describe("Observed color on a scale from 0 through 20");
const MemberReviewServingStyleSchema = ServingStyleEnum.nullable()
  .default(null)
  .describe("How the reviewed pour was served");

export const MemberReviewSchema = z.object({
  id: z.number().int().positive(),
  bottleId: z.number().int().positive(),
  score: MemberReviewScoreSchema,
  tags: MemberReviewTagsSchema,
  color: MemberReviewColorSchema,
  notes: MemberReviewNotesSchema,
  servingStyle: MemberReviewServingStyleSchema,
  friends: z
    .array(UserSchema)
    .default([])
    .describe("Friends who were present for the reviewed pour"),
  imageUrl: z.string().nullable(),
  createdBy: UserSchema.readonly(),
  createdAt: z.string().datetime().readonly(),
  updatedAt: z.string().datetime().readonly(),
});

export const MemberReviewInputSchema = z
  .object({
    score: MemberReviewScoreSchema,
    tags: MemberReviewTagsSchema,
    color: MemberReviewColorSchema,
    notes: MemberReviewNotesSchema,
    servingStyle: MemberReviewServingStyleSchema,
    friends: z
      .array(z.number().int().positive())
      .default([])
      .describe("Friend user IDs present for the reviewed pour"),
  })
  .strict();
