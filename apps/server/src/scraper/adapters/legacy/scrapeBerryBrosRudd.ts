import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import { absoluteUrl } from "@peated/server/lib/urls";
import { load as cheerio } from "cheerio";
import type { ScrapePricesCallback, StorePrice } from "../../legacy/scraper";
import scrapePrices, { getUrl } from "../../legacy/scraper";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "berrybrosrudd";
const STORE_ORIGIN = "https://www.bbr.com";
const PRODUCT_CARD_SELECTOR = 'div.sf-product-card[data-testid="product-card"]';

function parsePrice(value: string): number | null {
  const match = value.match(/£\s*([\d,]+)(?:\.(\d{1,2}))?/);
  if (!match) return null;

  const pounds = Number.parseInt(match[1].replaceAll(",", ""), 10);
  const pence = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10) || 0;
  const price = pounds * 100 + pence;
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function parseVolume(value: string): number | null {
  const match = value.match(/\b(\d+(?:\.\d+)?)\s*(ml|cl|l)\b/i);
  if (!match) return null;

  const amount = Number.parseFloat(match[1]);
  const volume =
    match[2].toLowerCase() === "cl"
      ? amount * 10
      : match[2].toLowerCase() === "l"
        ? amount * 1000
        : amount;

  return Number.isInteger(volume) ? volume : null;
}

export function parseBerryBrosRuddPage(
  html: string,
  sourceUrl: string,
): { products: StorePrice[]; hasSourceProducts: boolean } {
  const $ = cheerio(html);
  const products: StorePrice[] = [];
  const cards = $(PRODUCT_CARD_SELECTOR);

  cards.each((_, element) => {
    const card = $(element);
    const rawName = card.find("span.body--strong").first().text().trim();
    const action = card.find("button.add-item").first().text().trim();

    if (action.toLowerCase() !== "add to basket") {
      logScrapeWarning(SITE, "Product is not purchasable", { rawName });
      return;
    }

    if (!rawName) {
      logScrapeWarning(SITE, "Unable to identify product name");
      return;
    }

    const productUrl = card
      .find('[data-testid="product-link"]')
      .first()
      .attr("href");
    if (!productUrl) {
      logScrapeWarning(SITE, "Unable to identify product URL", { rawName });
      return;
    }

    const priceRaw = card.find("span.sf-price__regular").first().text().trim();
    const price = parsePrice(priceRaw);
    if (price === null) {
      logScrapeWarning(SITE, "Invalid product price", { priceRaw, rawName });
      return;
    }

    const volumeRaw = card
      .find("span.body--default")
      .toArray()
      .map((node) => $(node).text().trim())
      .find((value) => parseVolume(value) !== null);
    const volume = volumeRaw ? parseVolume(volumeRaw) : null;
    if (volume === null || !ALLOWED_VOLUMES.includes(volume)) {
      logScrapeWarning(SITE, "Invalid product size", {
        rawName,
        volume,
        volumeRaw,
      });
      return;
    }

    const image = card
      .find('[data-testid="image-wrapper"] img.sf-image')
      .first();
    const imageUrl = image.attr("src") ?? image.attr("data-src");
    const { name } = normalizeBottle({ name: rawName });
    const listing = {
      name,
      price,
      currency: "gbp" as const,
      volume,
      url: absoluteUrl(sourceUrl, productUrl),
      imageUrl: imageUrl ? absoluteUrl(sourceUrl, imageUrl) : null,
    };

    logScrapedProduct(SITE, listing);
    products.push(listing);
  });

  return { products, hasSourceProducts: cards.length > 0 };
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url);
  const { products, hasSourceProducts } = parseBerryBrosRuddPage(data, url);
  await Promise.all(products.map(cb));
  return { hasSourceProducts };
}

export default async function scrapeBerryBrosRudd({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return await scrapePrices(
    SITE,
    (page) =>
      `${STORE_ORIGIN}/search?page=${page}&spirit_type=Scotch%20Whisky&own_selection=true`,
    scrapeProducts,
    { dryRun },
  );
}
