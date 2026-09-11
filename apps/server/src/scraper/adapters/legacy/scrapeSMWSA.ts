import { normalizeBottleInput } from "@peated/bottle-classifier/normalize";
import { parseDetailsFromName } from "@peated/bottle-classifier/smws";
import {
  type BottleInputSchema,
  type StorePriceInputSchema,
} from "@peated/server/schemas";
import { getUrl, handleBottle } from "../../legacy/scraper";

import { load as cheerio } from "cheerio";
import { type z } from "zod";
import { logScrapeWarning } from "./scrapeLogging";

const SITE = "smwsa";

function parseAbv(value: string | null | undefined): number | null {
  if (!value) return null;
  const abv = Number.parseFloat(value.replace("%", "").trim());
  return Number.isFinite(abv) && abv >= 0 && abv <= 100 ? abv : null;
}

function parseAge(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  const vintageMatch = /^Vintage\s+(?<year>\d{4})$/iu.exec(normalized);
  if (vintageMatch?.groups) {
    return { statedAge: null, vintageYear: Number(vintageMatch.groups.year) };
  }
  const ageMatch = /^(?<age>\d+)\s+years?$/iu.exec(normalized);
  return {
    statedAge: ageMatch?.groups ? Number(ageMatch.groups.age) : null,
    vintageYear: null,
  };
}

export default async function scrapeSMWSA() {
  return scrapeBottles(
    `https://newmake.smwsa.com/collections/all-products`,
    async (bottle, price, imageUrl) =>
      await handleBottle(bottle, price, imageUrl, { site: SITE }),
  );
}

export async function scrapeBottles(
  url: string,
  cb: (
    bottle: z.input<typeof BottleInputSchema>,
    price?: z.input<typeof StorePriceInputSchema> | null,
    imageUrl?: string | null,
  ) => Promise<void>,
  request: (url: string) => Promise<string> = getUrl,
) {
  const data = await request(url);
  const $ = cheerio(data);
  let itemCount = 0;

  for (const el of $(
    ".product-collection-module__grid-item, [data-product-tile]",
  )) {
    const card = $(el);
    const productLink = card
      .find('[data-ecommerce-action="select-product"]')
      .first();
    const itemType =
      $(".product-collection-module__type", el).first().text().trim() ||
      card.find("h3").first().text().trim();
    if (!itemType || !itemType.startsWith("Cask No.")) {
      continue;
    }

    const caskName =
      $(".product-collection-module__title", el).first().text().trim() ||
      productLink.attr("data-product-name")?.trim() ||
      card.find("h1").first().text().trim();

    const specList: [string, string][] = [];
    const legacySpecs = $(".product-collection-module__specs-list li", el);
    const specs = legacySpecs.length
      ? legacySpecs
      : card.find("ul").first().find("li");
    specs.each((_, specEl) => {
      const columns = $(specEl).children("div");
      const name =
        $(".product-collection-module__specs-item-col--title", specEl)
          .first()
          .text()
          .trim() || columns.first().text().trim();
      const value =
        $(".product-collection-module__specs-item-col--desc", specEl)
          .first()
          .text()
          .trim() || columns.eq(1).text().trim();
      specList.push([name, value]);
    });

    const rawPrice =
      $(".product-collection-module__price", el).first().text().trim() ||
      productLink.attr("data-product-price")?.trim();
    const parsedPrice = rawPrice
      ? Number(rawPrice.replace(/^\$/u, "").replaceAll(",", ""))
      : Number.NaN;
    const price =
      Number.isFinite(parsedPrice) && parsedPrice > 0
        ? Math.round(parsedPrice * 100)
        : null;

    const rawUrl =
      $("a.product-collection-module__grid-item-gallery", el)
        .first()
        .attr("href") ||
      productLink.attr("data-product-url") ||
      productLink.attr("href");
    if (!rawUrl) {
      logScrapeWarning(SITE, "Cannot find product URL", {
        caskName,
      });
      continue;
    }
    const url = new URL(rawUrl, "https://newmake.smwsa.com").toString();

    const ageSpec = specList.find(([name]) => name === "Age:");
    let { statedAge, vintageYear } = parseAge(ageSpec?.[1]);

    const caskSpec = specList.find(([name]) => name === "Cask:");
    const maturation = caskSpec?.[1] || null;
    const abvSpec = specList.find(([name]) => name === "ABV:");
    const abv = parseAbv(abvSpec?.[1]);
    const caskNumber = itemType.replace(/^Cask No\.\s*/i, "").trim();

    const details = parseDetailsFromName(`${itemType} ${caskName}`);
    if (!details?.distiller) {
      logScrapeWarning(SITE, "Cannot find distiller", {
        itemType,
        caskName,
      });
      continue;
    }
    if (!details.category) {
      logScrapeWarning(SITE, "Unsupported spirit", {
        itemType,
        caskName,
      });
      continue;
    }

    let name = details.name;
    ({ name, statedAge, vintageYear } = normalizeBottleInput({
      name,
      statedAge,
      vintageYear,
      isFullName: false,
    }));

    const imageUrl =
      $("img.product-collection-module__grid-item-image", el)
        .first()
        .attr("src") ??
      productLink.attr("data-product-image") ??
      productLink.find("img").first().attr("src") ??
      null;

    const bottle: z.input<typeof BottleInputSchema> = {
      name,
      vintageYear,
      category: details.category,
      statedAge,
      brand: {
        name: "The Scotch Malt Whisky Society",
      },
      bottler: {
        name: "The Scotch Malt Whisky Society",
      },
      distillers: [{ name: details.distiller }],
      maturation,
      caskNumber,
      singleCask: true,
    };
    if (abv !== null) bottle.abv = abv;

    let storePrice: z.input<typeof StorePriceInputSchema> | null = null;
    if (price !== null) {
      storePrice = {
        name: `SMWS ${details.name}`,
        price,
        volume: 750,
        currency: "usd",
        url,
      };
      const externalProductId = productLink.attr("data-product-product-id");
      if (externalProductId) storePrice.externalProductId = externalProductId;
    }

    await cb(bottle, storePrice, imageUrl);
    itemCount += 1;
  }
  return itemCount;
}
