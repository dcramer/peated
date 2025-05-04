import { ALLOWED_VOLUMES } from "@peated/server/constants";
import { normalizeBottle, normalizeVolume } from "@peated/server/lib/normalize";
import type { ScrapePricesCallback } from "@peated/server/lib/scraper";
import scrapePrices, { getUrl, parsePrice } from "@peated/server/lib/scraper";
import { absoluteUrl } from "@peated/server/lib/urls";
import { load as cheerio } from "cheerio";

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url);
  const $ = cheerio(data);

  const promises: Promise<void>[] = [];
  $("#main article").each((_, el) => {
    const rawName = $("h2.title__2RoYeYuO > a", el).first().text();
    if (!rawName) {
      console.warn("Unable to identify Product Name");
      return;
    }
    const { name } = normalizeBottle({ name: rawName });

    const volumeRaw = $("h2.title__2RoYeYuO > span", el).first().text();
    const volume = volumeRaw ? normalizeVolume(volumeRaw) : null;
    if (!volume) {
      console.warn(`Invalid size: ${volumeRaw}`);
      return;
    }

    if (!ALLOWED_VOLUMES.includes(volume)) {
      console.warn(`Invalid size: ${volume}`);
      return;
    }

    const productUrl = $("h2.title__2RoYeYuO > a", el).first().attr("href");
    if (!productUrl) throw new Error("Unable to identify Product URL");

    const priceRaw =
      $("span.price__1JvDDp_x span.price__1JvDDp_x", el).first().text() ||
      $("span.price__1JvDDp_x", el).first().text();
    const price = parsePrice(priceRaw);
    if (!price) {
      console.warn(`Invalid price: ${priceRaw}`);
      return;
    }
    console.log(`${name} - ${(price / 100).toFixed(2)}`);
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
    "totalwine",
    (page) =>
      `https://www.totalwine.com/spirits/scotch/c/000887?viewall=true&pageSize=120&aty=0,0,0,0&page=${page}`,
    scrapeProducts,
  );

  await scrapePrices(
    "totalwine",
    (page) =>
      `https://www.totalwine.com/spirits/whiskey/c/9238919?viewall=true&pageSize=120&aty=0,0,0,0&page=${page}`,
    scrapeProducts,
  );
}
