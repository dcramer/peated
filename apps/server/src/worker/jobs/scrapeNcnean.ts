import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import type {
  ScrapePricesCallback,
  StorePrice,
} from "@peated/server/lib/scraper";
import scrapePrices from "@peated/server/lib/scraper";
import {
  getShopifyImageUrl,
  getShopifyProductTitle,
  parseShopifyPrice,
  scrapeShopifyProducts,
  ShopifyCatalogSchema,
  ShopifyProductSchema,
  ShopifyVariantSchema,
} from "@peated/server/lib/shopify";
import { z } from "zod";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "ncnean";
const STORE_ORIGIN = "https://ncnean.com";
const CATALOG_URL = `${STORE_ORIGIN}/collections/all/products.json?country=GB&limit=250`;
const SUPPORTED_VOLUME = 700;
const DISTILLERY_VENDOR = "Nc'nean Distillery";

const VariantSchema = ShopifyVariantSchema.extend({
  title: z.string().trim().min(1),
});

const ProductSchema = ShopifyProductSchema.extend({
  handle: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  body_html: z.string(),
  tags: z.array(z.string()),
  vendor: z.string(),
  images: z.array(z.unknown()).min(1),
  variants: z.array(VariantSchema),
});

type Variant = z.infer<typeof VariantSchema>;

function parseVolume(amountRaw: string, unitRaw: string): number | null {
  const amount = Number.parseFloat(amountRaw);
  const unit = unitRaw.toLowerCase();
  const volume =
    unit === "cl"
      ? amount * 10
      : unit === "l" || unit.startsWith("lit")
        ? amount * 1000
        : amount;
  return Number.isInteger(volume) ? volume : null;
}

function getDescriptionVolumes(bodyHtml: string): number[] {
  const volumes: number[] = [];
  for (const match of bodyHtml.matchAll(
    /\b(\d+(?:\.\d+)?)\s*(ml|cl|l|lit(?:re|er)s?)\b/gi,
  )) {
    const volume = parseVolume(match[1], match[2]);
    if (volume !== null) volumes.push(volume);
  }
  return volumes;
}

function getPricedVariant(
  variants: Variant[],
  rawName: string,
): Variant | null {
  const availableVariants = variants.filter((variant) => variant.available);
  if (availableVariants.length === 1) return availableVariants[0] ?? null;
  if (availableVariants.length === 0) return null;

  const bottleOnlyVariants = availableVariants.filter((variant) =>
    /^without gift tube\b/i.test(variant.title),
  );
  if (bottleOnlyVariants.length === 1) return bottleOnlyVariants[0] ?? null;

  logScrapeWarning(SITE, "Ambiguous available product variants", {
    rawName,
    variantCount: availableVariants.length,
  });
  return null;
}

function formatProductTitle(title: string): string {
  if (title !== title.toUpperCase()) return title;

  return title
    .toLowerCase()
    .replace(/(^|[\s(:-])\p{L}/gu, (value) => value.toUpperCase());
}

function getProductName(title: string, vendor: string): string | null {
  if (vendor.trim() !== DISTILLERY_VENDOR) return null;

  const formattedTitle = formatProductTitle(title);
  const publishedName = /^(?:nc['’]nean)\b/i.test(formattedTitle)
    ? formattedTitle
    : `Nc'nean ${formattedTitle}`;
  return normalizeBottle({ name: publishedName }).name;
}

export function parseNcneanProducts(input: unknown): StorePrice[] {
  const payload = ShopifyCatalogSchema.parse(input);
  const products: StorePrice[] = [];

  for (const productInput of payload.products) {
    const productResult = ProductSchema.safeParse(productInput);
    if (!productResult.success) {
      logScrapeWarning(SITE, "Invalid product record", {
        rawName: getShopifyProductTitle(productInput),
      });
      continue;
    }

    const product = productResult.data;
    if (!product.tags.includes("Whiskies")) continue;
    if (product.tags.includes("Miniatures")) continue;

    const volumes = getDescriptionVolumes(product.body_html);
    if (volumes.length !== 1 || volumes[0] !== SUPPORTED_VOLUME) {
      logScrapeWarning(SITE, "Unsupported product size", {
        rawName: product.title,
        volumes,
      });
      continue;
    }

    const variant = getPricedVariant(product.variants, product.title);
    if (!variant) continue;

    const price = parseShopifyPrice(variant.price);
    if (price === null) {
      logScrapeWarning(SITE, "Invalid product price", {
        rawName: product.title,
        price: variant.price,
      });
      continue;
    }

    const name = getProductName(product.title, product.vendor);
    if (!name) {
      logScrapeWarning(SITE, "Unrecognized product identity", {
        rawName: product.title,
      });
      continue;
    }

    const imageUrl = getShopifyImageUrl(product.images[0], ["ncnean.com"]);
    if (!imageUrl) {
      logScrapeWarning(SITE, "Invalid product image URL", {
        rawName: product.title,
      });
      continue;
    }

    const listing = {
      name,
      price,
      currency: "gbp" as const,
      volume: SUPPORTED_VOLUME,
      url: `${STORE_ORIGIN}/products/${product.handle}`,
      imageUrl,
    };

    logScrapedProduct(SITE, listing);
    products.push(listing);
  }

  return products;
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  return scrapeShopifyProducts(url, cb, parseNcneanProducts);
}

export default async function scrapeNcnean({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return await scrapePrices(
    SITE,
    (page) => `${CATALOG_URL}&page=${page}`,
    scrapeProducts,
    { dryRun },
  );
}
