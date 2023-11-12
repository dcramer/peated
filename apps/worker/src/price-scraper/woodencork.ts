import { load as cheerio } from "cheerio";
import { getUrl } from "../scraper";

import {
  normalizeBottleName,
  normalizeVolume,
} from "@peated/server/lib/normalize";
import type { StorePrice } from "../lib/api";
import { submitStorePrices } from "../lib/api";
import { absoluteUrl, chunked, parsePrice } from "./utils";

function extractVolume(name: string) {
  const match = name.match(/^(.+)\s([\d.]+(?:ml|l))$/i);
  if (!match) return [name];
  return match.slice(1, 3);
}

function getLargestImage(srcset: string) {
  const srcList = srcset
    .split(", ")
    .map((data) => {
      const [src, size] = data.split(" ");
      return {
        src,
        size: parseInt(size.replace(/^[\d+]/, ""), 10),
      };
    })
    .sort((a, b) => b.size - a.size);
  return srcList.length ? srcList[0].src : null;
}

export async function scrapeProducts(
  url: string,
  cb: (product: StorePrice) => Promise<void>,
) {
  const data = await getUrl(url);
  const $ = cheerio(data);
  $("#CollectionAjaxContent div.grid-item").each((_, el) => {
    const bottle = $("div.grid-product__title", el).first().text();
    if (!bottle) {
      console.warn("Unable to identify Product Name");
      return;
    }

    const [nameRaw, volumeRaw] = extractVolume(bottle);
    const name = normalizeBottleName(nameRaw);

    const productUrl = $("a.grid-item__link", el).first().attr("href");
    if (!productUrl) throw new Error("Unable to identify Product URL");

    // XXX: WC seems to default to 750ml in listings
    const volume = volumeRaw ? normalizeVolume(volumeRaw) : 750;
    if (!volume) {
      console.warn(`Invalid size: ${volumeRaw}`);
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
      console.warn(`Invalid price: ${priceRaw}`);
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

    console.log(`${name} - ${(price / 100).toFixed(2)}`);

    cb({
      name,
      price,
      priceUnit: "USD",
      volume,
      // image,
      url: absoluteUrl(productUrl, url),
    });
  });
}

export async function main() {
  // TODO: support pagination
  const products: StorePrice[] = [];

  let hasProducts = true;
  let page = 1;
  while (hasProducts) {
    hasProducts = false;
    await scrapeProducts(
      `https://woodencork.com/collections/whiskey?cursor=${page}`,
      async (product) => {
        products.push(product);
        hasProducts = true;
      },
    );
    page += 1;
  }

  if (process.env.ACCESS_TOKEN) {
    console.log("Pushing new price data to API");

    chunked(products, 100, async (items) => await submitStorePrices(2, items));
  } else {
    console.log(`Dry Run Complete - ${products.length} products found`);
  }
}

if (typeof require !== "undefined" && require.main === module) {
  main();
}
