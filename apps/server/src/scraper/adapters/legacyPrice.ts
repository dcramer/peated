import { z } from "zod";
import {
  runLegacyPriceAdapter,
  type LegacyPriceCursor,
} from "../legacy/priceContext";
import type { StorePrice } from "../legacy/scraper";
import type { ScraperAdapter } from "../types";

export const LegacyPriceCursorSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    page: z.number().int().positive(),
  })
  .strict();

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
