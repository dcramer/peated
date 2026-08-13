import type {
  ScrapePricesCallback,
  ScrapePricesPageResult,
  StorePrice,
} from "@peated/server/lib/scraper";
import { getUrl } from "@peated/server/lib/scraper";
import { load as cheerio } from "cheerio";
import { z } from "zod";

export const WooCommerceCatalogSchema = z.array(z.unknown());

export const WooCommercePriceSchema = z
  .object({
    price: z.string(),
    currency_code: z.string(),
    currency_minor_unit: z.number().int(),
  })
  .passthrough();

export const WooCommerceImageSchema = z
  .object({
    src: z.string().url(),
  })
  .passthrough();

export const WooCommerceProductSchema = z
  .object({
    name: z.string().trim().min(1),
    permalink: z.string().trim().min(1),
    prices: WooCommercePriceSchema,
    images: z.array(z.unknown()),
    is_in_stock: z.boolean(),
    is_purchasable: z.boolean(),
  })
  .passthrough();

export function getWooCommerceProductName(input: unknown): string | null {
  if (!input || typeof input !== "object" || !("name" in input)) return null;
  return typeof input.name === "string" ? input.name : null;
}

export function decodeWooCommerceText(value: string): string {
  const $ = cheerio(`<span>${value}</span>`);
  return $("span").text().trim();
}

export function parseWooCommercePrice(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const price = Number.parseInt(value, 10);
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

/** A non-empty source page advances pagination even if every listing is filtered. */
export async function scrapeWooCommerceProducts(
  url: string,
  cb: ScrapePricesCallback,
  parseProducts: (input: unknown) => StorePrice[],
): Promise<ScrapePricesPageResult> {
  const data = await getUrl(url);
  const catalog = WooCommerceCatalogSchema.parse(JSON.parse(data));
  const products = parseProducts(catalog);
  await Promise.all(products.map(cb));

  return { hasSourceProducts: catalog.length > 0 };
}
