import { load as cheerio } from "cheerio";
import { getUrl } from "../scraper";

import { normalizeBottleName } from "@peated/shared/lib/normalize";

import { submitStorePrices } from "../api";
import { absoluteUrl, parsePrice } from "./utils";

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
  $("#search-results .item-teaser").each(async (_, el) => {
    const name = $(".header > h2", el).first().attr("title").trim();
    if (!name) {
      console.warn("Unable to identify Product Name");
      return;
    }
    const productUrl = $("a.item-name", el).first().attr("href");
    if (!productUrl) throw new Error("Unable to identify Product URL");
    const price = parsePrice(
      $("span.price-bottle.display-2", el).first().text().trim(),
    );
    if (!price) {
      console.warn("Invalid price value");
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
      `https://www.astorwines.com/SpiritsSearchResult.aspx?search=Advanced&searchtype=Contains&term=&cat=2&style=3_41&srt=1&instockonly=True&Page=${page}`,
      async (product: Product) => {
        products.push(product);
        hasProducts = true;
      },
    );
    page += 1;
  }

  if (process.env.ACCESS_TOKEN) {
    await submitStorePrices(3, products);
  } else {
    console.log(`Dry Run Complete - ${products.length} products found`);
  }
}

if (typeof require !== "undefined" && require.main === module) {
  main();
}
