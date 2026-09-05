import { upsertCatalogListings } from "@peated/server/lib/catalogListings";
import type { CatalogListingInput } from "@peated/server/schemas";
import type { ScraperSink } from "../types";

export const catalogListingSink: ScraperSink<CatalogListingInput[]> = async ({
  externalSiteId,
  observation,
}) => {
  await upsertCatalogListings(externalSiteId, observation.value);
};
