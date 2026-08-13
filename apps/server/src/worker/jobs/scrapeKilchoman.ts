import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import type {
  ScrapePricesCallback,
  StorePrice,
} from "@peated/server/lib/scraper";
import scrapePrices, { getUrl } from "@peated/server/lib/scraper";
import { absoluteUrl } from "@peated/server/lib/urls";
import { load as cheerio } from "cheerio";
import { z } from "zod";
import { logScrapedProduct } from "./scrapeLogging";

const SITE = "kilchoman";
const SHOP_URL = "https://www.kilchomandistillery.com/whisky-shop/";
const DEFAULT_VOLUME = 700;

const KilchomanProductSchema = z.object({
  rawName: z.string().trim().min(1),
  priceRaw: z.string().trim().min(1),
  url: z.string().url(),
  imageUrl: z.string().url(),
});

function parsePrice(value: string): number | null {
  const match = value.match(/^£([\d,]+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const pounds = Number.parseInt(match[1].replaceAll(",", ""), 10);
  const pence = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10) || 0;
  const price = pounds * 100 + pence;
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function extractBackgroundUrl(style: string): string | null {
  return (
    style.match(
      /background(?:-image)?\s*:\s*url\(["']?([^"')]+)["']?\)/i,
    )?.[1] ?? null
  );
}

export function parseKilchomanProducts(
  html: string,
  sourceUrl: string,
): StorePrice[] {
  const $ = cheerio(html);
  const products: StorePrice[] = [];

  $("ul.grid-products > li.product").each((_, element) => {
    const card = $(element);
    if (card.hasClass("product_soldout")) return;

    const rawName = card.find("h3").first().text().trim();
    if (/\bgift\s*pack\b/i.test(rawName)) return;

    const productUrl = card
      .find('a[href*="/our-whisky/"]')
      .first()
      .attr("href");
    const imageStyle = card.find(".img_place").first().attr("style") ?? "";
    const imageUrl = extractBackgroundUrl(imageStyle);
    const priceRaw = card.find(".sm-details strong").first().text().trim();

    const product = KilchomanProductSchema.parse({
      rawName,
      priceRaw,
      url: productUrl ? absoluteUrl(sourceUrl, productUrl) : productUrl,
      imageUrl: imageUrl ? absoluteUrl(sourceUrl, imageUrl) : imageUrl,
    });
    const price = parsePrice(product.priceRaw);
    if (price === null) {
      throw new Error(`Invalid Kilchoman product price: ${product.priceRaw}`);
    }

    const { name } = normalizeBottle({ name: `Kilchoman ${product.rawName}` });
    const listing = {
      name,
      price,
      currency: "gbp" as const,
      volume: DEFAULT_VOLUME,
      url: product.url,
      imageUrl: product.imageUrl,
    };

    logScrapedProduct(SITE, listing);
    products.push(listing);
  });

  return products;
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url);
  const products = parseKilchomanProducts(data, url);
  await Promise.all(products.map(cb));
}

export default async function scrapeKilchoman({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  await scrapePrices(SITE, () => SHOP_URL, scrapeProducts, { dryRun });
}
