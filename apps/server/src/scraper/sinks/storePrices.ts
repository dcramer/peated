import { SCRAPER_PRICE_BATCH_SIZE } from "@peated/server/constants";
import { createStorePricesAsPeated } from "@peated/server/lib/createStorePrices";
import { StorePriceInputSchema } from "@peated/server/schemas";
import type { ExternalSiteKey } from "@peated/server/types";
import { z } from "zod";
import type { ScraperSink } from "../types";

export const StorePriceBatchSchema = z
  .array(StorePriceInputSchema.strict())
  .min(1)
  .max(SCRAPER_PRICE_BATCH_SIZE);

export type StorePriceBatch = z.infer<typeof StorePriceBatchSchema>;

export function createStorePriceSink(
  site: ExternalSiteKey,
): ScraperSink<StorePriceBatch> {
  return async ({ observation }) => {
    return await createStorePricesAsPeated({
      site,
      prices: observation.value,
    });
  };
}
