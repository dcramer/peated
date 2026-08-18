import { persistBottleObservation } from "@peated/server/lib/scraper";
import type { LegacyBottleObservation } from "../adapters/legacyBottle";
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
