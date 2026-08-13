import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import type {
  ScrapePricesCallback,
  StorePrice,
} from "@peated/server/lib/scraper";
import scrapePrices, { getUrl } from "@peated/server/lib/scraper";
import { load as cheerio } from "cheerio";
import { z } from "zod";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "thompsonbros";
const STORE_ORIGIN = "https://www.thompsonbrosdistillers.com";
const CATALOG_URL = `${STORE_ORIGIN}/wp-json/wc/store/v1/products?category=18&per_page=100&stock_status=instock`;

const ThompsonBrosCatalogSchema = z.array(z.unknown());

const ThompsonBrosProductSchema = z
  .object({
    name: z.string().trim().min(1),
    permalink: z.string().trim().min(1),
    prices: z
      .object({
        price: z.string(),
        currency_code: z.string(),
        currency_minor_unit: z.number().int(),
      })
      .passthrough(),
    images: z.array(z.unknown()),
    is_in_stock: z.boolean(),
    is_purchasable: z.boolean(),
  })
  // WooCommerce adds extension fields that are irrelevant to this parser.
  .passthrough();

const ProductImageSchema = z
  .object({
    src: z.string().url(),
  })
  .passthrough();

function getRawName(input: unknown): string | null {
  if (!input || typeof input !== "object" || !("name" in input)) return null;
  return typeof input.name === "string" ? input.name : null;
}

function decodeProductName(value: string): string {
  const $ = cheerio(`<span>${value}</span>`);
  return $("span").text().trim();
}

function parsePrice(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const price = Number.parseInt(value, 10);
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function parseVolume(name: string): number | null {
  const match = name.match(/\b(\d+(?:\.\d+)?)\s*(ml|cl|l)\b/i);
  if (!match) return null;

  const amount = Number.parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const volume =
    unit === "cl" ? amount * 10 : unit === "l" ? amount * 1000 : amount;
  return Number.isInteger(volume) ? volume : null;
}

function getProductUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.origin === STORE_ORIGIN ? url.toString() : null;
  } catch {
    return null;
  }
}

function getImageUrl(value: unknown, rawName: string): string | null {
  if (value === undefined) return null;

  const result = ProductImageSchema.safeParse(value);
  if (!result.success) {
    logScrapeWarning(SITE, "Invalid product image URL", { rawName });
    return null;
  }
  return result.data.src;
}

export function parseThompsonBrosProducts(input: unknown): StorePrice[] {
  const payload = ThompsonBrosCatalogSchema.parse(input);
  const products: StorePrice[] = [];

  for (const productInput of payload) {
    const productResult = ThompsonBrosProductSchema.safeParse(productInput);
    if (!productResult.success) {
      logScrapeWarning(SITE, "Invalid product record", {
        rawName: getRawName(productInput),
      });
      continue;
    }

    const product = productResult.data;
    if (!product.is_in_stock || !product.is_purchasable) continue;

    const rawName = decodeProductName(product.name);
    if (/\brum\b/i.test(rawName)) continue;

    const productUrl = getProductUrl(product.permalink);
    if (!productUrl) {
      logScrapeWarning(SITE, "Invalid product URL", {
        rawName,
        productUrl: product.permalink,
      });
      continue;
    }

    const volume = parseVolume(rawName);
    if (volume === null || !ALLOWED_VOLUMES.includes(volume)) {
      logScrapeWarning(SITE, "Invalid product size", { rawName, volume });
      continue;
    }

    const price =
      product.prices.currency_code === "GBP" &&
      product.prices.currency_minor_unit === 2
        ? parsePrice(product.prices.price)
        : null;
    if (price === null) {
      logScrapeWarning(SITE, "Invalid product price", {
        rawName,
        currency: product.prices.currency_code,
        price: product.prices.price,
      });
      continue;
    }

    const prefixedName = /\bthompson\s+(?:bros?|brothers)\b/i.test(rawName)
      ? rawName
      : `Thompson Bros ${rawName}`;
    const { name } = normalizeBottle({ name: prefixedName });
    const listing = {
      name,
      price,
      currency: "gbp" as const,
      volume,
      url: productUrl,
      imageUrl: getImageUrl(product.images[0], rawName),
    };

    logScrapedProduct(SITE, listing);
    products.push(listing);
  }

  return products;
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url);
  const products = parseThompsonBrosProducts(JSON.parse(data));
  await Promise.all(products.map(cb));
}

export default async function scrapeThompsonBros({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return await scrapePrices(
    SITE,
    (page) => `${CATALOG_URL}&page=${page}`,
    scrapeProducts,
    { dryRun },
  );
}
