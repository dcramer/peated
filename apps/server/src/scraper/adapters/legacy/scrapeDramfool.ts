import { normalizeBottleInput } from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import { GtinSchema } from "@peated/server/schemas";
import { load as cheerio } from "cheerio";
import { z } from "zod";
import type { ScrapePricesCallback, StorePrice } from "../../legacy/scraper";
import scrapePrices, { getUrl } from "../../legacy/scraper";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "dramfool";
const STORE_ORIGIN = "https://dramfool.com";
const SHOP_URL = `${STORE_ORIGIN}/shop`;

const MoneySchema = z
  .object({
    currency: z.string(),
    value: z.string(),
  })
  .catchall(z.json());

const DramfoolVariantSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    barcode: z.string().trim().min(1).nullish(),
    attributes: z.record(z.string(), z.string()),
    priceMoney: MoneySchema,
    salePriceMoney: MoneySchema.optional(),
    onSale: z.boolean(),
    unlimited: z.boolean(),
    qtyInStock: z.number(),
  })
  .catchall(z.json());

function parsePrice(value: string): number | null {
  const match = value.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const pounds = Number.parseInt(match[1], 10);
  const pence = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10) || 0;
  const price = pounds * 100 + pence;
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function parseVolume(value: string): number | null {
  const match = value.match(/^\s*(\d+(?:\.\d+)?)\s*(ml|cl|l)\s*$/i);
  if (!match) return null;

  const amount = Number.parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const volume =
    unit === "cl" ? amount * 10 : unit === "l" ? amount * 1000 : amount;
  return Number.isInteger(volume) ? volume : null;
}

function getSize(attributes: Record<string, string>): string | null {
  return (
    Object.entries(attributes).find(
      ([name]) => name.trim().toLowerCase() === "size",
    )?.[1] ?? null
  );
}

function getProductUrl(value: string): string | null {
  try {
    const url = new URL(value, STORE_ORIGIN);
    if (
      url.protocol !== "https:" ||
      url.origin !== STORE_ORIGIN ||
      url.username ||
      url.password ||
      !url.pathname.startsWith("/shop/")
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

function getImageUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value, STORE_ORIGIN);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseDramfoolProductLinks(html: string): string[] {
  const $ = cheerio(html);
  const links = new Set<string>();

  $(".ProductList-item.post-type-store-item > a.ProductList-item-link").each(
    (_, element) => {
      const href = $(element).attr("href");
      if (!href) return;

      const url = getProductUrl(href);
      if (url) links.add(url);
    },
  );

  return [...links];
}

export function parseDramfoolProductPage(
  html: string,
  productUrl: string,
): StorePrice[] {
  const $ = cheerio(html);
  if (!$('.sqs-add-to-cart-button[data-product-type="1"]').length) return [];
  const availability = $('meta[property="product:availability"]')
    .attr("content")
    ?.toLowerCase();
  if (availability === "outofstock") return [];

  const rawName = $(".ProductItem-details-title").first().text().trim();
  if (!rawName) {
    logScrapeWarning(SITE, "Unable to identify product name", { productUrl });
    return [];
  }

  const variantsRaw = $(".product-variants[data-variants]")
    .first()
    .attr("data-variants");
  if (!variantsRaw) {
    logScrapeWarning(SITE, "Unable to identify product variants", { rawName });
    return [];
  }

  let variants: unknown;
  try {
    variants = JSON.parse(variantsRaw);
  } catch {
    logScrapeWarning(SITE, "Invalid product variants", { rawName });
    return [];
  }
  if (!Array.isArray(variants)) {
    logScrapeWarning(SITE, "Invalid product variants", { rawName });
    return [];
  }

  const imageValue = $(".ProductItem-gallery-slides-item-image")
    .first()
    .attr("data-src");
  const imageUrl = getImageUrl(imageValue);
  if (imageValue && !imageUrl) {
    logScrapeWarning(SITE, "Invalid product image URL", { rawName });
  }

  const rawProductId = $("article.ProductItem").first().attr("data-item-id");
  const productId = rawProductId?.trim() || undefined;
  const normalizedName = /\bdramfool\b/i.test(rawName)
    ? rawName
    : `Dramfool ${rawName}`;
  const { name } = normalizeBottleInput({ name: normalizedName });
  const products: StorePrice[] = [];

  for (const variantInput of variants) {
    const variantResult = DramfoolVariantSchema.safeParse(variantInput);
    if (!variantResult.success) {
      logScrapeWarning(SITE, "Invalid product variant", { rawName });
      continue;
    }

    const variant = variantResult.data;
    if (!variant.unlimited && variant.qtyInStock <= 0) continue;

    const size = getSize(variant.attributes);
    const volume = size ? parseVolume(size) : null;
    if (volume === null || !ALLOWED_VOLUMES.includes(volume)) {
      logScrapeWarning(SITE, "Invalid product size", {
        rawName,
        size,
        volume,
      });
      continue;
    }

    const money = variant.onSale ? variant.salePriceMoney : variant.priceMoney;
    const price = money?.currency === "GBP" ? parsePrice(money.value) : null;
    if (price === null) {
      logScrapeWarning(SITE, "Invalid product price", {
        rawName,
        currency: money?.currency ?? null,
        price: money?.value ?? null,
      });
      continue;
    }

    const externalProductId = variant.id ?? productId;
    const barcode = GtinSchema.safeParse(variant.barcode);
    const listing: StorePrice = {
      name,
      price,
      currency: "gbp",
      volume,
      url: productUrl,
      imageUrl,
    };
    if (externalProductId) listing.externalProductId = externalProductId;
    if (barcode.success) listing.barcode = barcode.data;

    logScrapedProduct(SITE, listing);
    products.push(listing);
  }

  return products;
}

export async function scrapeProducts(url: string, cb: ScrapePricesCallback) {
  const listHtml = await getUrl(url);
  const productUrls = parseDramfoolProductLinks(listHtml);
  for (const productUrl of productUrls) {
    const html = await getUrl(productUrl);
    for (const product of parseDramfoolProductPage(html, productUrl)) {
      await cb(product);
    }
  }
  return { hasNextPage: false };
}

export default async function scrapeDramfool({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  return await scrapePrices(SITE, () => SHOP_URL, scrapeProducts, { dryRun });
}
