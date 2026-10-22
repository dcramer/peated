import { ImageBottleEvidenceSchema } from "@peated/bottle-classifier/contract";
import { z } from "zod";
import { BottleSchema } from "./bottles";

export const WrongPhotoMatchSchema = z.object({
  id: z.number(),
  imageUrl: z
    .string()
    .nullable()
    .describe(
      "Label photo the member uploaded, or `null` after it is deleted 30 days after the report",
    ),
  imageEvidence: ImageBottleEvidenceSchema.describe(
    "Label facts read from the photo when it was matched",
  ),
  wrongBottle: BottleSchema.nullable().describe(
    "Bottle Peated matched, or `null` if it was deleted",
  ),
  correctBottle: BottleSchema.nullable().describe(
    "Bottle the member chose next, or `null` if they have not chosen one",
  ),
  traceId: z
    .string()
    .nullable()
    .describe("Sentry trace ID of the photo identification request"),
  createdAt: z.string().datetime(),
});
