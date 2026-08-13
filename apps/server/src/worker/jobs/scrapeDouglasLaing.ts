import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import type {
  ScrapePricesCallback,
  StorePrice,
} from "@peated/server/lib/scraper";
import scrapePrices, { getUrl } from "@peated/server/lib/scraper";
import { absoluteUrl } from "@peated/server/lib/urls";
import { z } from "zod";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "douglaslaing";
const STORE_ORIGIN = "https://www.douglaslaing.com";
const SUPPORTED_PRODUCT_TYPES = new Set([
  "Blended Malt",
  "Blended Scotch",
  "Single Grain",
  "Single Malt",
  "Whisky",
]);
const SUPPORTED_VOLUME_TAGS = new Map([
  ["Vol: 50", 500],
  ["Vol: 70", 700],
]);

const DouglasLaingProductsSchema = z
  .object({
    products: z.array(
      z
        .object({
          title: z.string().trim().min(1),
          handle: z.string().trim().min(1),
          product_type: z.string(),
          tags: z.array(z.string()),
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

function extractAbv(tags: string[]): number | null {
  const abvTag = tags.find((tag) => /^Abv:/i.test(tag));
  const match = abvTag?.match(/^Abv:\s*(\d+(?:\.\d+)?)$/i);
  return match ? Number.parseFloat(match[1]) : null;
}

export function parseDouglasLaingProducts(
  input: unknown,
  sourceUrl: string,
): StorePrice[] {
  const payload = DouglasLaingProductsSchema.parse(input);
  const products: StorePrice[] = [];

  for (const product of payload.products) {
    if (!SUPPORTED_PRODUCT_TYPES.has(product.product_type)) continue;
    if (product.tags.includes("Whisky-Gift-Set")) continue;

    const volumeTag = product.tags.find((tag) =>
      SUPPORTED_VOLUME_TAGS.has(tag),
    );
    const volume = volumeTag
      ? (SUPPORTED_VOLUME_TAGS.get(volumeTag) ?? null)
      : null;
    if (volume === null) {
      logScrapeWarning(SITE, "Unsupported product size", {
        rawName: product.title,
      });
      continue;
    }

    const abv = extractAbv(product.tags);
    if (abv !== null && abv < 40) continue;

    const pricedVariant = product.variants
      .map((variant) => ({
        ...variant,
        parsedPrice: parsePrice(variant.price),
      }))
      .find((variant) => variant.available && variant.parsedPrice !== null);
    if (!pricedVariant || pricedVariant.parsedPrice === null) continue;

    const { name } = normalizeBottle({ name: product.title });
    const listing = {
      name,
      price: pricedVariant.parsedPrice,
      currency: "usd" as const,
      volume,
      url: absoluteUrl(
        sourceUrl,
        `/en-us/products/${encodeURIComponent(product.handle)}`,
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
  const products = parseDouglasLaingProducts(JSON.parse(data), url);
  await Promise.all(products.map(cb));
}

export default async function scrapeDouglasLaing({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return await scrapePrices(
    SITE,
    (page) =>
      `${STORE_ORIGIN}/en-us/collections/scotch-whisky/products.json?limit=250&page=${page}`,
    scrapeProducts,
    { dryRun },
  );
}
