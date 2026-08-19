import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import { z } from "zod";
import type { ScrapePricesCallback, StorePrice } from "../../legacy/scraper";
import scrapePrices from "../../legacy/scraper";
import {
  getShopifyImageUrl,
  getShopifyProductTitle,
  parseShopifyPrice,
  scrapeShopifyProducts,
  ShopifyCatalogSchema,
  ShopifyProductSchema,
  ShopifyVariantSchema,
} from "../../legacy/shopify";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "missionliquor";
const STORE_ORIGIN = "https://www.missionliquor.com";
const CATALOG_URL = `${STORE_ORIGIN}/collections/whiskey/products.json?limit=250`;
const SIZE_TAG_PATTERN = /^size-(\d+(?:\.\d+)?)(ml|cl|l)(?:-[a-z]+)?$/i;
const TITLE_VOLUME_PATTERN = /(\d+(?:\.\d+)?)\s*(ml|cl|l)\b/gi;
const MULTIPRODUCT_PATTERN =
  /\b(?:gift|tasting)\s+set\b|\bsampler\b|\bbundle\b|\b\d+\s*(?:x|×)\s*\d+(?:\.\d+)?\s*(?:ml|cl|l)\b|\b\d+\s*(?:pack|pk)\b/i;

const VariantSchema = ShopifyVariantSchema;

const ProductSchema = ShopifyProductSchema.extend({
  handle: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  product_type: z.string().trim(),
  tags: z.array(z.string()),
  images: z.array(z.unknown()).min(1),
  variants: z.array(VariantSchema),
});

function parseVolume(amountRaw: string, unitRaw: string): number | null {
  const amount = Number.parseFloat(amountRaw);
  const unit = unitRaw.toLowerCase();
  const volume =
    unit === "cl" ? amount * 10 : unit === "l" ? amount * 1000 : amount;
  return Number.isInteger(volume) && volume > 0 ? volume : null;
}

function getTaggedVolume(tags: string[]): number | null {
  const matches = tags
    .map((tag) => tag.trim().match(SIZE_TAG_PATTERN))
    .filter((match): match is RegExpMatchArray => match !== null);
  if (matches.length !== 1) return null;

  const volume = parseVolume(matches[0][1], matches[0][2]);
  return volume !== null && ALLOWED_VOLUMES.includes(volume) ? volume : null;
}

function getTitleVolumes(title: string): number[] {
  const volumes: number[] = [];
  for (const match of title.matchAll(TITLE_VOLUME_PATTERN)) {
    const volume = parseVolume(match[1], match[2]);
    if (volume !== null) volumes.push(volume);
  }
  return volumes;
}

function isMultiproduct(title: string): boolean {
  return MULTIPRODUCT_PATTERN.test(title) || /^buy\b/i.test(title.trim());
}

function getProductName(title: string): string | null {
  const withoutTerminalVolume = title
    .replace(/\s*\d+(?:\.\d+)?\s*(?:ml|cl|l)(?=\s*(?:\([^)]*\))?\s*$)/i, "")
    .trim();
  if (!withoutTerminalVolume) return null;
  return normalizeBottle({ name: withoutTerminalVolume }).name;
}

export function parseMissionLiquorProducts(input: unknown): StorePrice[] {
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
    if (product.product_type !== "WHISKEY") continue;
    if (isMultiproduct(product.title)) continue;

    const volume = getTaggedVolume(product.tags);
    if (volume === null) {
      logScrapeWarning(SITE, "Unsupported product size", {
        rawName: product.title,
        tags: product.tags.filter((tag) => /^size-/i.test(tag.trim())),
      });
      continue;
    }

    const titleVolumes = getTitleVolumes(product.title);
    if (titleVolumes.some((titleVolume) => titleVolume !== volume)) {
      logScrapeWarning(SITE, "Product title and tag sizes disagree", {
        rawName: product.title,
        titleVolumes,
        volume,
      });
      continue;
    }

    const availableVariants = product.variants.filter(
      (variant) => variant.available,
    );
    if (availableVariants.length !== 1) {
      if (availableVariants.length > 1) {
        logScrapeWarning(SITE, "Ambiguous available product variants", {
          rawName: product.title,
          variantCount: availableVariants.length,
        });
      }
      continue;
    }

    const price = parseShopifyPrice(availableVariants[0].price);
    if (price === null) {
      logScrapeWarning(SITE, "Invalid product price", {
        rawName: product.title,
        price: availableVariants[0].price,
      });
      continue;
    }

    const name = getProductName(product.title);
    if (!name) {
      logScrapeWarning(SITE, "Invalid product name", {
        rawName: product.title,
      });
      continue;
    }

    const imageUrl = getShopifyImageUrl(product.images[0], [
      "www.missionliquor.com",
    ]);
    if (!imageUrl) {
      logScrapeWarning(SITE, "Invalid product image URL", {
        rawName: product.title,
      });
      continue;
    }

    const listing = {
      name,
      price,
      currency: "usd" as const,
      volume,
      url: `${STORE_ORIGIN}/products/${product.handle}`,
      imageUrl,
    };

    logScrapedProduct(SITE, listing);
    products.push(listing);
  }

  return products;
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  return scrapeShopifyProducts(url, cb, parseMissionLiquorProducts);
}

export default async function scrapeMissionLiquor({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return await scrapePrices(
    SITE,
    (page) => `${CATALOG_URL}&page=${page}`,
    scrapeProducts,
    { dryRun },
  );
}
