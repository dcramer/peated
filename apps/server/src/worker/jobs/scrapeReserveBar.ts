import {
  ALLOWED_VOLUMES,
  SCRAPER_PRICE_BATCH_SIZE,
} from "@peated/server/constants";
import BatchQueue from "@peated/server/lib/batchQueue";
import { normalizeBottle, normalizeVolume } from "@peated/server/lib/normalize";
import type { StorePrice } from "@peated/server/lib/scraper";
import { getUrl, parsePrice } from "@peated/server/lib/scraper";
import { trpcClient } from "@peated/server/lib/trpc/server";
import { absoluteUrl } from "@peated/server/lib/urls";
import { load as cheerio } from "cheerio";

const cookieValue =
  'priceBookisIsSet=true; persisted="{\\"address\\":\\"301 Mission St, San Francisco, CA 94105, USA\\",\\"address1\\":\\"301 Mission St\\",\\"city\\":\\"SF\\",\\"postalCode\\":\\"94105\\",\\"place_id\\":\\"ChIJ68ImfGOAhYARGxkajD7cq9M\\",\\"lat\\":\\"37.7904705\\",\\"long\\":\\"-122.3961641\\",\\"state_code\\":\\"CA\\",\\"is_gift\\":false}"';

export async function scrapeProducts(
  url: string,
  cb: (product: StorePrice) => Promise<void>,
) {
  const data = await getUrl(url, false, {
    Cookie: cookieValue,
  });
  const $ = cheerio(data);
  $(".product-grid .b-product-grid__item").each((_, el) => {
    const bottle = $("div.pdp-link > a", el).first();
    if (!bottle) {
      console.warn("Unable to identify Product Name");
      return;
    }

    const productUrl = bottle.attr("href");
    if (!productUrl) {
      console.warn("Unable to identify Product URL");
      return;
    }

    const { name } = normalizeBottle({ name: bottle.text() });

    const volumeRaw = $(".product-tile__volume", el).first().text();
    if (!volumeRaw) {
      console.warn("Unable to identify Product Volume");
      return;
    }

    const volume = volumeRaw ? normalizeVolume(volumeRaw) : 750;
    if (!volume) {
      console.warn(`Invalid size: ${volumeRaw}`);
      return;
    }

    if (!ALLOWED_VOLUMES.includes(volume)) {
      console.warn(`Invalid size: ${volume}`);
      return;
    }

    const priceRaw = $(".sales > .value", el).first().text();
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
      // image,
      url: absoluteUrl(url, productUrl),
    });
  });
}

export default async function scrapeReserveBar() {
  // TODO: support pagination
  const workQueue = new BatchQueue<StorePrice>(
    SCRAPER_PRICE_BATCH_SIZE,
    async (items) => {
      console.log("Pushing new price data to API");
      await trpcClient.priceCreateBatch.mutate({
        site: "reservebar",
        prices: items,
      });
    },
  );
  const productNames: Set<string> = new Set();

  const limit = 36;

  let hasProducts = true;
  let offset = 0;
  while (hasProducts) {
    hasProducts = false;
    await scrapeProducts(
      `https://www.reservebar.com/collections/whiskey?start=${offset}&sz=${limit}`,
      async (product) => {
        if (!productNames.has(product.name)) {
          productNames.add(product.name);
          await workQueue.push(product);
          hasProducts = true;
        }
        offset += 1;
      },
    );
  }

  const products = Array.from(productNames.values());
  if (products.length === 0) {
    throw new Error("Failed to scrape any products.");
  }

  await workQueue.processRemaining();

  console.log(`Complete - ${products.length} products found`);
}
