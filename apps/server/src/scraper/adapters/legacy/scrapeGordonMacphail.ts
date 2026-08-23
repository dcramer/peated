import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
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
import type { JsonValue } from "../../types";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "gordonmacphail";

const GordonMacphailProductSchema = ShopifyProductSchema.extend({
  id: z.number().int().positive().optional(),
  body_html: z.string().nullish(),
  images: z.array(ShopifyImageSchema),
});

const GordonMacphailProductsSchema = ShopifyCatalogSchema.extend({
  products: z.array(GordonMacphailProductSchema),
});

function parseVolume(amountRaw: string, unit: string): number | null {
  const amount = Number.parseFloat(amountRaw);
  if (!Number.isFinite(amount)) return null;

  const volume =
    unit.toLowerCase() === "cl"
      ? amount * 10
      : unit.toLowerCase() === "l"
        ? amount * 1000
        : amount;

  return Number.isInteger(volume) ? volume : null;
}

function extractVolume(
  product: z.infer<typeof GordonMacphailProductsSchema>["products"][number],
): number | null {
  const text = [
    product.title,
    product.body_html ?? "",
    ...product.images.map((image) => image.src),
  ].join(" ");
  const match = text.match(
    /(?:^|[^a-z0-9])(\d+(?:\.\d+)?)\s*(ml|cl|l)(?=$|[^a-z0-9])/i,
  );
  return match ? parseVolume(match[1], match[2]) : null;
}

function isExplicitlyNonWhisky(title: string, bodyHtml: string | null) {
  const text = `${title} ${bodyHtml ?? ""}`;
  if (/\bwhisk(?:y|ey)\b/i.test(text)) return false;

  return /\b(?:gin|rum|wine|vodka|brandy|liqueur|beer|cider|glassware|merchandise|ticket)\b/i.test(
    text,
  );
}

export function parseGordonMacphailProducts(
  input: JsonValue,
  sourceUrl: string,
): StorePrice[] {
  const payload = GordonMacphailProductsSchema.parse(input);
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

    const volume = extractVolume(product);
    if (volume === null || !ALLOWED_VOLUMES.includes(volume)) {
      logScrapeWarning(SITE, "Invalid product size", {
        rawName: product.title,
        volume,
      });
      continue;
    }

    const { name } = normalizeBottle({ name: product.title });
    const listing = {
      ...getShopifyStorePriceIdentity(product, pricedVariant),
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
  return scrapeShopifyProducts(url, cb, parseGordonMacphailProducts);
}

export default async function scrapeGordonMacphail({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return scrapePrices(
    SITE,
    (page) =>
      `https://shop.gordonandmacphail.com/products.json?limit=250&page=${page}`,
    scrapeProducts,
    { dryRun },
  );
}
