import { normalizeGtin } from "@peated/server/lib/gtin";
import { z } from "zod";
import { BottleSchema } from "./bottles";

export const GtinSchema = z
  .string()
  .min(1)
  .transform((input, context) => {
    try {
      return normalizeGtin(input).value;
    } catch (error) {
      context.addIssue({
        code: "custom",
        message:
          error instanceof Error ? error.message : "Barcode is not valid.",
      });
      return z.NEVER;
    }
  })
  .describe("A valid GTIN-8, GTIN-12, GTIN-13, or GTIN-14 barcode");

export const BottleBarcodeSchema = z.object({
  id: z.number().readonly().describe("Unique identifier for this barcode"),
  bottle: z.number().readonly().describe("Bottle assigned to this barcode"),
  value: GtinSchema.readonly().describe("Product barcode number"),
  volume: z
    .number()
    .int()
    .positive()
    .nullable()
    .readonly()
    .describe("Package size in milliliters, when known"),
  createdAt: z
    .string()
    .datetime()
    .readonly()
    .describe("Time when this barcode was assigned"),
});

export const BottleBarcodeLookupSchema = z.object({
  barcode: BottleBarcodeSchema,
  bottle: BottleSchema,
});

export type BottleBarcodeApi = z.infer<typeof BottleBarcodeSchema>;
