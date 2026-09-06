import { upsertCatalogListings } from "@peated/server/lib/catalogListings";
import type { CatalogListingInput } from "@peated/server/schemas";
import type { ScraperSink } from "../types";

export const catalogListingSink: ScraperSink<CatalogListingInput[]> = async ({
  externalSiteId,
  observation,
}) => {
  const result = await upsertCatalogListings(externalSiteId, observation.value);
  return {
    newItemCount: result.newItemCount,
    existingItemCount: result.existingItemCount,
  };
};
