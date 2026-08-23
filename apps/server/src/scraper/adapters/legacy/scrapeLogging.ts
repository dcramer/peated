import { logInfo, logWarn, type LogContext } from "@peated/server/lib/log";

export function logScrapeWarning(
  site: string,
  message: string,
  extra: LogContext = {},
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
