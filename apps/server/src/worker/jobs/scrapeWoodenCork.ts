import {
  normalizeBottle,
  normalizeVolume,
} from "@peated/bottle-classifier/normalize";
import type { ScrapePricesCallback } from "@peated/server/lib/scraper";
import scrapePrices, { getUrl, parsePrice } from "@peated/server/lib/scraper";
import { absoluteUrl } from "@peated/server/lib/urls";
import { load as cheerio } from "cheerio";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "woodencork";

function extractVolume(name: string) {
  const match = name.match(/^(.+)\s([\d.]+(?:ml|l))$/i);
  if (!match) return [name];
  return match.slice(1, 3);
}

// function getLargestImage(srcset: string) {
//   const srcList = srcset
//     .split(", ")
//     .map((data) => {
//       const [src, size] = data.split(" ");
//       return {
//         src,
//         size: size ? parseInt(size.replace(/^[\d+]/, ""), 10) : 0,
//       };
//     })
//     .sort((a, b) => b.size - a.size);
//   return srcList.length ? srcList[0].src : null;
// }

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url);
  const $ = cheerio(data);

  const promises: Promise<void>[] = [];
  $("#CollectionAjaxContent div.grid-item").each((_, el) => {
    const bottle = $("div.grid-product__title", el).first().text();
    if (!bottle) {
      logScrapeWarning(SITE, "Unable to identify product name");
      return;
    }

    const [nameRaw, volumeRaw] = extractVolume(bottle);
    const { name } = normalizeBottle({ name: nameRaw });

    const productUrl = $("a.grid-item__link", el).first().attr("href");
    if (!productUrl) throw new Error("Unable to identify Product URL");

    // XXX: WC seems to default to 750ml in listings
    const volume = volumeRaw ? normalizeVolume(volumeRaw) : 750;
    if (!volume) {
      logScrapeWarning(SITE, "Invalid product size", { volumeRaw });
      return;
    }

    if (volume < 500) {
      logScrapeWarning(SITE, "Invalid product size", { volume });
      return;
    }

    const priceRaw = $(
      "span.grid-product__price--current > span.visually-hidden",
      el,
    )
      .first()
      .text();
    const price = parsePrice(priceRaw);
    if (!price) {
      logScrapeWarning(SITE, "Invalid product price", { priceRaw });
      return;
    }

    // 'data-src': '//cdn.shopify.com/s/files/1/0276/1621/5176/products/bushmills-peeky-blinders_{width}x.png?v=1653415529',
    // 'data-widths': '[160, 200, 280, 360, 540, 720, 900]',

    // const img = $("div.grid-product__image-wrap img", el).first();

    // const imgSrc = img.attr("data-src");
    // const imgWidths = img.attr("data-widths");
    // const image =
    //   imgSrc && imgWidths
    //     ? imgSrc.replace("{width}", JSON.parse(imgWidths).slice(-1))
    //     : null;

    logScrapedProduct(SITE, { name, price });

    promises.push(
      cb({
        name,
        price,
        currency: "usd",
        volume,
        // image,
        url: absoluteUrl(url, productUrl),
      }),
    );
  });

  await Promise.all(promises);
}

export default async function scrapeWoodenCork() {
  await scrapePrices(
    SITE,
    (page) => `https://woodencork.com/collections/whiskey?cursor=${page}`,
    scrapeProducts,
  );
}
