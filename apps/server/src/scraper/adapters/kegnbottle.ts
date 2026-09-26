import { normalizeBottleInput } from "@peated/bottle-classifier/normalize";
import {
  ALLOWED_VOLUMES,
  SCRAPER_PRICE_BATCH_SIZE,
} from "@peated/server/constants";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  keepValidStorePrices,
  StorePriceBatchSchema,
  type StorePriceBatch,
} from "../sinks/storePrices";
import type { JsonValue, ScraperAdapter } from "../types";
import { logScrapedProduct, logScrapeWarning } from "./legacy/scrapeLogging";
import {
  getShopifyImageUrl,
  getShopifyProductTitle,
  parseShopifyPrice,
  ShopifyCatalogSchema,
  ShopifyProductSchema,
  ShopifyVariantSchema,
} from "./shopify";

const SITE = "kegnbottle";
const TARGET = "kegnbottle";
const ORIGIN = "https://kegnbottle.com";
const STORE_HOSTNAMES = ["kegnbottle.com"];
const PAGE_SIZE = 250;
/** The whiskey collection held 3,763 products (16 pages) in September 2026. */
const MAX_PAGES = 25;
const WHISKY_TYPE_PATTERN = /^whisk(?:e)?y$/i;
// Titles print sizes as "(750 ml)", "750mL", "1.75 L", or "750 (mL)".
const VOLUME_PATTERN = /(\d+(?:\.\d+)?)\s*\(?\s*(ml|cl|l)\s*\)?(?![a-z])/i;
const TRAILING_VOLUME_PATTERN =
  /\s*\(?\s*\d+(?:\.\d+)?\s*\(?\s*(?:ml|cl|l)\s*\)?\s*\)?\s*$/i;
const TRAILING_PUNCTUATION_PATTERN = /[\s\-–—:]+$/;
// A price listing is one Bottle. Keg N Bottle marks bundles in product titles
// ("Collection (750 ml Each)", "with Rocks Glasses", "Gift Box", "Join Zoom
// tasting") and cases in variant names; both are skipped here (scraper README).
const MULTIPRODUCT_TITLE_PATTERN =
  /\b(?:gift|tasting)\s+set\b|\bgift\s+(?:box|pack)\b|\bset\b|\bkit\b|\bsampler\b|\bbundle\b|\bcombo\b|\bmystery\s+box\b|\bparty\s+box\b|\badvent\b|\b(?:zoom|virtual)\b|\bincluded\b|\bwith\b.*\b(?:glass(?:es)?|vest|topper|flask)\b|\(\s*\d+\s+bottles?\s*\)|\b\d+\s*(?:x|×)\s*\d+(?:\.\d+)?\s*(?:ml|cl|l)\b|\b(?:ml|cl|l)\s+each\b|\b\d+[\s-]*(?:pack|pk)\b/i;
const MULTIPRODUCT_VARIANT_PATTERN = /\bcase\b|\bpack\b|\b\d+\s*(?:x|×)\s*\d+/i;

export const KegnbottleCursorSchema = z
  .object({ page: z.number().int().positive() })
  .strict();
export const KegnbottleObservationSchema = StorePriceBatchSchema;

export type KegnbottleCursor = z.infer<typeof KegnbottleCursorSchema>;
export type KegnbottleObservation = StorePriceBatch;
type Listing = StorePriceBatch[number];

const VariantSchema = ShopifyVariantSchema.extend({
  id: z.union([z.number().int().positive(), z.string().trim().min(1)]),
  title: z.string().trim().min(1),
});

const ProductSchema = ShopifyProductSchema.extend({
  // Handles can hold underscores, symbols, and non-Latin letters; they only
  // need to work as one URL path segment.
  handle: z
    .string()
    .trim()
    .regex(/^[^\s/?#]+$/),
  product_type: z.string().trim(),
  variants: z.array(VariantSchema),
});

export function catalogUrl(page: number): URL {
  const url = new URL("/collections/whiskey/products.json", ORIGIN);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("page", String(page));
  return url;
}

function getVolume(text: string): number | null {
  const match = text.match(VOLUME_PATTERN);
  if (!match) return null;
  const amount = Number.parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const volume =
    unit === "cl" ? amount * 10 : unit === "l" ? amount * 1000 : amount;
  return ALLOWED_VOLUMES.includes(volume) ? volume : null;
}

function getProductName(title: string): string | null {
  const withoutVolume = title
    .replace(TRAILING_VOLUME_PATTERN, "")
    .replace(TRAILING_PUNCTUATION_PATTERN, "")
    .trim();
  if (!withoutVolume) return null;
  return normalizeBottleInput({ name: withoutVolume }).name;
}

export function parseKegnbottleProducts(input: JsonValue): Listing[] {
  const payload = ShopifyCatalogSchema.parse(input);
  const listings: Listing[] = [];

  for (const productInput of payload.products) {
    const productResult = ProductSchema.safeParse(productInput);
    if (!productResult.success) {
      logScrapeWarning(SITE, "Invalid product record", {
        rawName: getShopifyProductTitle(productInput),
        fields: productResult.error.issues.map((issue) => issue.path.join(".")),
      });
      continue;
    }

    const product = productResult.data;
    if (!WHISKY_TYPE_PATTERN.test(product.product_type)) continue;
    if (MULTIPRODUCT_TITLE_PATTERN.test(product.title)) continue;

    const name = getProductName(product.title);
    if (!name) {
      logScrapeWarning(SITE, "Invalid product name", {
        rawName: product.title,
      });
      continue;
    }

    const titleVolume = getVolume(product.title);
    const imageUrl = getShopifyImageUrl(
      product.images[0] ?? null,
      STORE_HOSTNAMES,
    );
    const bottleVariants = product.variants.filter(
      (variant) => !MULTIPRODUCT_VARIANT_PATTERN.test(variant.title),
    );

    for (const variant of bottleVariants) {
      if (!variant.available) continue;

      const variantVolume = getVolume(variant.title);
      const volume = variantVolume ?? titleVolume;
      if (volume === null) {
        logScrapeWarning(SITE, "Unsupported product size", {
          rawName: product.title,
          variant: variant.title,
        });
        continue;
      }
      if (
        variantVolume !== null &&
        titleVolume !== null &&
        variantVolume !== titleVolume
      ) {
        logScrapeWarning(SITE, "Product title and variant sizes disagree", {
          rawName: product.title,
          variant: variant.title,
        });
        continue;
      }

      const price = parseShopifyPrice(variant.price);
      if (price === null) {
        logScrapeWarning(SITE, "Invalid product price", {
          rawName: product.title,
          price: variant.price,
        });
        continue;
      }

      const url = new URL(`/products/${product.handle}`, ORIGIN);
      if (bottleVariants.length > 1) {
        url.searchParams.set("variant", String(variant.id));
      }

      const listing: Listing = {
        externalProductId: String(variant.id),
        name,
        price,
        currency: "usd",
        volume,
        url: url.toString(),
        imageUrl,
      };
      logScrapedProduct(SITE, listing);
      listings.push(listing);
    }
  }

  return listings;
}

function batchSourceKey(batch: Listing[]): string {
  const digest = createHash("sha256")
    .update(
      batch
        .map((listing) => `${listing.externalProductId}\u0000${listing.volume}`)
        .sort()
        .join("\u0001"),
    )
    .digest("hex");
  return `${SITE}:${digest}`;
}

export const kegnbottleAdapter: ScraperAdapter<
  KegnbottleCursor,
  KegnbottleObservation
> = async ({ cursor, session }) => {
  let page = cursor?.page ?? 1;
  let listingCount = 0;

  while (page <= MAX_PAGES) {
    const response = await session.request({
      target: TARGET,
      url: catalogUrl(page),
    });
    const catalog = ShopifyCatalogSchema.parse(JSON.parse(response.body));
    if (catalog.products.length === 0) break;

    const listings = keepValidStorePrices(
      SITE,
      parseKegnbottleProducts(catalog),
    );
    for (let at = 0; at < listings.length; at += SCRAPER_PRICE_BATCH_SIZE) {
      const batch = listings.slice(at, at + SCRAPER_PRICE_BATCH_SIZE);
      await session.emit({
        sourceKey: batchSourceKey(batch),
        itemCount: batch.length,
        value: batch,
      });
    }
    listingCount += listings.length;

    await session.checkpoint({ page: page + 1 });
    page += 1;
  }

  if (page > MAX_PAGES) {
    logScrapeWarning(SITE, "Stopped at the page limit", { pages: MAX_PAGES });
  }
  if (cursor === null && listingCount === 0) {
    throw new Error("Keg N Bottle returned no supported whisky listings.");
  }
};
