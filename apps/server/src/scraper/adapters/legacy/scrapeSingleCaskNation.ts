import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { absoluteUrl } from "@peated/server/lib/urls";
import { z } from "zod";
import type { ScrapePricesCallback, StorePrice } from "../../legacy/scraper";
import scrapePrices from "../../legacy/scraper";
import {
  parseShopifyPrice,
  scrapeShopifyProducts,
  ShopifyCatalogSchema,
  ShopifyImageSchema,
  ShopifyProductSchema,
} from "../../legacy/shopify";
import { logScrapedProduct } from "./scrapeLogging";

const SITE = "singlecasknation";
const STORE_ORIGIN = "https://singlecasknation.com";
const DEFAULT_VOLUME = 700;
const SUPPORTED_PRODUCT_TYPES = new Set([
  "American Single Malt Whisky",
  "Australian Rye Whisky",
  "Bourbon Whisky",
  "Single Grain Scotch Whisky",
  "Single Malt Scotch Whisky",
  "Straight Rye Whisky",
]);

const SingleCaskNationProductSchema = ShopifyProductSchema.extend({
  product_type: z.string(),
  images: z.array(ShopifyImageSchema),
});

const SingleCaskNationProductsSchema = ShopifyCatalogSchema.extend({
  products: z.array(SingleCaskNationProductSchema),
});

export function parseSingleCaskNationProducts(
  input: unknown,
  sourceUrl: string,
): StorePrice[] {
  const payload = SingleCaskNationProductsSchema.parse(input);
  const products: StorePrice[] = [];

  for (const product of payload.products) {
    if (!SUPPORTED_PRODUCT_TYPES.has(product.product_type)) continue;

    const pricedVariant = product.variants
      .map((variant) => ({
        ...variant,
        parsedPrice: parseShopifyPrice(variant.price),
      }))
      .find((variant) => variant.available && variant.parsedPrice !== null);
    if (!pricedVariant || pricedVariant.parsedPrice === null) continue;

    const { name } = normalizeBottle({
      name: `Single Cask Nation ${product.title}`,
    });
    const listing = {
      name,
      price: pricedVariant.parsedPrice,
      currency: "usd" as const,
      volume: DEFAULT_VOLUME,
      url: absoluteUrl(
        sourceUrl,
        `/products/${encodeURIComponent(product.handle)}`,
      ),
      imageUrl: product.images[0]?.src ?? null,
    };

    logScrapedProduct(SITE, listing);
    products.push(listing);
  }

  return products;
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  return scrapeShopifyProducts(url, cb, parseSingleCaskNationProducts);
}

export default async function scrapeSingleCaskNation({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return await scrapePrices(
    SITE,
    (page) =>
      `${STORE_ORIGIN}/collections/frontpage/products.json?limit=250&page=${page}&country=US`,
    scrapeProducts,
    { dryRun },
  );
}
