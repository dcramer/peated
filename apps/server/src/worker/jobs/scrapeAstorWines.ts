import { ALLOWED_VOLUMES } from "@peated/server/constants";
import { normalizeBottle, normalizeVolume } from "@peated/server/lib/normalize";
import scrapePrices, { getUrl, parsePrice } from "@peated/server/lib/scraper";
import { absoluteUrl } from "@peated/server/lib/urls";
import type { StorePriceInputSchema } from "@peated/server/schemas";
import { load as cheerio } from "cheerio";
import type { z } from "zod";

export async function scrapeProducts(
  url: string,
  cb: (product: z.infer<typeof StorePriceInputSchema>) => Promise<void>,
) {
  const data = await getUrl(url);
  const $ = cheerio(data);
  $("#search-results .item-teaser").each((_, el) => {
    const rawName = ($(".header > h2", el).first().attr("title") || "").trim();
    if (!rawName) {
      console.warn("Unable to identify Product Name");
      return;
    }

    const { name } = normalizeBottle({ name: rawName });

    const productUrl = $("a.item-name", el).first().attr("href");
    if (!productUrl) throw new Error("Unable to identify Product URL");

    const volumeRaw = $(".teaser__item__meta__2 > div").last().text();
    const volume = volumeRaw ? normalizeVolume(volumeRaw) : null;
    if (!volume) {
      console.warn(`Invalid size: ${volumeRaw}`);
      return;
    }

    if (!ALLOWED_VOLUMES.includes(volume)) {
      console.warn(`Invalid size: ${volume}`);
      return;
    }

    const priceRaw = $("span.price-bottle.display-2", el).first().text().trim();
    const price = parsePrice(priceRaw);
    if (!price) {
      console.warn(`Invalid price: ${priceRaw}`);
      return;
    }

    const imageUrl = $(".item-image img", el).first().attr("src")?.trim();

    console.log(`${name} - ${(price / 100).toFixed(2)}`);

    cb({
      name,
      price,
      currency: "usd",
      volume,
      url: absoluteUrl(url, productUrl),
      imageUrl: imageUrl ? absoluteUrl(url, imageUrl) : null,
    });
  });
}

export default async function scrapeAstorWines() {
  await scrapePrices(
    "astorwines",
    (page) =>
      `https://www.astorwines.com/SpiritsSearchResult.aspx?search=Advanced&searchtype=Contains&term=&cat=2&style=3_41&srt=1&instockonly=True&Page=${page}`,
    scrapeProducts,
  );

  await scrapePrices(
    "astorwines",
    (page) =>
      `https://www.astorwines.com/SpiritsSearchResult.aspx?search=Advanced&searchtype=Contains&term=&cat=2&style=2_32&srt=1&instockonly=True&Page=${page}`,
    scrapeProducts,
  );
}
