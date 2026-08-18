import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import type {
  ScrapePricesCallback,
  StorePrice,
} from "@peated/server/lib/scraper";
import scrapePrices, { requestUrl } from "@peated/server/lib/scraper";
import { GtinSchema } from "@peated/server/schemas";
import { z } from "zod";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "masterofmalt";
const STORE_ORIGIN = "https://www.masterofmalt.com";
const ALGOLIA_APPLICATION_ID = "LL7RRRES19";
const ALGOLIA_SEARCH_API_KEY = "c173fd6d86fa29679cd0e5075ed07de5";
const ALGOLIA_INDEX = "bc_e8lbekfe7c_1736038_d2c_variants";
const SEARCH_URL = `https://${ALGOLIA_APPLICATION_ID.toLowerCase()}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query`;
const HITS_PER_PARTITION = 1000;
const CATALOG_FILTER =
  'categories_without_path:"Shop all whisky" AND NOT volume:3 AND NOT variant_metafields.atom.product.is-dram:"1" AND NOT exclude_from_search:true AND NOT exclude_from_category:true AND in_stock:true';
const PRICE_PARTITIONS = [
  ["calculated_prices.GBP<40"],
  ["calculated_prices.GBP>=40", "calculated_prices.GBP<60"],
  ["calculated_prices.GBP>=60", "calculated_prices.GBP<80"],
  ["calculated_prices.GBP>=80", "calculated_prices.GBP<100"],
  ["calculated_prices.GBP>=100", "calculated_prices.GBP<200"],
  ["calculated_prices.GBP>=200", "calculated_prices.GBP<500"],
  ["calculated_prices.GBP>=500", "calculated_prices.GBP<1000"],
  ["calculated_prices.GBP>=1000", "calculated_prices.GBP<5000"],
  ["calculated_prices.GBP>=5000"],
] as const;
const MULTIPRODUCT_PATTERN =
  /\b(?:gift|tasting|miniature|sample|discovery)\s+(?:set|pack|collection)\b|\bbundle\b|\badvent\s+calendar\b|\b\d+\s*(?:pack|pk)\b|\b\d+\s*(?:x|×)\s*\d+(?:\.\d+)?\s*(?:ml|cl|l)\b|\bset\s+of\s+\d+\b/i;

const SearchResponseSchema = z
  .object({
    hits: z.array(z.unknown()),
    nbHits: z.number().int().nonnegative(),
  })
  .passthrough();

const ProductSchema = z
  .object({
    bundle_skus: z.array(z.string()).nullable().optional(),
    calculated_prices: z.object({
      GBP: z.number().positive(),
    }),
    image_url: z.string(),
    in_stock: z.literal(true),
    name: z.string().trim().min(1),
    sku: z.string().trim().min(1),
    upc: z.string().trim().nullable().optional(),
    url: z.string().trim().min(1),
    volume: z.number().positive(),
  })
  .passthrough();

function getRawName(input: unknown): string | null {
  if (!input || typeof input !== "object" || !("name" in input)) return null;
  return typeof input.name === "string" ? input.name : null;
}

function parsePrice(value: number): number | null {
  const price = Math.round(value * 100);
  return Number.isSafeInteger(price) &&
    price > 0 &&
    Math.abs(price / 100 - value) < Number.EPSILON * 100
    ? price
    : null;
}

function parseVolume(value: number): number | null {
  const volume = value * 10;
  return Number.isInteger(volume) && ALLOWED_VOLUMES.includes(volume)
    ? volume
    : null;
}

function getProductUrl(path: string, sku: string): string | null {
  try {
    const url = new URL(path, STORE_ORIGIN);
    if (
      url.protocol !== "https:" ||
      url.origin !== STORE_ORIGIN ||
      url.username ||
      url.password ||
      !url.pathname.startsWith("/whiskies/")
    ) {
      return null;
    }

    url.search = "";
    url.hash = "";
    url.searchParams.set("sku", sku);
    return url.toString();
  } catch {
    return null;
  }
}

function getImageUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "cdn11.bigcommerce.com"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function getPartition(url: string): readonly string[] | null {
  const agent = new URL(url).searchParams.get("x-algolia-agent");
  const match = agent?.match(/^Peated\/1\.0 masterofmalt\/(\d+)$/);
  if (!match) throw new Error("Invalid Master of Malt catalog request URL.");

  const page = Number.parseInt(match[1], 10);
  return PRICE_PARTITIONS[page - 1] ?? null;
}

export function parseMasterOfMaltProducts(input: unknown): StorePrice[] {
  const payload = SearchResponseSchema.parse(input);
  if (
    payload.nbHits > HITS_PER_PARTITION ||
    payload.hits.length !== payload.nbHits
  ) {
    throw new Error(
      "Master of Malt price partition exceeds the complete-search limit.",
    );
  }

  const products: StorePrice[] = [];
  for (const productInput of payload.hits) {
    const result = ProductSchema.safeParse(productInput);
    if (!result.success) {
      logScrapeWarning(SITE, "Invalid product record", {
        rawName: getRawName(productInput),
      });
      continue;
    }

    const product = result.data;
    if (
      product.bundle_skus?.length ||
      MULTIPRODUCT_PATTERN.test(product.name)
    ) {
      continue;
    }

    const volume = parseVolume(product.volume);
    if (volume === null) {
      logScrapeWarning(SITE, "Unsupported product size", {
        rawName: product.name,
        volumeCl: product.volume,
      });
      continue;
    }

    const price = parsePrice(product.calculated_prices.GBP);
    if (price === null) {
      logScrapeWarning(SITE, "Invalid product price", {
        price: product.calculated_prices.GBP,
        rawName: product.name,
      });
      continue;
    }

    const url = getProductUrl(product.url, product.sku);
    if (!url) {
      logScrapeWarning(SITE, "Invalid product URL", {
        rawName: product.name,
        url: product.url,
      });
      continue;
    }

    const imageUrl = getImageUrl(product.image_url);
    if (!imageUrl) {
      logScrapeWarning(SITE, "Invalid product image URL", {
        imageUrl: product.image_url,
        rawName: product.name,
      });
      continue;
    }

    const { name } = normalizeBottle({ name: product.name });
    const barcode = GtinSchema.safeParse(product.upc);
    const listing = {
      externalProductId: product.sku,
      name,
      price,
      currency: "gbp" as const,
      volume,
      url,
      imageUrl,
      ...(barcode.success ? { barcode: barcode.data } : {}),
    };

    logScrapedProduct(SITE, listing);
    products.push(listing);
  }

  return products;
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const numericFilters = getPartition(url);
  if (!numericFilters) return;

  const data = JSON.parse(
    await requestUrl(url, {
      method: "POST",
      retryable: true,
      body: JSON.stringify({
        attributesToRetrieve: [
          "bundle_skus",
          "calculated_prices.GBP",
          "image_url",
          "in_stock",
          "name",
          "sku",
          "upc",
          "url",
          "volume",
        ],
        filters: CATALOG_FILTER,
        hitsPerPage: HITS_PER_PARTITION,
        numericFilters,
        query: "",
      }),
      headers: {
        "Content-Type": "application/json",
        "x-algolia-api-key": ALGOLIA_SEARCH_API_KEY,
        "x-algolia-application-id": ALGOLIA_APPLICATION_ID,
      },
    }),
  );

  const payload = SearchResponseSchema.parse(data);
  if (payload.nbHits === 0) {
    throw new Error("Master of Malt price partition unexpectedly empty.");
  }

  const products = parseMasterOfMaltProducts(payload);
  if (products.length === 0) {
    throw new Error(
      "Master of Malt price partition contained no supported listings.",
    );
  }
  await Promise.all(products.map(cb));
}

export default async function scrapeMasterOfMalt({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return await scrapePrices(
    SITE,
    (page) => {
      const url = new URL(SEARCH_URL);
      url.searchParams.set(
        "x-algolia-agent",
        `Peated/1.0 masterofmalt/${page}`,
      );
      return url.toString();
    },
    scrapeProducts,
    { dryRun },
  );
}
