import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { load as cheerio } from "cheerio";
import type { ScrapePricesCallback, StorePrice } from "../../legacy/scraper";
import scrapePrices, { getUrl } from "../../legacy/scraper";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "whiskyworld";
const STORE_ORIGIN = "https://www.thewhiskyworld.com";
const CATALOG_URL = `${STORE_ORIGIN}/whisky-c7/70cl-t24`;
const PRODUCT_CARD_SELECTOR =
  "#js-search-results-products__list .product[id^='product_']";
const MULTIPRODUCT_PATTERN =
  /\b(?:gift|tasting|miniature|collection)\s+(?:set|pack)\b|\bbundle\b|\badvent\s+calendar\b|\b\d+\s*(?:pack|pk)\b|\b\d+\s*(?:x|×)\s*\d+(?:\.\d+)?\s*(?:ml|cl|l)\b|\bset\s+of\s+\d+\b/i;

function parsePrice(value: string): number | null {
  const match = value.match(/^£\s*([\d,]+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const pounds = Number.parseInt(match[1].replaceAll(",", ""), 10);
  const pence = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10) || 0;
  const price = pounds * 100 + pence;
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function getOfficialUrl(
  value: string | undefined,
  { product = false }: { product?: boolean } = {},
): string | null {
  if (!value || value.startsWith("data:")) return null;

  try {
    const url = new URL(value, STORE_ORIGIN);
    if (
      url.protocol !== "https:" ||
      url.origin !== STORE_ORIGIN ||
      url.username ||
      url.password
    ) {
      return null;
    }
    if (product && !/-p\d+\/?$/.test(url.pathname)) return null;

    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function getImageUrl(
  image: ReturnType<ReturnType<typeof cheerio>>,
): string | null {
  const srcsetUrl = image
    .attr("srcset")
    ?.split(",", 1)[0]
    ?.trim()
    .split(/\s+/, 1)[0];
  const candidates = [image.attr("data-src"), image.attr("src"), srcsetUrl];

  for (const candidate of candidates) {
    const imageUrl = getOfficialUrl(candidate);
    if (imageUrl) return imageUrl;
  }
  return null;
}

function isMultiproduct(title: string): boolean {
  return MULTIPRODUCT_PATTERN.test(title);
}

function getExternalProductId(url: string): string {
  const match = new URL(url).pathname.match(/-p(\d+)\/?$/);
  if (!match)
    throw new Error(`Validated product URL has no product id: ${url}`);
  return match[1];
}

export function parseWhiskyWorldPage(html: string): {
  products: StorePrice[];
  hasNextPage: boolean;
} {
  const $ = cheerio(html);
  const products: StorePrice[] = [];
  const cards = $(PRODUCT_CARD_SELECTOR);

  cards.each((_, element) => {
    const card = $(element);
    const titleLink = card.find(".product__details__title a").first();
    const rawName = titleLink.text().replaceAll(/\s+/g, " ").trim();
    const action = card
      .find(".product__options__view span")
      .first()
      .text()
      .trim();

    if (action.toLowerCase() !== "buy") return;
    if (!rawName) {
      logScrapeWarning(SITE, "Unable to identify product name");
      return;
    }
    if (isMultiproduct(rawName)) return;

    const url = getOfficialUrl(titleLink.attr("href"), { product: true });
    if (!url) {
      logScrapeWarning(SITE, "Invalid product URL", { rawName });
      return;
    }

    const priceRaw = card
      .find(".product-content__price--inc .GBP")
      .first()
      .text()
      .replaceAll(/\s+/g, " ")
      .trim();
    const price = parsePrice(priceRaw);
    if (price === null) {
      logScrapeWarning(SITE, "Invalid product price", { priceRaw, rawName });
      return;
    }

    const imageUrl = getImageUrl(card.find(".product__image img").first());
    if (!imageUrl) {
      logScrapeWarning(SITE, "Invalid product image URL", { rawName });
      return;
    }

    const { name } = normalizeBottle({ name: rawName });
    const listing = {
      externalProductId: getExternalProductId(url),
      name,
      price,
      currency: "gbp" as const,
      volume: 700,
      url,
      imageUrl,
    };

    logScrapedProduct(SITE, listing);
    products.push(listing);
  });

  return {
    products,
    hasNextPage: $('link[rel="next"]').length > 0,
  };
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url);
  const { products, hasNextPage } = parseWhiskyWorldPage(data);
  await Promise.all(products.map(cb));
  return { hasNextPage };
}

export default async function scrapeWhiskyWorld({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return await scrapePrices(
    SITE,
    (page) => `${CATALOG_URL}?show=48&page=${page}`,
    scrapeProducts,
    { dryRun },
  );
}
