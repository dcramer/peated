import { BottleExtractedDetailsSchema } from "@peated/bottle-classifier/contract";
import { normalizeBottleInput } from "@peated/bottle-classifier/normalize";
import { absoluteUrl } from "@peated/server/lib/urls";
import { load as cheerio } from "cheerio";
import { z } from "zod";
import type { ScrapePricesCallback, StorePrice } from "../../legacy/scraper";
import scrapePrices, { getUrl } from "../../legacy/scraper";
import {
  getShopifyStorePriceIdentity,
  parseShopifyPrice,
  ShopifyCatalogSchema,
  ShopifyImageSchema,
  ShopifyProductSchema,
} from "../../legacy/shopify";
import type { JsonValue } from "../../types";
import { logScrapedProduct } from "./scrapeLogging";

const SITE = "singlecasknation";
const STORE_ORIGIN = "https://singlecasknation.com";
const DEFAULT_VOLUME = 700;
const CATEGORY_BY_PRODUCT_TYPE: ReadonlyMap<
  string,
  "bourbon" | "rye" | "single_grain" | "single_malt"
> = new Map([
  ["American Single Malt Whisky", "single_malt"],
  ["Australian Rye Whisky", "rye"],
  ["Bourbon Whisky", "bourbon"],
  ["Single Grain Scotch Whisky", "single_grain"],
  ["Single Malt Scotch Whisky", "single_malt"],
  ["Straight Rye Whisky", "rye"],
] as const);
const RELEASE_MONTHS = new Map(
  [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ].map((name, index) => [name.toLowerCase(), index + 1]),
);

type Release = {
  releaseYear: number;
  releaseMonth: number;
};

type LoadReleases = (
  externalProductIds: string[],
) => Promise<Map<string, Release>>;

const noSavedReleases: LoadReleases = async () => new Map();

const SingleCaskNationProductSchema = ShopifyProductSchema.extend({
  product_type: z.string(),
  images: z.array(ShopifyImageSchema),
});

const SingleCaskNationProductsSchema = ShopifyCatalogSchema.extend({
  products: z.array(SingleCaskNationProductSchema),
});

export function parseReleaseMonth(input: string) {
  const text = cheerio(input).text().replaceAll(/\s+/gu, " ");
  const match = new RegExp(
    `\\b(${Array.from(RELEASE_MONTHS.keys()).join("|")})\\s+(\\d{4})\\s+Online Exclusive Release\\b`,
    "iu",
  ).exec(text);
  if (!match) return null;

  const releaseYear = Number(match[2]);
  if (releaseYear < 1800 || releaseYear > new Date().getFullYear()) return null;

  return {
    releaseYear,
    releaseMonth: RELEASE_MONTHS.get(match[1].toLowerCase())!,
  };
}

async function scrapeSingleCaskNationProducts(
  input: JsonValue,
  sourceUrl: string,
  onListing: ScrapePricesCallback,
  loadReleases: LoadReleases,
) {
  const payload = SingleCaskNationProductsSchema.parse(input);
  const savedReleases = await loadReleases(
    payload.products.flatMap((product) =>
      product.id === undefined ? [] : [String(product.id)],
    ),
  );
  for (const product of payload.products) {
    const category = CATEGORY_BY_PRODUCT_TYPE.get(product.product_type);
    if (!category) continue;

    const pricedVariant = product.variants
      .map((variant) => ({
        ...variant,
        parsedPrice: parseShopifyPrice(variant.price),
      }))
      .find((variant) => variant.available && variant.parsedPrice !== null);
    if (!pricedVariant || pricedVariant.parsedPrice === null) continue;

    const { name } = normalizeBottleInput({
      name: `Single Cask Nation ${product.title}`,
    });
    const productUrl = absoluteUrl(
      sourceUrl,
      `/products/${encodeURIComponent(product.handle)}`,
    );
    const shopifyIdentity = getShopifyStorePriceIdentity(
      product,
      pricedVariant,
    );
    let release: Release | null | undefined = shopifyIdentity.externalProductId
      ? savedReleases.get(shopifyIdentity.externalProductId)
      : undefined;
    // A saved release date does not change. Fetch the page until we have one.
    if (!release) {
      release = parseReleaseMonth(await getUrl(productUrl));
    }
    const listing: StorePrice = {
      ...shopifyIdentity,
      sourceFingerprint: "release-month-v1",
      name,
      price: pricedVariant.parsedPrice,
      currency: "usd",
      volume: DEFAULT_VOLUME,
      url: productUrl,
      imageUrl: product.images[0]?.src ?? null,
      sourceBottleIdentity: BottleExtractedDetailsSchema.parse({
        brand: "Single Cask Nation",
        bottler: "Single Cask Nation",
        expression: product.title,
        category,
        single_cask: true,
        release_year: release?.releaseYear ?? null,
        release_month: release?.releaseMonth ?? null,
      }),
    };

    logScrapedProduct(SITE, listing);
    await onListing(listing);
  }
}

export async function scrapeProducts(
  url: string,
  onListing: ScrapePricesCallback,
  loadReleases: LoadReleases = noSavedReleases,
) {
  const data = await getUrl(url);
  const catalog = ShopifyCatalogSchema.parse(JSON.parse(data));
  await scrapeSingleCaskNationProducts(catalog, url, onListing, loadReleases);
  return { hasSourceProducts: catalog.products.length > 0 };
}

export default async function scrapeSingleCaskNation(
  { dryRun = false }: { dryRun?: boolean } = {},
  loadReleases: LoadReleases = noSavedReleases,
) {
  return await scrapePrices(
    SITE,
    (page) =>
      `${STORE_ORIGIN}/collections/frontpage/products.json?limit=250&page=${page}&country=US`,
    (url, onListing) => scrapeProducts(url, onListing, loadReleases),
    { dryRun },
  );
}
