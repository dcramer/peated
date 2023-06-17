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
  $("#main article").each(async (_, el) => {
    const name = $("h2.title__2RoYeYuO > a", el).first().text();
    if (!name) throw new Error("Unable to identify Product Name");
    const productUrl = $("h2.title__2RoYeYuO > a", el).first().attr("href");
    if (!productUrl) throw new Error("Unable to identify Product URL");
    const price = parsePrice($("span.price__1JvDDp_x", el).first().text());
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
  const products: Product[] = [];
  await scrapeProducts(
    "https://www.totalwine.com/spirits/scotch/c/000887?viewall=true&pageSize=120&aty=0,0,0,0",
    async (product: Product) => {
      products.push(product);
    },
  );

  await scrapeProducts(
    "https://www.totalwine.com/spirits/whiskey/c/9238919?viewall=true&pageSize=120&aty=0,0,0,0",
    async (product: Product) => {
      products.push(product);
    },
  );

  if (process.env.ACCESS_TOKEN) {
    await submitStorePrices(1, products);
  } else {
    console.log(`Dry Run Complete - ${products.length} products found`);
  }
}

if (typeof require !== "undefined" && require.main === module) {
  main();
}
