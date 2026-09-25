import { ShopifyCatalogSchema } from "../adapters/shopify";
import type { JsonValue } from "../types";
import type {
  ScrapePricesCallback,
  ScrapePricesPageResult,
  StorePrice,
} from "./scraper";
import { getUrl } from "./scraper";

/** A non-empty source page advances pagination even if every listing is filtered. */
export async function scrapeShopifyProducts(
  url: string,
  cb: ScrapePricesCallback,
  parseProducts: (input: JsonValue, sourceUrl: string) => StorePrice[],
): Promise<ScrapePricesPageResult> {
  const data = await getUrl(url);
  const catalog = ShopifyCatalogSchema.parse(JSON.parse(data));
  const products = parseProducts(catalog, url);
  await Promise.all(products.map(cb));

  return { hasSourceProducts: catalog.products.length > 0 };
}
