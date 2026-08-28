import { z } from "zod";
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

export const MemberReviewSchema = z.object({
  id: z.number().int().positive(),
  bottleId: z.number().int().positive(),
  score: MemberReviewScoreSchema,
  notes: MemberReviewNotesSchema,
  createdBy: UserSchema.readonly(),
  createdAt: z.string().datetime().readonly(),
  updatedAt: z.string().datetime().readonly(),
});

export const MemberReviewInputSchema = z
  .object({
    score: MemberReviewScoreSchema,
    notes: MemberReviewNotesSchema,
  })
  .strict();
