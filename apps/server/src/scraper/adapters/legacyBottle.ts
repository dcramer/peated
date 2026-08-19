import {
  BottleInputSchema,
  StorePriceInputSchema,
} from "@peated/server/schemas";
import { z } from "zod";
import { runLegacyBottleAdapter } from "../legacy/bottleContext";
import type { ScraperAdapter } from "../types";

export const LegacyBottleObservationSchema = z
  .object({
    bottle: BottleInputSchema,
    price: StorePriceInputSchema.strict().nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
  })
  .strict();

export type LegacyBottleObservation = z.input<
  typeof LegacyBottleObservationSchema
>;

export function createLegacyBottleAdapter(
  targetKey: string,
  scrape: () => Promise<number | void>,
): ScraperAdapter<null, LegacyBottleObservation> {
  return async ({ session }) => {
    await runLegacyBottleAdapter({
      session,
      targetKey,
      run: scrape,
    });
  };
}
