import {
  normalizeBottle,
  normalizeVolume,
} from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import type { ScrapePricesCallback } from "@peated/server/lib/scraper";
import scrapePrices, { getUrl, parsePrice } from "@peated/server/lib/scraper";
import { toTitleCase } from "@peated/server/lib/strings";
import { absoluteUrl } from "@peated/server/lib/urls";
import { load as cheerio } from "cheerio";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "healthyspirits";

function extractVolume(name: string): [string, string] | [string] {
  const match = name.match(/^(.+)\s([\d.]+(?:ml|l))$/i);
  if (!match) return [name];
  return match.slice(1, 3) as [string, string];
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url);
  const $ = cheerio(data);

  const promises: Promise<void>[] = [];
  $(".collection-products-row .product-block").each((_, el) => {
    const brand = toTitleCase($("div.brand", el).first().text().trim());
    const bottle = $("a.title", el).first().text().trim();
    if (!bottle || !brand) {
      logScrapeWarning(SITE, "Unable to identify product name");
      return;
    }

    const [name, volumeRaw] = extractVolume(
      normalizeBottle({
        name: toTitleCase(`${bottle}`),
        isFullName: false,
      }).name,
    );

    const volume = volumeRaw ? normalizeVolume(volumeRaw) : null;
    if (!volume) {
      logScrapeWarning(SITE, "Invalid product size", { volumeRaw });
      return;
    }

    if (!ALLOWED_VOLUMES.includes(volume)) {
      logScrapeWarning(SITE, "Invalid product size", { volume });
      return;
    }

    const productUrl = $("a.title", el).first().attr("href");
    if (!productUrl) throw new Error("Unable to identify Product URL");

    const priceRaw = $("div.product-block-price > strong", el)
      .first()
      .text()
      .trim();
    const price = parsePrice(priceRaw);
    if (!price) {
      logScrapeWarning(SITE, "Invalid product price", { priceRaw });
      return;
    }

    const fullName = `${brand} ${name}`;
    logScrapedProduct(SITE, { name: fullName, price });

    promises.push(
      cb({
        name: fullName,
        price,
        currency: "usd",
        volume,
        url: absoluteUrl(url, productUrl),
      }),
    );
  });

  await Promise.all(promises);
}

export default async function scrapeHealthySpirits() {
  await scrapePrices(
    SITE,
    (page) =>
      `https://www.healthyspirits.com/spirits/whiskey/page${page}.html?limit=72`,
    scrapeProducts,
  );
}
