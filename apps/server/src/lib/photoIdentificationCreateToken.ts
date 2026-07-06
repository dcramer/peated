import {
  BottleClassificationDecisionSchema,
  ImagePhotoSuitabilitySchema,
} from "@peated/server/agents/bottleClassifier";
import { signPayload, verifyPayload } from "@peated/server/lib/auth";
import { z } from "zod";

export const PhotoIdentificationCreateTokenPayloadSchema = z
  .object({
    type: z.literal("photo_identification_create"),
    userId: z.number().int().positive(),
    pendingImageId: z.string().trim().min(1),
    decision: BottleClassificationDecisionSchema,
    photoSuitability: ImagePhotoSuitabilitySchema,
    candidateBottleIds: z.array(z.number().int().positive()),
    iat: z.number().optional(),
    exp: z.number().optional(),
  })
  .strict();

export type PhotoIdentificationCreateTokenPayload = z.infer<
  typeof PhotoIdentificationCreateTokenPayloadSchema
>;

/** Signs the reviewed create proposal so create can persist it without rerunning photo AI. */
export async function signPhotoIdentificationCreateToken(
  payload: PhotoIdentificationCreateTokenPayload,
) {
  return await signPayload(
    PhotoIdentificationCreateTokenPayloadSchema.parse(payload),
  );
}

/** Verifies the create token and returns the user-owned create proposal it authorizes. */
export async function verifyPhotoIdentificationCreateToken(token: string) {
  return PhotoIdentificationCreateTokenPayloadSchema.parse(
    await verifyPayload(token),
  );
}
