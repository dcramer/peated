import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import { absoluteUrl } from "@peated/server/lib/urls";
import { GtinSchema } from "@peated/server/schemas";
import { z } from "zod";
import type { ScrapePricesCallback, StorePrice } from "../../legacy/scraper";
import scrapePrices, { getUrl } from "../../legacy/scraper";
import type { JsonValue } from "../../types";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "dramfool";
const STORE_ORIGIN = "https://dramfool.com";
const CATALOG_URL = `${STORE_ORIGIN}/shop?format=json`;

const DramfoolCatalogSchema = z
  .object({
    items: z.array(z.json()),
  })
  .catchall(z.json());

const DramfoolProductSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1),
    fullUrl: z.string().trim().min(1),
    assetUrl: z.string().nullish(),
    productType: z.number().int(),
    variants: z.array(z.json()),
  })
  .catchall(z.json());

const MoneySchema = z
  .object({
    currency: z.string(),
    value: z.string(),
  })
  .catchall(z.json());

const DramfoolVariantSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    barcode: z.string().trim().min(1).nullish(),
    attributes: z.record(z.string(), z.string()),
    priceMoney: MoneySchema,
    salePriceMoney: MoneySchema.optional(),
    onSale: z.boolean(),
    unlimited: z.boolean(),
    qtyInStock: z.number(),
  })
  .catchall(z.json());

function getRawName(input: JsonValue): string | null {
  const parsed = z.object({ title: z.string() }).safeParse(input);
  return parsed.success ? parsed.data.title : null;
}

function parsePrice(value: string): number | null {
  const match = value.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const pounds = Number.parseInt(match[1], 10);
  const pence = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10) || 0;
  const price = pounds * 100 + pence;
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function parseVolume(value: string): number | null {
  const match = value.match(/^\s*(\d+(?:\.\d+)?)\s*(ml|cl|l)\s*$/i);
  if (!match) return null;

  const amount = Number.parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const volume =
    unit === "cl" ? amount * 10 : unit === "l" ? amount * 1000 : amount;
  return Number.isInteger(volume) ? volume : null;
}

function getSize(attributes: Record<string, string>): string | null {
  return (
    Object.entries(attributes).find(
      ([name]) => name.trim().toLowerCase() === "size",
    )?.[1] ?? null
  );
}

function getProductUrl(path: string): string | null {
  const url = absoluteUrl(STORE_ORIGIN, path);
  try {
    return new URL(url).origin === STORE_ORIGIN ? url : null;
  } catch {
    return null;
  }
}

function getImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  return z.string().url().safeParse(value).success ? value : null;
}

export function parseDramfoolProducts(input: JsonValue): StorePrice[] {
  const payload = DramfoolCatalogSchema.parse(input);
  const products: StorePrice[] = [];

  for (const productInput of payload.items) {
    const productResult = DramfoolProductSchema.safeParse(productInput);
    if (!productResult.success) {
      logScrapeWarning(SITE, "Invalid product record", {
        rawName: getRawName(productInput),
      });
      continue;
    }

    const product = productResult.data;
    if (product.productType !== 1) continue;

    const productUrl = getProductUrl(product.fullUrl);
    if (!productUrl) {
      logScrapeWarning(SITE, "Invalid product URL", {
        rawName: product.title,
        productUrl: product.fullUrl,
      });
      continue;
    }

    const imageUrl = getImageUrl(product.assetUrl);
    if (product.assetUrl && !imageUrl) {
      logScrapeWarning(SITE, "Invalid product image URL", {
        rawName: product.title,
      });
    }

    for (const variantInput of product.variants) {
      const variantResult = DramfoolVariantSchema.safeParse(variantInput);
      if (!variantResult.success) {
        logScrapeWarning(SITE, "Invalid product variant", {
          rawName: product.title,
        });
        continue;
      }

      const variant = variantResult.data;
      if (!variant.unlimited && variant.qtyInStock <= 0) continue;

      const size = getSize(variant.attributes);
      const volume = size ? parseVolume(size) : null;
      if (volume === null || !ALLOWED_VOLUMES.includes(volume)) {
        logScrapeWarning(SITE, "Invalid product size", {
          rawName: product.title,
          size,
          volume,
        });
        continue;
      }

      const money = variant.onSale
        ? variant.salePriceMoney
        : variant.priceMoney;
      const price = money?.currency === "GBP" ? parsePrice(money.value) : null;
      if (price === null) {
        logScrapeWarning(SITE, "Invalid product price", {
          rawName: product.title,
          currency: money?.currency ?? null,
          price: money?.value ?? null,
        });
        continue;
      }

      const rawName = /\bdramfool\b/i.test(product.title)
        ? product.title
        : `Dramfool ${product.title}`;
      const { name } = normalizeBottle({ name: rawName });
      const externalProductId = variant.id ?? product.id;
      const barcode = GtinSchema.safeParse(variant.barcode);
      const listing: StorePrice = {
        name,
        price,
        currency: "gbp" as const,
        volume,
        url: productUrl,
        imageUrl,
      };
      if (externalProductId) {
        listing.externalProductId = String(externalProductId);
      }
      if (barcode.success) listing.barcode = barcode.data;

      logScrapedProduct(SITE, listing);
      products.push(listing);
    }
  }

  return products;
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const page = Number.parseInt(
    new URL(url).searchParams.get("page") ?? "1",
    10,
  );
  if (page > 1) return;

  const data = await getUrl(url);
  const products = parseDramfoolProducts(JSON.parse(data));
  await Promise.all(products.map(cb));
}

export default async function scrapeDramfool({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return await scrapePrices(
    SITE,
    (page) => `${CATALOG_URL}&page=${page}`,
    scrapeProducts,
    { dryRun },
  );
}
