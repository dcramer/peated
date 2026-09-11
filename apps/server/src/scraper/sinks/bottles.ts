import type { ExternalSiteKey } from "@peated/server/types";
import type { LegacyBottleObservation } from "../adapters/legacyBottle";
import { persistBottleObservation } from "../legacy/scraper";
import type { ScraperSink } from "../types";

export function createBottleObservationSink(
  site: ExternalSiteKey,
): ScraperSink<LegacyBottleObservation> {
  return async ({ observation }) => {
    return await persistBottleObservation(
      observation.value.bottle,
      observation.value.price,
      observation.value.imageUrl,
      { site },
    );
  };
}
