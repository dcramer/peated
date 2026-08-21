import {
  BottleExtractedDetailsSchema,
  type BottleExtractedDetails,
} from "@peated/bottle-classifier/contract";
import {
  normalizeBottle,
  stripDuplicateBrandPrefixFromBottleName,
} from "@peated/bottle-classifier/normalize";
import { absoluteUrl } from "@peated/server/lib/urls";
import { z } from "zod";
import type { ScrapePricesCallback, StorePrice } from "../../legacy/scraper";
import scrapePrices from "../../legacy/scraper";
import {
  getShopifyStorePriceIdentity,
  parseShopifyPrice,
  scrapeShopifyProducts,
  ShopifyCatalogSchema,
  ShopifyImageSchema,
  ShopifyProductSchema,
} from "../../legacy/shopify";
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
const PRODUCT_TYPE_CATEGORIES = new Map<
  string,
  BottleExtractedDetails["category"]
>([
  ["Blended Malt", "blend"],
  ["Blended Scotch", "blend"],
  ["Single Grain", "single_grain"],
  ["Single Malt", "single_malt"],
  ["Whisky", null],
]);

const DouglasLaingProductSchema = ShopifyProductSchema.extend({
  vendor: z.string().trim().min(1),
  product_type: z.string(),
  tags: z.array(z.string()),
  images: z.array(ShopifyImageSchema),
});

const DouglasLaingProductsSchema = ShopifyCatalogSchema.extend({
  products: z.array(DouglasLaingProductSchema),
});

function extractAbv(tags: string[]): number | null {
  const abvTag = tags.find((tag) => /^Abv:/i.test(tag));
  const match = abvTag?.match(/^Abv:\s*(\d+(?:\.\d+)?)$/i);
  return match ? Number.parseFloat(match[1]) : null;
}

function extractCaskFinish(tags: string[]): string | null {
  const caskTag = tags.find((tag) => /^Cask:\s*Finished\b/i.test(tag));
  return caskTag?.replace(/^Cask:\s*/i, "").trim() || null;
}

function buildSourceIdentity({
  title,
  vendor,
  productType,
  tags,
}: {
  title: string;
  vendor: string;
  productType: string;
  tags: string[];
}): BottleExtractedDetails {
  const sourceExpression = stripDuplicateBrandPrefixFromBottleName(
    title,
    vendor,
  );
  const hasConsumerBrandEvidence = sourceExpression !== title;
  const normalized = normalizeBottle({
    name: sourceExpression,
    isFullName: false,
  });
  const caskFinish = extractCaskFinish(tags);

  return BottleExtractedDetailsSchema.parse({
    brand: hasConsumerBrandEvidence ? vendor : null,
    expression:
      [normalized.name, caskFinish].filter(Boolean).join(" – ") || null,
    category: PRODUCT_TYPE_CATEGORIES.get(productType) ?? null,
    stated_age: normalized.statedAge,
    abv: extractAbv(tags),
    cask_strength: normalized.caskStrength ?? null,
    single_cask: normalized.singleCask ?? null,
  });
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
        parsedPrice: parseShopifyPrice(variant.price),
      }))
      .find((variant) => variant.available && variant.parsedPrice !== null);
    if (!pricedVariant || pricedVariant.parsedPrice === null) continue;

    const { name } = normalizeBottle({ name: product.title });
    const listing = {
      ...getShopifyStorePriceIdentity(product, pricedVariant),
      name,
      price: pricedVariant.parsedPrice,
      currency: "usd" as const,
      volume,
      url: absoluteUrl(
        sourceUrl,
        `/en-us/products/${encodeURIComponent(product.handle)}`,
      ),
      imageUrl: product.images[0]?.src ?? null,
      sourceBottleIdentity: buildSourceIdentity({
        title: product.title,
        vendor: product.vendor,
        productType: product.product_type,
        tags: product.tags,
      }),
    };

    logScrapedProduct(SITE, listing);
    products.push(listing);
  }

  return products;
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  return scrapeShopifyProducts(url, cb, parseDouglasLaingProducts);
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
