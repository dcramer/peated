import { JSON_SCHEMA_INPUT_REGISTRY } from "@orpc/zod/zod4";
import { z } from "zod";

// Image uploads accept Blob values in RPC calls and multipart files over HTTP.
// The image schema owns this mapping because JSON Schema cannot describe Blob.
export const ImageUploadSchema = z
  .instanceof(Blob)
  .register(JSON_SCHEMA_INPUT_REGISTRY, {
    // The converter merges this over its unsupported-type schema, { not: {} }.
    not: undefined,
    type: "string",
    format: "binary",
    contentMediaType: "image/*",
    description: "Image file to upload",
  });

export const ImageSourceUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => /^https?:\/\//iu.test(value), {
    message: "Enter an HTTP or HTTPS URL.",
  })
  .nullable()
  .default(null)
  .describe("Original source page for the image");

export const ImageLicenseSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .nullable()
  .default(null)
  .describe("License or reuse terms for the image");
