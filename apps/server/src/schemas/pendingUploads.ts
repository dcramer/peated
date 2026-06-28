import {
  PENDING_UPLOAD_KIND_LIST,
  PENDING_UPLOAD_PURPOSE_LIST,
  PENDING_UPLOAD_STATUS_LIST,
} from "@peated/server/db/schema";
import { z } from "zod";

export const PendingUploadKindEnum = z.enum(PENDING_UPLOAD_KIND_LIST);
export const PendingUploadPurposeEnum = z.enum(PENDING_UPLOAD_PURPOSE_LIST);
export const PendingUploadStatusEnum = z.enum(PENDING_UPLOAD_STATUS_LIST);

export const PendingUploadSchema = z.object({
  id: z.string().describe("Stable identifier for the pending upload"),
  imageUrl: z.string().describe("URL for the processed pending image"),
  kind: PendingUploadKindEnum.describe("Type of pending upload"),
  purpose: PendingUploadPurposeEnum.describe("Intended use for the upload"),
  status: PendingUploadStatusEnum.describe("Current pending upload state"),
  expiresAt: z.string().datetime().describe("When the pending upload expires"),
});

export const PendingUploadInputSchema = z.object({
  file: z.instanceof(Blob).describe("Image file to store as a pending upload"),
  purpose: PendingUploadPurposeEnum.default("photo_tasting_entry").describe(
    "Intended use for the pending upload",
  ),
  idempotencyKey: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .describe("Client retry key for reusing an existing pending upload"),
});
