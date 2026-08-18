import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { ALLOWED_VOLUMES } from "@peated/server/constants";
import type {
  ScrapePricesCallback,
  StorePrice,
} from "@peated/server/lib/scraper";
import scrapePrices, { requestUrl } from "@peated/server/lib/scraper";
import { toTitleCase } from "@peated/server/lib/strings";
import slugify from "@sindresorhus/slugify";
import { z } from "zod";
import { logScrapedProduct, logScrapeWarning } from "./scrapeLogging";

const SITE = "reservebar";
const STORE_ORIGIN = "https://www.reservebar.com";
const API_ORIGIN = "https://api.liquidcommerce.cloud";
const AUTH_URL = `${API_ORIGIN}/api/authentication`;
const CATALOG_URL = `${API_ORIGIN}/api/catalog/search`;
// ReserveBar publishes this storefront credential to its browser client.
const API_KEY = "3874058558b6dd82dc652e770b6b689e";
const PRODUCTS_PER_PAGE = 16;

const AuthenticationResponseSchema = z.object({
  data: z.object({
    token: z.string().min(1),
  }),
});

const CatalogResponseSchema = z.object({
  navigation: z.object({
    currentPage: z.number().int().positive(),
    totalPages: z.number().int().nonnegative(),
  }),
  products: z.array(z.unknown()),
});

const ProductSchema = z
  .object({
    images: z.array(z.string()).optional(),
    name: z.string().trim().min(1),
    priceInfo: z.object({
      average: z.number().int().positive(),
      currency: z.literal("USD"),
    }),
    salsifyGrouping: z.string().trim().min(1),
    sizes: z
      .array(
        z.object({
          pack: z.boolean().optional(),
          size: z.string().trim().min(1),
          uom: z.string().trim().min(1),
          volume: z.string().trim().min(1),
        }),
      )
      .min(1),
  })
  .passthrough();

function getRawName(input: unknown): string | null {
  if (!input || typeof input !== "object" || !("name" in input)) return null;
  return typeof input.name === "string" ? input.name : null;
}

function parseVolume(size: z.infer<typeof ProductSchema>["sizes"][number]) {
  if (size.pack) return null;

  const unit = size.uom.toUpperCase();
  const amount = Number(size.volume);
  const volume = unit === "LITRE" ? amount * 1000 : amount;
  return Number.isInteger(volume) && ALLOWED_VOLUMES.includes(volume)
    ? volume
    : null;
}

function getImageUrl(images: string[] | undefined): string | undefined {
  const value = images?.[0];
  if (!value) return;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return;
  }
}

export function parseReserveBarProducts(input: unknown): {
  products: StorePrice[];
  hasNextPage: boolean;
} {
  const payload = CatalogResponseSchema.parse(input);
  const products: StorePrice[] = [];

  for (const productInput of payload.products) {
    const result = ProductSchema.safeParse(productInput);
    if (!result.success) {
      logScrapeWarning(SITE, "Invalid product record", {
        rawName: getRawName(productInput),
      });
      continue;
    }

    const product = result.data;
    const volume = parseVolume(product.sizes[0]);
    if (!volume) {
      logScrapeWarning(SITE, "Unsupported product size", {
        rawName: product.name,
        size: product.sizes[0].size,
      });
      continue;
    }

    const rawName =
      product.name === product.name.toUpperCase()
        ? toTitleCase(product.name)
        : product.name;
    const { name } = normalizeBottle({ name: rawName });
    const listing = {
      currency: "usd" as const,
      imageUrl: getImageUrl(product.images),
      name,
      price: product.priceInfo.average,
      url: `${STORE_ORIGIN}/products/${slugify(product.name)}/${product.salsifyGrouping}`,
      volume,
    };

    logScrapedProduct(SITE, listing);
    products.push(listing);
  }

  return {
    products,
    hasNextPage: payload.navigation.currentPage < payload.navigation.totalPages,
  };
}

async function getAccessToken(): Promise<string> {
  const data = JSON.parse(
    await requestUrl(AUTH_URL, {
      headers: {
        "X-LIQUID-API-KEY": API_KEY,
        "X-LIQUID-API-OBF": "true",
      },
    }),
  );
  return AuthenticationResponseSchema.parse(data).data.token;
}

export async function scrapeProducts(
  url: string,
  cb: ScrapePricesCallback,
  accessToken?: string,
) {
  const page = Number(new URL(url).searchParams.get("page"));
  if (!Number.isInteger(page) || page < 1) {
    throw new Error("Invalid ReserveBar catalog page URL.");
  }

  const token = accessToken ?? (await getAccessToken());
  const data = JSON.parse(
    await requestUrl(url, {
      method: "POST",
      retryable: true,
      body: JSON.stringify({
        entity: "reservebar.com",
        filters: [
          { key: "availability", values: "IN_STOCK" },
          { key: "categories", values: ["SPIRITS > WHISKEY"] },
        ],
        isLean: false,
        isLegacy: true,
        loc: {},
        orderBy: "price",
        orderDirection: "desc",
        page,
        perPage: PRODUCTS_PER_PAGE,
        refresh: false,
        search: "",
        shouldShowOffHours: false,
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-LIQUID-API-KEY": API_KEY,
        "X-LIQUID-API-OBF": "true",
        "X-LIQUID-API-SDK": "true",
        "X-LIQUID-SDK-VERSION": "1.11.1",
      },
    }),
  );

  const result = parseReserveBarProducts(data);
  await Promise.all(result.products.map(cb));
  return { hasNextPage: result.hasNextPage };
}

export default async function scrapeReserveBar({
  dryRun = false,
}: { dryRun?: boolean } = {}) {
  const accessToken = await getAccessToken();
  return scrapePrices(
    SITE,
    (page) => `${CATALOG_URL}?page=${page}`,
    (url, cb) => scrapeProducts(url, cb, accessToken),
    { dryRun },
  );
}
