import { load as cheerio } from "cheerio";
import { getUrl } from "../scraper";

import { normalizeBottleName } from "@peated/shared/lib/normalize";
import { toTitleCase } from "@peated/shared/lib/strings";

import { submitStorePrices } from "../api";
import { absoluteUrl, chunked, parsePrice } from "./utils";

type Product = {
  name: string;
  price: number;
  priceUnit: "USD";
  url: string;
};

function removeSize(name: string) {
  return name.replace(/ [\d]+ml$/i, "");
}

async function scrapeProducts(
  url: string,
  cb: (product: Product) => Promise<void>,
) {
  const data = await getUrl(url);
  const $ = cheerio(data);
  $(".collection-products-row .product-block").each((_, el) => {
    const brand = $("div.brand", el).first().text().trim();
    const bottle = $("a.title", el).first().text().trim();
    if (!bottle || !brand) {
      console.warn("Unable to identify Product Name");
      return;
    }
    const name = toTitleCase(`${brand} ${bottle}`);
    const productUrl = $("a.title", el).first().attr("href");
    if (!productUrl) throw new Error("Unable to identify Product URL");
    const price = parsePrice(
      $("div.product-block-price > strong", el).first().text().trim(),
    );
    if (!price) {
      console.warn("Invalid price value");
      return;
    }
    cb({
      name: removeSize(normalizeBottleName(name)),
      price,
      priceUnit: "USD",
      url: absoluteUrl(productUrl, url),
    });
  });
}

export async function main() {
  // TODO: support pagination
  const products: Product[] = [];

  const uniqueProducts = new Set();

  let hasProducts = true;
  let page = 1;
  while (hasProducts) {
    hasProducts = false;
    await scrapeProducts(
      `https://www.healthyspirits.com/spirits/whiskey/page${page}.html?limit=72`,
      async (product: Product) => {
        console.log(`${product.name} - ${(product.price / 100).toFixed(2)}`);
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
    chunked(products, 100, async (items) => await submitStorePrices(4, items));
  } else {
    console.log(`Dry Run Complete - ${products.length} products found`);
  }
}

if (typeof require !== "undefined" && require.main === module) {
  main();
}
