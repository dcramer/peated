import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
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
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "northstarspirits";
const DEFAULT_VOLUME = 700;

const NorthStarProductSchema = ShopifyProductSchema.extend({
  body_html: z.string().nullish(),
  images: z.array(ShopifyImageSchema),
});

const NorthStarProductsSchema = ShopifyCatalogSchema.extend({
  products: z.array(NorthStarProductSchema),
});

function extractVolume(title: string, bodyHtml: string | null): number {
  const match = `${title} ${bodyHtml ?? ""}`.match(
    /\b(\d+(?:\.\d+)?)\s*(ml|cl|l)\b/i,
  );
  if (!match) return DEFAULT_VOLUME;

  const amount = Number.parseFloat(match[1]);
  switch (match[2].toLowerCase()) {
    case "l":
      return amount * 1000;
    case "cl":
      return amount * 10;
    default:
      return amount;
  }
}

function isExplicitlyNonWhisky(title: string, bodyHtml: string | null) {
  const text = `${title} ${bodyHtml ?? ""}`;
  return /\bgin\b/i.test(title) && !/\bwhisk(?:y|ey)\b/i.test(text);
}

export function parseNorthStarProducts(
  input: unknown,
  sourceUrl: string,
): StorePrice[] {
  const payload = NorthStarProductsSchema.parse(input);
  const products: StorePrice[] = [];

  for (const product of payload.products) {
    if (isExplicitlyNonWhisky(product.title, product.body_html ?? null)) {
      logScrapeWarning(SITE, "Unsupported non-whisky product", {
        rawName: product.title,
      });
      continue;
    }

    const pricedVariant = product.variants
      .map((variant) => ({
        ...variant,
        parsedPrice: parseShopifyPrice(variant.price),
      }))
      .find((variant) => variant.available && variant.parsedPrice !== null);
    if (!pricedVariant || pricedVariant.parsedPrice === null) continue;

    const volume = extractVolume(product.title, product.body_html ?? null);
    if (!ALLOWED_VOLUMES.includes(volume)) {
      logScrapeWarning(SITE, "Invalid product size", {
        rawName: product.title,
        volume,
      });
      continue;
    }

    const { name } = normalizeBottle({ name: product.title });
    const listing = {
      name,
      price: pricedVariant.parsedPrice,
      currency: "gbp" as const,
      volume,
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
  return scrapeShopifyProducts(url, cb, parseNorthStarProducts);
}

export default async function scrapeNorthStarSpirits({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return scrapePrices(
    SITE,
    (page) =>
      `https://northstarspirits.com/collections/shop/products.json?limit=250&page=${page}`,
    scrapeProducts,
    { dryRun },
  );
}
