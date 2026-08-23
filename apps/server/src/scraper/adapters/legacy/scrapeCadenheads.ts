import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import { z } from "zod";
import type { ScrapePricesCallback, StorePrice } from "../../legacy/scraper";
import scrapePrices from "../../legacy/scraper";
import {
  decodeWooCommerceText,
  getWooCommerceStorePriceIdentity,
  parseWooCommercePrice,
  scrapeWooCommerceProducts,
  WooCommerceImageSchema,
  WooCommercePriceSchema,
  WooCommerceProductSchema,
} from "../../legacy/woocommerce";
import type { JsonValue } from "../../types";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "cadenheads";

const CadenheadsProductSchema = WooCommerceProductSchema.extend({
  permalink: z.string().url(),
  prices: WooCommercePriceSchema.extend({
    price: z.string().regex(/^\d+$/),
    currency_code: z.literal("GBP"),
    currency_minor_unit: z.literal(2),
  }),
  images: z.array(WooCommerceImageSchema),
  attributes: z.array(
    z
      .object({
        taxonomy: z.string(),
        terms: z.array(
          z
            .object({
              name: z.string().trim().min(1),
            })
            .catchall(z.json()),
        ),
      })
      .catchall(z.json()),
  ),
});

const CadenheadsProductsSchema = z.array(CadenheadsProductSchema);

function parseVolume(amountRaw: string, unit = "ml"): number | null {
  const amount = Number.parseFloat(amountRaw);
  if (!Number.isFinite(amount)) return null;

  const volume =
    unit.toLowerCase() === "cl"
      ? amount * 10
      : unit.toLowerCase() === "l"
        ? amount * 1000
        : amount;

  return Number.isInteger(volume) ? volume : null;
}

function extractVolume(
  product: z.infer<typeof CadenheadsProductsSchema>[number],
  name: string,
): number | null {
  const volumeAttribute = product.attributes.find(
    (attribute) => attribute.taxonomy === "pa_volume-ml",
  );
  if (volumeAttribute) {
    const amount = volumeAttribute.terms[0]?.name;
    return amount ? parseVolume(amount) : null;
  }

  const match = name.match(/\b(\d+(?:\.\d+)?)\s*(ml|cl|l)\b/i);
  return match ? parseVolume(match[1], match[2]) : null;
}

export function parseCadenheadsProducts(input: JsonValue): StorePrice[] {
  const payload = CadenheadsProductsSchema.parse(input);
  const products: StorePrice[] = [];

  for (const product of payload) {
    if (!product.is_in_stock || !product.is_purchasable) continue;

    const price = parseWooCommercePrice(product.prices.price);
    if (price === null) continue;

    const rawName = decodeWooCommerceText(product.name);
    const volume = extractVolume(product, rawName);
    if (volume === null || !ALLOWED_VOLUMES.includes(volume)) {
      logScrapeWarning(SITE, "Invalid product size", { rawName, volume });
      continue;
    }

    const { name } = normalizeBottle({ name: rawName });
    const listing = {
      ...getWooCommerceStorePriceIdentity(product),
      name,
      price,
      currency: "gbp" as const,
      volume,
      url: product.permalink,
      imageUrl: product.images[0]?.src ?? null,
    };

    logScrapedProduct(SITE, listing);
    products.push(listing);
  }

  return products;
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  return scrapeWooCommerceProducts(url, cb, parseCadenheadsProducts);
}

export default async function scrapeCadenheads({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return scrapePrices(
    SITE,
    (page) =>
      `https://www.cadenhead.shop/wp-json/wc/store/v1/products?category=whisky&per_page=100&stock_status=instock&page=${page}`,
    scrapeProducts,
    { dryRun },
  );
}
