import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import {
  getCategoryFromCask,
  parseDetailsFromName,
  SMWS_DISTILLERY_CODES,
} from "@peated/bottle-classifier/smws";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import { parseExactReleaseDate } from "@peated/server/lib/bottleRelease";
import {
  type BottleInputSchema,
  type StorePriceInputSchema,
} from "@peated/server/schemas";
import { load as cheerio } from "cheerio";
import { z } from "zod";
import { chunked, handleBottle, requestUrl } from "../../legacy/scraper";
import { logScrapeWarning } from "./scrapeLogging";

const SITE = "smws";
const ARCHIVE_PAGE_SIZE = 100;
const ARCHIVE_DETAIL_BATCH_SIZE = 50;
type BottleFlavorProfile = NonNullable<
  z.input<typeof BottleInputSchema>["flavorProfile"]
>;
const ARCHIVE_FLAVOR_PROFILES = {
  "young spritely": "young_spritely",
  "sweet fruity mellow": "sweet_fruit_mellow",
  "spicy sweet": "spicy_sweet",
  "spicy dry": "spicy_dry",
  "deep rich dried fruits": "deep_rich_dried_fruit",
  "old dignified": "old_dignified",
  "light delicate": "light_delicate",
  "juicy oak vanilla": "juicy_oak_vanilla",
  "oily coastal": "oily_coastal",
  "lightly peated": "lightly_peated",
  peated: "peated",
  "heavily peated": "heavily_peated",
} satisfies Record<string, BottleFlavorProfile>;

export type SmwsBottleCallback = (
  bottle: z.input<typeof BottleInputSchema>,
  price?: z.input<typeof StorePriceInputSchema> | null,
  imageUrl?: string | null,
) => Promise<void>;

export type SmwsCatalogRequest = (
  url: string,
  options?: {
    method?: "GET" | "POST";
    body?: string;
    headers?: Record<string, string>;
    retryable?: boolean;
  },
) => Promise<string>;

function parseAbv(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  const numericValue = z.number().safeParse(value);
  if (numericValue.success) return numericValue.data;

  // Remove % symbol and trim whitespace
  const cleanValue = z.string().parse(value).replace("%", "").trim();

  // Convert to float
  const floatValue = parseFloat(cleanValue);

  // Return null if the conversion failed
  return isNaN(floatValue) ? null : floatValue;
}

function parseVintageYear(value: string | null | undefined): number | null {
  if (!value) return null;

  const match =
    /^(?<day>\d{1,2})[/-](?<month>\d{1,2})[/-](?<year>\d{4})$/u.exec(
      value.trim(),
    );
  if (!match?.groups) return null;

  const day = Number(match.groups.day);
  const month = Number(match.groups.month);
  const year = Number(match.groups.year);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? year
    : null;
}

function parseReleaseDate(value: string | null | undefined) {
  if (!value) return null;

  const date = value.trim().slice(0, 10);
  return parseExactReleaseDate(date);
}

function parseVolume(sku: string): number | null {
  // SMWS UK SKUs encode the bottle size in centilitres after GB or GX.
  const match = /(?:GB|GX)(?<centilitres>\d{3})/u.exec(sku);
  if (!match?.groups) return null;

  const volume = Number(match.groups.centilitres) * 10;
  return ALLOWED_VOLUMES.includes(volume) ? volume : null;
}

/**
 * SMWS bottle SKUs encode a three-character distillery segment followed by a
 * three-digit cask segment. Use it only when the decoded prefix is in the
 * curated SMWS table. This corrects source display typos without guessing.
 */
export function parseCaskNumberFromSku(sku: string): string | null {
  const match = /^(?<identity>[A-Z0-9]{6})[A-Z]{2}\d/u.exec(
    sku.trim().toUpperCase(),
  );
  if (!match?.groups) return null;

  const distilleryCode = match.groups.identity.slice(0, 3).replace(/^0+/u, "");
  const caskSequence = Number(match.groups.identity.slice(3));
  if (
    !distilleryCode ||
    !SMWS_DISTILLERY_CODES[distilleryCode] ||
    !Number.isSafeInteger(caskSequence) ||
    caskSequence <= 0
  ) {
    return null;
  }
  return `${distilleryCode}.${caskSequence}`;
}

function getSmwsCodeIdentity(societyCode: string) {
  const caskMatch = /^(?<distillery>[A-Z0-9]+)\.(?<cask>\d+)$/iu.exec(
    societyCode,
  );
  if (caskMatch?.groups) {
    return {
      caskNumber: societyCode,
      edition: null,
      distilleryCode: caskMatch.groups.distillery.toUpperCase(),
    };
  }

  // SMWS puts numbered batch releases in its cask-number API field, but the
  // product presents them as editions rather than single-cask codes.
  const batchMatch = /^Batch (?<number>\d+)$/iu.exec(societyCode);
  if (batchMatch?.groups) {
    return {
      caskNumber: null,
      edition: `Batch ${batchMatch.groups.number}`,
      distilleryCode: null,
    };
  }

  // SMWS also puts batch and rare-release labels in its cask-number field.
  // These labels can be reused, so they are not bottle cask numbers.
  const namedDistilleryMatch =
    /^Distillery (?<code>[A-Z0-9]+)(?: Rare Release| \(\d{4}\))$/iu.exec(
      societyCode,
    ) ??
    /^(?<code>[A-Z0-9]+) (?:Campbeltown|Highland|Islay|Lowland|Speyside) Batch \d{4}$/iu.exec(
      societyCode,
    );

  return {
    caskNumber: null,
    edition: null,
    distilleryCode: namedDistilleryMatch?.groups?.code.toUpperCase() ?? null,
  };
}

function categoryFromSmwsFacts({
  caskNumber,
  distilleryCode,
  region,
  spirit,
}: {
  caskNumber: string | null;
  distilleryCode: string | null;
  region: string | null;
  spirit: string | null;
}): z.input<typeof BottleInputSchema>["category"] {
  const details = caskNumber
    ? parseDetailsFromName(`${caskNumber} Society bottle`)
    : null;
  if (details?.distiller) return details.category;
  if (distilleryCode && SMWS_DISTILLERY_CODES[distilleryCode]) {
    return getCategoryFromCask(distilleryCode);
  }

  const normalizedSpirit = spirit?.toLowerCase() ?? "";
  const normalizedRegion = region?.toLowerCase() ?? "";
  if (
    normalizedRegion.includes("blended malt") ||
    normalizedSpirit.includes("blended malt")
  ) {
    return "blended_malt";
  }
  if (
    normalizedRegion.includes("blended grain") ||
    normalizedSpirit.includes("blended grain")
  ) {
    return "blended_grain";
  }
  if (
    normalizedSpirit.includes("single grain whisky") ||
    normalizedSpirit.includes("single grain")
  ) {
    return "single_grain";
  }
  if (normalizedSpirit.includes("bourbon")) return "bourbon";
  if (normalizedSpirit.includes("corn whisky")) return "corn";
  if (normalizedSpirit.includes("rye")) return "rye";
  if (normalizedSpirit.includes("wheat whisky")) return "wheat";
  if (normalizedSpirit.includes("single malt whisky")) return "single_malt";
  return null;
}

function categoryFromSmwsDescription(
  description: string | null | undefined,
): z.input<typeof BottleInputSchema>["category"] {
  if (
    /\bsmall[- ]batch(?: sherried)? single malt\b/iu.test(description ?? "")
  ) {
    return "single_malt";
  }
  if (/\bsmall[- ]batch blended malt\b/iu.test(description ?? "")) {
    return "blended_malt";
  }
  return null;
}

function isSingleCask(
  hasKnownDistiller: boolean,
  maturation: string | null,
): boolean {
  if (!hasKnownDistiller) return false;
  return !/^(?:two|three|four|five|six|seven|eight|nine|ten)\b/iu.test(
    maturation?.trim() ?? "",
  );
}

type ArchiveBottle = {
  bottle: z.input<typeof BottleInputSchema>;
  imageUrl: string | null;
  productId: number | null;
};

type ArchivePage = {
  bottles: ArchiveBottle[];
  pageCount: number;
};

export function parseArchivePage(body: string): ArchivePage {
  const $ = cheerio(body);
  const productCountText = $(".productCount").first().text();
  const productCount = Number(
    productCountText.match(/[\d,]+/u)?.[0]?.replaceAll(",", "") ?? 0,
  );
  const pageCount = Math.max(1, Math.ceil(productCount / ARCHIVE_PAGE_SIZE));
  const bottles: ArchiveBottle[] = [];

  for (const element of $(".productGrid > .product article.itemSmall")) {
    const card = $(element);
    const title = card.attr("data-item-name")?.trim();
    const sku = card.attr("data-item-sku")?.trim() ?? "";
    const productId = Number(card.attr("data-item-id"));
    const imageUrl = z
      .string()
      .url()
      .safeParse(card.attr("data-item-image")).data;
    const facts = new Map<string, string>();
    card.find(".itemInfoWrap li").each((_, item) => {
      const label = $(".name", item)
        .first()
        .text()
        .replace(/\s+/gu, " ")
        .trim();
      const value = $(".value", item)
        .first()
        .text()
        .replace(/\s+/gu, " ")
        .trim();
      if (label && value) facts.set(label.toUpperCase(), value);
    });

    const abv = parseAbv(facts.get("ABV"));
    if (!title || abv === null) continue;

    const displayedSocietyCode = facts.get("CASK NO.") ?? null;
    const societyCode = parseCaskNumberFromSku(sku) ?? displayedSocietyCode;
    if (!societyCode) continue;
    const { caskNumber, edition, distilleryCode } =
      getSmwsCodeIdentity(societyCode);
    const bundleTitle = /\b(?:case|collection|duo|pack|trio)\b/iu.test(title);
    if (!caskNumber && bundleTitle) continue;
    const details = caskNumber
      ? parseDetailsFromName(`${caskNumber} ${title}`)
      : null;
    const distiller =
      details?.distiller ??
      (distilleryCode ? SMWS_DISTILLERY_CODES[distilleryCode] : null);
    const age = Number.parseInt(facts.get("AGE") ?? "", 10);
    const statedAge = Number.isSafeInteger(age) && age > 0 ? age : null;
    const vintageYear = parseVintageYear(card.attr("data-item-distilleddate"));
    const maturation =
      card.attr("data-item-type")?.trim() || facts.get("CASK") || null;
    const region = facts.get("REGION") ?? null;
    const spirit = facts.get("SPIRIT") ?? null;
    const rawName = details?.name ?? title;
    const normalized = normalizeBottle({
      name: rawName,
      statedAge,
      vintageYear,
      isFullName: false,
    });

    const bottle: z.input<typeof BottleInputSchema> = {
      name: normalized.name,
      statedAge: normalized.statedAge,
      vintageYear: normalized.vintageYear,
      releaseYear: normalized.releaseYear,
      abv,
      category: categoryFromSmwsFacts({
        caskNumber,
        distilleryCode,
        region,
        spirit,
      }),
      brand: { name: "The Scotch Malt Whisky Society" },
      bottler: { name: "The Scotch Malt Whisky Society" },
      distillers: distiller ? [{ name: distiller }] : [],
      maturation,
      caskNumber,
      outturn: parsePositiveInteger(
        facts.get("OUTTURN") ?? facts.get("BOTTLES PRODUCED"),
      ),
      singleCask: isSingleCask(Boolean(caskNumber && distiller), maturation),
    };
    if (edition) bottle.edition = edition;

    bottles.push({
      imageUrl: imageUrl ?? null,
      productId:
        Number.isSafeInteger(productId) && productId > 0 ? productId : null,
      bottle,
    });
  }

  return { bottles, pageCount };
}

const ArchiveProductSchema = z.object({
  entityId: z.number().int().positive(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  customFields: z.object({
    edges: z.array(
      z.object({ node: z.object({ name: z.string(), value: z.string() }) }),
    ),
  }),
  images: z.object({
    edges: z.array(
      z.object({
        node: z.object({ urlOriginal: z.string().url() }),
      }),
    ),
  }),
});

const ArchiveProductPayloadSchema = z.object({
  data: z.object({
    site: z.object({
      products: z.object({
        edges: z.array(z.object({ node: ArchiveProductSchema })),
      }),
    }),
  }),
});

type ArchiveProduct = z.infer<typeof ArchiveProductSchema>;

export function parseStorefrontToken(body: string): string | null {
  const escapedMarker = '\\"storefront_api\\":{\\"token\\":\\"';
  const plainMarker = '"storefront_api":{"token":"';
  const marker = body.includes(escapedMarker) ? escapedMarker : plainMarker;
  const start = body.indexOf(marker);
  if (start === -1) return null;
  const valueStart = start + marker.length;
  const valueEnd = body.indexOf(
    marker === escapedMarker ? '\\"' : '"',
    valueStart,
  );
  if (valueEnd === -1) return null;
  return body.slice(valueStart, valueEnd) || null;
}

function parsePositiveInteger(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseFlavorProfile(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, " ")
    .trim();
  return (
    Object.entries(ARCHIVE_FLAVOR_PROFILES).find(
      ([label]) => label === normalized,
    )?.[1] ?? null
  );
}

function textFromHtml(value: string | null | undefined): string | null {
  if (!value) return null;
  const $ = cheerio(`<body>${value}</body>`);
  return repairMojibake($("body").text().replace(/\s+/gu, " ").trim()) || null;
}

function repairMojibake(value: string): string {
  if (!/[ÃÂ]/u.test(value)) return value;
  const bytes = Array.from(value, (character) => character.charCodeAt(0));
  if (bytes.some((byte) => byte > 255)) return value;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(bytes),
    );
  } catch {
    return value;
  }
}

function mergeArchiveDetails(
  archived: ArchiveBottle,
  product: ArchiveProduct | undefined,
): ArchiveBottle {
  if (!product) return archived;

  const customFields = new Map(
    product.customFields.edges.map(({ node }) => [
      node.name.trim().toLowerCase(),
      node.value.trim(),
    ]),
  );
  const release = parseReleaseDate(customFields.get("release date"));
  const description = textFromHtml(product.description);
  const caskNumber = archived.bottle.caskNumber;
  const productTitle = caskNumber
    ? repairMojibake(product.name)
        .trim()
        .replace(
          new RegExp(
            `^(?:Cask No\\.\\s*)?${caskNumber.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*`,
            "iu",
          ),
          "",
        )
        .trim()
    : repairMojibake(product.name).trim();
  const normalizedName = normalizeBottle({
    name: caskNumber ? `${caskNumber} ${productTitle}` : productTitle,
    statedAge: archived.bottle.statedAge,
    vintageYear: archived.bottle.vintageYear,
    isFullName: false,
  });

  return {
    ...archived,
    imageUrl: product.images.edges[0]?.node.urlOriginal ?? archived.imageUrl,
    bottle: {
      ...archived.bottle,
      name: normalizedName.name,
      abv: archived.bottle.abv ?? parseAbv(customFields.get("abv")),
      statedAge:
        archived.bottle.statedAge ??
        parsePositiveInteger(customFields.get("age")),
      vintageYear:
        archived.bottle.vintageYear ??
        parseVintageYear(customFields.get("date distilled")),
      releaseYear: release?.releaseYear ?? null,
      releaseMonth: release?.releaseMonth ?? null,
      releaseDay: release?.releaseDay ?? null,
      maturation:
        archived.bottle.maturation ?? customFields.get("cask type") ?? null,
      outturn: parsePositiveInteger(
        customFields.get("outturn") ??
          customFields.get("bottles produced") ??
          customFields.get("number of bottles"),
      ),
      category:
        archived.bottle.category ?? categoryFromSmwsDescription(description),
      description,
      flavorProfile: parseFlavorProfile(customFields.get("flavour profile")),
    },
  };
}

async function fetchArchiveProducts(
  productIds: number[],
  token: string,
  request: SmwsCatalogRequest,
) {
  if (!productIds.length) return [];
  const query = `
    query SmwsArchiveProducts($ids: [Int!]!) {
      site {
        products(entityIds: $ids, first: ${ARCHIVE_DETAIL_BATCH_SIZE}) {
          edges {
            node {
              entityId
              sku
              name
              description
              customFields(first: 50) {
                edges { node { name value } }
              }
              images(first: 1) {
                edges { node { urlOriginal } }
              }
            }
          }
        }
      }
    }
  `;
  const body = await request("https://smws.com/graphql", {
    method: "POST",
    body: JSON.stringify({ query, variables: { ids: productIds } }),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    retryable: true,
  });
  return ArchiveProductPayloadSchema.parse(
    JSON.parse(body),
  ).data.site.products.edges.map(({ node }) => node);
}

export async function scrapeArchiveBottles(
  urlForPage: (page: number) => string,
  cb: SmwsBottleCallback,
  request: SmwsCatalogRequest = requestUrl,
) {
  let page = 1;
  let itemCount = 0;
  let storefrontToken: string | null = null;
  while (true) {
    const body = await request(urlForPage(page));
    storefrontToken ??= parseStorefrontToken(body);
    if (!storefrontToken) {
      throw new Error("SMWS storefront token not found.");
    }
    const token = storefrontToken;
    const parsed = parseArchivePage(body);
    const products: ArchiveProduct[] = [];
    await chunked(
      parsed.bottles.flatMap(({ productId }) =>
        productId === null ? [] : [productId],
      ),
      ARCHIVE_DETAIL_BATCH_SIZE,
      async (productIds) => {
        products.push(
          ...(await fetchArchiveProducts(productIds, token, request)),
        );
      },
    );
    const productsById = new Map(
      products.map((product) => [product.entityId, product]),
    );
    for (const archived of parsed.bottles) {
      const enriched = mergeArchiveDetails(
        archived,
        archived.productId === null
          ? undefined
          : productsById.get(archived.productId),
      );
      await cb(enriched.bottle, null, enriched.imageUrl);
      itemCount += 1;
    }
    if (page >= parsed.pageCount) return itemCount;
    page += 1;
  }
}

export async function collectSmwsCatalog(
  cb: SmwsBottleCallback,
  request: SmwsCatalogRequest = requestUrl,
) {
  // The current catalog adds live prices. The archive runs last because its
  // batch detail records own the richer descriptions and historic coverage.
  const current = await scrapeBottles(
    `https://api.smws.com/api/v1/bottles?store_id=uk&parent_id=61&page=1&sortBy=featured&minPrice=0&maxPrice=0&perPage=128`,
    cb,
    request,
  );
  const archived = await scrapeArchiveBottles(
    (page) =>
      `https://smws.com/archive?limit=${ARCHIVE_PAGE_SIZE}&page=${page}`,
    cb,
    request,
  );
  return archived + current;
}

export default async function scrapeSMWS() {
  return await collectSmwsCatalog(handleBottle);
}

const SMWSPayloadSchema = z.object({
  items: z.array(
    z.object({
      // `stock` is remaining inventory, not producer-stated outturn.
      id: z.number().int().positive(),
      sku: z.string(),
      name: z.string(),
      age: z.number().nullish(),
      abv: z.union([z.string(), z.number()]).nullish(),
      cask_no: z.string().nullish(),
      cask_type: z.string().nullish(),
      region: z.string().nullish(),
      spirit_type: z.string().nullish(),
      distilleddate: z.string().nullish(),
      list_description: z.string().nullish(),
      price: z.number(),
      sale_price: z.number().nullish(),
      url: z.string(),
      release_date: z.string().nullish(),
      image: z.string(),
    }),
  ),
});

export async function scrapeBottles(
  url: string,
  cb: SmwsBottleCallback,
  request: SmwsCatalogRequest = requestUrl,
) {
  const body = await request(url);
  const data = SMWSPayloadSchema.parse(JSON.parse(body));
  let itemCount = 0;

  await chunked(data.items, 10, async (items) => {
    await Promise.all(
      items.map(async (item) => {
        const caskName = item.name;
        if (!caskName) {
          logScrapeWarning(SITE, "Cannot find cask name for product");
          return;
        }
        const societyCode =
          parseCaskNumberFromSku(item.sku) ?? item.cask_no?.trim() ?? null;
        if (!societyCode) {
          logScrapeWarning(SITE, "Cannot find Society code for product", {
            caskName,
          });
          return;
        }

        const { caskNumber, edition, distilleryCode } =
          getSmwsCodeIdentity(societyCode);
        const details = caskNumber
          ? parseDetailsFromName(`${caskNumber} ${caskName}`)
          : null;
        const distiller =
          details?.distiller ??
          (distilleryCode ? SMWS_DISTILLERY_CODES[distilleryCode] : null);
        const category =
          categoryFromSmwsFacts({
            caskNumber,
            distilleryCode,
            region: item.region ?? null,
            spirit: item.spirit_type ?? null,
          }) ?? categoryFromSmwsDescription(item.list_description);

        const release = parseReleaseDate(item.release_date);

        const { name, statedAge, vintageYear, releaseYear } = normalizeBottle({
          name: details?.name ?? caskName,
          statedAge: item.age,
          vintageYear: parseVintageYear(item.distilleddate),
          releaseYear: release?.releaseYear ?? null,
          isFullName: false,
        });

        const abv = parseAbv(item.abv);
        const volume = parseVolume(item.sku);
        if (!volume) {
          logScrapeWarning(SITE, "Cannot find supported bottle volume", {
            societyCode,
            sku: item.sku,
          });
        }

        const bottle: z.input<typeof BottleInputSchema> = {
          name,
          vintageYear,
          category,
          statedAge,
          abv,
          brand: {
            name: "The Scotch Malt Whisky Society",
          },
          bottler: {
            name: "The Scotch Malt Whisky Society",
          },
          distillers: distiller ? [{ name: distiller }] : [],
          maturation: item.cask_type?.trim() || null,
          caskNumber,
          singleCask: isSingleCask(
            Boolean(caskNumber && distiller),
            item.cask_type?.trim() || null,
          ),
          description: item.list_description?.trim() || null,
        };
        if (edition) bottle.edition = edition;
        if (release && releaseYear !== null) {
          bottle.releaseYear = releaseYear;
          bottle.releaseMonth = release.releaseMonth;
          bottle.releaseDay = release.releaseDay;
        }

        await cb(
          bottle,
          volume
            ? {
                name: `SMWS ${name}`,
                price: Math.round(
                  (item.sale_price && item.sale_price > 0
                    ? item.sale_price
                    : item.price) * 100,
                ),
                currency: "gbp",
                volume,
                url: `https://smws.com${item.url}`,
                externalProductId: String(item.id),
              }
            : null,
          item.image,
        );
        itemCount += 1;
      }),
    );
  });
  return itemCount;
}
