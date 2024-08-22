import { defaultHeaders } from "@peated/server/constants";
import { ApiClient } from "@peated/server/lib/apiClient";
import { logError } from "@peated/server/lib/log";
import { trpcClient } from "@peated/server/lib/trpc/server";
import { isTRPCClientError } from "@peated/server/trpc/client";
import type { Currency } from "@peated/server/types";
import { type Category } from "@peated/server/types";
import axios from "axios";
import { existsSync, mkdirSync, statSync } from "fs";
import { open } from "fs/promises";
import type { z } from "zod";
import config from "../config";
import type { BottleInputSchema, StorePriceInputSchema } from "../schemas";

const CACHE = ".cache";

const CACHE_EXPIRE = 60 * 60 * 18 * 1000;

if (!existsSync(CACHE)) {
  mkdirSync(CACHE);
}

export class PageNotFound extends Error {}

export function downloadFileAsBlob(url: string) {
  return fetch(url).then((res) => res.blob());
}

export async function getUrl(
  url: string,
  noCache = !!process.env.DISABLE_HTTP_CACHE,
  headers: Record<string, string> = {},
) {
  const filename = `${CACHE}/${encodeURIComponent(url)}`;

  let data = "",
    status = 0;
  if (!existsSync(filename) || noCache) {
    console.log(`${url} not cached, fetching from internet`);
    ({ data, status } = await cacheUrl(url, filename, headers));
  } else if (statSync(filename).mtimeMs < new Date().getTime() - CACHE_EXPIRE) {
    console.log(`${url} cache outdated, fetching from internet`);
    ({ data, status } = await cacheUrl(url, filename, headers));
  } else {
    const fs = await open(filename, "r");
    const payload = await fs.readFile();
    ({ data, status } = JSON.parse(payload.toString("utf8")));
    await fs.close();
  }

  if (status === 404) {
    throw new PageNotFound(url);
  }

  return data;
}

export async function cacheUrl(
  url: string,
  filename: string,
  headers: Record<string, string> = {},
) {
  let data = "";
  let status = 0;
  try {
    ({ status, data } = await axios.get(url, {
      headers: {
        ...defaultHeaders(url),
        ...headers,
      },
    }));
    // gross
    if (typeof data !== "string") data = JSON.stringify(data);
  } catch (err: any) {
    status = err?.response?.status;
    if (status !== 404) {
      throw err;
    }
  }

  const fs = await open(filename, "w");
  await fs.writeFile(
    JSON.stringify({
      status,
      data: data.toString(),
    }),
  );
  await fs.close();

  return { data, status };
}

// TODO: move this function
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

export type StorePrice = {
  name: string;
  price: number;
  currency: Currency;
  url: string;
  volume: number;
};

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
) {
  const apiClient = new ApiClient({
    server: config.API_SERVER,
    accessToken: process.env.ACCESS_TOKEN,
  });

  if (process.env.ACCESS_TOKEN) {
    console.log(`Submitting [${bottle.name}]`);

    let bottleResult;
    try {
      bottleResult = await trpcClient.bottleUpsert.mutate(bottle);
    } catch (err) {
      if (!isTRPCClientError(err) || (err as any).data?.httpStatus !== 409) {
        logError(err, { bottle });
        return;
      }
    }

    if (bottleResult && !bottleResult.imageUrl && imageUrl) {
      try {
        const blob = await downloadFileAsBlob(imageUrl);
        await apiClient.post(`/bottles/${bottleResult.id}/image`, {
          data: {
            image: blob,
          },
        });
      } catch (err) {
        logError(err, { bottle });
      }
    }

    if (price) {
      try {
        await trpcClient.priceCreateBatch.mutate({
          site: "smws",
          prices: [price],
        });
      } catch (err) {
        if (!isTRPCClientError(err) || (err as any).data?.httpStatus !== 409) {
          logError(err, { bottle, price });
        }
      }
    }
  } else {
    console.log(`Dry Run [${bottle.name}]`);
  }
}
