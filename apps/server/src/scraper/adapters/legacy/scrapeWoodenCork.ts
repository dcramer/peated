import {
  normalizeBottle,
  normalizeVolume,
} from "@peated/bottle-classifier/normalize";
import { absoluteUrl } from "@peated/server/lib/urls";
import { load as cheerio } from "cheerio";
import type { ScrapePricesCallback, StorePrice } from "../../legacy/scraper";
import scrapePrices, { getUrl, parsePrice } from "../../legacy/scraper";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "woodencork";
const PRODUCT_CARD_SELECTOR =
  "#CollectionAjaxContent div.grid-item, .collection-grid .product-grid-item";

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
  const cards = $(PRODUCT_CARD_SELECTOR);
  cards.each((_, el) => {
    const externalProductId = $(el).attr("data-product-id")?.trim();
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

    const listing: StorePrice = {
      name,
      price,
      currency: "usd",
      volume,
      // image,
      url: absoluteUrl("https://woodencork.com", productUrl),
    };
    if (externalProductId) listing.externalProductId = externalProductId;
    promises.push(cb(listing));
  });

  await Promise.all(promises);
  return {
    hasNextPage:
      $('link[rel="next"]').length > 0 || $(".pagination .next a").length > 0,
  };
}

export default async function scrapeWoodenCork({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return scrapePrices(
    SITE,
    (page) => `https://woodencork.com/collections/whiskey?cursor=${page}`,
    scrapeProducts,
    { dryRun },
  );
}
