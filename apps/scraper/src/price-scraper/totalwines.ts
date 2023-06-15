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
  $("#main article").each(async (_, el) => {
    const name = $("h2.title__2RoYeYuO > a", el).first().text();
    if (!name) throw new Error("Unable to identify Product Name");
    const productUrl = $("h2.title__2RoYeYuO > a", el).first().attr("href");
    if (!productUrl) throw new Error("Unable to identify Product URL");
    const price = parsePrice($("span.price__1JvDDp_x", el).first().text());
    cb({
      name: normalizeBottleName(name),
      price,
      priceUnit: "USD",
      url: absoluteUrl(productUrl, url),
    });
  });
}

export async function main() {
  const products: Product[] = [];
  await scrapeProducts(
    "https://www.totalwine.com/spirits/scotch/single-malt/c/000887?viewall=true&pageSize=120&aty=0,0,0,0",
    async (product: Product) => {
      products.push(product);
    },
  );
  console.log(products);
}

if (typeof require !== "undefined" && require.main === module) {
  main();
}
