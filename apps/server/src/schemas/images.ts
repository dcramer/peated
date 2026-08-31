import { z } from "zod";

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
