import { db } from "@peated/server/db";
import { storePrices, type StorePrice } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  createPreparedSource,
  inspectExistingSource,
  type ExistingSourceDefinition,
} from "./prepareExistingSource";
import { ScrapeSourceValidationError } from "./service";

const InputSchema = z
  .object({
    apply: z.boolean().default(false),
    createdById: z.number().int().positive(),
  })
  .strict();

export type PreparePriceSourceInput = z.input<typeof InputSchema>;

type PriceSourceDefinition = ExistingSourceDefinition & {
  listUrl: string;
  isExpectedPrice: (price: StorePrice) => boolean;
};

/** Checks one price source by default; applying preserves price rows and leaves collection paused. */
export async function preparePriceSource(
  input: PreparePriceSourceInput,
  definition: PriceSourceDefinition,
) {
  const { apply, createdById } = InputSchema.parse(input);
  return db.transaction(async (tx) => {
    const site = await inspectExistingSource(tx, definition);
    const prices = await tx
      .select()
      .from(storePrices)
      .where(eq(storePrices.externalSiteId, site.id))
      .for("update");
    if (prices.length === 0) {
      throw new ScrapeSourceValidationError(
        `${definition.siteName} has no stored prices to verify.`,
      );
    }
    for (const price of prices) {
      if (!definition.isExpectedPrice(price)) {
        throw new ScrapeSourceValidationError(
          `Check ${definition.siteName} price ${price.id} before continuing.`,
        );
      }
    }

    const scrapeSourceId = apply
      ? await createPreparedSource(
          tx,
          {
            externalSiteId: site.id,
            kind: "price",
            listUrl: definition.listUrl,
            createdById,
          },
          definition,
        )
      : null;
    return {
      siteId: site.id,
      scrapeSourceId,
      priceCount: prices.length,
      visiblePriceCount: prices.filter(({ hidden }) => !hidden).length,
      matchedPriceCount: prices.filter(({ bottleId }) => bottleId !== null)
        .length,
      applied: apply,
    };
  });
}
