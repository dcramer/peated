import type { LegacyBottleObservation } from "../adapters/legacyBottle";
import { persistBottleObservation } from "../legacy/scraper";
import type { ScraperSink } from "../types";

export const bottleObservationSink: ScraperSink<
  LegacyBottleObservation
> = async ({ observation }) => {
  await persistBottleObservation(
    observation.value.bottle,
    observation.value.price,
    observation.value.imageUrl,
  );
};
