import { ImageBottleEvidenceSchema } from "@peated/bottle-classifier/contract";
import { signToken, verifyToken } from "@peated/server/lib/auth";
import { z } from "zod";

// The token proves Peated matched this photo to this Bottle, so a member can
// only report a match the classifier really made.
const WrongPhotoMatchTokenPayloadSchema = z
  .object({
    type: z.literal("wrong_photo_match"),
    userId: z.number().int().positive(),
    pendingImageId: z.string().trim().min(1),
    bottleId: z.number().int().positive(),
    imageEvidence: ImageBottleEvidenceSchema,
    aud: z.literal("wrong-photo-match").optional(),
    iat: z.number().optional(),
    exp: z.number().optional(),
  })
  .strict();

export type WrongPhotoMatchTokenPayload = z.infer<
  typeof WrongPhotoMatchTokenPayloadSchema
>;

/** Signs a photo match so the member can report it as wrong later. */
export async function signWrongPhotoMatchToken(
  payload: WrongPhotoMatchTokenPayload,
) {
  return await signToken(
    WrongPhotoMatchTokenPayloadSchema.parse(payload),
    "wrong-photo-match",
  );
}

/** Verifies a wrong-match token and returns the match it describes. */
export async function verifyWrongPhotoMatchToken(token: string) {
  return WrongPhotoMatchTokenPayloadSchema.parse(
    await verifyToken(token, "wrong-photo-match"),
  );
}
