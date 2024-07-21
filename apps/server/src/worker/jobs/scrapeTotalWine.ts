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
  $("#main article").each((_, el) => {
    const rawName = $("h2.title__2RoYeYuO > a", el).first().text();
    if (!rawName) {
      console.warn("Unable to identify Product Name");
      return;
    }
    const { name } = normalizeBottleName({ name: rawName });

    const volumeRaw = $("h2.title__2RoYeYuO > span", el).first().text();
    const volume = volumeRaw ? normalizeVolume(volumeRaw) : null;
    if (!volume) {
      console.warn(`Invalid size: ${volumeRaw}`);
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
    cb({
      name,
      price,
      currency: "usd",
      volume,
      url: absoluteUrl(productUrl, url),
    });
  });
}

export default async function scrapeTotalWine() {
  const products: StorePrice[] = [];
  await scrapeProducts(
    "https://www.totalwine.com/spirits/scotch/c/000887?viewall=true&pageSize=120&aty=0,0,0,0",
    async (product) => {
      products.push(product);
    },
  );

  await scrapeProducts(
    "https://www.totalwine.com/spirits/whiskey/c/9238919?viewall=true&pageSize=120&aty=0,0,0,0",
    async (product) => {
      products.push(product);
    },
  );

  if (process.env.ACCESS_TOKEN) {
    console.log("Pushing new price data to API");

    await chunked(
      products,
      100,
      async (items) =>
        await trpcClient.priceCreateBatch.mutate({
          site: "totalwine",
          prices: items,
        }),
    );
  } else {
    console.log(`Dry Run Complete - ${products.length} products found`);
  }
}
