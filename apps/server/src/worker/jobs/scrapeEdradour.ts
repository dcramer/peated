import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import type {
  ScrapePricesCallback,
  StorePrice,
} from "@peated/server/lib/scraper";
import scrapePrices, { getUrl } from "@peated/server/lib/scraper";
import { load as cheerio } from "cheerio";
import { z } from "zod";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "edradour";
const STORE_ORIGIN = "https://www.edradour.com";
const SHOP_URL = `${STORE_ORIGIN}/shop/`;

const EdradourProductCardSchema = z.object({
  rawName: z.string().trim().min(1),
  url: z.string().url(),
});

const EdradourProductDetailSchema = z.object({
  rawName: z.string().trim().min(1),
  priceRaw: z.string().trim().min(1),
  sizeRaw: z.string().trim().min(1),
  abvRaw: z.string().trim().min(1),
  url: z.string().url(),
  imageUrl: z.string().url(),
});

type EdradourProductCard = z.infer<typeof EdradourProductCardSchema>;

function getOfficialUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value, STORE_ORIGIN);
    return url.origin === STORE_ORIGIN ? url.toString() : null;
  } catch {
    return null;
  }
}

function parsePrice(value: string): number | null {
  const match = value.match(/^£\s*([\d,]+)(?:\.(\d{1,2}))?\s*\*?$/);
  if (!match) return null;

  const pounds = Number.parseInt(match[1].replaceAll(",", ""), 10);
  const pence = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10) || 0;
  const price = pounds * 100 + pence;
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function parseVolume(value: string): number | null {
  const match = value.match(/^(\d+(?:[.,]\d+)?)\s*(ml|cl|l)$/i);
  if (!match) return null;

  const amount = Number.parseFloat(match[1].replace(",", "."));
  const unit = match[2].toLowerCase();
  const volume =
    unit === "cl" ? amount * 10 : unit === "l" ? amount * 1000 : amount;
  return Number.isInteger(volume) ? volume : null;
}

function parseAbv(value: string): number | null {
  const match = value.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (!match) return null;

  const abv = Number.parseFloat(match[1].replace(",", "."));
  return Number.isFinite(abv) && abv >= 0 && abv <= 100 ? abv : null;
}

export function parseEdradourProductCards(html: string): EdradourProductCard[] {
  const $ = cheerio(html);
  const products: EdradourProductCard[] = [];

  $(".product-box").each((_, element) => {
    const card = $(element);
    if (!card.find("form.buy-widget").length) return;

    const nameLink = card.find("a.product-name").first();
    const rawName = nameLink.text().trim();
    const url = getOfficialUrl(nameLink.attr("href"));
    const result = EdradourProductCardSchema.safeParse({ rawName, url });
    if (!result.success) {
      logScrapeWarning(SITE, "Invalid product card", {
        rawName: rawName || null,
      });
      return;
    }

    products.push(result.data);
  });

  return products;
}

function getDetailProperty(
  $: ReturnType<typeof cheerio>,
  expectedLabel: RegExp,
): string | null {
  let result: string | null = null;
  $(".product-detail-properties-table tr").each((_, element) => {
    const row = $(element);
    const label = row.find("th").first().text().trim();
    if (expectedLabel.test(label)) {
      result = row.find("td").first().text().trim() || null;
      return false;
    }
  });
  return result;
}

export function parseEdradourProduct(
  html: string,
  sourceUrl: string,
): StorePrice | null {
  const $ = cheerio(html);
  if (!$("form.buy-widget").length) return null;

  const rawName = $("h1.product-detail-name").first().text().trim();
  const imageUrl = getOfficialUrl(
    $(".gallery-slider-image[src]").first().attr("src"),
  );
  const result = EdradourProductDetailSchema.safeParse({
    rawName,
    priceRaw: $(".product-detail-price").first().text().trim(),
    sizeRaw: getDetailProperty($, /^size\s*:?$/i),
    abvRaw: getDetailProperty($, /^alcohol by volume\s*:?$/i),
    url: getOfficialUrl(sourceUrl),
    imageUrl,
  });
  if (!result.success) {
    logScrapeWarning(SITE, "Invalid product detail", {
      rawName: rawName || null,
      productUrl: sourceUrl,
    });
    return null;
  }

  const product = result.data;
  const price = parsePrice(product.priceRaw);
  if (price === null) {
    logScrapeWarning(SITE, "Invalid product price", {
      rawName: product.rawName,
      price: product.priceRaw,
    });
    return null;
  }

  const volume = parseVolume(product.sizeRaw);
  if (volume === null || !ALLOWED_VOLUMES.includes(volume)) {
    logScrapeWarning(SITE, "Invalid product size", {
      rawName: product.rawName,
      volume,
      volumeRaw: product.sizeRaw,
    });
    return null;
  }

  const abv = parseAbv(product.abvRaw);
  if (abv === null || abv < 40) {
    logScrapeWarning(SITE, "Unsupported product ABV", {
      rawName: product.rawName,
      abv,
      abvRaw: product.abvRaw,
    });
    return null;
  }

  const prefixedName = /^(?:edradour|ballechin)\b/i.test(product.rawName)
    ? product.rawName
    : `Edradour ${product.rawName}`;
  const { name } = normalizeBottle({ name: prefixedName });
  const listing = {
    name,
    price,
    currency: "gbp" as const,
    volume,
    url: product.url,
    imageUrl: product.imageUrl,
  };

  logScrapedProduct(SITE, listing);
  return listing;
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url);
  const productCards = parseEdradourProductCards(data);

  for (const productCard of productCards) {
    const detail = await getUrl(productCard.url);
    const product = parseEdradourProduct(detail, productCard.url);
    if (product) await cb(product);
  }
}

export default async function scrapeEdradour({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return scrapePrices(SITE, (page) => `${SHOP_URL}?p=${page}`, scrapeProducts, {
    dryRun,
  });
}
