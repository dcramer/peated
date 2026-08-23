import { GtinSchema } from "@peated/server/schemas";
import { z } from "zod";
import type { JsonValue } from "../types";
import type {
  ScrapePricesCallback,
  ScrapePricesPageResult,
  StorePrice,
} from "./scraper";
import { getUrl } from "./scraper";

export const ShopifyCatalogSchema = z
  .object({
    products: z.array(z.json()),
  })
  .catchall(z.json());

export const ShopifyVariantSchema = z
  .object({
    id: z
      .union([z.number().int().positive(), z.string().trim().min(1)])
      .optional(),
    available: z.boolean(),
    barcode: z.string().trim().min(1).nullish(),
    price: z.string(),
  })
  .catchall(z.json());

export const ShopifyImageSchema = z
  .object({
    src: z.string().url(),
  })
  .catchall(z.json());

export const ShopifyProductSchema = z
  .object({
    id: z
      .union([z.number().int().positive(), z.string().trim().min(1)])
      .optional(),
    title: z.string().trim().min(1),
    handle: z.string().trim().min(1),
    images: z.array(z.json()),
    variants: z.array(ShopifyVariantSchema),
  })
  .catchall(z.json());

export function getShopifyStorePriceIdentity(
  product: Pick<z.infer<typeof ShopifyProductSchema>, "id">,
  variant: Pick<z.infer<typeof ShopifyVariantSchema>, "barcode">,
) {
  const barcode = GtinSchema.safeParse(variant.barcode);
  const identity: Partial<Pick<StorePrice, "externalProductId" | "barcode">> =
    {};
  if (product.id !== undefined) identity.externalProductId = String(product.id);
  if (barcode.success) identity.barcode = barcode.data;
  return identity;
}

export function getShopifyProductTitle(input: JsonValue): string | null {
  const parsed = z.object({ title: z.string() }).safeParse(input);
  return parsed.success ? parsed.data.title : null;
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
  value: JsonValue,
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
  parseProducts: (input: JsonValue, sourceUrl: string) => StorePrice[],
): Promise<ScrapePricesPageResult> {
  const data = await getUrl(url);
  const catalog = ShopifyCatalogSchema.parse(JSON.parse(data));
  const products = parseProducts(catalog, url);
  await Promise.all(products.map(cb));

  return { hasSourceProducts: catalog.products.length > 0 };
}
