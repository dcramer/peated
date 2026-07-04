import { toTitleCase } from "@peated/server/lib/strings";

export type CreateBottleReturnAction =
  | "addBottle"
  | "library"
  | "tasting"
  | "view";

export type CreateBottlePrefill = {
  brandName?: string | null;
  statedAge?: number | null;
  abv?: number | null;
  edition?: string | null;
  vintageYear?: number | null;
  releaseYear?: number | null;
};

/**
 * Builds the Create Bottle URL and owns the scan-prefill query string format.
 * Nullish prefill fields are omitted so manual creation stays editable.
 */
export function getCreateBottleHref({
  query,
  returnAction,
  prefill,
}: {
  query: string;
  returnAction?: CreateBottleReturnAction;
  prefill?: CreateBottlePrefill;
}) {
  const params = new URLSearchParams({
    name: toTitleCase(query),
  });
  if (returnAction) {
    params.set("returnAction", returnAction);
  }

  if (prefill?.brandName) params.set("brandName", prefill.brandName);
  if (prefill?.statedAge !== null && prefill?.statedAge !== undefined) {
    params.set("statedAge", String(prefill.statedAge));
  }
  if (prefill?.abv !== null && prefill?.abv !== undefined) {
    params.set("abv", String(prefill.abv));
  }
  if (prefill?.edition) params.set("edition", prefill.edition);
  if (prefill?.vintageYear !== null && prefill?.vintageYear !== undefined) {
    params.set("vintageYear", String(prefill.vintageYear));
  }
  if (prefill?.releaseYear !== null && prefill?.releaseYear !== undefined) {
    params.set("releaseYear", String(prefill.releaseYear));
  }
  return `/bottles/new?${params.toString()}`;
}
