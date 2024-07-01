import {
  normalizeBottleName,
  normalizeVolume,
} from "@peated/server/lib/normalize";
import type { StorePrice } from "@peated/server/lib/scraper";
import {
  absoluteUrl,
  chunked,
  getUrl,
  parsePrice,
} from "@peated/server/lib/scraper";
import { trpcClient } from "@peated/server/lib/trpc/server";
import { load as cheerio } from "cheerio";

export async function scrapeProducts(
  url: string,
  cb: (product: StorePrice) => Promise<void>,
) {
  const data = await getUrl(url);
  const $ = cheerio(data);
  $("#search-results .item-teaser").each((_, el) => {
    const rawName = ($(".header > h2", el).first().attr("title") || "").trim();
    if (!rawName) {
      console.warn("Unable to identify Product Name");
      return;
    }

    const [name] = normalizeBottleName(rawName);

    const productUrl = $("a.item-name", el).first().attr("href");
    if (!productUrl) throw new Error("Unable to identify Product URL");

    const volumeRaw = $(".teaser__item__meta__2 > div").last().text();
    const volume = volumeRaw ? normalizeVolume(volumeRaw) : null;
    if (!volume) {
      console.warn(`Invalid size: ${volumeRaw}`);
      return;
    }

    const priceRaw = $("span.price-bottle.display-2", el).first().text().trim();
    const price = parsePrice(priceRaw);
    if (!price) {
      console.warn(`Invalid price: ${priceRaw}`);
      return;
    }
    console.log(`${name} - ${(price / 100).toFixed(2)}`);

    cb({
      name,
      price,
      currency: "usd",
      volume,
      url: absoluteUrl(productUrl, url),
    });
  });
}

export default async function scrapeAstorWines() {
  // TODO: support pagination
  const products: StorePrice[] = [];

  const uniqueProducts = new Set();

  let hasProducts = true;
  let page = 1;
  while (hasProducts) {
    hasProducts = false;
    await scrapeProducts(
      `https://www.astorwines.com/SpiritsSearchResult.aspx?search=Advanced&searchtype=Contains&term=&cat=2&style=3_41&srt=1&instockonly=True&Page=${page}`,
      async (product) => {
        if (uniqueProducts.has(product.name)) return;
        products.push(product);
        uniqueProducts.add(product.name);
        hasProducts = true;
      },
    );
    page += 1;
  }

  hasProducts = true;
  page = 1;
  while (hasProducts) {
    hasProducts = false;
    await scrapeProducts(
      `https://www.astorwines.com/SpiritsSearchResult.aspx?search=Advanced&searchtype=Contains&term=&cat=2&style=2_32&srt=1&instockonly=True&Page=${page}`,
      async (product) => {
        if (uniqueProducts.has(product.name)) return;
        products.push(product);
        uniqueProducts.add(product.name);
        hasProducts = true;
      },
    );
    page += 1;
  }

  if (process.env.ACCESS_TOKEN) {
    console.log("Pushing new price data to API");
    await chunked(
      products,
      100,
      async (items) =>
        await trpcClient.priceCreateBatch.mutate({
          site: "astorwines",
          prices: items,
        }),
    );
  } else {
    console.log(`Dry Run Complete - ${products.length} products found`);
  }
}
