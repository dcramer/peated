import {
  normalizeBottle,
  normalizeVolume,
} from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import type { ScrapePricesCallback } from "@peated/server/lib/scraper";
import scrapePrices, { getUrl, parsePrice } from "@peated/server/lib/scraper";
import { absoluteUrl } from "@peated/server/lib/urls";
import { load as cheerio } from "cheerio";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "totalwine";

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url);
  const $ = cheerio(data);

  const promises: Promise<void>[] = [];
  $("#main article").each((_, el) => {
    const rawName = $("h2.title__2RoYeYuO > a", el).first().text();
    if (!rawName) {
      logScrapeWarning(SITE, "Unable to identify product name");
      return;
    }
    const { name } = normalizeBottle({ name: rawName });

    const volumeRaw = $("h2.title__2RoYeYuO > span", el).first().text();
    const volume = volumeRaw ? normalizeVolume(volumeRaw) : null;
    if (!volume) {
      logScrapeWarning(SITE, "Invalid product size", { volumeRaw });
      return;
    }

    if (!ALLOWED_VOLUMES.includes(volume)) {
      logScrapeWarning(SITE, "Invalid product size", { volume });
      return;
    }

    const productUrl = $("h2.title__2RoYeYuO > a", el).first().attr("href");
    if (!productUrl) throw new Error("Unable to identify Product URL");

    const priceRaw =
      $("span.price__1JvDDp_x span.price__1JvDDp_x", el).first().text() ||
      $("span.price__1JvDDp_x", el).first().text();
    const price = parsePrice(priceRaw);
    if (!price) {
      logScrapeWarning(SITE, "Invalid product price", { priceRaw });
      return;
    }
    logScrapedProduct(SITE, { name, price });
    promises.push(
      cb({
        name,
        price,
        currency: "usd",
        volume,
        url: absoluteUrl(url, productUrl),
      }),
    );
  });

  await Promise.all(promises);
}

export default async function scrapeTotalWine() {
  await scrapePrices(
    SITE,
    (page) =>
      `https://www.totalwine.com/spirits/scotch/c/000887?viewall=true&pageSize=120&aty=0,0,0,0&page=${page}`,
    scrapeProducts,
  );

  await scrapePrices(
    SITE,
    (page) =>
      `https://www.totalwine.com/spirits/whiskey/c/9238919?viewall=true&pageSize=120&aty=0,0,0,0&page=${page}`,
    scrapeProducts,
  );
}
