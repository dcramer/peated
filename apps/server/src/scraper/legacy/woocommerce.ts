import { GtinSchema } from "@peated/server/schemas";
import { load as cheerio } from "cheerio";
import { z } from "zod";
import type { JsonValue } from "../types";
import type {
  ScrapePricesCallback,
  ScrapePricesPageResult,
  StorePrice,
} from "./scraper";
import { getUrl } from "./scraper";

export const WooCommerceCatalogSchema = z.array(z.json());

export const WooCommercePriceSchema = z
  .object({
    price: z.string(),
    currency_code: z.string(),
    currency_minor_unit: z.number().int(),
  })
  .catchall(z.json());

export const WooCommerceImageSchema = z
  .object({
    src: z.string().url(),
  })
  .catchall(z.json());

export const WooCommerceProductSchema = z
  .object({
    id: z
      .union([z.number().int().positive(), z.string().trim().min(1)])
      .optional(),
    gtin: z.string().trim().min(1).nullish(),
    name: z.string().trim().min(1),
    permalink: z.string().trim().min(1),
    prices: WooCommercePriceSchema,
    images: z.array(z.json()),
    is_in_stock: z.boolean(),
    is_purchasable: z.boolean(),
  })
  .catchall(z.json());

export function getWooCommerceStorePriceIdentity(
  product: z.infer<typeof WooCommerceProductSchema>,
) {
  const barcode = GtinSchema.safeParse(product.gtin);
  const identity: Partial<Pick<StorePrice, "externalProductId" | "barcode">> =
    {};
  if (product.id !== undefined) identity.externalProductId = String(product.id);
  if (barcode.success) identity.barcode = barcode.data;
  return identity;
}

export function getWooCommerceProductName(input: JsonValue): string | null {
  const parsed = z.object({ name: z.string() }).safeParse(input);
  return parsed.success ? parsed.data.name : null;
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
  parseProducts: (input: JsonValue) => StorePrice[],
): Promise<ScrapePricesPageResult> {
  const data = await getUrl(url);
  const catalog = WooCommerceCatalogSchema.parse(JSON.parse(data));
  const products = parseProducts(catalog);
  await Promise.all(products.map(cb));

  return { hasSourceProducts: catalog.length > 0 };
}
