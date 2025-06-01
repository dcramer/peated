import { ALLOWED_VOLUMES } from "@peated/server/constants";
import { normalizeBottle, normalizeVolume } from "@peated/server/lib/normalize";
import type { ScrapePricesCallback } from "@peated/server/lib/scraper";
import scrapePrices, { getUrl, parsePrice } from "@peated/server/lib/scraper";
import { absoluteUrl } from "@peated/server/lib/urls";
import { load as cheerio } from "cheerio";

const cookieValue =
  'priceBookisIsSet=true; persisted="{\\"address\\":\\"301 Mission St, San Francisco, CA 94105, USA\\",\\"address1\\":\\"301 Mission St\\",\\"city\\":\\"SF\\",\\"postalCode\\":\\"94105\\",\\"place_id\\":\\"ChIJ68ImfGOAhYARGxkajD7cq9M\\",\\"lat\\":\\"37.7904705\\",\\"long\\":\\"-122.3961641\\",\\"state_code\\":\\"CA\\",\\"is_gift\\":false}"';

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url, false, {
    Cookie: cookieValue,
  });
  const $ = cheerio(data);
  const promises: Promise<void>[] = [];

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

    promises.push(
      cb({
        name,
        price,
        currency: "usd",
        volume,
        // image,
        url: absoluteUrl(url, productUrl),
      })
    );
  });

  await Promise.all(promises);
}

export default async function scrapeReserveBar() {
  const limit = 36;

  await scrapePrices(
    "reservebar",
    (page) =>
      `https://www.reservebar.com/collections/whiskey?start=${page * limit}&sz=${limit}`,
    scrapeProducts
  );
}
