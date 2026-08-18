import { z } from "zod";
import type {
  ScrapePricesCallback,
  ScrapePricesPageResult,
  StorePrice,
} from "./scraper";
import { getUrl } from "./scraper";

export const ShopifyCatalogSchema = z
  .object({
    products: z.array(z.unknown()),
  })
  .passthrough();

export const ShopifyVariantSchema = z
  .object({
    available: z.boolean(),
    price: z.string(),
  })
  .passthrough();

export const ShopifyImageSchema = z
  .object({
    src: z.string().url(),
  })
  .passthrough();

export const ShopifyProductSchema = z
  .object({
    title: z.string().trim().min(1),
    handle: z.string().trim().min(1),
    images: z.array(z.unknown()),
    variants: z.array(ShopifyVariantSchema),
  })
  .passthrough();

export function getShopifyProductTitle(input: unknown): string | null {
  if (!input || typeof input !== "object" || !("title" in input)) return null;
  return typeof input.title === "string" ? input.title : null;
}

export function parseShopifyPrice(value: string): number | null {
  const match = value.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const majorUnits = Number.parseInt(match[1], 10);
  const minorUnits = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10) || 0;
  const price = majorUnits * 100 + minorUnits;
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

export function getShopifyImageUrl(
  value: unknown,
  storeHostnames: string[],
): string | null {
  const result = ShopifyImageSchema.safeParse(value);
  if (!result.success) return null;

  const url = new URL(result.data.src);
  return url.protocol === "https:" &&
    (url.hostname === "cdn.shopify.com" ||
      storeHostnames.includes(url.hostname))
    ? url.toString()
    : null;
}

/** A non-empty source page advances pagination even if every listing is filtered. */
export async function scrapeShopifyProducts(
  url: string,
  cb: ScrapePricesCallback,
  parseProducts: (input: unknown, sourceUrl: string) => StorePrice[],
): Promise<ScrapePricesPageResult> {
  const data = await getUrl(url);
  const catalog = ShopifyCatalogSchema.parse(JSON.parse(data));
  const products = parseProducts(catalog, url);
  await Promise.all(products.map(cb));

  return { hasSourceProducts: catalog.products.length > 0 };
}
