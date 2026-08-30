import { BottleExtractedDetailsSchema } from "@peated/bottle-classifier/contract";
import { normalizeBottle } from "@peated/bottle-classifier/normalize";
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

async function parseSingleCaskNationProducts(
  input: JsonValue,
  sourceUrl: string,
): Promise<StorePrice[]> {
  const payload = SingleCaskNationProductsSchema.parse(input);
  const products = await Promise.all(
    payload.products.map(async (product): Promise<StorePrice | null> => {
      const category = CATEGORY_BY_PRODUCT_TYPE.get(product.product_type);
      if (!category) return null;

      const pricedVariant = product.variants
        .map((variant) => ({
          ...variant,
          parsedPrice: parseShopifyPrice(variant.price),
        }))
        .find((variant) => variant.available && variant.parsedPrice !== null);
      if (!pricedVariant || pricedVariant.parsedPrice === null) return null;

      const { name } = normalizeBottle({
        name: `Single Cask Nation ${product.title}`,
      });
      const productUrl = absoluteUrl(
        sourceUrl,
        `/products/${encodeURIComponent(product.handle)}`,
      );
      const release = parseReleaseMonth(await getUrl(productUrl));
      const listing: StorePrice = {
        ...getShopifyStorePriceIdentity(product, pricedVariant),
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
      return listing;
    }),
  );

  return products.filter((product): product is StorePrice => product !== null);
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url);
  const catalog = ShopifyCatalogSchema.parse(JSON.parse(data));
  const products = await parseSingleCaskNationProducts(catalog, url);
  await Promise.all(products.map(cb));
  return { hasSourceProducts: catalog.products.length > 0 };
}

export default async function scrapeSingleCaskNation({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return await scrapePrices(
    SITE,
    (page) =>
      `${STORE_ORIGIN}/collections/frontpage/products.json?limit=250&page=${page}&country=US`,
    scrapeProducts,
    { dryRun },
  );
}
