import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import type { ScrapePricesCallback } from "@peated/server/lib/scraper";
import scrapePrices, { getUrl } from "@peated/server/lib/scraper";
import { absoluteUrl } from "@peated/server/lib/urls";
import { load as cheerio } from "cheerio";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "decadentdrinks";
const DEFAULT_VOLUME = 700;

function extractVolume(name: string): [string, number] {
  const match = name.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(cl|ml|l)$/i);
  if (!match) return [name, DEFAULT_VOLUME];

  const [, bottleName, amountRaw, unit] = match;
  const amount = Number.parseFloat(amountRaw);
  const volume =
    unit.toLowerCase() === "cl"
      ? amount * 10
      : unit.toLowerCase() === "l"
        ? amount * 1000
        : amount;

  return [bottleName, volume];
}

function parsePrice(value: string): number | null {
  const match = value.match(/£([\d,]+)(?:\.(\d{1,2}))?/);
  if (!match) return null;

  const pounds = Number.parseInt(match[1].replaceAll(",", ""), 10);
  const pence = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10) || 0;
  return pounds * 100 + pence;
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url);
  const $ = cheerio(data);

  const promises: Promise<void>[] = [];
  $(".catalog-results .view-content > .col > .product-card").each((_, el) => {
    const rawName = $(".product-card__title", el).first().text().trim();
    if (!rawName) {
      logScrapeWarning(SITE, "Unable to identify product name");
      return;
    }

    const productUrl = $(".product-card__title a", el).first().attr("href");
    if (!productUrl) {
      logScrapeWarning(SITE, "Unable to identify product URL", { rawName });
      return;
    }

    const [nameWithoutVolume, volume] = extractVolume(rawName);
    if (!ALLOWED_VOLUMES.includes(volume)) {
      logScrapeWarning(SITE, "Invalid product size", { volume, rawName });
      return;
    }
    const { name } = normalizeBottle({ name: nameWithoutVolume });

    const priceRaw = $(".product-card__price", el).first().text().trim();
    const price = parsePrice(priceRaw);
    if (!price) {
      logScrapeWarning(SITE, "Invalid product price", { priceRaw, rawName });
      return;
    }

    const imageUrl = $(".product-card__media img", el).first().attr("src");

    logScrapedProduct(SITE, { name, price });

    promises.push(
      cb({
        name,
        price,
        currency: "gbp",
        volume,
        url: absoluteUrl(url, productUrl),
        imageUrl: imageUrl ? absoluteUrl(url, imageUrl) : null,
      }),
    );
  });

  await Promise.all(promises);
}

export default async function scrapeDecadentDrinks() {
  return scrapePrices(
    SITE,
    (page) => `https://decadent-drinks.com/shop?category=5&page=${page - 1}`,
    scrapeProducts,
  );
}
