import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import type {
  ScrapePricesCallback,
  StorePrice,
} from "@peated/server/lib/scraper";
import scrapePrices, { getUrl } from "@peated/server/lib/scraper";
import { absoluteUrl } from "@peated/server/lib/urls";
import { z } from "zod";
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

const SingleCaskNationProductsSchema = z
  .object({
    products: z.array(
      z
        .object({
          title: z.string().trim().min(1),
          handle: z.string().trim().min(1),
          product_type: z.string(),
          images: z.array(
            z
              .object({
                src: z.string().url(),
              })
              .passthrough(),
          ),
          variants: z.array(
            z
              .object({
                available: z.boolean(),
                price: z.string(),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
  })
  .passthrough();

function parsePrice(value: string): number | null {
  const match = value.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const dollars = Number.parseInt(match[1], 10);
  const cents = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10) || 0;
  const price = dollars * 100 + cents;
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

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
        parsedPrice: parsePrice(variant.price),
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
  const data = await getUrl(url);
  const products = parseSingleCaskNationProducts(JSON.parse(data), url);
  await Promise.all(products.map(cb));
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
