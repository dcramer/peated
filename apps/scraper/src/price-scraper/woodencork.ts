// Products:
//     css: article.productCard__2nWxIKmi
//     multiple: true
//     type: Text
//     children:
//         Price:
//             css: span.price__1JvDDp_x
//             type: Text
//         Name:
//             css: 'h2.title__2RoYeYuO a'
//             type: Text
//         Size:
//             css: 'h2.title__2RoYeYuO span'
//             type: Text
//         InStock:
//             css: 'p:nth-of-type(1) span.message__IRMIwVd1'
//             type: Text
//         URL:
//             css: 'h2.title__2RoYeYuO a'
//             type: Link
//         DeliveryAvailable:
//             css: 'p:nth-of-type(2) span.message__IRMIwVd1'
//             type: Text

import { load as cheerio } from "cheerio";
import { getUrl } from "../scraper";

import { normalizeBottleName } from "@peated/shared/lib/normalize";

import { submitStorePrices } from "../api";

type Product = {
  name: string;
  price: number;
  priceUnit: "USD";
  url: string;
};

function absoluteUrl(url: string, baseUrl: string) {
  if (url.indexOf("/") !== 0) return url;
  const urlParts = new URL(baseUrl);
  return `${urlParts.origin}${url};`;
}

function removeBottleSize(name: string) {
  return name.replace(/\([^)]+\)$/, "");
}

function parsePrice(value: string) {
  // $XX.YY
  if (value.indexOf("$") !== 0)
    throw new Error(`Invalid price value: ${value}`);

  return parseInt(value.substring(1).split(".").join(""), 10);
}

async function scrapeProducts(
  url: string,
  cb: (product: Product) => Promise<void>,
) {
  const data = await getUrl(url);
  const $ = cheerio(data);
  $("div.grid-item").each(async (_, el) => {
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
    console.log(name);
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
  await scrapeProducts(
    "https://woodencork.com/search?type=product&options%5Bprefix%5D=last&q=*&filter.p.product_type=Scotch",
    async (product: Product) => {
      products.push(product);
    },
  );

  await scrapeProducts(
    "https://woodencork.com/search?type=product&options%5Bprefix%5D=last&q=*&filter.p.product_type=Whiskey",
    async (product: Product) => {
      products.push(product);
    },
  );

  if (process.env.ACCESS_TOKEN) {
    await submitStorePrices(2, products);
  } else {
    console.log("DRY RUN");
    console.log(`- ${products.length} products found`);
  }
}

if (typeof require !== "undefined" && require.main === module) {
  main();
}
