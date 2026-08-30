import type { Outputs } from "@peated/server/orpc/router";
import { z } from "zod";

export type PhotoIdentification = Outputs["tastings"]["photoIdentification"];

/** Formats classifier evidence without importing the server schema runtime. */
export function getFieldValue(
  result: PhotoIdentification | null,
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
