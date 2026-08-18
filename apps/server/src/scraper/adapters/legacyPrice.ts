import { SCRAPER_PRICE_BATCH_SIZE } from "@peated/server/constants";
import type { StorePrice } from "@peated/server/lib/scraper";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { z } from "zod";
import {
  runLegacyPriceAdapter,
  type LegacyPriceCursor,
} from "../legacyPriceContext";
import type { ScraperAdapter } from "../types";

export const LegacyPriceCursorSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    page: z.number().int().positive(),
  })
  .strict();

export const StorePriceBatchSchema = z
  .array(StorePriceInputSchema.strict())
  .min(1)
  .max(SCRAPER_PRICE_BATCH_SIZE);

export function createLegacyPriceAdapter(
  targetKey: string,
  scrape: (options?: { dryRun?: boolean }) => Promise<number>,
): ScraperAdapter<LegacyPriceCursor, StorePrice[]> {
  return async ({ cursor, session }) => {
    await runLegacyPriceAdapter({
      cursor,
      session,
      targetKey,
      run: async () => {
        await scrape({ dryRun: false });
      },
    });
  };
}
