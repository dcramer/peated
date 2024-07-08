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

    const [name] = normalizeBottleName(bottle.text());

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
      url: absoluteUrl(productUrl, url),
    });
  });
}

export default async function scrapeReserveBar() {
  // TODO: support pagination
  const products: Array<StorePrice> = [];
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
          products.push(product);
          hasProducts = true;
        }
        offset += 1;
      },
    );
  }

  if (process.env.ACCESS_TOKEN) {
    console.log("Pushing new price data to API");

    await chunked(
      products,
      100,
      async (items) =>
        await trpcClient.priceCreateBatch.mutate({
          site: "reservebar",
          prices: items,
        }),
    );
  } else {
    console.log(`Dry Run Complete - ${products.length} products found`);
  }
}
