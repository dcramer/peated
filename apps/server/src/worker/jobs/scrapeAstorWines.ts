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

const SITE = "astorwines";

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url);
  const $ = cheerio(data);

  const promises: Promise<void>[] = [];
  $("#search-results .item-teaser").each((_, el) => {
    const rawName = ($(".header > h2", el).first().attr("title") || "").trim();
    if (!rawName) {
      logScrapeWarning(SITE, "Unable to identify product name");
      return;
    }

    const { name } = normalizeBottle({ name: rawName });

    const productUrl = $("a.item-name", el).first().attr("href");
    if (!productUrl) throw new Error("Unable to identify Product URL");

    const volumeRaw = $(".teaser__item__meta__2 > div", el).last().text();
    const volume = volumeRaw ? normalizeVolume(volumeRaw) : null;
    if (!volume) {
      logScrapeWarning(SITE, "Invalid product size", { volumeRaw });
      return;
    }

    if (!ALLOWED_VOLUMES.includes(volume)) {
      logScrapeWarning(SITE, "Invalid product size", { volume });
      return;
    }

    const priceRaw = $("span.price-bottle.display-2", el).first().text().trim();
    const price = parsePrice(priceRaw);
    if (!price) {
      logScrapeWarning(SITE, "Invalid product price", { priceRaw });
      return;
    }

    const imageUrl = $(".item-image img", el).first().attr("src")?.trim();

    logScrapedProduct(SITE, { name, price });

    promises.push(
      cb({
        name,
        price,
        currency: "usd",
        volume,
        url: absoluteUrl(url, productUrl),
        imageUrl: imageUrl ? absoluteUrl(url, imageUrl) : null,
      }),
    );
  });

  await Promise.all(promises);
}

export default async function scrapeAstorWines() {
  await scrapePrices(
    SITE,
    (page) =>
      `https://www.astorwines.com/SpiritsSearchResult.aspx?search=Advanced&searchtype=Contains&term=&cat=2&style=3_41&srt=1&instockonly=True&Page=${page}`,
    scrapeProducts,
  );

  await scrapePrices(
    SITE,
    (page) =>
      `https://www.astorwines.com/SpiritsSearchResult.aspx?search=Advanced&searchtype=Contains&term=&cat=2&style=2_32&srt=1&instockonly=True&Page=${page}`,
    scrapeProducts,
  );
}
