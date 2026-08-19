import { logInfo, logWarn } from "@peated/server/lib/log";

export function logScrapeWarning(
  site: string,
  message: string,
  extra: Record<string, unknown> = {},
) {
  logWarn(message, {
    extra: {
      site,
      ...extra,
    },
  });
}

export function logScrapedProduct(
  site: string,
  product: {
    name: string;
    price: number;
  },
) {
  logInfo("Scraped product price {name}", {
    extra: {
      site,
      name: product.name,
      price: product.price,
    },
  });
}
