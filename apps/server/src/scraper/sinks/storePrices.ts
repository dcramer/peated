import { createStorePricesAsPeated } from "@peated/server/lib/createStorePrices";
import type { ExternalSiteType } from "@peated/server/types";
import type { StorePrice } from "../legacy/scraper";
import type { ScraperSink } from "../types";

export function createStorePriceSink(
  site: ExternalSiteType,
): ScraperSink<StorePrice[]> {
  return async ({ observation }) => {
    await createStorePricesAsPeated({ site, prices: observation.value });
  };
}
