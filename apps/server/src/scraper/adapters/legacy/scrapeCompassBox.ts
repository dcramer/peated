import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { load as cheerio } from "cheerio";
import { z } from "zod";
import type { ScrapePricesCallback, StorePrice } from "../../legacy/scraper";
import scrapePrices, { getUrl } from "../../legacy/scraper";
import { logScrapedProduct } from "./scrapeLogging";

const SITE = "compassbox";
const SHOP_URL = "https://www.compassboxwhisky.com/collections";
const DEFAULT_VOLUME = 700;

const CompassBoxProductSchema = z.object({
  rawName: z.string().trim().min(1),
  priceRaw: z.string().trim().min(1),
  url: z.string().url(),
  imageUrl: z.string().url(),
});

function parsePrice(value: string): number | null {
  const match = value.match(/^£([\d,]+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const pounds = Number.parseInt(match[1].replaceAll(",", ""), 10);
  const pence = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10) || 0;
  const price = pounds * 100 + pence;
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function resolveUrl(sourceUrl: string, value: string | undefined) {
  return value ? new URL(value, sourceUrl).toString() : value;
}

export function parseCompassBoxProducts(
  html: string,
  sourceUrl: string,
): StorePrice[] {
  const $ = cheerio(html);
  const products: StorePrice[] = [];

  $(".card-wrapper.product-card-wrapper").each((_, element) => {
    const card = $(element);
    if (
      card.find(".price--sold-out").length > 0 ||
      /\bsold out\b/i.test(card.find(".badge").text())
    ) {
      return;
    }

    const rawName = card.find(".card__heading a").first().text().trim();
    const productUrl = resolveUrl(
      sourceUrl,
      card.find(".card__heading a").first().attr("href"),
    );
    const imageUrl = resolveUrl(
      sourceUrl,
      card.find(".card__media img").first().attr("src"),
    );
    const salePrice = card
      .find(".price--on-sale .price-item--sale.price-item--last")
      .first()
      .text()
      .trim();
    const priceRaw =
      salePrice ||
      card.find(".price__regular .price-item--regular").first().text().trim();

    const product = CompassBoxProductSchema.parse({
      rawName,
      priceRaw,
      url: productUrl,
      imageUrl,
    });
    const price = parsePrice(product.priceRaw);
    if (price === null) {
      throw new Error(`Invalid Compass Box product price: ${product.priceRaw}`);
    }

    const { name } = normalizeBottle({
      name: `Compass Box ${product.rawName}`,
    });
    const listing = {
      name,
      price,
      currency: "gbp" as const,
      volume: DEFAULT_VOLUME,
      url: product.url,
      imageUrl: product.imageUrl,
    };

    logScrapedProduct(SITE, listing);
    products.push(listing);
  });

  return products;
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url);
  const products = parseCompassBoxProducts(data, url);
  await Promise.all(products.map(cb));
}

export default async function scrapeCompassBox({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return await scrapePrices(SITE, () => SHOP_URL, scrapeProducts, { dryRun });
}
