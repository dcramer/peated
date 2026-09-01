import { MemberReviewNotesSchema } from "@peated/server/schemas";
import { z } from "zod";
import type { ImageUploadValue } from "./imageUpload";

export const MemberReviewFormFieldsSchema = z
  .object({
    score: z
      .number()
      .int("Use a whole number.")
      .min(0, "Score must be 0 or higher.")
      .max(100, "Score must be 100 or lower.")
      .nullable(),
    notes: MemberReviewNotesSchema,
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
  score: number;
  notes: string | null;
  image: ImageUploadValue;
};

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
    bottle: bottleId,
    score: fields.score,
    notes: fields.notes,
    image,
  };
}
