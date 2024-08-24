import {
  ALLOWED_VOLUMES,
  SCRAPER_PRICE_BATCH_SIZE,
} from "@peated/server/constants";
import BatchQueue from "@peated/server/lib/batchQueue";
import { normalizeBottle, normalizeVolume } from "@peated/server/lib/normalize";
import type { StorePrice } from "@peated/server/lib/scraper";
import { chunked, getUrl, parsePrice } from "@peated/server/lib/scraper";
import { trpcClient } from "@peated/server/lib/trpc/server";
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
  const uniqueProducts = new Set();

  const workQueue = new BatchQueue<StorePrice>(
    SCRAPER_PRICE_BATCH_SIZE,
    async (items) => {
      console.log("Pushing new price data to API");
      await trpcClient.priceCreateBatch.mutate({
        site: "astorwines",
        prices: items,
      });
    },
  );

  let hasProducts = true;
  let page = 1;
  while (hasProducts) {
    hasProducts = false;
    await scrapeProducts(
      `https://www.astorwines.com/SpiritsSearchResult.aspx?search=Advanced&searchtype=Contains&term=&cat=2&style=3_41&srt=1&instockonly=True&Page=${page}`,
      async (product) => {
        if (uniqueProducts.has(product.name)) return;
        await workQueue.push(product);
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
        await workQueue.push(product);
        uniqueProducts.add(product.name);
        hasProducts = true;
      },
    );
    page += 1;
  }

  const products = Array.from(uniqueProducts.values());
  if (products.length === 0) {
    throw new Error("Failed to scrape any products.");
  }

  await workQueue.processRemaining();

  console.log(`Complete - ${products.length} products found`);
}
