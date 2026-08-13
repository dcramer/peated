import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import type {
  ScrapePricesCallback,
  StorePrice,
} from "@peated/server/lib/scraper";
import scrapePrices, { getUrl } from "@peated/server/lib/scraper";
import { z } from "zod";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "glenallachie";
const STORE_ORIGIN = "https://shop.theglenallachie.com";
const CATALOG_URL = `${STORE_ORIGIN}/collections/all-products/products.json?country=GB&limit=250`;
const DEFAULT_VOLUME = 700;
const SUPPORTED_PRODUCT_TYPES = new Set([
  "Blended Malt Whisky",
  "Blended Scotch Whisky",
  "Peated Single Malt Whisky",
  "Single Malt Scotch Whisky",
]);

const GlenAllachieCatalogSchema = z
  .object({
    products: z.array(z.unknown()),
  })
  .passthrough();

const GlenAllachieProductSchema = z
  .object({
    title: z.string().trim().min(1),
    handle: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    body_html: z.string(),
    product_type: z.string(),
    tags: z.array(z.string()),
    images: z.array(z.unknown()),
    variants: z.array(z.unknown()),
  })
  .passthrough();

const GlenAllachieVariantSchema = z
  .object({
    available: z.boolean(),
    price: z.string(),
  })
  .passthrough();

const GlenAllachieImageSchema = z
  .object({
    src: z.string().url(),
  })
  .passthrough();

function getRawName(input: unknown): string | null {
  if (!input || typeof input !== "object" || !("title" in input)) return null;
  return typeof input.title === "string" ? input.title : null;
}

function parsePrice(value: string): number | null {
  const match = value.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const pounds = Number.parseInt(match[1], 10);
  const pence = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10) || 0;
  const price = pounds * 100 + pence;
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function parseExplicitVolumes(value: string): number[] {
  const volumes = new Set<number>();
  for (const match of value.matchAll(/\b(\d+(?:\.\d+)?)\s*(ml|cl|l)\b/gi)) {
    const amount = Number.parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    const volume =
      unit === "cl" ? amount * 10 : unit === "l" ? amount * 1000 : amount;
    if (Number.isInteger(volume)) volumes.add(volume);
  }
  return [...volumes];
}

function getProductName(title: string, tags: string[]): string | null {
  if (
    /^(?:the\s+)?glenallachie\b/i.test(title) ||
    /^meikle\s+t(?:ò|o)ir\b/i.test(title) ||
    /^white\s+heather\b/i.test(title) ||
    /^macnair[’']s\b/i.test(title)
  ) {
    return normalizeBottle({ name: title }).name;
  }

  if (tags.some((tag) => tag.trim().toLowerCase() === "meikle toir")) {
    return normalizeBottle({ name: `Meikle Tòir ${title}` }).name;
  }

  return null;
}

function getImageUrl(value: unknown): string | null {
  const result = GlenAllachieImageSchema.safeParse(value);
  if (!result.success) return null;

  const url = new URL(result.data.src);
  return url.protocol === "https:" &&
    (url.hostname === "cdn.shopify.com" ||
      url.hostname === "shop.theglenallachie.com")
    ? url.toString()
    : null;
}

export function parseGlenAllachieProducts(input: unknown): StorePrice[] {
  const payload = GlenAllachieCatalogSchema.parse(input);
  const products: StorePrice[] = [];

  for (const productInput of payload.products) {
    const productResult = GlenAllachieProductSchema.safeParse(productInput);
    if (!productResult.success) {
      logScrapeWarning(SITE, "Invalid product record", {
        rawName: getRawName(productInput),
      });
      continue;
    }

    const product = productResult.data;
    if (!SUPPORTED_PRODUCT_TYPES.has(product.product_type)) continue;
    if (/\bminiatures?\b/i.test(product.title)) continue;

    const explicitVolumes = parseExplicitVolumes(
      `${product.title} ${product.body_html}`,
    );
    if (explicitVolumes.some((volume) => volume !== DEFAULT_VOLUME)) {
      logScrapeWarning(SITE, "Unsupported product size", {
        rawName: product.title,
        volumes: explicitVolumes,
      });
      continue;
    }

    const availableVariants = product.variants
      .map((variant) => GlenAllachieVariantSchema.safeParse(variant))
      .filter((result) => result.success && result.data.available)
      .map((result) => result.data);
    if (availableVariants.length !== 1) {
      if (availableVariants.length > 1) {
        logScrapeWarning(SITE, "Ambiguous available product variants", {
          rawName: product.title,
          variantCount: availableVariants.length,
        });
      }
      continue;
    }
    const variant = availableVariants[0];
    if (!variant) continue;

    const price = parsePrice(variant.price);
    if (price === null) {
      logScrapeWarning(SITE, "Invalid product price", {
        rawName: product.title,
        price: variant.price,
      });
      continue;
    }

    const name = getProductName(product.title, product.tags);
    if (!name) {
      logScrapeWarning(SITE, "Unrecognized product identity", {
        rawName: product.title,
      });
      continue;
    }

    const imageUrl = getImageUrl(product.images[0]);
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
      // The source omits volume; its explicitly classified, non-miniature UK
      // whisky range is 700 ml. Conflicting published sizes are rejected above.
      volume: DEFAULT_VOLUME,
      url: `${STORE_ORIGIN}/products/${product.handle}`,
      imageUrl,
    };

    logScrapedProduct(SITE, listing);
    products.push(listing);
  }

  return products;
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url);
  const products = parseGlenAllachieProducts(JSON.parse(data));
  await Promise.all(products.map(cb));
}

export default async function scrapeGlenAllachie({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return await scrapePrices(
    SITE,
    (page) => `${CATALOG_URL}&page=${page}`,
    scrapeProducts,
    { dryRun },
  );
}
