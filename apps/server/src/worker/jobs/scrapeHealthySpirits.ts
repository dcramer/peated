import { ALLOWED_VOLUMES } from "@peated/server/constants";
import { normalizeBottle, normalizeVolume } from "@peated/server/lib/normalize";
import type { ScrapePricesCallback } from "@peated/server/lib/scraper";
import scrapePrices, { getUrl, parsePrice } from "@peated/server/lib/scraper";
import { toTitleCase } from "@peated/server/lib/strings";
import { absoluteUrl } from "@peated/server/lib/urls";
import { load as cheerio } from "cheerio";

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
      console.warn("Unable to identify Product Name");
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
      console.warn(`Invalid size: ${volumeRaw}`);
      return;
    }

    if (!ALLOWED_VOLUMES.includes(volume)) {
      console.warn(`Invalid size: ${volume}`);
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
      console.warn(`Invalid price: ${priceRaw}`);
      return;
    }

    const fullName = `${brand} ${name}`;
    console.log(`${fullName} - ${(price / 100).toFixed(2)}`);

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
    "healthyspirits",
    (page) =>
      `https://www.healthyspirits.com/spirits/whiskey/page${page}.html?limit=72`,
    scrapeProducts,
  );
}
