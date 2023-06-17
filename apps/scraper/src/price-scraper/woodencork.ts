import { load as cheerio } from "cheerio";
import { getUrl } from "../scraper";

import { normalizeBottleName } from "@peated/shared/lib/normalize";

import { submitStorePrices } from "../api";
import { absoluteUrl, chunked, parsePrice } from "./utils";

type Product = {
  name: string;
  price: number;
  priceUnit: "USD";
  url: string;
};

async function scrapeProducts(
  url: string,
  cb: (product: Product) => Promise<void>,
) {
  const data = await getUrl(url);
  const $ = cheerio(data);
  $("#CollectionAjaxContent div.grid-item").each(async (_, el) => {
    const name = $("div.grid-product__title", el).first().text();
    if (!name) {
      console.warn("Unable to identify Product Name");
      return;
    }
    const productUrl = $("a.grid-item__link", el).first().attr("href");
    if (!productUrl) throw new Error("Unable to identify Product URL");
    const price = parsePrice(
      $("span.grid-product__price--current > span.visually-hidden", el)
        .first()
        .text(),
    );
    if (!price) {
      console.warn(
        `Invalid price value: ${$(
          "span.grid-product__price--current > span.visually-hidden",
          el,
        )
          .first()
          .text()}`,
      );
      return;
    }
    console.log(`${name} - ${(price / 100).toFixed(2)}`);

    cb({
      name: normalizeBottleName(name),
      price,
      priceUnit: "USD",
      url: absoluteUrl(productUrl, url),
    });
  });
}

export async function main() {
  // TODO: support pagination
  const products: Product[] = [];

  let hasProducts = true;
  let page = 1;
  while (hasProducts) {
    hasProducts = false;
    await scrapeProducts(
      `https://woodencork.com/collections/whiskey?page=${page}`,
      async (product: Product) => {
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
