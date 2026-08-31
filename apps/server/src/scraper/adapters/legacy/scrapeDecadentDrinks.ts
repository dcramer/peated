import { BottleExtractedDetailsSchema } from "@peated/bottle-classifier/contract";
import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import { absoluteUrl } from "@peated/server/lib/urls";
import { load as cheerio } from "cheerio";
import type { ScrapePricesCallback } from "../../legacy/scraper";
import scrapePrices, { getUrl } from "../../legacy/scraper";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "decadentdrinks";
const PRODUCT_CARD_SELECTOR =
  ".catalog-results .view-content > .col > .product-card";
const DEFAULT_VOLUME = 700;
const SITEMAP_URL = "https://decadent-drinks.com/sitemap.xml";

function productUrlKey(value: string) {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/$/u, "") || "/";
  return url.toString();
}

export function parseSitemapUpdatedYears(input: string) {
  const $ = cheerio(input, { xmlMode: true });
  const years = new Map<string, number>();
  $("url").each((_, element) => {
    const url = $("loc", element).text().trim();
    const lastModified = $("lastmod", element).text().trim();
    const match = /^(?<year>\d{4})-/u.exec(lastModified);
    if (!url || !match?.groups) return;

    const year = Number(match.groups.year);
    if (year >= 1800 && year <= new Date().getFullYear()) {
      years.set(productUrlKey(url), year);
    }
  });
  return years;
}

export function parseExplicitReleaseYear(name: string): number | null {
  const match =
    /\b(?:spring|summer|autumn|fall|winter)(?:\s+edition)?\s+(20\d{2})\b/iu.exec(
      name,
    ) ?? /\b(20\d{2})\s+(?:edition|release)\b/iu.exec(name);
  if (!match) return null;

  const year = Number(match[1]);
  return year <= new Date().getFullYear() ? year : null;
}

export function parseSkuReleaseYear(input: string): number | null {
  const match = /"SKU":"(?:BDS)?(?<year>\d{2})\d+"/u.exec(input);
  if (!match?.groups) return null;

  const year = 2000 + Number(match.groups.year);
  return year <= new Date().getFullYear() ? year : null;
}

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

export async function scrapeProducts(
  url: string,
  cb: ScrapePricesCallback,
  sitemapUpdatedYears: ReadonlyMap<string, number> = new Map(),
) {
  const data = await getUrl(url);
  const $ = cheerio(data);

  const promises: Promise<void>[] = [];
  const cards = $(PRODUCT_CARD_SELECTOR);
  cards.each((_, el) => {
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

    const productPageUrl = absoluteUrl(url, productUrl);
    promises.push(
      (async () => {
        let releaseYear = parseExplicitReleaseYear(nameWithoutVolume);
        const updatedYear = sitemapUpdatedYears.get(
          productUrlKey(productPageUrl),
        );
        if (releaseYear === null && updatedYear !== undefined) {
          const skuYear = parseSkuReleaseYear(await getUrl(productPageUrl));
          if (skuYear === updatedYear) releaseYear = skuYear;
        }

        await cb({
          name,
          price,
          currency: "gbp",
          volume,
          url: productPageUrl,
          imageUrl: imageUrl ? absoluteUrl(url, imageUrl) : null,
          sourceBottleIdentity: BottleExtractedDetailsSchema.parse({
            bottler: "Decadent Drinks",
            expression: name,
            release_year: releaseYear,
          }),
        });
      })(),
    );
  });

  await Promise.all(promises);
  return { hasSourceProducts: cards.length > 0 };
}

export default async function scrapeDecadentDrinks({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  const sitemapUpdatedYears = parseSitemapUpdatedYears(
    await getUrl(SITEMAP_URL),
  );
  return scrapePrices(
    SITE,
    (page) => `https://decadent-drinks.com/shop?category=5&page=${page - 1}`,
    (url, cb) => scrapeProducts(url, cb, sitemapUpdatedYears),
    { dryRun },
  );
}
