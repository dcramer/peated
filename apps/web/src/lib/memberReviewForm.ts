import { MemberReviewInputSchema } from "@peated/server/schemas";
import { z } from "zod";
import type { ImageUploadValue } from "./imageUpload";

export const MemberReviewFormFieldsSchema = MemberReviewInputSchema.omit({
  score: true,
})
  .extend({
    score: z
      .number()
      .int("Use a whole number.")
      .min(0, "Score must be 0 or higher.")
      .max(100, "Score must be 100 or lower.")
      .nullable(),
  })
  .strict()
  .refine(({ score }) => score !== null, {
    message: "Enter a score.",
    path: ["score"],
  });

export type MemberReviewFormFields = z.infer<
  typeof MemberReviewFormFieldsSchema
>;

export type MemberReviewFormSubmitData = {
  bottle: number;
  image: ImageUploadValue;
} & Omit<MemberReviewFormFields, "score"> & { score: number };

export function buildMemberReviewFormSubmission({
  bottleId,
  fields,
  image,
}: {
  bottleId: number;
  fields: MemberReviewFormFields;
  image: ImageUploadValue;
}): MemberReviewFormSubmitData {
  if (fields.score === null) {
    throw new Error("A validated member review must have a score.");
  }

  return {
    ...fields,
    score: fields.score,
    bottle: bottleId,
    image,
  };
}
