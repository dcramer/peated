import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { z } from "zod";
import type { ScrapePricesCallback, StorePrice } from "../../legacy/scraper";
import scrapePrices from "../../legacy/scraper";
import {
  getShopifyImageUrl,
  getShopifyProductTitle,
  getShopifyStorePriceIdentity,
  parseShopifyPrice,
  scrapeShopifyProducts,
  ShopifyCatalogSchema,
  ShopifyProductSchema,
  ShopifyVariantSchema,
} from "../../legacy/shopify";
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

const GlenAllachieProductSchema = ShopifyProductSchema.extend({
  handle: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  body_html: z.string(),
  product_type: z.string(),
  tags: z.array(z.string()),
  images: z.array(z.unknown()),
  variants: z.array(z.unknown()),
});

const GlenAllachieVariantSchema = ShopifyVariantSchema;

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

export function parseGlenAllachieProducts(input: unknown): StorePrice[] {
  const payload = ShopifyCatalogSchema.parse(input);
  const products: StorePrice[] = [];

  for (const productInput of payload.products) {
    const productResult = GlenAllachieProductSchema.safeParse(productInput);
    if (!productResult.success) {
      logScrapeWarning(SITE, "Invalid product record", {
        rawName: getShopifyProductTitle(productInput),
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

    const price = parseShopifyPrice(variant.price);
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

    const imageUrl = getShopifyImageUrl(product.images[0], [
      "shop.theglenallachie.com",
    ]);
    if (!imageUrl) {
      logScrapeWarning(SITE, "Invalid product image URL", {
        rawName: product.title,
      });
      continue;
    }

    const listing = {
      ...getShopifyStorePriceIdentity(product, variant),
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
  return scrapeShopifyProducts(url, cb, parseGlenAllachieProducts);
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
