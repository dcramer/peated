/**
 * Owns retailer fetching, normalization, and dispatch into durable server
 * capabilities. Persistence failures escape to the worker boundary; optional
 * image transfer may degrade without discarding the authoritative listing.
 */
import {
  defaultHeaders,
  SCRAPER_PRICE_BATCH_SIZE,
} from "@peated/server/constants";
import { logError, logInfo } from "@peated/server/lib/log";
import { emitLegacyBottleObservation } from "@peated/server/scraper/legacyBottleContext";
import {
  beginLegacyPricePagination,
  checkpointLegacyPricePage,
  completeLegacyPricePagination,
  emitLegacyPriceBatch,
} from "@peated/server/scraper/legacyPriceContext";
import { requestLegacyUrl } from "@peated/server/scraper/legacyRequestContext";
import type { ExternalSiteType } from "@peated/server/types";
import { type Category } from "@peated/server/types";
import axios from "axios";
import type { z } from "zod";
import config from "../config";
import type { BottleInputSchema, StorePriceInputSchema } from "../schemas";
import BatchQueue from "./batchQueue";
import { BottleAlreadyExistsError, createBottleAsPeated } from "./createBottle";
import { createStorePricesAsPeated } from "./createStorePrices";
import { buildBottleCreateInput } from "./flatBottleInput";
import { formatBottleName } from "./format";
import { updateBottleAsPeated } from "./updateBottle";
import { updateBottleImageAsPeated } from "./updateBottleImage";

export class PageNotFound extends Error {
  override name = "PageNotFound";
}

export function downloadFileAsBlob(url: string) {
  return fetch(url).then((res) => res.blob());
}

export async function getUrl(
  url: string,
  _noCache = true,
  headers: Record<string, string> = {},
) {
  return await requestUrl(url, { headers });
}

export async function requestUrl(
  url: string,
  {
    method = "GET",
    body,
    headers = {},
    retryable = false,
  }: {
    method?: "GET" | "POST";
    body?: string;
    headers?: Record<string, string>;
    retryable?: boolean;
  } = {},
) {
  const runtimeBody = await requestLegacyUrl(url, {
    method,
    body,
    headers,
    retryable,
  });
  if (runtimeBody !== null) return runtimeBody;
  if (config.ENV !== "test") {
    throw new Error("Scraper HTTP requires an active scraper runtime session.");
  }

  let data = "";
  let status = 0;
  try {
    ({ status, data } = await axios.request({
      url,
      method,
      data: body,
      headers: {
        ...defaultHeaders(url),
        ...headers,
      },
    }));
    if (typeof data !== "string") data = JSON.stringify(data);
  } catch (err: any) {
    status = err?.response?.status;
    if (status !== 404) {
      throw err;
    }
  }

  if (status === 404) throw new PageNotFound(url);
  return data;
}

export function absoluteUrl(url: string, baseUrl: string) {
  if (url.indexOf("https://") === 0) return url;
  const urlParts = new URL(baseUrl);
  return `${urlParts.origin}${url.indexOf("/") !== 0 ? "/" : ""}${url}`;
}

export function removeBottleSize(name: string) {
  return name.replace(/\([^)]+\)$/, "");
}

export function parsePrice(value: string) {
  // $XX.YY
  if (value.indexOf("$") !== 0) {
    return;
  }

  const unit = value.substring(0, 1);
  const price = parseInt(value.substring(1).replaceAll(/[,.]/gi, ""), 10);

  // only working for USD atm
  if (unit === "$" && value.indexOf(".") !== -1) {
    return price;
  }

  return price * 100;
}

export async function chunked<T>(
  items: T[],
  count: number,
  cb: (items: T[]) => Promise<any>,
) {
  const len = items.length;
  let at = 0;
  while (at < len) {
    await cb(items.slice(at, at + count));
    at += count;
  }
}

export type StorePrice = z.infer<typeof StorePriceInputSchema>;

export type BottleReview = {
  name: string;
  category: Category | null;
  rating: number;
  url: string;
  issue: string;
  publishedAt?: Date;
};

export async function handleBottle(
  bottle: z.input<typeof BottleInputSchema>,
  price?: z.input<typeof StorePriceInputSchema> | null,
  imageUrl?: string | null,
  { dryRun = false }: { dryRun?: boolean } = {},
) {
  if (
    !dryRun &&
    (await emitLegacyBottleObservation({ bottle, price, imageUrl }))
  ) {
    return;
  }
  return await persistBottleObservation(bottle, price, imageUrl, { dryRun });
}

export async function persistBottleObservation(
  bottle: z.input<typeof BottleInputSchema>,
  price?: z.input<typeof StorePriceInputSchema> | null,
  imageUrl?: string | null,
  { dryRun = false }: { dryRun?: boolean } = {},
) {
  if (dryRun) {
    logInfo("Dry run bottle {bottleName}", {
      extra: {
        bottleName: formatBottleName(bottle),
      },
    });
    return;
  }

  logInfo("Submitting bottle {bottleName}", {
    extra: { bottleName: formatBottleName(bottle) },
  });

  let createInput: ReturnType<typeof buildBottleCreateInput>;
  createInput = buildBottleCreateInput(bottle);

  let resultBottle;
  try {
    resultBottle = (await createBottleAsPeated(createInput)).bottle;
  } catch (error) {
    if (!(error instanceof BottleAlreadyExistsError)) throw error;
    // An SMWS cask code outlives its mutable subtitle. Reuse its Bottle id;
    // the update boundary makes the new title canonical and retains the old
    // canonical title as an alias.
    resultBottle = (
      await updateBottleAsPeated({
        bottleId: error.bottleId,
        input: createInput,
      })
    ).bottle;
  }

  if (!resultBottle.imageUrl && imageUrl) {
    try {
      const blob = await downloadFileAsBlob(imageUrl);
      await updateBottleImageAsPeated({
        bottleId: resultBottle.id,
        file: blob,
      });
    } catch (error) {
      logError(error, {
        bottle: { id: resultBottle.id, name: resultBottle.fullName },
      });
    }
  }

  if (price) {
    await createStorePricesAsPeated({ site: "smws", prices: [price] });
  }
}

export type ScrapePricesCallback = (product: StorePrice) => Promise<void>;

/** Lets a source own pagination when emitted products are not a reliable signal. */
export type ScrapePricesPageResult = {
  hasSourceProducts?: boolean;
  hasNextPage?: boolean;
};

function getScrapedProductKey(product: StorePrice): string {
  return product.externalProductId
    ? `external:${product.externalProductId}`
    : `url:${product.url}`;
}

export default async function scrapePrices(
  site: ExternalSiteType,
  urlFn: (page: number) => string,
  scrapeProducts: (
    url: string,
    cb: ScrapePricesCallback,
  ) => Promise<ScrapePricesPageResult | void>,
  { dryRun = false }: { dryRun?: boolean } = {},
) {
  const pagination = beginLegacyPricePagination();
  if (pagination?.skip) return 0;
  const workQueue = new BatchQueue<StorePrice>(
    SCRAPER_PRICE_BATCH_SIZE,
    async (prices) => {
      logInfo(dryRun ? "Dry run price batch" : "Persisting price batch", {
        extra: {
          site,
          count: prices.length,
        },
      });
      if (!(await emitLegacyPriceBatch(prices)) && !dryRun) {
        await createStorePricesAsPeated({ site, prices });
      }
    },
  );

  const uniqueProducts = new Set<string>();

  let hasMorePages = true;
  let page = pagination?.startPage ?? 1;
  try {
    while (hasMorePages) {
      let emittedProduct = false;
      const result = await scrapeProducts(urlFn(page), async (product) => {
        logInfo("Scraped product price {name}", {
          extra: {
            name: product.name,
            price: product.price,
            site,
          },
        });
        const productKey = getScrapedProductKey(product);
        if (uniqueProducts.has(productKey)) return;
        await workQueue.push(product);
        uniqueProducts.add(productKey);
        emittedProduct = true;
      });
      hasMorePages =
        result?.hasNextPage ?? result?.hasSourceProducts ?? emittedProduct;
      if (hasMorePages && pagination) {
        await checkpointLegacyPricePage(pagination.sequence, page + 1);
      }
      page += 1;
    }

    if (uniqueProducts.size === 0) {
      throw new Error("Failed to scrape any products.");
    }
  } finally {
    // Full batches persist during pagination, so the same run also owns its remainder.
    await workQueue.processRemaining();
  }

  if (pagination) {
    await completeLegacyPricePagination(pagination.sequence);
  }

  logInfo("Scrape complete", {
    extra: {
      site,
      count: uniqueProducts.size,
    },
  });
  return uniqueProducts.size;
}
