import type {
  PhotoIdentificationProgressSchema,
  PhotoIdentificationSchema,
} from "@peated/server/schemas";
import { z } from "zod";

/** The full result that ends a photo identification stream. */
export type PhotoIdentification = z.infer<typeof PhotoIdentificationSchema>;

/** One progress event sent before the full result. */
export type PhotoIdentificationProgressEvent = z.infer<
  typeof PhotoIdentificationProgressSchema
>;

/** Formats classifier evidence without importing the server schema runtime. */
export function getFieldValue(
  result: Pick<PhotoIdentification, "imageEvidence"> | null,
  field: keyof PhotoIdentification["imageEvidence"]["fieldCandidates"],
) {
  const value = result?.imageEvidence.fieldCandidates[field]?.value;
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.join(", ");
  const booleanValue = z.boolean().safeParse(value);
  if (booleanValue.success) return booleanValue.data ? "Yes" : "No";
  if (field === "statedAge") return `${value} years`;
  if (field === "abv") return `${value}% ABV`;
  if (field === "category") {
    return String(value)
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return String(value);
}
