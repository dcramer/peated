import {
  BottleClassificationDecisionSchema,
  ImagePhotoSuitabilitySchema,
} from "@peated/server/agents/bottleClassifier";
import { signToken, verifyToken } from "@peated/server/lib/auth";
import { z } from "zod";

export const PhotoIdentificationCreateTokenPayloadSchema = z
  .object({
    type: z.literal("photo_identification_create"),
    userId: z.number().int().positive(),
    pendingImageId: z.string().trim().min(1),
    decision: BottleClassificationDecisionSchema,
    photoSuitability: ImagePhotoSuitabilitySchema,
    aud: z.literal("photo-identification-create").optional(),
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
  return await signToken(
    PhotoIdentificationCreateTokenPayloadSchema.parse(payload),
    "photo-identification-create",
  );
}

/** Verifies the create token and returns the user-owned create proposal it authorizes. */
export async function verifyPhotoIdentificationCreateToken(token: string) {
  return PhotoIdentificationCreateTokenPayloadSchema.parse(
    await verifyToken(token, "photo-identification-create"),
  );
}
