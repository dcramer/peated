import {
  normalizeBottle,
  normalizeVolume,
} from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import { toTitleCase } from "@peated/server/lib/strings";
import { GtinSchema } from "@peated/server/schemas";
import { z } from "zod";
import type { ScrapePricesCallback, StorePrice } from "../../legacy/scraper";
import scrapePrices, { requestUrl } from "../../legacy/scraper";
import type { JsonValue } from "../../types";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "healthyspirits";
const STORE_ORIGIN = "https://www.healthyspirits.com";
const STORE_ID = 115311147;
const WHISKEY_CATEGORY_ID = 179389817;
const PRODUCTS_PER_PAGE = 60;
const CATALOG_URL = `https://us-vir5-storefront-api.ecwid.com/storefront/api/v1/${STORE_ID}/catalog`;
const CLUB_PREFIX_PATTERN = /^\([^)]*\bwhisk(?:e)?y club\)\s*/i;

const CatalogResponseSchema = z.object({
  expandedCategories: z.array(
    z.object({
      categoryInfo: z.object({ id: z.number().int() }),
      products: z.array(z.json()),
      totalProductsCount: z.number().int().nonnegative(),
    }),
  ),
});

const ProductSchema = z
  .object({
    externalReferenceId: z.string().trim().min(1).optional(),
    identifier: z
      .object({
        productId: z.union([
          z.number().int().positive(),
          z.string().trim().min(1),
        ]),
      })
      .optional(),
    defaultOptionsOverrides: z.object({
      pricesOverrides: z.object({
        basePrice: z.number().positive(),
      }),
      variationOverrides: z.object({
        isSoldOut: z.boolean(),
        productGridMediaItems: z
          .array(
            z.object({
              image800pxUrl: z.string().optional(),
              isMain: z.boolean().optional(),
            }),
          )
          .optional(),
      }),
    }),
    name: z.string().trim().min(1),
    seo: z.object({
      canonicalUrl: z.string().trim().min(1),
      jsonLD: z.string().optional(),
    }),
  })
  .catchall(z.json());

const StructuredProductSchema = z
  .object({
    gtin: z.string().optional(),
    gtin8: z.string().optional(),
    gtin12: z.string().optional(),
    gtin13: z.string().optional(),
    gtin14: z.string().optional(),
  })
  .catchall(z.json());

function getRawName(input: JsonValue): string | null {
  const parsed = z.object({ name: z.string() }).safeParse(input);
  return parsed.success ? parsed.data.name : null;
}

function extractVolume(name: string): [string, string] | [string] {
  const match = name.match(
    /^(.+?)\s+(\d+(?:\.\d+)?\s*(?:ml|l))(?:\s+bottle)?$/i,
  );
  if (!match) return [name];
  const productName = match[1];
  const volume = match[2];
  if (!productName || !volume) return [name];
  return [productName, volume];
}

function parsePrice(value: number): number | null {
  const price = Math.round(value * 100);
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function getProductUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.origin === STORE_ORIGIN &&
      url.pathname.startsWith("/products/")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function getImageUrl(
  mediaItems: Array<{ image800pxUrl?: string; isMain?: boolean }> | undefined,
): string | undefined {
  const value =
    mediaItems?.find((media) => media.isMain)?.image800pxUrl ??
    mediaItems?.[0]?.image800pxUrl;
  if (!value) return;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return;
  }
}

function getProductBarcode(jsonLD: string | undefined): string | undefined {
  if (!jsonLD) return;

  let input: JsonValue;
  try {
    input = JSON.parse(jsonLD);
  } catch {
    return;
  }

  const result = StructuredProductSchema.safeParse(input);
  if (!result.success) return;

  for (const value of [
    result.data.gtin,
    result.data.gtin8,
    result.data.gtin12,
    result.data.gtin13,
    result.data.gtin14,
  ]) {
    const barcode = GtinSchema.safeParse(value);
    if (barcode.success) return barcode.data;
  }
}

export interface HealthySpiritsProducts {
  products: StorePrice[];
  hasNextPage: boolean;
}

export function parseHealthySpiritsProducts(
  input: JsonValue,
  offset: number,
): HealthySpiritsProducts {
  const payload = CatalogResponseSchema.parse(input);
  const category = payload.expandedCategories.find(
    ({ categoryInfo }) => categoryInfo.id === WHISKEY_CATEGORY_ID,
  );
  if (!category) {
    throw new Error("Healthy Spirits whiskey category missing from response.");
  }

  const products: StorePrice[] = [];
  for (const productInput of category.products) {
    const result = ProductSchema.safeParse(productInput);
    if (!result.success) {
      logScrapeWarning(SITE, "Invalid product record", {
        rawName: getRawName(productInput),
      });
      continue;
    }

    const product = result.data;
    if (product.defaultOptionsOverrides.variationOverrides.isSoldOut) continue;

    const [nameRaw, volumeRaw] = extractVolume(
      product.name.replace(CLUB_PREFIX_PATTERN, ""),
    );
    const volume = volumeRaw ? normalizeVolume(volumeRaw) : null;
    if (!volume || !ALLOWED_VOLUMES.includes(volume)) {
      logScrapeWarning(SITE, "Unsupported product size", {
        rawName: product.name,
        volumeRaw,
      });
      continue;
    }

    const price = parsePrice(
      product.defaultOptionsOverrides.pricesOverrides.basePrice,
    );
    if (!price) {
      logScrapeWarning(SITE, "Invalid product price", {
        rawName: product.name,
      });
      continue;
    }

    const url = getProductUrl(product.seo.canonicalUrl);
    if (!url) {
      logScrapeWarning(SITE, "Invalid product URL", {
        rawName: product.name,
        url: product.seo.canonicalUrl,
      });
      continue;
    }

    const { name } = normalizeBottle({ name: toTitleCase(nameRaw) });
    const externalProductId =
      product.identifier?.productId ?? product.externalReferenceId;
    const barcode = getProductBarcode(product.seo.jsonLD);
    const listing: StorePrice = {
      currency: "usd" as const,
      imageUrl: getImageUrl(
        product.defaultOptionsOverrides.variationOverrides
          .productGridMediaItems,
      ),
      name,
      price,
      url,
      volume,
    };
    if (externalProductId !== undefined) {
      listing.externalProductId = String(externalProductId);
    }
    if (barcode) listing.barcode = barcode;

    logScrapedProduct(SITE, listing);
    products.push(listing);
  }

  return {
    products,
    hasNextPage:
      offset + category.products.length < category.totalProductsCount,
  };
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const offset = Number(new URL(url).searchParams.get("offset"));
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error("Invalid Healthy Spirits catalog offset.");
  }

  const data = JSON.parse(
    await requestUrl(url, {
      method: "POST",
      retryable: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryViewMode: "COLLAPSED",
        lang: "en",
        pagination: { offset, limit: PRODUCTS_PER_PAGE },
        parentCategoryId: WHISKEY_CATEGORY_ID,
        urlParams: {
          baseUrl: "/products",
          canonicalBaseUrl: `${STORE_ORIGIN}/products`,
          isCanonicalUrlsEnabled: true,
          isCleanUrls: true,
          isSlugsWithoutIds: true,
          isTrailingSlash: false,
          urlType: "CLEAN_URL",
        },
      }),
    }),
  );

  const result = parseHealthySpiritsProducts(data, offset);
  await Promise.all(result.products.map(cb));
  return { hasNextPage: result.hasNextPage };
}

export default async function scrapeHealthySpirits({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return scrapePrices(
    SITE,
    (page) => `${CATALOG_URL}?offset=${(page - 1) * PRODUCTS_PER_PAGE}`,
    scrapeProducts,
    { dryRun },
  );
}
