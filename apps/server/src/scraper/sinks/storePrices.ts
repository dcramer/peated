import { SCRAPER_PRICE_BATCH_SIZE } from "@peated/server/constants";
import { createStorePricesAsPeated } from "@peated/server/lib/createStorePrices";
import { logWarn } from "@peated/server/lib/log";
import { StorePriceInputSchema } from "@peated/server/schemas";
import type { ExternalSiteKey } from "@peated/server/types";
import { z } from "zod";
import type { ScraperSink } from "../types";

export const StorePriceBatchSchema = z
  .array(StorePriceInputSchema.strict())
  .min(1)
  .max(SCRAPER_PRICE_BATCH_SIZE);

export type StorePriceBatch = z.infer<typeof StorePriceBatchSchema>;

const StorePriceListingSchema = StorePriceInputSchema.strict();

/**
 * Scraper rule (owner: scraper runtime): one listing the store printed badly
 * is skipped with a warning. It must not fail the batch and stop the rest of
 * the store from being collected.
 */
export function keepValidStorePrices<T>(site: string, prices: T[]): T[] {
  return prices.filter((price) => {
    const result = StorePriceListingSchema.safeParse(price);
    if (result.success) return true;
    logWarn("Skipped an invalid store price", {
      extra: {
        site,
        fields: result.error.issues.map((issue) => issue.path.join(".")),
      },
    });
    return false;
  });
}

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
