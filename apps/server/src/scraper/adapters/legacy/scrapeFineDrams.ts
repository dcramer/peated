import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import { load as cheerio } from "cheerio";
import type { ScrapePricesCallback, StorePrice } from "../../legacy/scraper";
import scrapePrices, { getUrl } from "../../legacy/scraper";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "finedrams";
const STORE_ORIGIN = "https://www.finedrams.com";
const CATALOG_URL = `${STORE_ORIGIN}/whisky`;
const PRODUCT_CARD_SELECTOR =
  "#product_list_ajax .product_list.grid > li > a.product";
const MULTIPRODUCT_PATTERN =
  /\b(?:gift|tasting|miniature|sample|discovery)\s+(?:set|pack|collection)\b|\bminiature\b|\bbundle\b|\badvent\s+calendar\b|\b\d+\s*(?:pack|pk)\b|\b\d+\s*(?:x|×)\s*\d+(?:[.,]\d+)?\s*(?:ml|cl|l)\b|\bset\s+of\s+\d+\b/i;

function parsePrice(value: string): number | null {
  const match = value
    .replaceAll("\u00a0", " ")
    .trim()
    .match(/^(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?\s*€$/);
  if (!match) return null;

  const euros = Number.parseInt(match[1].replaceAll(",", ""), 10);
  const cents = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10) || 0;
  const price = euros * 100 + cents;
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function parseVolume(value: string): number | null {
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\b/i);
  if (!match) return null;

  const amount = Number.parseFloat(match[1].replace(",", "."));
  const multiplier = { ml: 1, cl: 10, l: 1000 }[
    match[2].toLowerCase() as "ml" | "cl" | "l"
  ];
  const volume = amount * multiplier;
  return Number.isInteger(volume) && ALLOWED_VOLUMES.includes(volume)
    ? volume
    : null;
}

function getProductUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value, STORE_ORIGIN);
    if (
      url.protocol !== "https:" ||
      url.origin !== STORE_ORIGIN ||
      url.username ||
      url.password ||
      !url.pathname.endsWith(".html")
    ) {
      return null;
    }

    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function getImageUrl(
  card: ReturnType<ReturnType<typeof cheerio>>,
): string | null {
  const source = card.find(".image_container picture source").first();
  const image = card.find(".image_container picture img").first();
  const candidates = [
    source.attr("data-src"),
    source.attr("srcset")?.split(",", 1)[0]?.trim().split(/\s+/, 1)[0],
    image.attr("data-src"),
    image.attr("src"),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      const url = new URL(candidate, STORE_ORIGIN);
      if (
        url.protocol === "https:" &&
        (url.origin === STORE_ORIGIN ||
          url.hostname === "d1wd5rt8ssn8ry.cloudfront.net")
      ) {
        return url.toString();
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function parseFineDramsPage(html: string): {
  products: StorePrice[];
  hasSourceProducts: boolean;
} {
  const $ = cheerio(html);
  const products: StorePrice[] = [];
  const cards = $(PRODUCT_CARD_SELECTOR);
  let malformedCards = 0;

  cards.each((_, element) => {
    const card = $(element);
    const rawName = card.find(".details .name").first().text().trim();
    if (!rawName) {
      malformedCards += 1;
      logScrapeWarning(SITE, "Unable to identify product name");
      return;
    }
    if (MULTIPRODUCT_PATTERN.test(rawName)) return;

    const availability = card
      .find(".details .quantity")
      .first()
      .text()
      .replaceAll(/\s+/g, " ")
      .trim();
    if (availability.toLowerCase() !== "in stock") return;

    const volumeRaw = card
      .find(".details .name_extra")
      .first()
      .text()
      .replaceAll(/\s+/g, " ")
      .trim();
    const volume = parseVolume(volumeRaw);
    if (volume === null) {
      logScrapeWarning(SITE, "Unsupported product size", {
        rawName,
        volumeRaw,
      });
      return;
    }

    const priceRaw = card
      .children(".price")
      .first()
      .clone()
      .children()
      .remove()
      .end()
      .text()
      .replaceAll(/\s+/g, " ")
      .trim();
    const price = parsePrice(priceRaw);
    if (price === null) {
      malformedCards += 1;
      logScrapeWarning(SITE, "Invalid product price", { priceRaw, rawName });
      return;
    }

    const url = getProductUrl(card.attr("href"));
    if (!url) {
      malformedCards += 1;
      logScrapeWarning(SITE, "Invalid product URL", {
        rawName,
        url: card.attr("href"),
      });
      return;
    }

    const imageUrl = getImageUrl(card);
    if (!imageUrl) {
      malformedCards += 1;
      logScrapeWarning(SITE, "Invalid product image URL", { rawName });
      return;
    }

    const { name } = normalizeBottle({ name: rawName });
    const listing = {
      name,
      price,
      currency: "eur" as const,
      volume,
      url,
      imageUrl,
    };

    logScrapedProduct(SITE, listing);
    products.push(listing);
  });

  if (products.length === 0 && malformedCards > 0) {
    throw new Error(
      "Fine Drams page contained product cards but no supported listings.",
    );
  }

  return {
    products,
    hasSourceProducts: cards.length > 0,
  };
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const data = await getUrl(url);
  const { products, hasSourceProducts } = parseFineDramsPage(data);
  await Promise.all(products.map(cb));
  return { hasSourceProducts };
}

export default async function scrapeFineDrams({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return await scrapePrices(
    SITE,
    (page) => {
      const url = new URL(CATALOG_URL);
      url.searchParams.set("in-stock", "1");
      url.searchParams.set("p", String(page));
      return url.toString();
    },
    scrapeProducts,
    { dryRun },
  );
}
