import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import type {
  ScrapePricesCallback,
  StorePrice,
} from "@peated/server/lib/scraper";
import scrapePrices, { getUrl } from "@peated/server/lib/scraper";
import { z } from "zod";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "bruichladdich";
const STORE_ORIGIN = "https://www.bruichladdich.com";
const CATALOG_URL = `${STORE_ORIGIN}/collections/all/products.json?country=GB&limit=250`;
const SUPPORTED_VOLUME = 700;
const SUPPORTED_PRODUCT_TYPES = new Set([
  "Heavily Peated Islay Single Malt Scotch Whisky",
  "Islay Single Malt Scotch Whisky",
  "Super Heavily Peated Islay Single Malt Scotch Whisky",
  "Unpeated Islay Single Malt Scotch Whisky",
]);
const BRAND_TAGS = new Map([
  ["bruichladdich", "Bruichladdich"],
  ["octomore", "Octomore"],
  ["port charlotte", "Port Charlotte"],
]);

const CatalogSchema = z
  .object({
    products: z.array(z.unknown()),
  })
  .passthrough();

const VariantSchema = z
  .object({
    available: z.boolean(),
    price: z.string(),
    title: z.string().trim().min(1),
  })
  .passthrough();

const ProductSchema = z
  .object({
    title: z.string().trim().min(1),
    handle: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    product_type: z.string(),
    tags: z.array(z.string()),
    vendor: z.string(),
    images: z.array(z.unknown()).min(1),
    variants: z.array(VariantSchema),
  })
  .passthrough();

const ImageSchema = z
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

function parseVolume(value: string): number | null {
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(ml|cl|l)$/i);
  if (!match) return null;

  const amount = Number.parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const volume =
    unit === "cl" ? amount * 10 : unit === "l" ? amount * 1000 : amount;
  return Number.isInteger(volume) ? volume : null;
}

function getProductName(
  title: string,
  tags: string[],
  vendor: string,
): string | null {
  if (/^(?:bruichladdich|octomore|port charlotte)\b/i.test(title)) {
    return normalizeBottle({ name: title }).name;
  }

  const brands = new Set(
    tags
      .map((tag) => BRAND_TAGS.get(tag.trim().toLowerCase()))
      .filter((brand): brand is string => Boolean(brand)),
  );
  if (brands.size === 0 && vendor.trim() === "Bruichladdich Distillery") {
    brands.add("Bruichladdich");
  }
  if (brands.size !== 1) return null;

  const brand = [...brands][0];
  return brand ? normalizeBottle({ name: `${brand} ${title}` }).name : null;
}

function getImageUrl(value: unknown): string | null {
  const result = ImageSchema.safeParse(value);
  if (!result.success) return null;

  const url = new URL(result.data.src);
  return url.protocol === "https:" &&
    (url.hostname === "cdn.shopify.com" ||
      url.hostname === "www.bruichladdich.com")
    ? url.toString()
    : null;
}

export function parseBruichladdichProducts(input: unknown): StorePrice[] {
  const payload = CatalogSchema.parse(input);
  const products: StorePrice[] = [];

  for (const productInput of payload.products) {
    const productResult = ProductSchema.safeParse(productInput);
    if (!productResult.success) {
      logScrapeWarning(SITE, "Invalid product record", {
        rawName: getRawName(productInput),
      });
      continue;
    }

    const product = productResult.data;
    if (!SUPPORTED_PRODUCT_TYPES.has(product.product_type)) continue;

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
    const variant = availableVariants[0];
    if (!variant) continue;

    const volume = parseVolume(variant.title);
    if (volume !== SUPPORTED_VOLUME) {
      logScrapeWarning(SITE, "Unsupported product size", {
        rawName: product.title,
        variantTitle: variant.title,
      });
      continue;
    }

    const price = parsePrice(variant.price);
    if (price === null) {
      logScrapeWarning(SITE, "Invalid product price", {
        rawName: product.title,
        price: variant.price,
      });
      continue;
    }

    const name = getProductName(product.title, product.tags, product.vendor);
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
  const data = await getUrl(url);
  const products = parseBruichladdichProducts(JSON.parse(data));
  await Promise.all(products.map(cb));
}

export default async function scrapeBruichladdich({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return await scrapePrices(
    SITE,
    (page) => `${CATALOG_URL}&page=${page}`,
    scrapeProducts,
    { dryRun },
  );
}
